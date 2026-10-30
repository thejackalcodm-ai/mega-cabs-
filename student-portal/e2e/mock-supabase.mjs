/**
 * TEST DOUBLE for the Supabase Auth + PostgREST endpoints used by the Phase 2 screens.
 * It lets the real React app run end to end in a browser without a Supabase project.
 * It is NOT a security boundary — data security is proven by supabase/tests/rls.test.sql.
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PASSWORD = 'Demo#Pass123'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (user) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`

export function createMock() {
  const users = new Map()
  const add = (email, role, first, last, extra = {}) => {
    const id = randomUUID()
    users.set(email, {
      id,
      email,
      password: PASSWORD,
      role,
      first,
      last,
      confirmed: true,
      active: true,
      ...extra,
    })
  }
  add('superadmin@demo.portal', 'super_admin', 'Sofia', 'Reyes')
  add('admin@demo.portal', 'admin', 'Daniel', 'Okafor')
  add('counselor@demo.portal', 'counselor', 'Priya', 'Raman')
  add('instructor@demo.portal', 'instructor', 'Marcus', 'Bell')
  add('student@demo.portal', 'student', 'Nimali', 'Fernando')
  add('unverified@demo.portal', 'student', 'Una', 'Verified', { confirmed: false })
  add('inactive@demo.portal', 'student', 'Ina', 'Active', { active: false })

  const tokens = new Map()
  const calls = []
  const byId = (id) => [...users.values()].find((u) => u.id === id)
  const authUser = (u) => ({
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.confirmed ? new Date().toISOString() : null,
    phone: '',
    app_metadata: { provider: 'email', role: u.role },
    user_metadata: { first_name: u.first, last_name: u.last },
    identities: [{ id: u.id, provider: 'email' }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  const session = (u) => {
    const access_token = jwt(u)
    const refresh_token = randomUUID()
    tokens.set(access_token, u.id)
    tokens.set(`r:${refresh_token}`, u.id)
    return {
      access_token,
      refresh_token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: authUser(u),
    }
  }

  const PERMS = {
    counselor: ['applications.manage', 'calendar.manage', 'documents.review', 'students.view_assigned'],
    instructor: ['calendar.manage', 'courses.manage'],
    admin: [
      'applications.manage',
      'audit.view',
      'courses.manage',
      'documents.review',
      'payments.manage',
      'reports.view',
      'students.manage',
      'students.view_all',
    ],
  }
  const studentRows = (viewer) => {
    if (!['counselor', 'admin', 'super_admin'].includes(viewer.role)) return []
    const all = [
      {
        id: randomUUID(),
        student_number: 'STU-1001',
        created_at: '2026-10-01T10:00:00Z',
        profile: {
          first_name: 'Nimali',
          last_name: 'Fernando',
          email: 'student@demo.portal',
          country: 'Sri Lanka',
          is_active: true,
        },
        counselor: { profile: { first_name: 'Priya', last_name: 'Raman' } },
      },
      {
        id: randomUUID(),
        student_number: 'STU-1002',
        created_at: '2026-10-03T10:00:00Z',
        profile: {
          first_name: 'Kavindu',
          last_name: 'Jayasinghe',
          email: 'kavindu.jayasinghe@demo.portal',
          country: 'Sri Lanka',
          is_active: true,
        },
        counselor: { profile: { first_name: 'Priya', last_name: 'Raman' } },
      },
      {
        id: randomUUID(),
        student_number: 'STU-1008',
        created_at: '2026-10-20T10:00:00Z',
        profile: {
          first_name: 'Farhan',
          last_name: 'Siddiqui',
          email: 'farhan.siddiqui@demo.portal',
          country: 'Pakistan',
          is_active: true,
        },
        counselor: null,
      },
    ]
    return viewer.role === 'counselor' ? all.filter((s) => s.counselor) : all
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x')
    const cors = {
      'Access-Control-Allow-Origin': req.headers.origin ?? '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Range, X-Total-Count',
    }
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
    let body = ''
    for await (const chunk of req) body += chunk
    const json = body ? JSON.parse(body) : {}
    calls.push({ method: req.method, path: u.pathname, query: u.search, body: json })
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { ...cors, 'Content-Type': 'application/json', ...headers })
      res.end(data === undefined ? '' : JSON.stringify(data))
    }
    const bearer = (req.headers.authorization ?? '').replace('Bearer ', '')
    const me = byId(tokens.get(bearer))

    // ---------- auth
    if (u.pathname === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') {
        const user = users.get(String(json.email).toLowerCase())
        if (!user || user.password !== json.password)
          return send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
        if (!user.confirmed)
          return send(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' })
        return send(200, session(user))
      }
      const id = tokens.get(`r:${json.refresh_token}`)
      return id ? send(200, session(byId(id))) : send(400, { msg: 'Invalid Refresh Token' })
    }
    if (u.pathname === '/auth/v1/signup') {
      const email = String(json.email).toLowerCase()
      if (users.has(email)) return send(200, { ...authUser(users.get(email)), identities: [] })
      const id = randomUUID()
      const md = json.data ?? {}
      users.set(email, {
        id,
        email,
        password: json.password,
        role: 'student',
        first: md.first_name,
        last: md.last_name,
        confirmed: false,
        active: true,
        metadata: md,
      })
      return send(200, authUser(users.get(email)))
    }
    if (u.pathname === '/auth/v1/user' && req.method === 'GET')
      return me ? send(200, authUser(me)) : send(401, { msg: 'invalid JWT' })
    if (u.pathname === '/auth/v1/user' && req.method === 'PUT') {
      if (!me) return send(401, { msg: 'Auth session missing!' })
      if (json.password) me.password = json.password
      return send(200, authUser(me))
    }
    if (u.pathname === '/auth/v1/logout') {
      tokens.delete(bearer)
      return send(204)
    }
    if (u.pathname === '/auth/v1/recover' || u.pathname === '/auth/v1/resend') return send(200, {})

    // ---------- rest (row-level filtering by the signed-in user)
    const m = u.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_]+)$/)
    if (!m) return send(404, { message: 'not found' })
    if (!me) return send(200, [])
    const [, rpc, name] = m
    const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
    const rows = (list) => {
      if (req.method === 'HEAD') return send(200, undefined, { 'Content-Range': `*/${list.length}` })
      if (wantsObject)
        return list.length === 1
          ? send(200, list[0])
          : send(406, {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
              details: 'The result contains 0 rows',
            })
      return send(200, list, { 'Content-Range': `0-${Math.max(list.length - 1, 0)}/${list.length}` })
    }
    if (rpc) {
      if (name === 'log_client_event') return send(204)
      if (name === 'profile_completion')
        return send(200, {
          percent: 88,
          completed: 14,
          total: 16,
          missing: [
            { key: 'address', label: 'Home address', section: 'contact' },
            { key: 'emergency_contact', label: 'Emergency contact', section: 'emergency' },
          ],
        })
      return send(404, { message: 'unknown rpc' })
    }
    switch (name) {
      case 'profiles':
        return rows([
          {
            id: me.id,
            email: me.email,
            first_name: me.first,
            last_name: me.last,
            avatar_url: null,
            is_active: me.active,
          },
        ])
      case 'user_roles':
        return rows([{ role: me.role }])
      case 'students':
        if (u.searchParams.get('profile_id'))
          return rows(me.role === 'student' ? [{ id: `stu-${me.id}` }] : [])
        return rows(studentRows(me))
      case 'staff':
        return rows(me.role === 'student' ? [] : [{ id: `staff-${me.id}` }])
      case 'role_permissions':
        return rows((PERMS[me.role] ?? []).map((permission) => ({ permission })))
      case 'notifications':
        return rows(
          me.role === 'student'
            ? [
                {
                  id: '1',
                  type: 'document_rejected',
                  title: 'Bank Statement needs resubmission',
                  body: 'The statement is older than 31 days.',
                  link: '/app/documents',
                  is_read: false,
                  created_at: new Date(Date.now() - 864e5).toISOString(),
                },
                {
                  id: '2',
                  type: 'university_offer',
                  title: 'New offer from Westmere University',
                  body: 'You received a conditional offer.',
                  link: '/app/applications',
                  is_read: false,
                  created_at: new Date(Date.now() - 2 * 864e5).toISOString(),
                },
                {
                  id: '3',
                  type: 'document_approved',
                  title: 'Passport approved',
                  body: null,
                  link: '/app/documents',
                  is_read: true,
                  created_at: new Date(Date.now() - 9 * 864e5).toISOString(),
                },
              ].filter((n) => (u.searchParams.get('is_read') === 'eq.false' ? !n.is_read : true))
            : [],
        )
      case 'my_threads':
        return rows(me.role === 'student' ? [{ unread_count: 1 }] : [])
      case 'courses':
        return rows(
          me.role === 'instructor'
            ? [
                {
                  id: 'c1',
                  title: 'IELTS Academic Complete',
                  status: 'published',
                  updated_at: '2026-10-28T10:00:00Z',
                  enrollments: [{ count: 7 }],
                },
                {
                  id: 'c5',
                  title: 'Academic Writing Masterclass',
                  status: 'draft',
                  updated_at: '2026-10-29T10:00:00Z',
                  enrollments: [{ count: 0 }],
                },
              ]
            : [],
        )
      default:
        return rows([])
    }
  })
  return { server, users, calls }
}
