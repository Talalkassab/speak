'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/libs/supabase/supabase-browser-client';
import type { User } from '@supabase/supabase-js';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo_url?: string;
  country_code: string;
  timezone: string;
  language_code: string;
  settings: Record<string, any>;
  subscription_tier: 'basic' | 'professional' | 'enterprise';
  max_users: number;
  max_documents: number;
  max_storage_gb: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'hr_manager' | 'hr_staff' | 'viewer';
  is_active: boolean;
  invited_by?: string;
  invited_at?: string;
  joined_at: string;
  last_active_at: string;
  permissions: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationWithMembership extends Organization {
  membership?: OrganizationMember;
}

interface OrganizationContextType {
  organization: OrganizationWithMembership | null;
  organizations: OrganizationWithMembership[];
  isLoading: boolean;
  error: string | null;
  switchOrganization: (organizationId: string) => Promise<void>;
  createOrganization: (orgData: CreateOrganizationData) => Promise<Organization>;
  updateOrganization: (id: string, updates: Partial<Organization>) => Promise<void>;
  inviteUser: (email: string, role: OrganizationMember['role']) => Promise<void>;
  leaveOrganization: () => Promise<void>;
  refreshOrganizations: () => Promise<void>;
}

interface CreateOrganizationData {
  name: string;
  domain?: string;
  adminFirstName: string;
  adminLastName: string;
  phoneNumber?: string;
  industry?: string;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<OrganizationWithMembership | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const supabase = createSupabaseBrowserClient();

  // Load user and organizations on mount
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        
        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        
        setUser(user);
        
        if (user) {
          await loadOrganizations(user.id);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        await loadOrganizations(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setOrganization(null);
        setOrganizations([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadOrganizations = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations (*)
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      const orgsWithMembership = data.map((member: any) => ({
        ...member.organization,
        membership: {
          id: member.id,
          organization_id: member.organization_id,
          user_id: member.user_id,
          role: member.role,
          is_active: member.is_active,
          invited_by: member.invited_by,
          invited_at: member.invited_at,
          joined_at: member.joined_at,
          last_active_at: member.last_active_at,
          permissions: member.permissions,
          created_at: member.created_at,
          updated_at: member.updated_at,
        }
      }));

      setOrganizations(orgsWithMembership);

      // Set current organization (first one or from localStorage)
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const currentOrg = savedOrgId 
        ? orgsWithMembership.find(org => org.id === savedOrgId)
        : orgsWithMembership[0];

      if (currentOrg) {
        setOrganization(currentOrg);
        localStorage.setItem('currentOrganizationId', currentOrg.id);
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load organizations');
    }
  };

  const switchOrganization = async (organizationId: string) => {
    const targetOrg = organizations.find(org => org.id === organizationId);
    if (targetOrg) {
      setOrganization(targetOrg);
      localStorage.setItem('currentOrganizationId', organizationId);
      
      // Update last active timestamp
      await supabase
        .from('organization_members')
        .update({ last_active_at: new Date().toISOString() })
        .eq('organization_id', organizationId)
        .eq('user_id', user?.id);
    }
  };

  const createOrganization = async (orgData: CreateOrganizationData): Promise<Organization> => {
    if (!user) throw new Error('User not authenticated');

    try {
      // Generate slug from organization name
      const slug = orgData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '');

      // Create organization
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgData.name,
          slug: slug,
          domain: orgData.domain,
          country_code: 'SA',
          timezone: 'Asia/Riyadh',
          language_code: 'ar',
          settings: {
            industry: orgData.industry,
            admin_phone: orgData.phoneNumber,
            admin_first_name: orgData.adminFirstName,
            admin_last_name: orgData.adminLastName,
          }
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add user as organization owner
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: newOrg.id,
          user_id: user.id,
          role: 'owner',
          is_active: true,
        });

      if (memberError) throw memberError;

      // Refresh organizations list
      await refreshOrganizations();
      
      return newOrg;
    } catch (err) {
      console.error('Error creating organization:', err);
      throw err;
    }
  };

  const updateOrganization = async (id: string, updates: Partial<Organization>) => {
    if (!organization || organization.id !== id) {
      throw new Error('Not authorized to update this organization');
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setOrganization(prev => prev ? { ...prev, ...updates } : null);
      setOrganizations(prev => 
        prev.map(org => org.id === id ? { ...org, ...updates } : org)
      );
    } catch (err) {
      console.error('Error updating organization:', err);
      throw err;
    }
  };

  const inviteUser = async (email: string, role: OrganizationMember['role']) => {
    if (!organization || !user) throw new Error('Not authorized');

    try {
      const { error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: organization.id,
          email,
          role,
          invited_by: user.id,
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error inviting user:', err);
      throw err;
    }
  };

  const leaveOrganization = async () => {
    if (!organization || !user) throw new Error('Not authorized');

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ is_active: false })
        .eq('organization_id', organization.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Refresh organizations
      await refreshOrganizations();
    } catch (err) {
      console.error('Error leaving organization:', err);
      throw err;
    }
  };

  const refreshOrganizations = async () => {
    if (user) {
      await loadOrganizations(user.id);
    }
  };

  const value: OrganizationContextType = {
    organization,
    organizations,
    isLoading,
    error,
    switchOrganization,
    createOrganization,
    updateOrganization,
    inviteUser,
    leaveOrganization,
    refreshOrganizations,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

// Helper hook to check user permissions
export function usePermissions() {
  const { organization } = useOrganization();
  
  const hasRole = (roles: OrganizationMember['role'] | OrganizationMember['role'][]) => {
    if (!organization?.membership) return false;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    return allowedRoles.includes(organization.membership.role);
  };

  const canManageUsers = () => hasRole(['owner', 'admin']);
  const canManageDocuments = () => hasRole(['owner', 'admin', 'hr_manager']);
  const canViewReports = () => hasRole(['owner', 'admin', 'hr_manager']);
  const canManageSettings = () => hasRole(['owner', 'admin']);

  return {
    hasRole,
    canManageUsers,
    canManageDocuments,
    canViewReports,
    canManageSettings,
    role: organization?.membership?.role,
  };
}