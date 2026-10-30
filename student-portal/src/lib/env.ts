import { z } from 'zod'

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_ENABLE_DEMO_LOGIN: z.string().optional(),
})

const parsed = schema.safeParse(import.meta.env)

/** Null when the app is not configured; the UI then shows setup instructions instead of crashing. */
export const env = parsed.success
  ? { supabaseUrl: parsed.data.VITE_SUPABASE_URL, supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY }
  : null

export const configErrors = parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.'))

// Compared against a literal so Vite can drop the demo panel (and its credentials) from builds where it is off.
export const demoLoginEnabled = import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true'
