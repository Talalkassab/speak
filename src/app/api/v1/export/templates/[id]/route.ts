/**
 * Individual Export Template API Route
 * GET /api/v1/export/templates/[id] - Get specific template
 * PUT /api/v1/export/templates/[id] - Update template
 * DELETE /api/v1/export/templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/libs/supabase/types'
import { auditLogger } from '@/libs/logging/audit-logger'

interface UpdateTemplateRequest {
  name?: string
  description?: string
  templateData?: Record<string, any>
  cssStyles?: string
  htmlTemplate?: string
  isActive?: boolean
  isDefault?: boolean
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const templateId = params.id
    const organizationId = memberData.organization_id

    // Get template
    const { data: template, error: templateError } = await supabase
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
        parent_template_id,
        created_at,
        updated_at,
        created_by,
        users!export_templates_created_by_fkey(full_name, email)
      `)
      .eq('id', templateId)
      .eq('organization_id', organizationId)
      .single()

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Get template usage statistics
    const { data: usageStats } = await supabase
      .rpc('get_template_usage_stats', { 
        org_id: organizationId,
        template_ids: [templateId]
      })

    // Get version history if this is a versioned template
    const { data: versionHistory } = await supabase
      .from('export_templates')
      .select('id, version, updated_at, users!export_templates_created_by_fkey(full_name)')
      .eq('organization_id', organizationId)
      .or(`id.eq.${templateId},parent_template_id.eq.${templateId}`)
      .order('version', { ascending: false })

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
        parentTemplateId: template.parent_template_id,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        createdBy: template.users,
        usageStats: usageStats?.[0] || null,
        versionHistory: versionHistory || []
      }
    })

  } catch (error) {
    console.error('Get template error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check permissions
    if (!['owner', 'admin', 'hr_manager'].includes(memberData.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to update export templates' 
      }, { status: 403 })
    }

    const templateId = params.id
    const organizationId = memberData.organization_id
    const body: UpdateTemplateRequest = await request.json()

    // Get existing template
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('export_templates')
      .select('*')
      .eq('id', templateId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Prevent modification of system templates
    if (existingTemplate.is_system) {
      return NextResponse.json({ 
        error: 'System templates cannot be modified' 
      }, { status: 400 })
    }

    // Validate name uniqueness if changing name
    if (body.name && body.name !== existingTemplate.name) {
      const { data: duplicateTemplate } = await supabase
        .from('export_templates')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('name', body.name.trim())
        .eq('template_type', existingTemplate.template_type)
        .neq('id', templateId)
        .single()

      if (duplicateTemplate) {
        return NextResponse.json({ 
          error: `Template with name "${body.name}" already exists for ${existingTemplate.template_type} format` 
        }, { status: 400 })
      }
    }

    // Validate template data if provided
    if (body.templateData) {
      const validationResult = validateTemplateData(existingTemplate.template_type, body.templateData)
      if (!validationResult.isValid) {
        return NextResponse.json({ 
          error: `Invalid template data: ${validationResult.errors.join(', ')}` 
        }, { status: 400 })
      }
    }

    // If setting as default, unset current default
    if (body.isDefault && !existingTemplate.is_default) {
      await supabase
        .from('export_templates')
        .update({ is_default: false })
        .eq('organization_id', organizationId)
        .eq('template_type', existingTemplate.template_type)
        .eq('is_default', true)
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.description !== undefined) updateData.description = body.description?.trim()
    if (body.templateData !== undefined) updateData.template_data = body.templateData
    if (body.cssStyles !== undefined) updateData.css_styles = body.cssStyles
    if (body.htmlTemplate !== undefined) updateData.html_template = body.htmlTemplate
    if (body.isActive !== undefined) updateData.is_active = body.isActive
    if (body.isDefault !== undefined) updateData.is_default = body.isDefault

    // Check if this is a major change that should create a new version
    const isMajorChange = body.templateData !== undefined || body.htmlTemplate !== undefined
    
    if (isMajorChange) {
      // Create new version
      updateData.version = existingTemplate.version + 1
      updateData.parent_template_id = existingTemplate.parent_template_id || existingTemplate.id
    }

    // Update template
    const { data: updatedTemplate, error: updateError } = await supabase
      .from('export_templates')
      .update(updateData)
      .eq('id', templateId)
      .select()
      .single()

    if (updateError) {
      console.error('Update template error:', updateError)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    // Log template update
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      'update_export_template',
      'export_template',
      templateId,
      {
        template_name: updatedTemplate.name,
        template_type: updatedTemplate.template_type,
        changes: Object.keys(updateData),
        new_version: isMajorChange ? updatedTemplate.version : undefined
      }
    )

    return NextResponse.json({
      success: true,
      template: {
        id: updatedTemplate.id,
        name: updatedTemplate.name,
        description: updatedTemplate.description,
        templateType: updatedTemplate.template_type,
        templateData: updatedTemplate.template_data,
        cssStyles: updatedTemplate.css_styles,
        htmlTemplate: updatedTemplate.html_template,
        isActive: updatedTemplate.is_active,
        isDefault: updatedTemplate.is_default,
        isSystem: updatedTemplate.is_system,
        version: updatedTemplate.version,
        updatedAt: updatedTemplate.updated_at
      }
    })

  } catch (error) {
    console.error('Update template error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check permissions
    if (!['owner', 'admin', 'hr_manager'].includes(memberData.role)) {
      return NextResponse.json({ 
        error: 'Insufficient permissions to delete export templates' 
      }, { status: 403 })
    }

    const templateId = params.id
    const organizationId = memberData.organization_id

    // Get template to check if it can be deleted
    const { data: template, error: fetchError } = await supabase
      .from('export_templates')
      .select('*')
      .eq('id', templateId)
      .eq('organization_id', organizationId)
      .single()

    if (fetchError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Prevent deletion of system templates
    if (template.is_system) {
      return NextResponse.json({ 
        error: 'System templates cannot be deleted' 
      }, { status: 400 })
    }

    // Check if template is in use
    const { data: usageStats } = await supabase
      .rpc('get_template_usage_stats', { 
        org_id: organizationId,
        template_ids: [templateId]
      })

    const isInUse = usageStats?.[0]?.total_usage > 0
    
    if (isInUse) {
      // Don't delete if in use, just deactivate
      const { error: deactivateError } = await supabase
        .from('export_templates')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', templateId)

      if (deactivateError) {
        return NextResponse.json({ error: 'Failed to deactivate template' }, { status: 500 })
      }

      await auditLogger.logUserActivity(
        user.id,
        organizationId,
        'deactivate_export_template',
        'export_template',
        templateId,
        {
          template_name: template.name,
          template_type: template.template_type,
          reason: 'Template in use, deactivated instead of deleted'
        }
      )

      return NextResponse.json({
        success: true,
        message: 'Template deactivated (was in use, cannot delete)',
        action: 'deactivated'
      })
    }

    // If it's a default template, set another template as default
    if (template.is_default) {
      const { data: alternativeTemplate } = await supabase
        .from('export_templates')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('template_type', template.template_type)
        .eq('is_active', true)
        .neq('id', templateId)
        .order('is_system', { ascending: false })
        .limit(1)
        .single()

      if (alternativeTemplate) {
        await supabase
          .from('export_templates')
          .update({ is_default: true })
          .eq('id', alternativeTemplate.id)
      }
    }

    // Delete the template
    const { error: deleteError } = await supabase
      .from('export_templates')
      .delete()
      .eq('id', templateId)

    if (deleteError) {
      console.error('Delete template error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    // Log template deletion
    await auditLogger.logUserActivity(
      user.id,
      organizationId,
      'delete_export_template',
      'export_template',
      templateId,
      {
        template_name: template.name,
        template_type: template.template_type,
        was_default: template.is_default
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
      action: 'deleted'
    })

  } catch (error) {
    console.error('Delete template error:', error)
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