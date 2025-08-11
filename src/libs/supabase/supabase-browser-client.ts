// Browser client for Supabase - used in React components

import { Database } from '@/libs/supabase/types';
import { getEnvVar } from '@/utils/get-env-var';
import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    getEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL!, 'NEXT_PUBLIC_SUPABASE_URL'),
    getEnvVar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'NEXT_PUBLIC_SUPABASE_ANON_KEY')
  );
}