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

  // 2. storage
  const signed = await a.storage.from('student-documents').createSignedUrl(bDoc.file_path, 60)
  check("[2] student cannot create a signed URL for another student's file (exact path)", !!signed.error)
  const dl = await a.storage.from('student-documents').download(bDoc.file_path)
  check("[2] student cannot download another student's file", !!dl.error)
  const own = await a.storage.from('student-documents').createSignedUrl(aDoc.file_path, 60)
  const ownFetch = own.data ? await fetch(own.data.signedUrl) : null
  check(
    '[2] student can open their own file via a short-lived signed URL',
    ownFetch?.status === 200,
    `status=${ownFetch?.status}`,
  )
  const planted = await a.storage
    .from('student-documents')
    .upload(`${bId}/identity/planted.pdf`, new Blob(['%PDF-1.4']), { contentType: 'application/pdf' })
  check("[2] student cannot upload into another student's folder", !!planted.error)

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

  // 8. buckets private
  const pub = await fetch(`${url}/storage/v1/object/public/student-documents/${bDoc.file_path}`)
  check('[8] public URL to a stored document is refused', pub.status >= 400, `status=${pub.status}`)

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
