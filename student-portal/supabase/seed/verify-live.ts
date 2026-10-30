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
const results: { ok: boolean; name: string; detail?: string }[] = []
const check = (name: string, ok: boolean, detail?: string) => results.push({ ok, name, detail })

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

  const failed = results.filter((r) => !r.ok)
  for (const r of results)
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : `  (${r.detail})`}`)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
