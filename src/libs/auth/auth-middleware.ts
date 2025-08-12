import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';

export interface UserContext {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string[];
  email: string;
  name?: string;
}

export interface OrganizationContext {
  id: string;
  name: string;
  slug: string;
  subscriptionTier: string;
  maxUsers: number;
  maxDocuments: number;
  maxStorageGb: number;
  language: string;
  timezone: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Extract and validate user context from request
 */
export async function getUserContext(request: Request): Promise<UserContext> {
  const supabase = await createSupabaseServerClient();
  
  // Get authenticated user
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    throw new AuthError('Authentication required', 'AUTH_REQUIRED', 401);
  }

  // Get organization ID from header
  const organizationId = request.headers.get('x-organization-id');
  
  if (!organizationId) {
    throw new AuthError('Organization context required', 'ORG_REQUIRED', 400);
  }

  // Verify user's membership in the organization
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select(`
      role,
      is_active,
      permissions,
      organization:organizations(
        id,
        name,
        subscription_tier,
        is_active
      )
    `)
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  if (membershipError || !membership) {
    throw new AuthError('Access denied to organization', 'ORG_ACCESS_DENIED', 403);
  }

  if (!membership.organization?.is_active) {
    throw new AuthError('Organization is inactive', 'ORG_INACTIVE', 403);
  }

  // Extract permissions from membership
  const permissions = membership.permissions as Record<string, any> || {};
  const permissionsList = Object.keys(permissions).filter(key => permissions[key]);

  return {
    userId: user.id,
    organizationId,
    role: membership.role,
    permissions: permissionsList,
    email: user.email!,
    name: user.user_metadata?.name || user.email
  };
}

/**
 * Get organization context
 */
export async function getOrganizationContext(
  organizationId: string
): Promise<OrganizationContext> {
  const supabase = await createSupabaseServerClient();
  
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .eq('is_active', true)
    .single();

  if (error || !org) {
    throw new AuthError('Organization not found', 'ORG_NOT_FOUND', 404);
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    subscriptionTier: org.subscription_tier,
    maxUsers: org.max_users,
    maxDocuments: org.max_documents,
    maxStorageGb: org.max_storage_gb,
    language: org.language_code,
    timezone: org.timezone
  };
}

/**
 * Check if user has specific role in organization
 */
export function hasRole(userContext: UserContext, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userContext.role);
}

/**
 * Check if user has specific permission
 */
export function hasPermission(userContext: UserContext, permission: string): boolean {
  return userContext.permissions.includes(permission) || 
         hasRole(userContext, ['owner', 'admin']);
}

/**
 * Validate document access permissions
 */
export async function validateDocumentAccess(
  documentId: string,
  userContext: UserContext,
  operation: 'read' | 'write' | 'delete' = 'read'
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  
  // Check if document belongs to user's organization
  const { data: document, error } = await supabase
    .from('documents')
    .select('organization_id, uploaded_by, is_public')
    .eq('id', documentId)
    .single();

  if (error || !document) {
    return false;
  }

  // Document must belong to user's organization
  if (document.organization_id !== userContext.organizationId) {
    return false;
  }

  // Role-based access control
  switch (userContext.role) {
    case 'owner':
    case 'admin':
      return true;
    
    case 'hr_manager':
    case 'hr_staff':
      return operation !== 'delete' || document.uploaded_by === userContext.userId;
    
    case 'viewer':
      return operation === 'read' && (document.is_public || document.uploaded_by === userContext.userId);
    
    default:
      return false;
  }
}

/**
 * Rate limiting and usage tracking
 */
export async function checkUsageLimits(
  organizationId: string,
  operation: 'query' | 'upload' | 'generate' | 'api_call'
): Promise<{ allowed: boolean; limit: number; current: number; resetDate: Date }> {
  const supabase = await createSupabaseServerClient();
  
  // Get organization subscription limits
  const { data: org } = await supabase
    .from('organizations')
    .select('subscription_tier')
    .eq('id', organizationId)
    .single();

  // Get current month usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: usage } = await supabase
    .from('organization_usage')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('period_start', startOfMonth.toISOString().split('T')[0])
    .single();

  // Define limits by subscription tier
  const limits = {
    basic: {
      query: 100,
      upload: 50,
      generate: 10,
      api_call: 500
    },
    professional: {
      query: 1000,
      upload: 200,
      generate: 50,
      api_call: 2000
    },
    enterprise: {
      query: 10000,
      upload: 1000,
      generate: 200,
      api_call: 10000
    }
  };

  const tierLimits = limits[org?.subscription_tier as keyof typeof limits] || limits.basic;
  const operationLimit = tierLimits[operation];
  
  let currentUsage = 0;
  if (usage) {
    switch (operation) {
      case 'query':
        currentUsage = usage.messages_count || 0;
        break;
      case 'upload':
        currentUsage = usage.documents_count || 0;
        break;
      case 'generate':
        currentUsage = usage.api_calls || 0; // This would need a separate field
        break;
      case 'api_call':
        currentUsage = usage.api_calls || 0;
        break;
    }
  }

  const nextMonth = new Date(startOfMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return {
    allowed: currentUsage < operationLimit,
    limit: operationLimit,
    current: currentUsage,
    resetDate: nextMonth
  };
}

/**
 * Log user activity for audit trail
 */
export async function logUserActivity(
  userContext: UserContext,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, any>,
  request?: Request
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  if (request) {
    // Extract IP address (consider proxy headers)
    ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      null;
    
    userAgent = request.headers.get('user-agent');
  }

  await supabase
    .from('user_activity_logs')
    .insert({
      organization_id: userContext.organizationId,
      user_id: userContext.userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details || {},
      ip_address: ipAddress,
      user_agent: userAgent
    });
}

/**
 * Update usage statistics
 */
export async function updateUsageStats(
  organizationId: string,
  stats: {
    messages_count?: number;
    documents_count?: number;
    tokens_used?: number;
    api_calls?: number;
  }
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0); // Last day of current month

  // Upsert usage record for current month
  await supabase
    .from('organization_usage')
    .upsert({
      organization_id: organizationId,
      period_start: startOfMonth.toISOString().split('T')[0],
      period_end: endOfMonth.toISOString().split('T')[0],
      ...stats
    }, {
      onConflict: 'organization_id,period_start'
    });
}