import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/libs/supabase/server';
import { QueryTemplate, SuggestionCategory } from '@/types/suggestions';
import { z } from 'zod';

// Request validation schemas
const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  nameArabic: z.string().min(1).max(200),
  template: z.string().min(10).max(2000),
  templateArabic: z.string().min(10).max(2000),
  category: z.enum([
    'labor_law', 'employment', 'compensation', 'benefits', 'disciplinary',
    'termination', 'compliance', 'contracts', 'policies', 'training',
    'performance', 'leaves', 'recruitment', 'general'
  ]),
  description: z.string().min(10).max(500),
  descriptionArabic: z.string().min(10).max(500),
  variables: z.array(z.object({
    name: z.string(),
    nameArabic: z.string(),
    type: z.enum(['text', 'number', 'date', 'select', 'multiselect']),
    required: z.boolean(),
    description: z.string(),
    descriptionArabic: z.string(),
    options: z.array(z.object({
      value: z.string(),
      label: z.string(),
      labelArabic: z.string()
    })).optional(),
    validation: z.object({
      pattern: z.string().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      required: z.boolean().optional(),
      custom: z.string().optional()
    }).optional()
  })).default([]),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  examples: z.array(z.object({
    scenario: z.string(),
    scenarioArabic: z.string(),
    values: z.record(z.any()),
    expectedResult: z.string(),
    expectedResultArabic: z.string()
  })).default([])
});

const UpdateTemplateSchema = CreateTemplateSchema.partial();

const GetTemplatesSchema = z.object({
  category: z.enum([
    'labor_law', 'employment', 'compensation', 'benefits', 'disciplinary',
    'termination', 'compliance', 'contracts', 'policies', 'training',
    'performance', 'leaves', 'recruitment', 'general'
  ]).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  sortBy: z.enum(['name', 'created_at', 'usage_count', 'rating']).default('usage_count'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includePublic: z.boolean().default(true),
  language: z.enum(['ar', 'en', 'both']).default('both')
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Authentication
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required',
            messageArabic: 'مطلوب المصادقة' 
          } 
        },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'PROFILE_NOT_FOUND', 
            message: 'User profile not found',
            messageArabic: 'لم يتم العثور على الملف الشخصي للمستخدم' 
          } 
        },
        { status: 404 }
      );
    }

    // Parse and validate query parameters
    const queryParams = {
      category: searchParams.get('category') as SuggestionCategory | undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean),
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: (searchParams.get('sortBy') || 'usage_count') as 'name' | 'created_at' | 'usage_count' | 'rating',
      sortOrder: (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc',
      includePublic: searchParams.get('includePublic') !== 'false',
      language: (searchParams.get('language') || 'both') as 'ar' | 'en' | 'both'
    };

    const validatedParams = GetTemplatesSchema.parse(queryParams);

    // Build query
    let query = supabase
      .from('query_templates')
      .select(`
        *,
        creator:profiles!created_by(id, full_name),
        template_usage:query_template_usage(count)
      `);

    // Filter by organization (user's templates) or public templates
    if (validatedParams.includePublic) {
      query = query.or(`organization_id.eq.${profile.organization_id},is_public.eq.true`);
    } else {
      query = query.eq('organization_id', profile.organization_id);
    }

    // Apply filters
    if (validatedParams.category) {
      query = query.eq('category', validatedParams.category);
    }

    if (validatedParams.search) {
      query = query.or(`name.ilike.%${validatedParams.search}%,name_arabic.ilike.%${validatedParams.search}%,description.ilike.%${validatedParams.search}%`);
    }

    if (validatedParams.tags && validatedParams.tags.length > 0) {
      query = query.contains('tags', validatedParams.tags);
    }

    // Apply sorting
    const sortColumn = validatedParams.sortBy === 'usage_count' ? 'usage_count' : validatedParams.sortBy;
    query = query.order(sortColumn, { ascending: validatedParams.sortOrder === 'asc' });

    // Apply pagination
    query = query.range(validatedParams.offset, validatedParams.offset + validatedParams.limit - 1);

    const { data: templates, error: queryError } = await query;

    if (queryError) {
      console.error('Templates query error:', queryError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message: 'Failed to fetch templates',
            messageArabic: 'فشل في جلب القوالب'
          }
        },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('query_templates')
      .select('id', { count: 'exact', head: true });

    if (validatedParams.includePublic) {
      countQuery = countQuery.or(`organization_id.eq.${profile.organization_id},is_public.eq.true`);
    } else {
      countQuery = countQuery.eq('organization_id', profile.organization_id);
    }

    const { count: totalCount } = await countQuery;

    // Format response
    const formattedTemplates: QueryTemplate[] = (templates || []).map(template => ({
      id: template.id,
      name: template.name,
      nameArabic: template.name_arabic,
      template: template.template,
      templateArabic: template.template_arabic,
      category: template.category as SuggestionCategory,
      variables: template.variables || [],
      description: template.description,
      descriptionArabic: template.description_arabic,
      usageCount: template.usage_count || 0,
      rating: template.rating || 0,
      createdBy: template.created_by,
      organizationId: template.organization_id,
      isPublic: template.is_public,
      tags: template.tags || [],
      examples: template.examples || [],
      createdAt: template.created_at,
      updatedAt: template.updated_at
    }));

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'templates',
      query: 'fetch_templates',
      language: validatedParams.language,
      suggestions_count: formattedTemplates.length,
      category: validatedParams.category,
      search_query: validatedParams.search,
      method: 'GET',
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data: {
        templates: formattedTemplates,
        pagination: {
          limit: validatedParams.limit,
          offset: validatedParams.offset,
          total: totalCount || 0,
          hasMore: (validatedParams.offset + validatedParams.limit) < (totalCount || 0)
        },
        filters: validatedParams
      }
    });

  } catch (error) {
    console.error('Get templates API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid query parameters',
            messageArabic: 'معاملات الاستعلام غير صالحة',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch templates',
          messageArabic: 'فشل في جلب القوالب'
        }
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required',
            messageArabic: 'مطلوب المصادقة' 
          } 
        },
        { status: 401 }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'PROFILE_NOT_FOUND', 
            message: 'User profile not found',
            messageArabic: 'لم يتم العثور على الملف الشخصي للمستخدم' 
          } 
        },
        { status: 404 }
      );
    }

    // Parse and validate request
    const rawBody = await request.json();
    const validatedData = CreateTemplateSchema.parse(rawBody);

    // Create template
    const templateData = {
      ...validatedData,
      name_arabic: validatedData.nameArabic,
      template_arabic: validatedData.templateArabic,
      description_arabic: validatedData.descriptionArabic,
      organization_id: profile.organization_id,
      created_by: user.id,
      is_public: validatedData.isPublic,
      usage_count: 0,
      rating: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: template, error: insertError } = await supabase
      .from('query_templates')
      .insert(templateData)
      .select()
      .single();

    if (insertError) {
      console.error('Template creation error:', insertError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CREATION_ERROR',
            message: 'Failed to create template',
            messageArabic: 'فشل في إنشاء القالب',
            details: insertError
          }
        },
        { status: 500 }
      );
    }

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: profile.organization_id,
      suggestion_type: 'templates',
      query: 'create_template',
      category: validatedData.category,
      metadata: {
        template_id: template.id,
        is_public: validatedData.isPublic,
        variables_count: validatedData.variables.length
      },
      method: 'POST',
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data: {
        template: {
          id: template.id,
          name: template.name,
          nameArabic: template.name_arabic,
          template: template.template,
          templateArabic: template.template_arabic,
          category: template.category,
          variables: template.variables,
          description: template.description,
          descriptionArabic: template.description_arabic,
          usageCount: 0,
          rating: 0,
          createdBy: user.id,
          organizationId: profile.organization_id,
          isPublic: template.is_public,
          tags: template.tags,
          examples: template.examples,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        }
      },
      message: 'Template created successfully',
      messageArabic: 'تم إنشاء القالب بنجاح'
    });

  } catch (error) {
    console.error('Create template API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid template data',
            messageArabic: 'بيانات القالب غير صالحة',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create template',
          messageArabic: 'فشل في إنشاء القالب'
        }
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_ID',
            message: 'Template ID is required',
            messageArabic: 'معرف القالب مطلوب'
          }
        },
        { status: 400 }
      );
    }

    // Authentication
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required',
            messageArabic: 'مطلوب المصادقة' 
          } 
        },
        { status: 401 }
      );
    }

    // Check template ownership
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('query_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Template not found',
            messageArabic: 'لم يتم العثور على القالب'
          }
        },
        { status: 404 }
      );
    }

    if (existingTemplate.created_by !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only edit your own templates',
            messageArabic: 'يمكنك تعديل قوالبك فقط'
          }
        },
        { status: 403 }
      );
    }

    // Parse and validate update data
    const rawBody = await request.json();
    const validatedData = UpdateTemplateSchema.parse(rawBody);

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (validatedData.name) updateData.name = validatedData.name;
    if (validatedData.nameArabic) updateData.name_arabic = validatedData.nameArabic;
    if (validatedData.template) updateData.template = validatedData.template;
    if (validatedData.templateArabic) updateData.template_arabic = validatedData.templateArabic;
    if (validatedData.category) updateData.category = validatedData.category;
    if (validatedData.description) updateData.description = validatedData.description;
    if (validatedData.descriptionArabic) updateData.description_arabic = validatedData.descriptionArabic;
    if (validatedData.variables) updateData.variables = validatedData.variables;
    if (validatedData.tags) updateData.tags = validatedData.tags;
    if (validatedData.examples) updateData.examples = validatedData.examples;
    if (typeof validatedData.isPublic !== 'undefined') updateData.is_public = validatedData.isPublic;

    // Update template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('query_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single();

    if (updateError) {
      console.error('Template update error:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UPDATE_ERROR',
            message: 'Failed to update template',
            messageArabic: 'فشل في تحديث القالب'
          }
        },
        { status: 500 }
      );
    }

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: existingTemplate.organization_id,
      suggestion_type: 'templates',
      query: 'update_template',
      metadata: {
        template_id: templateId,
        updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at')
      },
      method: 'PUT',
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      data: {
        template: {
          id: updatedTemplate.id,
          name: updatedTemplate.name,
          nameArabic: updatedTemplate.name_arabic,
          template: updatedTemplate.template,
          templateArabic: updatedTemplate.template_arabic,
          category: updatedTemplate.category,
          variables: updatedTemplate.variables,
          description: updatedTemplate.description,
          descriptionArabic: updatedTemplate.description_arabic,
          usageCount: updatedTemplate.usage_count,
          rating: updatedTemplate.rating,
          createdBy: updatedTemplate.created_by,
          organizationId: updatedTemplate.organization_id,
          isPublic: updatedTemplate.is_public,
          tags: updatedTemplate.tags,
          examples: updatedTemplate.examples,
          createdAt: updatedTemplate.created_at,
          updatedAt: updatedTemplate.updated_at
        }
      },
      message: 'Template updated successfully',
      messageArabic: 'تم تحديث القالب بنجاح'
    });

  } catch (error) {
    console.error('Update template API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid update data',
            messageArabic: 'بيانات التحديث غير صالحة',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update template',
          messageArabic: 'فشل في تحديث القالب'
        }
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_ID',
            message: 'Template ID is required',
            messageArabic: 'معرف القالب مطلوب'
          }
        },
        { status: 400 }
      );
    }

    // Authentication
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required',
            messageArabic: 'مطلوب المصادقة' 
          } 
        },
        { status: 401 }
      );
    }

    // Check template ownership
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('query_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchError || !existingTemplate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Template not found',
            messageArabic: 'لم يتم العثور على القالب'
          }
        },
        { status: 404 }
      );
    }

    if (existingTemplate.created_by !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You can only delete your own templates',
            messageArabic: 'يمكنك حذف قوالبك فقط'
          }
        },
        { status: 403 }
      );
    }

    // Delete template
    const { error: deleteError } = await supabase
      .from('query_templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) {
      console.error('Template deletion error:', deleteError);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DELETION_ERROR',
            message: 'Failed to delete template',
            messageArabic: 'فشل في حذف القالب'
          }
        },
        { status: 500 }
      );
    }

    // Log analytics
    await supabase.from('suggestion_analytics').insert({
      user_id: user.id,
      organization_id: existingTemplate.organization_id,
      suggestion_type: 'templates',
      query: 'delete_template',
      metadata: {
        template_id: templateId,
        template_name: existingTemplate.name
      },
      method: 'DELETE',
      created_at: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
      messageArabic: 'تم حذف القالب بنجاح'
    });

  } catch (error) {
    console.error('Delete template API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete template',
          messageArabic: 'فشل في حذف القالب'
        }
      },
      { status: 500 }
    );
  }
}