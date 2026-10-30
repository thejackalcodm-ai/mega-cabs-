import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env } from '@/lib/env'

/**
 * The single Supabase client. Only src/services/* may import this (enforced by ESLint).
 * Uses the anon key: every request is authorised by RLS with the user's JWT.
 */
export const supabase = createClient<Database>(
  env?.supabaseUrl ?? 'http://localhost:54321',
  env?.supabaseAnonKey ?? 'missing-anon-key',
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  },
)
