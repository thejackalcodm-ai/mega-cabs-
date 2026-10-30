import { describe, expect, it, vi } from 'vitest'
import { handleCreateUser, parseRequest, type Caller, type Deps } from './handler'

const admin: Caller = { id: 'a', active: true, canManageStudents: true, isSuperAdmin: false }
const superAdmin: Caller = { id: 's', active: true, canManageStudents: true, isSuperAdmin: true }
const counselor: Caller = { id: 'c', active: true, canManageStudents: false, isSuperAdmin: false }
const body = { email: ' New.Student@Example.com ', first_name: 'Asha', last_name: 'Newman', country: 'Kenya' }

function deps(caller: Caller | null, overrides: Partial<Deps> = {}) {
  return {
    getCaller: vi.fn(async () => caller),
    createUser: vi.fn(async () => ({ id: 'new-user' })),
    sendInvite: vi.fn(async () => undefined),
    logCreated: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
    ...overrides,
  } satisfies Deps
}

describe('admin-create-user handler', () => {
  it('rejects unauthenticated and inactive callers', async () => {
    expect((await handleCreateUser(body, deps(null))).status).toBe(401)
    expect((await handleCreateUser(body, deps({ ...admin, active: false }))).status).toBe(403)
  })

  it('lets an admin create a student, audits it and sends the invite', async () => {
    const d = deps(admin)
    const res = await handleCreateUser(body, d)
    expect(res).toEqual({ status: 201, body: { user_id: 'new-user', role: 'student', invited: true } })
    expect(d.createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'new.student@example.com', role: 'student' }))
    expect(d.logCreated).toHaveBeenCalledWith('new-user', 'student')
    expect(d.sendInvite).toHaveBeenCalledWith('new.student@example.com')
  })

  it('refuses students to callers without students.manage (e.g. counselors)', async () => {
    const d = deps(counselor)
    expect((await handleCreateUser(body, d)).status).toBe(403)
    expect(d.createUser).not.toHaveBeenCalled()
  })

  it('only a super admin can create staff accounts', async () => {
    for (const role of ['counselor', 'instructor', 'admin', 'super_admin']) {
      const d = deps(admin)
      const res = await handleCreateUser({ ...body, role }, d)
      expect(res.status).toBe(403)
      expect(d.createUser).not.toHaveBeenCalled()
    }
    const ok = await handleCreateUser({ ...body, role: 'counselor' }, deps(superAdmin))
    expect(ok.status).toBe(201)
  })

  it('validates input before touching the service role', async () => {
    const d = deps(admin)
    const res = await handleCreateUser({ email: 'nope', first_name: '<b>', last_name: '', role: 'root' }, d)
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.fields as object).sort()).toEqual(['email', 'first_name', 'last_name', 'role'])
    expect(d.createUser).not.toHaveBeenCalled()
  })

  it('maps duplicate emails to 409', async () => {
    const res = await handleCreateUser(body, deps(admin, { createUser: vi.fn(async () => ({ error: 'exists' as const })) }))
    expect(res.status).toBe(409)
  })

  it('removes the new user when the audit entry cannot be written', async () => {
    const d = deps(admin, { logCreated: vi.fn(async () => Promise.reject(new Error('rls'))) })
    const res = await handleCreateUser(body, d)
    expect(res.status).toBe(500)
    expect(d.deleteUser).toHaveBeenCalledWith('new-user')
    expect(d.sendInvite).not.toHaveBeenCalled()
  })

  it('still succeeds (invited: false) when the email cannot be sent', async () => {
    const res = await handleCreateUser({ ...body, send_invite: true }, deps(admin, { sendInvite: vi.fn(async () => Promise.reject(new Error('smtp'))) }))
    expect(res).toMatchObject({ status: 201, body: { invited: false } })
  })

  it('can skip the invite (used by verify:live)', async () => {
    const d = deps(admin)
    await handleCreateUser({ ...body, send_invite: false }, d)
    expect(d.sendInvite).not.toHaveBeenCalled()
  })

  it('parses optional fields', () => {
    const r = parseRequest({ ...body, phone: '' })
    expect(r).toMatchObject({ ok: true, user: { phone: null, country: 'Kenya', sendInvite: true } })
  })
})
