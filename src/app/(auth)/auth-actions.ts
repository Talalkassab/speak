'use server';

import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from '@/libs/supabase/supabase-server-client';
import { ActionResponse } from '@/types/action-response';
import { getURL } from '@/utils/get-url';

export interface OrganizationSignupData {
  // User fields
  email: string;
  password: string;
  
  // Organization fields
  companyName: string;
  companyDomain?: string;
  adminFirstName: string;
  adminLastName: string;
  phoneNumber?: string;
  industry?: string;
}

export interface InvitationAcceptData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  invitationToken: string;
}

export async function signInWithOAuth(provider: 'github' | 'google'): Promise<ActionResponse> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getURL('/auth/callback'),
    },
  });

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return redirect(data.url);
}

export async function signInWithEmail(email: string): Promise<ActionResponse> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getURL('/auth/callback'),
    },
  });

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return { data: null, error: null };
}

export async function signUpWithOrganization(data: OrganizationSignupData): Promise<ActionResponse> {
  const supabase = await createSupabaseServerClient();

  try {
    // 1. Create user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.adminFirstName,
          last_name: data.adminLastName,
          phone: data.phoneNumber,
        },
        emailRedirectTo: getURL('/auth/callback?type=organization_signup'),
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return { data: null, error: authError };
    }

    if (!authData.user) {
      return { data: null, error: { message: 'Failed to create user account' } };
    }

    // 2. Generate organization slug
    const slug = data.companyName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');

    // 3. Create organization
    const { data: orgData, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: data.companyName,
        slug: slug,
        domain: data.companyDomain,
        country_code: 'SA',
        timezone: 'Asia/Riyadh',
        language_code: 'ar',
        settings: {
          industry: data.industry,
          admin_phone: data.phoneNumber,
          admin_first_name: data.adminFirstName,
          admin_last_name: data.adminLastName,
        },
      })
      .select()
      .single();

    if (orgError) {
      console.error('Organization creation error:', orgError);
      return { data: null, error: orgError };
    }

    // 4. Add user as organization owner
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgData.id,
        user_id: authData.user.id,
        role: 'owner',
        is_active: true,
      });

    if (memberError) {
      console.error('Membership creation error:', memberError);
      return { data: null, error: memberError };
    }

    // 5. Create default document categories
    await supabase.rpc('create_default_document_categories', {
      p_organization_id: orgData.id,
      p_created_by: authData.user.id,
    });

    return { 
      data: { 
        user: authData.user, 
        organization: orgData 
      }, 
      error: null 
    };

  } catch (error) {
    console.error('Signup error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : { message: 'Unknown error occurred' } 
    };
  }
}

export async function acceptInvitation(data: InvitationAcceptData): Promise<ActionResponse> {
  const supabase = await createSupabaseServerClient();

  try {
    // 1. Verify invitation token
    const { data: invitationData, error: invitationError } = await supabase
      .from('organization_invitations')
      .select('*, organization:organizations(*)')
      .eq('token', data.invitationToken)
      .eq('email', data.email)
      .gte('expires_at', new Date().toISOString())
      .is('accepted_at', null)
      .single();

    if (invitationError || !invitationData) {
      return { 
        data: null, 
        error: { message: 'Invalid or expired invitation' } 
      };
    }

    // 2. Create user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
        },
        emailRedirectTo: getURL('/auth/callback?type=invitation_accept'),
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      return { data: null, error: authError };
    }

    if (!authData.user) {
      return { data: null, error: { message: 'Failed to create user account' } };
    }

    // 3. Add user to organization
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: invitationData.organization_id,
        user_id: authData.user.id,
        role: invitationData.role,
        invited_by: invitationData.invited_by,
        invited_at: invitationData.created_at,
        is_active: true,
      });

    if (memberError) {
      console.error('Membership creation error:', memberError);
      return { data: null, error: memberError };
    }

    // 4. Mark invitation as accepted
    await supabase
      .from('organization_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitationData.id);

    return { 
      data: { 
        user: authData.user, 
        organization: invitationData.organization 
      }, 
      error: null 
    };

  } catch (error) {
    console.error('Invitation accept error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : { message: 'Unknown error occurred' } 
    };
  }
}

export async function validateInvitation(token: string): Promise<ActionResponse> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('organization_invitations')
    .select(`
      *,
      organization:organizations(name),
      invited_by_user:auth.users!organization_invitations_invited_by_fkey(
        raw_user_meta_data
      )
    `)
    .eq('token', token)
    .gte('expires_at', new Date().toISOString())
    .is('accepted_at', null)
    .single();

  if (error || !data) {
    return { 
      data: null, 
      error: { message: 'Invalid or expired invitation' } 
    };
  }

  return { data, error: null };
}

export async function signOut(): Promise<ActionResponse> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error(error);
    return { data: null, error: error };
  }

  return { data: null, error: null };
}
