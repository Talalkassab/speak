/**
 * Export Templates API Route
 * GET /api/v1/export/templates - List export templates
 * POST /api/v1/export/templates - Create new export template
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/libs/supabase/types'
import { auditLogger } from '@/libs/logging/audit-logger'

interface CreateTemplateRequest {
  name: string
  description?: string
  templateType: 'pdf' | 'docx' | 'html' | 'email'
  templateData: Record<string, any>
  cssStyles?: string
  htmlTemplate?: string
  isDefault?: boolean
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 })
    }

    const organizationId = memberData.organization_id
    const { searchParams } = new URL(request.url)
    
    // Get query parameters
    const templateType = searchParams.get('type')
    const isActive = searchParams.get('active')
    const includeSystem = searchParams.get('includeSystem') === 'true'

    // Build query
    let query = supabase
      .from('export_templates')
      .select(`
        id,
        name,
        description,
        template_type,
        template_data,
        css_styles,
        html_template,
        is_active,
        is_default,
        is_system,
        version,
        created_at,
        updated_at,
        created_by,
        users!export_templates_created_by_fkey(full_name, email)
      `)
      .eq('organization_id', organizationId)
      .order('is_system', { ascending: false })
      .order('is_default', { ascending: false })
      .order('name')

    // Apply filters
    if (templateType) {
      query = query.eq('template_type', templateType)
    }
    
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    if (!includeSystem) {
      query = query.eq('is_system', false)
    }

    const { data: templates, error: fetchError } = await query

    if (fetchError) {
      console.error('Fetch templates error:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    // Get template usage statistics
    const templateIds = templates?.map(t => t.id) || []
    const { data: usageStats } = await supabase
      .rpc('get_template_usage_stats', { 
        org_id: organizationId,
        template_ids: templateIds
      })

    // Combine templates with usage stats
    const templatesWithStats = (templates || []).map(template => {
      const stats = usageStats?.find((s: any) => s.template_id === template.id)
      
      return {
        id: template.id,
        name: template.name,
        description: template.description,
        templateType: template.template_type,
        templateData: template.template_data,
        cssStyles: template.css_styles,
        htmlTemplate: template.html_template,
        isActive: template.is_active,
        isDefault: template.is_default,
        isSystem: template.is_system,
        version: template.version,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        createdBy: template.users,
        usageStats: stats ? {
          totalUsage: stats.total_usage,
          lastUsed: stats.last_used,
          popularityScore: stats.popularity_score
        } : null
      }
    })

    return NextResponse.json({
      success: true,
      templates: templatesWithStats,
      summary: {
        total: templatesWithStats.length,
        byType: templatesWithStats.reduce((acc, t) => {
          acc[t.templateType] = (acc[t.templateType] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        active: templatesWithStats.filter(t => t.isActive).length,
        system: templatesWithStats.filter(t => t.isSystem).length,
        custom: templatesWithStats.filter(t => !t.isSystem).length
      }
    })

  } catch (error) {
    console.error('Get templates error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization and role
    const { data: memberData, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'No active organization found' }, { status: 403 })
    }

    // Check permissions for template creation
    if (!['owner', 'admin', 'hr_manager'].includes(memberData.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to create export templates' 
      }, { status: 403 })
    }

    const organizationId = memberData.organization_id
    const body: CreateTemplateRequest = await request.json()

    // Validate request
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    if (!['pdf', 'docx', 'html', 'email'].includes(body.templateType)) {
      return NextResponse.json({ error: 'Invalid template type' }, { status: 400 })
    }

    if (!body.templateData || typeof body.templateData !== 'object') {
      return NextResponse.json({ error: 'Template data is required' }, { status: 400 })
    }

    // Check for name uniqueness within organization and type
    const { data: existingTemplate } = await supabase
      .from('export_templates')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', body.name.trim())
      .eq('template_type', body.templateType)
      .single()

    if (existingTemplate) {
      return NextResponse.json({ 
        error: `Template with name "${body.name}" already exists for ${body.templateType} format` 
      }, { status: 400 })
    }

    // Validate template data based on type
    const validationResult = validateTemplateData(body.templateType, body.templateData)
    if (!validationResult.isValid) {
      return NextResponse.json({ 
        error: `Invalid template data: ${validationResult.errors.join(', ')}` 
      }, { status: 400 })
    }

    // If setting as default, unset current default
    if (body.isDefault) {
      await supabase
        .from('export_templates')
        .update({ is_default: false })
        .eq('organization_id', organizationId)
        .eq('template_type', body.templateType)
        .eq('is_default', true)
    }

    // Create template
    const { data: template, error: createError } = await supabase
      .from('export_templates')
      .insert({
        organization_id: organizationId,
        created_by: user.id,
        name: body.name.trim(),
        description: body.description?.trim(),
        template_type: body.templateType,
        template_data: body.templateData,
        css_styles: body.cssStyles,
        html_template: body.htmlTemplate,
        is_default: body.isDefault || false,
        is_active: true,
        is_system: false
      })
      .select()
      .single()

    if (createError) {
      console.error('Create template error:', createError)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    // Log template creation
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      'create_export_template',
      'export_template',
      template.id,
      {
        template_name: body.name,
        template_type: body.templateType,
        is_default: body.isDefault
      }
    )

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        templateType: template.template_type,
        templateData: template.template_data,
        cssStyles: template.css_styles,
        htmlTemplate: template.html_template,
        isActive: template.is_active,
        isDefault: template.is_default,
        isSystem: template.is_system,
        version: template.version,
        createdAt: template.created_at
      }
    })

  } catch (error) {
    console.error('Create template error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Validate template data based on template type
 */
function validateTemplateData(
  templateType: string, 
  templateData: Record<string, any>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  switch (templateType) {
    case 'pdf':
      if (!templateData.layout || !['standard', 'legal', 'executive', 'compliance'].includes(templateData.layout)) {
        errors.push('PDF template must have a valid layout')
      }
      if (templateData.font_size && (templateData.font_size < 8 || templateData.font_size > 24)) {
        errors.push('Font size must be between 8 and 24')
      }
      break

    case 'docx':
      if (!templateData.document_type || !['standard', 'legal', 'report'].includes(templateData.document_type)) {
        errors.push('DOCX template must have a valid document type')
      }
      break

    case 'html':
      if (templateData.theme && !['light', 'dark', 'auto'].includes(templateData.theme)) {
        errors.push('HTML template theme must be light, dark, or auto')
      }
      if (templateData.include_search !== undefined && typeof templateData.include_search !== 'boolean') {
        errors.push('include_search must be a boolean value')
      }
      break

    case 'email':
      if (!templateData.subject_template || templateData.subject_template.trim().length === 0) {
        errors.push('Email template must have a subject template')
      }
      if (!templateData.body_template || templateData.body_template.trim().length === 0) {
        errors.push('Email template must have a body template')
      }
      break

    default:
      errors.push('Invalid template type')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}