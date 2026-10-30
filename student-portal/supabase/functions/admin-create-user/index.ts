// Supabase Edge Function (Deno). Deploy: supabase functions deploy admin-create-user
// Secrets SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
// APP_URL (optional) is where the "set your password" link lands, e.g. https://your-app.vercel.app
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { handleCreateUser, type Caller, type NewUser } from './handler.ts'

declare const Deno: {
  env: { get(name: string): string | undefined }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const url = Deno.env.get('SUPABASE_URL')!
// Works with legacy JWT keys and the newer sb_publishable_ / sb_secret_ keys.
const anonKey = (Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY'))!
const serviceKey = (Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!
const appUrl = Deno.env.get('APP_URL') ?? ''
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const cors = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors })

  // The caller is authenticated here (auth.getUser in getCaller), not by the gateway; see config.toml.
  const authorization = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+\S+/.test(authorization)) {
    return new Response(JSON.stringify({ error: 'Sign in again to continue.' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  // Caller-scoped client: every query runs under the caller's RLS.
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  // Service-role client: used only for auth.admin calls below. Never returned to the browser.
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const body = await req.json().catch(() => null)
  const result = await handleCreateUser(body, {
    async getCaller(): Promise<Caller | null> {
      const { data } = await asCaller.auth.getUser()
      if (!data.user) return null
      const [profile, manage, superAdmin] = await Promise.all([
        asCaller.from('profiles').select('is_active').eq('id', data.user.id).single(),
        asCaller.rpc('has_permission', { perm: 'students.manage' }),
        asCaller.rpc('is_super_admin'),
      ])
      return {
        id: data.user.id,
        active: !!profile.data?.is_active,
        canManageStudents: manage.data === true,
        isSuperAdmin: superAdmin.data === true,
      }
    },
    async createUser(u: NewUser) {
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email,
        email_confirm: true, // the invite email proves ownership by setting a password
        app_metadata: { role: u.role },
        user_metadata: { first_name: u.firstName, last_name: u.lastName, phone: u.phone, country: u.country },
      })
      if (error)
        return {
          error: /already|exists|registered/i.test(error.message) ? 'exists' : 'failed',
          message: error.message,
        }
      return { id: data.user.id }
    },
    async sendInvite(email: string) {
      const { error } = await asCaller.auth.resetPasswordForEmail(email, {
        redirectTo: appUrl ? `${appUrl}/reset-password` : undefined,
      })
      if (error) throw error
    },
    async logCreated(userId, role) {
      const { error } = await asCaller.rpc('log_admin_user_created', { p_user_id: userId, p_role: role })
      if (error) throw error
    },
    async deleteUser(userId) {
      await admin.auth.admin.deleteUser(userId)
    },
  })
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
