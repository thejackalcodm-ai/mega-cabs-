/**
 * Live security check against a real Supabase project (run after `npm run seed`).
 * Signs in as real demo users through the public API with the ANON key and confirms that RLS
 * and storage policies behave like the local pgTAP suite. The service role key is used only to
 * look up ground truth (ids and file paths), never to perform the checks.
 *
 *   npm run verify:live
 */
import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.SEED_DEMO_PASSWORD ?? 'Demo#Pass123'
if (!url || !anonKey || !serviceKey) {
  console.error(
    'Set SUPABASE_URL (or VITE_SUPABASE_URL), VITE_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY in .env',
  )
  process.exit(1)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, opts)
const results: { ok: boolean; name: string; detail?: string; skipped?: boolean }[] = []
const check = (name: string, ok: boolean, detail?: string) => results.push({ ok, name, detail })
const skip = (name: string, detail: string) => results.push({ ok: true, skipped: true, name, detail })

async function signIn(email: string): Promise<SupabaseClient> {
  const c = createClient(url!, anonKey!, opts)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message} (has npm run seed been run?)`)
  return c
}

async function count(c: SupabaseClient, table: string, column?: string, value?: string) {
  let q = c.from(table).select('*', { count: 'exact', head: true })
  if (column) q = q.eq(column, value!)
  const { count: n, error } = await q
  return error ? -1 : (n ?? 0)
}

async function main() {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const idOf = (email: string) => users.users.find((u) => u.email === email)?.id
  const studentOf = async (email: string) =>
    (await admin.from('students').select('id').eq('profile_id', idOf(email)!).single()).data!.id as string
  const aId = await studentOf('student@demo.portal')
  const bEmail = 'kavindu.jayasinghe@demo.portal'
  const bId = await studentOf(bEmail)
  const bDoc = (await admin.from('documents').select('id, file_path').eq('student_id', bId).limit(1).single())
    .data!
  const aDoc = (await admin.from('documents').select('id, file_path').eq('student_id', aId).limit(1).single())
    .data!
  const assigned = (
    await admin.from('students').select('id', { count: 'exact', head: true }).not('counselor_id', 'is', null)
  ).count

  const a = await signIn('student@demo.portal')

  // 1. cross-student reads
  for (const [table, col, val] of [
    ['students', 'id', bId],
    ['student_profiles', 'student_id', bId],
    ['applications', 'student_id', bId],
    ['documents', 'student_id', bId],
    ['invoices', 'student_id', bId],
    ['payments', 'student_id', bId],
    ['student_tasks', 'student_id', bId],
    ['message_threads', 'student_id', bId],
    ['notifications', 'recipient_id', idOf(bEmail)!],
  ] as const) {
    const n = await count(a, table, col, val)
    check(`[1] student cannot read another student's ${table}`, n === 0, `rows=${n}`)
  }
  check('[1] student sees exactly one student record (their own)', (await count(a, 'students')) === 1)
  const upd = await a
    .from('student_profiles')
    .update({ passport_number: 'HACKED' })
    .eq('student_id', bId)
    .select()
  check("[1] student cannot update another student's personal data", (upd.data?.length ?? 0) === 0)
  const del = await a.from('documents').delete().eq('student_id', bId).select()
  check("[1] student cannot delete another student's documents", (del.data?.length ?? 0) === 0)

  // 2. storage — the highest-risk area: every check runs as a real signed-in student with the anon key
  const pdfBytes = (tag: string) =>
    new Blob([`%PDF-1.4\n% verify-live ${tag}\n%%EOF\n`], { type: 'application/pdf' })
  const auditCount = async (action: string, entityId: string) =>
    (
      await admin
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .eq('action', action)
        .eq('entity_id', entityId)
    ).count ?? 0
  const signed = await a.storage.from('student-documents').createSignedUrl(bDoc.file_path, 60)
  check("[2] student cannot create a signed URL for another student's file (exact path)", !!signed.error)
  const dl = await a.storage.from('student-documents').download(bDoc.file_path)
  check("[2] student cannot download another student's file", !!dl.error)
  const otherGrant = await a.rpc('authorize_document_access', {
    p_document_id: bDoc.id,
    p_purpose: 'download',
  })
  check("[2] student cannot obtain an access grant for another student's document", !!otherGrant.error)
  const noGrant = await a.storage.from('student-documents').createSignedUrl(aDoc.file_path, 60)
  check('[2] even her own stored document cannot be signed without an audited grant', !!noGrant.error)
  const grant = await a.rpc('authorize_document_access', { p_document_id: aDoc.id, p_purpose: 'view' })
  const own = await a.storage.from('student-documents').createSignedUrl(aDoc.file_path, 60)
  const ownFetch = own.data ? await fetch(own.data.signedUrl) : null
  check(
    '[2] after authorize_document_access, her own file opens via a 60-second signed URL',
    !grant.error && ownFetch?.status === 200,
    `status=${ownFetch?.status}`,
  )
  check('[2] the view was written to the audit log', (await auditCount('document.viewed', aDoc.id)) > 0)
  const short = await a.storage.from('student-documents').createSignedUrl(aDoc.file_path, 1)
  await new Promise((r) => setTimeout(r, 3000))
  const expired = short.data ? await fetch(short.data.signedUrl) : null
  check(
    '[2] a signed URL stops working after it expires',
    (expired?.status ?? 0) >= 400,
    `status=${expired?.status}`,
  )
  for (const [label, path] of [
    ['own', aDoc.file_path],
    ["another student's", bDoc.file_path],
  ] as const) {
    const pub = await fetch(`${url}/storage/v1/object/public/student-documents/${path}`)
    check(`[8] public URL to ${label} file is refused`, pub.status >= 400, `status=${pub.status}`)
  }
  const planted = await a.storage
    .from('student-documents')
    .upload(`${bId}/identity/${crypto.randomUUID()}-planted.pdf`, pdfBytes('planted'), {
      contentType: 'application/pdf',
    })
  check("[2] student cannot upload into another student's folder", !!planted.error)
  const html = await a.storage
    .from('student-documents')
    .upload(
      `${aId}/other/${crypto.randomUUID()}-page.pdf`,
      new Blob(['<script>alert(1)</script>'], { type: 'text/html' }),
      { contentType: 'text/html' },
    )
  check('[2] the bucket rejects disallowed file types', !!html.error)
  const big = await a.storage
    .from('student-documents')
    .upload(
      `${aId}/other/${crypto.randomUUID()}-big.pdf`,
      new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'application/pdf' }),
      { contentType: 'application/pdf' },
    )
  check('[2] the bucket rejects files over 10 MB', !!big.error)

  // upload → replace → download → delete, each audited
  const types = (await admin.from('document_types').select('id, key, category').eq('key', 'other').single())
    .data!
  const path1 = `${aId}/other/${crypto.randomUUID()}-verify-live.pdf`
  const up = await a.storage
    .from('student-documents')
    .upload(path1, pdfBytes('v1'), { contentType: 'application/pdf' })
  const row = await a
    .from('documents')
    .insert({
      student_id: aId,
      document_type_id: types.id,
      category: 'other',
      custom_type_name: 'verify-live test',
      file_path: path1,
      file_name: 'verify-live.pdf',
      file_size: 40,
      mime_type: 'application/pdf',
      status: 'approved',
    })
    .select()
    .single()
  check(
    '[2] student can upload a document to her own folder',
    !up.error && !row.error,
    up.error?.message ?? row.error?.message,
  )
  const testDoc = row.data
  if (testDoc) {
    check(
      '[5] a student-inserted document starts as "uploaded" even if she sends "approved"',
      testDoc.status === 'uploaded',
      `status=${testDoc.status}`,
    )
    check('[audit] upload was audited', (await auditCount('document.uploaded', testDoc.id)) > 0)
    const path2 = `${aId}/other/${crypto.randomUUID()}-verify-live-v2.pdf`
    await a.storage
      .from('student-documents')
      .upload(path2, pdfBytes('v2'), { contentType: 'application/pdf' })
    const rep = await a.rpc('replace_document', {
      p_document_id: testDoc.id,
      p_file_path: path2,
      p_file_name: 'verify-live-v2.pdf',
      p_file_size: 40,
      p_mime_type: 'application/pdf',
    })
    const versions =
      (await a.from('document_versions').select('version').eq('document_id', testDoc.id)).data ?? []
    check(
      '[2] replacement adds version 2 and keeps version 1',
      !rep.error && versions.length === 2,
      rep.error?.message ?? `versions=${versions.length}`,
    )
    check('[audit] replacement was audited', (await auditCount('document.replaced', testDoc.id)) > 0)
    const v1 = await a.rpc('authorize_document_access', {
      p_document_id: testDoc.id,
      p_purpose: 'download',
      p_version: 1,
    })
    const v1url = await a.storage
      .from('student-documents')
      .createSignedUrl(path1, 60, { download: 'verify-live.pdf' })
    const v1fetch = v1url.data ? await fetch(v1url.data.signedUrl) : null
    check(
      '[2] an earlier version can still be downloaded (with a grant)',
      !v1.error && v1fetch?.status === 200,
      `status=${v1fetch?.status}`,
    )
    check('[audit] download was audited', (await auditCount('document.downloaded', testDoc.id)) > 0)
    const del = await a.rpc('delete_document', { p_document_id: testDoc.id })
    const removed = del.data ? await a.storage.from('student-documents').remove(del.data) : null
    check(
      '[2] student can delete a document that is not approved / under review; files are removed',
      !del.error && !removed?.error && (removed?.data?.length ?? 0) === 2,
      del.error?.message ?? removed?.error?.message,
    )
    check('[audit] delete was audited', (await auditCount('document.deleted', testDoc.id)) > 0)
  }
  const approved = (
    await admin
      .from('documents')
      .select('id')
      .eq('student_id', aId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()
  ).data
  if (approved) {
    const delApproved = await a.rpc('delete_document', { p_document_id: approved.id })
    check('[2] student cannot delete an approved document', !!delApproved.error)
  }
  // clean up anything a failed run may have left behind
  const leftovers = (await admin.storage.from('student-documents').list(`${aId}/other`)).data ?? []
  const stray = leftovers.filter((f) => f.name.includes('verify-live')).map((f) => `${aId}/other/${f.name}`)
  if (stray.length) await admin.storage.from('student-documents').remove(stray)

  // 3/5/6/9 escalation and integrity
  const role = await a
    .from('user_roles')
    .insert({ user_id: idOf('student@demo.portal')!, role: 'super_admin' })
  check('[3] student cannot insert into user_roles', !!role.error)
  const review = await a.from('document_reviews').insert({
    document_id: aDoc.id,
    version: 1,
    reviewer_id: idOf('student@demo.portal')!,
    action: 'approved',
  })
  check('[5] student cannot write document_reviews', !!review.error)
  const status = await a.from('documents').update({ status: 'approved' }).eq('id', aDoc.id).select()
  check('[5] student cannot set their own document status', (status.data?.length ?? 0) === 0)
  check('[6] student cannot read audit_logs', (await count(a, 'audit_logs')) === 0)
  check('[9] student cannot read quiz answer keys', (await count(a, 'quiz_options')) === 0)
  const fake = await a.from('quiz_attempts').insert({
    quiz_id: '00000000-0000-0000-0000-000000000000',
    student_id: aId,
    attempt_number: 99,
    score: 100,
    percentage: 100,
    passed: true,
  })
  check('[9] student cannot insert a quiz score', !!fake.error)

  // 4. counselor scope
  const counselor = await signIn('counselor@demo.portal')
  const visible = await count(counselor, 'students')
  check(
    '[4] counselor sees only assigned students',
    visible === assigned,
    `visible=${visible} assigned=${assigned}`,
  )
  const unassigned = (await admin.from('students').select('id').is('counselor_id', null).limit(1).single())
    .data!.id as string
  check(
    '[4] counselor gets zero rows for an unassigned student',
    (await count(counselor, 'documents', 'student_id', unassigned)) === 0,
  )

  // P4. admin & counselor workspaces, role changes, deactivation, the review gate
  await phase4({ a, counselor, aId, bId, unassigned, assigned: assigned ?? 0, idOf, auditCount, pdfBytes })

  // 7. anonymous
  const anon = createClient(url!, anonKey!, opts)
  for (const table of [
    'profiles',
    'students',
    'documents',
    'applications',
    'payments',
    'notifications',
    'audit_logs',
  ]) {
    check(`[7] anonymous request returns nothing from ${table}`, (await count(anon, table)) <= 0)
  }

  const anonRpc = await anon.rpc('is_admin')
  check(
    '[7] anonymous callers cannot execute RPCs (migration 0016)',
    !!anonRpc.error,
    anonRpc.error ? undefined : 'is_admin() ran for anon: apply 0016_function_privileges',
  )

  const failed = results.filter((r) => !r.ok)
  const skipped = results.filter((r) => r.skipped)
  for (const r of results)
    console.log(
      `${r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL'}  ${r.name}${(r.ok && !r.skipped) || !r.detail ? '' : `  (${r.detail})`}`,
    )
  console.log(
    `\n${results.length - failed.length - skipped.length}/${results.length - skipped.length} passed${skipped.length ? `, ${skipped.length} skipped` : ''}`,
  )
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})

interface Phase4Ctx {
  a: SupabaseClient
  counselor: SupabaseClient
  aId: string
  bId: string
  unassigned: string
  assigned: number
  idOf: (email: string) => string | undefined
  auditCount: (action: string, entityId: string) => Promise<number>
  pdfBytes: (tag: string) => Blob
}

async function phase4({
  a,
  counselor,
  aId,
  bId,
  unassigned,
  assigned,
  idOf,
  auditCount,
  pdfBytes,
}: Phase4Ctx) {
  const adm = await signIn('admin@demo.portal')
  const sup = await signIn('superadmin@demo.portal')
  const totalStudents = (await admin.from('students').select('id', { count: 'exact', head: true })).count ?? 0

  // dashboards and directory scope
  const metrics = await adm.rpc('admin_dashboard_metrics')
  const m = metrics.data as { scope?: string; total_students?: number } | null
  check(
    '[P4] admin metrics cover every student',
    !metrics.error && m?.scope === 'all' && m.total_students === totalStudents,
    metrics.error?.message ?? `total=${m?.total_students} expected=${totalStudents}`,
  )
  const cm = await counselor.rpc('admin_dashboard_metrics')
  const cmd = cm.data as { scope?: string; total_students?: number } | null
  check(
    '[P4] counselor metrics are limited to assigned students',
    !cm.error && cmd?.scope === 'assigned' && cmd.total_students === assigned,
    cm.error?.message ?? `total=${cmd?.total_students} assigned=${assigned}`,
  )
  check('[P4] counselor dashboard loads', !(await counselor.rpc('counselor_dashboard')).error)
  check(
    '[P4] counselor directory rows = assigned students',
    (await count(counselor, 'student_directory')) === assigned,
  )
  check(
    '[P4] counselor directory has no row for an unassigned student',
    (await count(counselor, 'student_directory', 'id', unassigned)) === 0,
  )
  const unassignedDoc = (
    await admin.from('documents').select('id').eq('student_id', unassigned).limit(1).maybeSingle()
  ).data
  if (unassignedDoc) {
    const r = await counselor.rpc('review_document', {
      p_document_id: unassignedDoc.id,
      p_action: 'approved',
    })
    check("[P4] counselor cannot review an unassigned student's document", !!r.error)
    const g = await counselor.rpc('authorize_document_access', { p_document_id: unassignedDoc.id })
    check("[P4] counselor cannot open an unassigned student's document", !!g.error)
  } else skip('[P4] counselor cannot review an unassigned student', 'the unassigned student has no documents')
  const cAssign = await counselor.rpc('assign_counselor', {
    p_student_id: bId,
    p_staff_id: null as unknown as string,
  })
  check('[P4] counselor cannot assign counselors', !!cAssign.error)

  // students calling staff functions
  const ownDoc = (await admin.from('documents').select('id').eq('student_id', aId).limit(1).single()).data!
  for (const [fn, args] of [
    ['review_document', { p_document_id: ownDoc.id, p_action: 'approved' }],
    ['admin_dashboard_metrics', {}],
    ['counselor_dashboard', {}],
    ['assign_counselor', { p_student_id: aId, p_staff_id: null }],
    ['request_document', { p_student_id: bId, p_document_type_id: ownDoc.id }],
  ] as const) {
    const r = await a.rpc(fn, args as never)
    check(`[P4] student calling ${fn} is refused`, !!r.error)
  }

  // role changes: only a super admin, never their own
  const rolesOf = async (email: string) =>
    ((await admin.from('user_roles').select('role').eq('user_id', idOf(email)!)).data ?? [])
      .map((r) => r.role as string)
      .sort()
      .join(',')
  const before = await Promise.all(
    ['admin@demo.portal', 'student@demo.portal', 'counselor@demo.portal'].map(rolesOf),
  )
  const ownUp = await adm
    .from('user_roles')
    .update({ role: 'super_admin' })
    .eq('user_id', idOf('admin@demo.portal')!)
    .select()
  check('[P4] admin cannot change their own role', !!ownUp.error || (ownUp.data?.length ?? 0) === 0)
  const stuUp = await adm
    .from('user_roles')
    .update({ role: 'admin' })
    .eq('user_id', idOf('student@demo.portal')!)
    .select()
  check("[P4] admin cannot change a student's role", !!stuUp.error || (stuUp.data?.length ?? 0) === 0)
  const ins = await adm
    .from('user_roles')
    .insert({ user_id: idOf('student@demo.portal')!, role: 'counselor' })
  check('[P4] admin cannot grant roles', !!ins.error)
  const delRole = await adm.from('user_roles').delete().eq('user_id', idOf('counselor@demo.portal')!).select()
  check('[P4] admin cannot revoke roles', !!delRole.error || (delRole.data?.length ?? 0) === 0)
  const supOwn = await sup
    .from('user_roles')
    .update({ role: 'admin' })
    .eq('user_id', idOf('superadmin@demo.portal')!)
    .select()
  check('[P4] super admin cannot change their own role', !!supOwn.error || (supOwn.data?.length ?? 0) === 0)
  const after = await Promise.all(
    ['admin@demo.portal', 'student@demo.portal', 'counselor@demo.portal'].map(rolesOf),
  )
  check('[P4] ... and every role is unchanged', before.join('|') === after.join('|'), `${before} → ${after}`)

  // deactivated users lose access (existing sessions included); restored afterwards
  const victimEmail = 'kavindu.jayasinghe@demo.portal'
  const victim = await signIn(victimEmail)
  const cnsl = await signIn('counselor@demo.portal')
  const setActive = (email: string, v: boolean) =>
    admin.from('profiles').update({ is_active: v }).eq('id', idOf(email)!)
  try {
    await setActive(victimEmail, false)
    await setActive('counselor@demo.portal', false)
    check('[P4] deactivated student reads no student rows', (await count(victim, 'students')) === 0)
    check('[P4] deactivated student reads no documents', (await count(victim, 'documents')) === 0)
    check(
      '[P4] deactivated student cannot load profile completion',
      !!(await victim.rpc('profile_completion')).error,
    )
    check('[P4] deactivated counselor reads no students', (await count(cnsl, 'students')) === 0)
    check('[P4] deactivated counselor has no dashboard', !!(await cnsl.rpc('counselor_dashboard')).error)
    const sw = await adm
      .from('profiles')
      .update({ is_active: false })
      .eq('id', idOf('counselor@demo.portal')!)
      .select()
    check('[P4] an admin cannot change a staff account status', !!sw.error || (sw.data?.length ?? 0) === 0)
  } finally {
    await setActive(victimEmail, true)
    await setActive('counselor@demo.portal', true)
  }
  check('[P4] reactivated student has access again', (await count(victim, 'students')) === 1)

  // GATE: reject with reason → student sees it → replacement → approve; notification + audit per step
  const other = (await admin.from('document_types').select('id').eq('key', 'other').single()).data!
  const p1 = `${aId}/other/${crypto.randomUUID()}-verify-live-gate.pdf`
  await a.storage
    .from('student-documents')
    .upload(p1, pdfBytes('gate v1'), { contentType: 'application/pdf' })
  const created = await a
    .from('documents')
    .insert({
      student_id: aId,
      document_type_id: other.id,
      category: 'other',
      custom_type_name: 'verify-live gate',
      file_path: p1,
      file_name: 'verify-live-gate.pdf',
      file_size: 40,
      mime_type: 'application/pdf',
    })
    .select()
    .single()
  const doc = created.data
  if (!doc) {
    check('[GATE] test document created', false, created.error?.message)
    return
  }
  const notes = async (email: string, type: string) =>
    (
      await admin
        .from('notifications')
        .select('id, body, title, link', { count: 'exact' })
        .eq('recipient_id', idOf(email)!)
        .eq('type', type)
        .like('link', `%${doc.id}%`)
    ).data ?? []
  const reason = 'verify-live: the scan is blurred'
  const fix = 'verify-live: upload a clear colour scan'
  try {
    const empty = await adm.rpc('review_document', { p_document_id: doc.id, p_action: 'rejected' })
    check('[GATE] reject without a reason is refused', !!empty.error)
    const rej = await adm.rpc('review_document', {
      p_document_id: doc.id,
      p_action: 'rejected',
      p_reason: reason,
      p_required_action: fix,
    })
    check('[GATE] admin rejects with a reason', !rej.error, rej.error?.message)
    const seen = (
      await a.from('documents').select('status, rejection_reason, required_action').eq('id', doc.id).single()
    ).data
    check(
      '[GATE] student sees the reason and the required action',
      seen?.status === 'rejected' && seen.rejection_reason === reason && seen.required_action === fix,
      JSON.stringify(seen),
    )
    check(
      '[GATE] student notified of the rejection',
      (await notes('student@demo.portal', 'document_rejected')).some((n) => n.body === reason),
    )
    const p2 = `${aId}/other/${crypto.randomUUID()}-verify-live-gate-v2.pdf`
    await a.storage
      .from('student-documents')
      .upload(p2, pdfBytes('gate v2'), { contentType: 'application/pdf' })
    const rep = await a.rpc('replace_document', {
      p_document_id: doc.id,
      p_file_path: p2,
      p_file_name: 'verify-live-gate-v2.pdf',
      p_file_size: 40,
      p_mime_type: 'application/pdf',
    })
    check(
      '[GATE] student uploads a replacement (version 2)',
      !rep.error && rep.data?.version === 2,
      rep.error?.message,
    )
    const hasCounselor = (await admin.from('students').select('counselor_id').eq('id', aId).single()).data
      ?.counselor_id
    if (hasCounselor)
      check(
        '[GATE] assigned counselor notified of the new version',
        (await notes('counselor@demo.portal', 'document_uploaded')).length > 0,
      )
    const ok = await adm.rpc('review_document', { p_document_id: doc.id, p_action: 'approved' })
    check('[GATE] admin approves version 2', !ok.error && ok.data?.status === 'approved', ok.error?.message)
    check(
      '[GATE] student notified of the approval',
      (await notes('student@demo.portal', 'document_approved')).length > 0,
    )
    const trail = (
      (
        await admin
          .from('audit_logs')
          .select('action, actor_id')
          .eq('entity_id', doc.id)
          .in('action', ['document.rejected', 'document.replaced', 'document.approved'])
          .order('created_at')
      ).data ?? []
    ).map(
      (r) =>
        `${r.action}:${r.actor_id === idOf('admin@demo.portal') ? 'admin' : r.actor_id === idOf('student@demo.portal') ? 'student' : '?'}`,
    )
    check(
      '[GATE] audit trail has one entry per step, in order, with the right actor',
      trail.join(' ') === 'document.rejected:admin document.replaced:student document.approved:admin',
      trail.join(' '),
    )
    const reviews =
      (await admin.from('document_reviews').select('action').eq('document_id', doc.id)).data ?? []
    check('[GATE] both reviews are kept in the history', reviews.length === 2, `reviews=${reviews.length}`)
    check('[GATE] audit has the upload too', (await auditCount('document.uploaded', doc.id)) > 0)
  } finally {
    const paths = (await adm.rpc('delete_document', { p_document_id: doc.id })).data ?? []
    if (paths.length) await admin.storage.from('student-documents').remove(paths)
    await admin.from('notifications').delete().like('link', `%${doc.id}%`)
  }

  // Edge Function (only once deployed with `supabase functions deploy admin-create-user`)
  const fnUrl = `${url}/functions/v1/admin-create-user`
  const body = JSON.stringify({
    email: `verify-live-${Date.now()}@example.com`,
    first_name: 'V',
    last_name: 'L',
    role: 'counselor',
  })
  const noAuth = await fetch(fnUrl, {
    method: 'POST',
    headers: { apikey: anonKey!, 'Content-Type': 'application/json' },
    body,
  })
  if (noAuth.status === 404) {
    skip(
      '[P4] admin-create-user Edge Function',
      'not deployed (404): run `supabase functions deploy admin-create-user`',
    )
    return
  }
  check(
    '[P4] Edge Function refuses an anonymous caller (401)',
    noAuth.status === 401,
    `status=${noAuth.status}`,
  )
  const tokenOf = async (c: SupabaseClient) => (await c.auth.getSession()).data.session!.access_token
  const asStudent = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${await tokenOf(a)}`,
      'Content-Type': 'application/json',
    },
    body: body.replace('"counselor"', '"student"'),
  })
  check('[P4] Edge Function refuses a student (403)', asStudent.status === 403, `status=${asStudent.status}`)
  const asAdmin = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      apikey: anonKey!,
      Authorization: `Bearer ${await tokenOf(adm)}`,
      'Content-Type': 'application/json',
    },
    body,
  })
  check(
    '[P4] Edge Function refuses an admin creating staff (403)',
    asAdmin.status === 403,
    `status=${asAdmin.status}`,
  )
}
