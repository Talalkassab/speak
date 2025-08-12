import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserContext, checkUsageLimits, logUserActivity, updateUsageStats, AuthError, hasRole } from '@/libs/auth/auth-middleware';
import TemplateManagementService from '@/libs/services/template-management-service';

// Schema for category creation/updates
const categorySchema = z.object({
  code: z.string().min(1).max(100).regex(/^[A-Z_]+$/, 'Code must be uppercase with underscores only'),
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  descriptionAr: z.string().max(500).optional(),
  descriptionEn: z.string().max(500).optional(),
  iconName: z.string().max(100).optional(),
  colorHex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be valid hex code').default('#3B82F6'),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true)
});

const listCategoriesSchema = z.object({
  language: z.enum(['ar', 'en']).default('ar'),
  includeInactive: z.boolean().default(false),
  includeStats: z.boolean().default(false)
});

interface APIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

function createErrorResponse(code: string, message: string, status: number = 400, details?: any): NextResponse {
  const error: APIError = {
    code,
    message,
    details,
    timestamp: new Date()
  };
  
  console.error('API Error:', error);
  return NextResponse.json({ error }, { status });
}

function createSuccessResponse<T>(data: T, status: number = 200, metadata?: any): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    metadata,
    timestamp: new Date()
  }, { status });
}

// GET /api/v1/templates/categories - List template categories
export async function GET(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check usage limits
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'api_call');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `API call limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      language: searchParams.get('language') || 'ar',
      includeInactive: searchParams.get('includeInactive') === 'true',
      includeStats: searchParams.get('includeStats') === 'true'
    };
    
    const { language, includeInactive, includeStats } = listCategoriesSchema.parse(queryParams);

    const templateService = new TemplateManagementService();
    const categories = await templateService.getTemplateCategories(language);

    // Filter active/inactive based on request
    const filteredCategories = includeInactive 
      ? categories 
      : categories.filter(cat => cat.isActive);

    // Format categories for response
    const formattedCategories = filteredCategories.map(category => ({
      id: category.id,
      code: category.code,
      name: language === 'ar' ? category.nameAr : category.nameEn,
      nameAr: category.nameAr,
      nameEn: category.nameEn,
      description: language === 'ar' ? category.descriptionAr : category.descriptionEn,
      descriptionAr: category.descriptionAr,
      descriptionEn: category.descriptionEn,
      iconName: category.iconName,
      colorHex: category.colorHex,
      sortOrder: category.sortOrder,
      isActive: category.isActive
    }));

    let responseData = {
      categories: formattedCategories,
      totalCount: formattedCategories.length,
      language
    };

    // Add statistics if requested
    if (includeStats) {
      // This would get template counts per category from the database
      const categoryStats = await getCategoryStatistics(userContext.organizationId);
      
      responseData = {
        ...responseData,
        statistics: categoryStats
      };
    }

    // Log activity
    await logUserActivity(
      userContext,
      'template_categories_listed',
      'template_category',
      undefined,
      { 
        language,
        includeStats,
        categoriesCount: formattedCategories.length 
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(responseData, 200, {
      cached: false,
      availableLanguages: ['ar', 'en']
    });

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid query parameters', 400, error.errors);
    }

    console.error('Unexpected error listing template categories:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// POST /api/v1/templates/categories - Create new template category (Admin only)
export async function POST(request: NextRequest) {
  try {
    // Authenticate and get user context
    const userContext = await getUserContext(request);
    
    // Check role permissions for category creation (system admin only)
    if (!hasRole(userContext, ['system_admin'])) {
      return createErrorResponse(
        'INSUFFICIENT_PERMISSIONS',
        'Only system administrators can create template categories',
        403
      );
    }

    // Check usage limits
    const usageCheck = await checkUsageLimits(userContext.organizationId, 'api_call');
    if (!usageCheck.allowed) {
      return createErrorResponse(
        'QUOTA_EXCEEDED',
        `API call limit exceeded (${usageCheck.current}/${usageCheck.limit})`,
        429,
        { resetDate: usageCheck.resetDate }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const categoryData = categorySchema.parse(body);

    // Create category using direct database access (since it's system-level)
    const createdCategory = await createTemplateCategory(categoryData);

    // Log activity
    await logUserActivity(
      userContext,
      'template_category_created',
      'template_category',
      createdCategory.id,
      { 
        categoryCode: categoryData.code,
        categoryName: categoryData.nameEn 
      },
      request
    );

    // Update usage stats
    await updateUsageStats(userContext.organizationId, { api_calls: 1 });

    return createSuccessResponse(createdCategory, 201);

  } catch (error) {
    if (error instanceof AuthError) {
      return createErrorResponse(error.code, error.message, error.statusCode);
    }
    
    if (error instanceof z.ZodError) {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid request data', 400, error.errors);
    }

    if (error instanceof Error && error.message.includes('duplicate key value')) {
      return createErrorResponse('DUPLICATE_CATEGORY', 'Category code already exists', 409);
    }

    console.error('Unexpected error creating template category:', error);
    return createErrorResponse('INTERNAL_ERROR', 'Internal server error', 500);
  }
}

// Helper function to get category statistics
async function getCategoryStatistics(organizationId: string) {
  const { createSupabaseServerClient } = require('@/libs/supabase/supabase-server-client');
  const supabase = await createSupabaseServerClient();
  
  try {
    // Get template count per category for the organization
    const { data: orgTemplates, error: orgError } = await supabase
      .from('hr_templates')
      .select('category')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    // Get system template count per category
    const { data: systemTemplates, error: systemError } = await supabase
      .from('hr_templates')
      .select('category')
      .is('organization_id', null)
      .eq('is_active', true);

    if (orgError || systemError) {
      console.error('Error getting category statistics:', orgError || systemError);
      return {};
    }

    // Combine and count templates per category
    const allTemplates = [...(orgTemplates || []), ...(systemTemplates || [])];
    const categoryStats = allTemplates.reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get usage statistics from template_usage_history
    const { data: usageData, error: usageError } = await supabase
      .from('template_usage_history')
      .select(`
        template_id,
        hr_templates!inner(category)
      `)
      .eq('organization_id', organizationId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    if (!usageError && usageData) {
      const usageStats = usageData.reduce((acc, usage) => {
        const category = usage.hr_templates.category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        templateCount: categoryStats,
        usageCount30Days: usageStats,
        totalTemplates: allTemplates.length,
        totalUsage30Days: usageData.length
      };
    }

    return {
      templateCount: categoryStats,
      totalTemplates: allTemplates.length
    };

  } catch (error) {
    console.error('Error calculating category statistics:', error);
    return {};
  }
}

// Helper function to create template category
async function createTemplateCategory(categoryData: any) {
  const { createSupabaseServerClient } = require('@/libs/supabase/supabase-server-client');
  const supabase = await createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase
      .from('template_categories')
      .insert({
        code: categoryData.code,
        name_ar: categoryData.nameAr,
        name_en: categoryData.nameEn,
        description_ar: categoryData.descriptionAr,
        description_en: categoryData.descriptionEn,
        icon_name: categoryData.iconName,
        color_hex: categoryData.colorHex,
        sort_order: categoryData.sortOrder,
        is_active: categoryData.isActive
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return {
      id: data.id,
      code: data.code,
      nameAr: data.name_ar,
      nameEn: data.name_en,
      descriptionAr: data.description_ar,
      descriptionEn: data.description_en,
      iconName: data.icon_name,
      colorHex: data.color_hex,
      sortOrder: data.sort_order,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };

  } catch (error) {
    console.error('Error creating template category:', error);
    throw error;
  }
}