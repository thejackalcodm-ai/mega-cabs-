/**
 * Browser tests for Phase 2 (auth, guards, layouts) against a mocked Supabase API.
 *   npm run e2e            (needs Playwright + Chromium: npx playwright install chromium)
 * Screenshots go to $E2E_SCREENSHOTS (default: e2e/.screenshots, git-ignored).
 */
import { execSync, spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createMock } from './mock-supabase.mjs'

const require = createRequire(import.meta.url)
let playwright
try {
  playwright = require('playwright')
} catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))
}

const MOCK_PORT = 54399
const APP_PORT = 5174
const APP = `http://localhost:${APP_PORT}`
const SHOTS = process.env.E2E_SCREENSHOTS ?? path.resolve('e2e/.screenshots')
mkdirSync(SHOTS, { recursive: true })

const { server, calls, users, db, audit, objects, failures } = createMock()
await new Promise((r) => server.listen(MOCK_PORT, r))
const vite = spawn('npx', ['vite', '--port', String(APP_PORT), '--strictPort'], {
  env: {
    ...process.env,
    VITE_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key-for-e2e-tests-only',
    VITE_ENABLE_DEMO_LOGIN: 'true',
  },
  stdio: 'ignore',
})
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(APP)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}

const browser = await playwright.chromium.launch()
const results = []
const consoleErrors = []
async function test(name, fn, viewport = { width: 1280, height: 860 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  page.setDefaultTimeout(10_000)
  page.on('pageerror', (e) => consoleErrors.push(`${name}: ${e.message}`))
  try {
    await fn(page)
    results.push({ name, ok: true })
  } catch (e) {
    results.push({ name, ok: false, error: e.message.split('\n')[0] })
    await page
      .screenshot({ path: path.join(SHOTS, `FAIL-${name.replace(/\W+/g, '-')}.png`), fullPage: true })
      .catch(() => {})
  } finally {
    await context.close()
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg)
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
async function demoLogin(page, role) {
  await page.goto(`${APP}/login`)
  await page.getByRole('button', { name: role, exact: true }).click()
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

// ------------------------------------------------------------------ registration
await test('register: validation errors are shown', async (page) => {
  await page.goto(`${APP}/register`)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('Enter your first name').waitFor()
  await page.getByText('Select your country').waitFor()
  await page.getByLabel(/^Password( \*)?$/).fill('weak')
  await page.getByLabel('Confirm password').fill('other')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByText("Passwords don't match").waitFor()
  await shot(page, 'register-validation')
})

await test('register: new student → verify email page; signup sends registration fields', async (page) => {
  await page.goto(`${APP}/register`)
  await page.getByLabel('First name').fill('Ravi')
  await page.getByLabel('Last name').fill('Perera')
  await page.getByLabel('Email').fill('ravi.perera@example.com')
  await page.getByLabel('Phone').fill('+94 77 555 1234')
  await page.getByLabel('Country').selectOption('Sri Lanka')
  await page.getByLabel(/^Password( \*)?$/).fill('Strong#Pass9')
  await page.getByLabel('Confirm password').fill('Strong#Pass9')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.waitForURL(/\/verify-email/)
  await page.getByText('ravi.perera@example.com').waitFor()
  const signup = calls.find((c) => c.path === '/auth/v1/signup' && c.body.email === 'ravi.perera@example.com')
  assert(signup, 'no signup call')
  assert(
    signup.body.data.first_name === 'Ravi' &&
      signup.body.data.country === 'Sri Lanka' &&
      signup.body.data.phone === '+94 77 555 1234',
    'metadata not sent',
  )
  assert(!('role' in signup.body.data), 'client must not send a role')
  assert(
    decodeURIComponent(signup.query).includes(`redirect_to=${APP}/auth/callback`),
    'verification redirect not set',
  )
  await page.getByRole('button', { name: /Resend available in/ }).waitFor()
  await shot(page, 'verify-email')
})

await test('register: existing email shows a friendly message', async (page) => {
  await page.goto(`${APP}/register`)
  await page.getByLabel('First name').fill('Nimali')
  await page.getByLabel('Last name').fill('Fernando')
  await page.getByLabel('Email').fill('student@demo.portal')
  await page.getByLabel('Phone').fill('+94 77 000 1001')
  await page.getByLabel('Country').selectOption('Sri Lanka')
  await page.getByLabel(/^Password( \*)?$/).fill('Strong#Pass9')
  await page.getByLabel('Confirm password').fill('Strong#Pass9')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('An account with this email already exists').waitFor()
})

// ------------------------------------------------------------------ login
await test('login: wrong password shows a friendly error', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('Email').fill('student@demo.portal')
  await page.getByLabel(/^Password( \*)?$/).fill('nope')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText("That email and password don't match").waitFor()
})

await test('login: unverified email explains and offers resend', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('Email').fill('unverified@demo.portal')
  await page.getByLabel(/^Password( \*)?$/).fill('Demo#Pass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.getByText('Please verify your email address first').waitFor()
  await page.getByRole('link', { name: 'Resend the link' }).waitFor()
})

await test('login: deactivated account sees the inactive page', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('Email').fill('inactive@demo.portal')
  await page.getByLabel(/^Password( \*)?$/).fill('Demo#Pass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(/\/app/)
  await page.getByRole('heading', { name: 'Your account is inactive' }).waitFor()
})

await test('login form: student lands on /app with greeting and real data', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('Email').fill('student@demo.portal')
  await page.getByLabel(/^Password( \*)?$/).fill('Demo#Pass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${APP}/app`)
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening), Nimali/ }).waitFor()
  await page.getByText('88%').waitFor()
  await page.getByText('Bank Statement needs resubmission').waitFor()
  await page.getByRole('link', { name: 'Notifications, 2 unread' }).waitFor()
  await page.getByRole('link', { name: 'Messages, 1 unread' }).waitFor()
  assert(
    calls.some((c) => c.path === '/rest/v1/rpc/log_client_event' && c.body.p_action === 'auth.login'),
    'login not audited',
  )
})

// ------------------------------------------------------------------ each demo role → correct shell
const ROLES = [
  ['Student', '/app', /Nimali/, ['My Applications', 'Documents', 'My Learning'], ['Students', 'Audit log']],
  [
    'Counselor',
    '/admin',
    /Priya/,
    ['Students', 'Applications', 'Documents'],
    ['Courses', 'Payments', 'Audit log'],
  ],
  [
    'Instructor',
    '/admin',
    /Marcus/,
    ['Courses', 'Lessons', 'Assignments', 'Quizzes'],
    ['Students', 'Payments'],
  ],
  ['Admin', '/admin', /Daniel/, ['Students', 'Courses', 'Payments', 'Reports', 'Audit log'], []],
  ['Super Admin', '/admin', /Sofia/, ['Students', 'Courses', 'Payments', 'Audit log'], []],
]
for (const [role, home, name, visible, hidden] of ROLES) {
  await test(`demo login: ${role} lands on ${home} with the right sidebar`, async (page) => {
    await demoLogin(page, role)
    await page.waitForURL(`${APP}${home}`)
    await page.getByRole('heading', { name }).waitFor()
    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const item of visible) await nav.getByRole('link', { name: item, exact: true }).waitFor()
    for (const item of hidden)
      assert(
        (await nav.getByRole('link', { name: item, exact: true }).count()) === 0,
        `${role} should not see ${item}`,
      )
    if (role === 'Counselor') {
      await page.getByText('Kavindu Jayasinghe').waitFor()
      assert((await page.getByText('Farhan Siddiqui').count()) === 0, 'counselor sees unassigned student')
    }
    if (role === 'Instructor') await page.getByText('IELTS Academic Complete').waitFor()
    if (role === 'Admin') await page.getByText('Total students').waitFor()
    await shot(page, `dashboard-${role.toLowerCase().replace(' ', '-')}`)
  })
}

// ------------------------------------------------------------------ wrong-role access
const DENY = [
  ['Student', '/admin'],
  ['Student', '/admin/students'],
  ['Counselor', '/app'],
  ['Counselor', '/admin/courses'],
  ['Counselor', '/admin/audit'],
  ['Instructor', '/admin/students'],
  ['Instructor', '/admin/payments'],
  ['Admin', '/app/documents'],
]
for (const [role, target] of DENY) {
  await test(`not authorized: ${role} opening ${target}`, async (page) => {
    await demoLogin(page, role)
    await page.waitForURL(/\/(app|admin)$/)
    await page.goto(`${APP}${target}`)
    await page.waitForURL(`${APP}/unauthorized`)
    await page.getByRole('heading', { name: "You don't have access to this page" }).waitFor()
    await page.getByText(target, { exact: true }).waitFor()
    if (role === 'Student' && target === '/admin') await shot(page, 'not-authorized')
    await page.getByRole('link', { name: 'Go to my dashboard' }).click()
    await page.waitForURL(`${APP}${role === 'Student' ? '/app' : '/admin'}`)
  })
}

await test('allowed deep link: counselor opens /admin/students (their students, no admin actions)', async (page) => {
  await demoLogin(page, 'Counselor')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students`)
  await page.getByRole('heading', { name: 'My students' }).waitFor()
  assert(
    (await page.getByRole('button', { name: /Add student/ }).count()) === 0,
    'counselor offered Add student',
  )
})

await test('signed-out visitor opening /app/documents is sent to login, then back after sign-in', async (page) => {
  await page.goto(`${APP}/app/documents`)
  await page.waitForURL(`${APP}/login`)
  await page.getByLabel('Email').fill('student@demo.portal')
  await page.getByLabel(/^Password( \*)?$/).fill('Demo#Pass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${APP}/app/documents`)
})

// ------------------------------------------------------------------ session
await test('session persists across reload and new tab', async (page) => {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  await page.reload()
  await page.getByRole('heading', { name: /Nimali/ }).waitFor()
  const second = await page.context().newPage()
  await second.goto(`${APP}/`)
  await second.waitForURL(`${APP}/app`)
})

await test('logout ends the session and protected pages redirect to login', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.waitForURL(`${APP}/login`)
  await page.getByText('You have been signed out').waitFor()
  assert(
    calls.some((c) => c.path === '/auth/v1/logout'),
    'logout not called',
  )
  assert(
    calls.some((c) => c.body?.p_action === 'auth.logout'),
    'logout not audited',
  )
  await page.goto(`${APP}/admin`)
  await page.waitForURL(`${APP}/login`)
})

// ------------------------------------------------------------------ password reset
await test('forgot password: generic confirmation (no account enumeration)', async (page) => {
  await page.goto(`${APP}/forgot-password`)
  await page.getByLabel('Email').fill('nobody@example.com')
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await page.getByText('If an account exists for').waitFor()
  const recover = calls.find((c) => c.path === '/auth/v1/recover')
  assert(
    recover && /\/reset-password/.test(decodeURIComponent(recover.query) + JSON.stringify(recover.body)),
    'reset redirect not set',
  )
})

await test('reset password: expired link without a session', async (page) => {
  await page.goto(`${APP}/reset-password`)
  await page.getByRole('heading', { name: 'This link has expired' }).waitFor()
})

await test('reset password: signed-in recovery session can set a new password', async (page) => {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  await page.goto(`${APP}/reset-password`)
  await page.getByLabel(/^New password/).fill('Another#Pass7')
  await page.getByLabel('Confirm new password').fill('Another#Pass7')
  await page.getByRole('button', { name: 'Update password' }).click()
  await page.waitForURL(`${APP}/app`)
  assert(users.get('student@demo.portal').password === 'Another#Pass7', 'password not updated')
  users.get('student@demo.portal').password = 'Demo#Pass123'
})

await test('verification link error is explained', async (page) => {
  await page.goto(
    `${APP}/auth/callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired`,
  )
  await page.getByRole('heading', { name: "We couldn't verify your email" }).waitFor()
})

await test('unknown route shows 404', async (page) => {
  await page.goto(`${APP}/definitely-not-here`)
  await page.getByRole('heading', { name: 'Page not found' }).waitFor()
})

// ------------------------------------------------------------------ responsive
await test(
  'mobile 375px: student bottom nav + drawer, no horizontal scroll',
  async (page) => {
    await demoLogin(page, 'Student')
    await page.waitForURL(`${APP}/app`)
    await page.getByRole('heading', { name: /Nimali/ }).waitFor()
    assert(await noOverflow(page), 'horizontal overflow at 375px')
    const bottom = page.getByRole('navigation', { name: 'Quick navigation' })
    await bottom.getByRole('link', { name: 'Applications' }).waitFor()
    await shot(page, 'mobile-student-dashboard')
    await bottom.getByRole('button', { name: 'More' }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'Help & Support' }).click()
    await page.waitForURL(`${APP}/app/support`)
  },
  { width: 375, height: 812 },
)

await test(
  'mobile 375px: login + register have no horizontal scroll',
  async (page) => {
    await page.goto(`${APP}/login`)
    assert(await noOverflow(page), 'login overflows')
    await shot(page, 'mobile-login')
    await page.goto(`${APP}/register`)
    assert(await noOverflow(page), 'register overflows')
  },
  { width: 375, height: 812 },
)

await test(
  'mobile 375px: admin uses the drawer and table stays inside the page',
  async (page) => {
    await demoLogin(page, 'Admin')
    await page.waitForURL(`${APP}/admin`)
    await page.getByText('Applications by status').waitFor()
    assert(await noOverflow(page), 'admin overflows at 375px')
    await page.goto(`${APP}/admin/students`)
    await page.getByText('Farhan Siddiqui').first().waitFor()
    assert(await noOverflow(page), 'students table overflows at 375px')
    await page.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('dialog').getByRole('link', { name: 'Audit log' }).waitFor()
    await shot(page, 'mobile-admin-drawer')
  },
  { width: 375, height: 812 },
)

await test(
  'tablet 768px: sidebar is a collapsible icon rail',
  async (page) => {
    await demoLogin(page, 'Student')
    await page.waitForURL(`${APP}/app`)
    const aside = page.locator('aside').first()
    const w = (await aside.boundingBox()).width
    assert(w < 90, `rail expected, got ${w}px`)
    assert(await noOverflow(page), 'overflow at 768px')
    await shot(page, 'tablet-student-rail')
    await page.getByRole('button', { name: 'Expand sidebar' }).click()
    await page.waitForTimeout(400) // width transition
    assert((await aside.boundingBox()).width > 200, 'did not expand')
    await page.reload()
    await page.getByRole('heading', { name: /Nimali/ }).waitFor()
    assert((await page.locator('aside').first().boundingBox()).width > 200, 'preference not remembered')
  },
  { width: 768, height: 1024 },
)

await test('desktop 1280px: full sidebar', async (page) => {
  await demoLogin(page, 'Counselor')
  await page.waitForURL(`${APP}/admin`)
  assert((await page.locator('aside').first().boundingBox()).width > 200, 'expected full sidebar')
  await shot(page, 'desktop-login')
})

await test('keyboard: Tab reaches the login form with a visible focus ring', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor()
  await page.keyboard.press('Tab')
  const focus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    ring: getComputedStyle(document.activeElement).boxShadow,
  }))
  assert(focus.tag === 'INPUT', `expected the email input, got ${focus.tag}`)
  assert(focus.ring && focus.ring !== 'none', 'no visible focus ring')
})

await test('keyboard: skip link is the first stop in the app shell', async (page) => {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  await page.getByRole('heading', { name: /Nimali/ }).waitFor()
  await page.keyboard.press('Tab')
  assert(
    (await page.evaluate(() => document.activeElement?.textContent)) === 'Skip to content',
    'skip link not first',
  )
})

// ================================================================== Phase 3: documents, profile, onboarding
const pdf = (name, extra = '') => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`%PDF-1.4\n% demo ${extra}\n1 0 obj<<>>endobj\n%%EOF\n`),
})
const studentId = () => db.students.find((x) => x.profile_id === users.get('student@demo.portal').id).id
const card = (page, title) => page.locator('[aria-label^="' + title + ', "]')

async function studentDocs(page) {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  await page.goto(`${APP}/app/documents`)
  await page.getByRole('heading', { name: 'My documents' }).waitFor()
  await card(page, 'Passport').waitFor()
}

await test('documents: checklist, statuses and reviewer feedback are shown', async (page) => {
  await studentDocs(page)
  await page.getByText('Northbridge University').waitFor()
  await page.getByText('20%', { exact: true }).waitFor() // 1 of 5 required approved
  await page.getByText('1 of 5 required approved').waitFor()
  const bank = card(page, 'Bank Statement')
  await bank.getByText('Resubmission required', { exact: false }).first().waitFor()
  await bank.getByText('The statement is older than 31 days.').waitFor()
  await bank.getByText('Upload a statement dated within the last 31 days.').waitFor()
  await bank.getByText('Ask your bank for a stamped statement.').waitFor()
  assert(
    (await card(page, 'Passport')
      .getByRole('button', { name: /Delete/ })
      .count()) === 0,
    'approved document must not offer delete',
  )
  assert(
    (await card(page, 'Passport')
      .getByRole('button', { name: /Replace/ })
      .count()) === 0,
    'approved document must not offer replace',
  )
  assert(
    (await card(page, 'IELTS Certificate')
      .getByRole('button', { name: /Delete/ })
      .count()) === 0,
    'under-review document must not offer delete',
  )
  await shot(page, 'documents-student')
})

await test('documents: file validation rejects wrong type, renamed executables and >10 MB', async (page) => {
  await studentDocs(page)
  await page.getByRole('button', { name: 'Upload document' }).click()
  const input = page.getByRole('dialog').locator('input[type=file]')
  await input.setInputFiles({
    name: 'setup.exe',
    mimeType: 'application/x-msdownload',
    buffer: Buffer.from('MZ\x90\x00'),
  })
  await page.getByText("This file type isn't allowed").waitFor()
  await input.setInputFiles({
    name: 'passport.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('MZ\x90\x00 not a pdf'),
  })
  await page.getByText("doesn't look like a valid PDF").waitFor()
  await input.setInputFiles({
    name: 'huge.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(10 * 1024 * 1024)]),
  })
  await page.getByText('The limit is 10 MB').waitFor()
  await input.setInputFiles({
    name: 'photo.png',
    mimeType: 'image/jpeg',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  })
  await page.getByText("contents don't match its extension").waitFor()
  assert(
    !calls.some(
      (c) =>
        c.method === 'POST' &&
        c.path.startsWith('/storage/v1/object/student-documents/') &&
        /exe|huge/.test(c.path),
    ),
    'invalid file reached storage',
  )
})

await test('GATE documents: student uploads a document to private storage (sanitised name, audited)', async (page) => {
  await studentDocs(page)
  await page.getByRole('button', { name: 'Upload document' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Category/).selectOption('education')
  await dialog.getByLabel(/^Document type/).selectOption({ label: 'Transcript' })
  await dialog.locator('input[type=file]').setInputFiles(pdf('Final Transcript (Oct) é.pdf'))
  await dialog.getByText('Final Transcript (Oct) é.pdf').waitFor()
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
  await page.getByText('Document uploaded').waitFor()
  await card(page, 'Transcript').getByText('Uploaded', { exact: true }).waitFor()
  const put = calls.find(
    (c) =>
      c.method === 'POST' &&
      c.path.includes('/storage/v1/object/student-documents/') &&
      c.path.includes('Final-Transcript'),
  )
  assert(put, 'no storage upload')
  const path = decodeURIComponent(put.path.replace('/storage/v1/object/student-documents/', ''))
  assert(
    new RegExp(`^${studentId()}/education/[0-9a-f-]{36}-Final-Transcript-Oct-e\\.pdf$`).test(path),
    `bad storage path ${path}`,
  )
  assert(
    objects.get(`student-documents/${path}`).bytes.subarray(0, 4).toString() === '%PDF',
    'stored bytes are not the PDF',
  )
  assert(
    audit.some((a) => a.action === 'document.uploaded'),
    'upload not audited',
  )
  await page.getByText('1 of 5 required approved · 2 awaiting review', { exact: false }).waitFor() // transcript now pending
})

await test('GATE documents: student replaces a document — new version, history kept, audited', async (page) => {
  await studentDocs(page)
  const bank = card(page, 'Bank Statement')
  await bank.getByRole('button', { name: 'Upload replacement' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByText('What to fix:').waitFor()
  await dialog.locator('input[type=file]').setInputFiles(pdf('bank-statement-october.pdf', 'v2'))
  await dialog.getByRole('button', { name: 'Upload new version' }).click()
  await page.getByText('Version 2 uploaded').waitFor()
  await bank.getByText('version 2', { exact: false }).waitFor()
  await bank.getByText('Uploaded', { exact: true }).waitFor()
  assert(
    (await bank.getByText('Ask your bank for a stamped statement.').count()) === 0,
    'old review comment shown on the new version',
  )
  await bank.getByRole('button', { name: /History/ }).click()
  await bank.getByText('v1', { exact: true }).waitFor()
  await bank.getByText('v2', { exact: true }).waitFor()
  assert(
    audit.some((a) => a.action === 'document.replaced' && a.version === 2),
    'replacement not audited',
  )
  assert(
    calls.some((c) => c.path === '/rest/v1/rpc/replace_document'),
    'replace_document RPC not used',
  )
})

await test('GATE documents: student previews through an audited short-lived signed URL', async (page) => {
  await studentDocs(page)
  await card(page, 'Passport').getByRole('button', { name: 'Preview Passport' }).click()
  const frame = page.getByRole('dialog').locator('iframe')
  await frame.waitFor()
  const src = await frame.getAttribute('src')
  assert(/\/storage\/v1\/object\/sign\/student-documents\/.+token=/.test(src), `not a signed URL: ${src}`)
  const auth = calls.findLast((c) => c.path === '/rest/v1/rpc/authorize_document_access')
  assert(auth?.body.p_purpose === 'view', 'preview did not request an audited grant first')
  const sign = calls.findLast((c) => c.method === 'POST' && c.path.startsWith('/storage/v1/object/sign/'))
  assert(sign.body.expiresIn === 60, `signed URL expiry should be 60s, was ${sign.body.expiresIn}`)
  assert(
    audit.some((a) => a.action === 'document.viewed'),
    'view not audited',
  )
  await shot(page, 'documents-preview')
})

await test('GATE documents: student downloads through an audited signed URL', async (page) => {
  await studentDocs(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card(page, 'Passport').getByRole('button', { name: 'Download Passport' }).click(),
  ])
  assert(
    /passport\.pdf$/.test(download.suggestedFilename()),
    `unexpected filename ${download.suggestedFilename()}`,
  )
  assert(
    audit.some((a) => a.action === 'document.downloaded'),
    'download not audited',
  )
})

await test("documents: signing another student's file path fails (mock mirrors the storage rule)", async (page) => {
  await studentDocs(page)
  const other = db.documents.find((d) => d.student_id !== studentId())
  const status = await page.evaluate(
    async ({ path, url }) => {
      const key = Object.keys(localStorage).find((k) => k.endsWith('-auth-token'))
      const token = JSON.parse(localStorage.getItem(key)).access_token
      const r = await fetch(`${url}/storage/v1/object/sign/student-documents/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{"expiresIn":60}',
      })
      return r.status
    },
    { path: other.file_path, url: 'http://127.0.0.1:54399' },
  )
  assert(status >= 400, "signing another student's file must fail")
})

await test('documents: delete is allowed only where the status permits, and is audited', async (page) => {
  await studentDocs(page)
  await page.getByRole('button', { name: 'Upload document' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Category/).selectOption('other')
  await dialog.getByLabel(/^Document type/).selectOption({ label: 'Other Document' })
  await dialog.getByLabel(/^Document name/).fill('Scholarship letter')
  await dialog.locator('input[type=file]').setInputFiles(pdf('scholarship.pdf'))
  await dialog.getByRole('button', { name: 'Upload', exact: true }).click()
  await card(page, 'Scholarship letter').waitFor()
  await card(page, 'Scholarship letter').getByRole('button', { name: 'Delete Scholarship letter' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await page.getByText('Document deleted').waitFor()
  await card(page, 'Scholarship letter').waitFor({ state: 'detached' })
  assert(
    audit.some((a) => a.action === 'document.deleted'),
    'delete not audited',
  )
  assert(
    calls.some(
      (c) =>
        c.method === 'DELETE' &&
        c.path === '/storage/v1/object/student-documents' &&
        c.body.prefixes?.[0]?.includes('scholarship'),
    ),
    'stored file not removed',
  )
})

await test('documents: error state with retry, and deep link highlight from a notification', async (page) => {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  failures.set('documents', 3) // initial try + 2 automatic retries
  await page.goto(`${APP}/app/documents`)
  await page.getByText("We couldn't load this").first().waitFor()
  await page.getByRole('button', { name: 'Try again' }).first().click()
  await card(page, 'Passport').waitFor()
  const bankId = db.documents.find(
    (d) => d.student_id === studentId() && d.document_type_id === 'type-bank_statement',
  ).id
  await page.goto(`${APP}/app/documents?doc=${bankId}`)
  await page.locator(`#doc-${bankId}.ring-2`).waitFor()
})

await test('GATE admin: the uploaded document appears in the review queue and can be previewed', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Documents' }).click()
  await page.getByRole('heading', { name: 'Document review queue' }).waitFor()
  const row = page.getByRole('row').filter({ hasText: 'Final-Transcript-Oct-e.pdf' })
  await row.getByText('Nimali Fernando').waitFor()
  await row.getByText('Uploaded').waitFor()
  await page.getByRole('row').filter({ hasText: 'Kavindu Jayasinghe' }).first().waitFor()
  await shot(page, 'admin-review-queue')
  await row.getByRole('button', { name: /^Preview/ }).click()
  await page.getByRole('dialog').locator('iframe').waitFor()
  assert(
    audit.some((a) => a.action === 'document.viewed' && a.actor === 'admin@demo.portal'),
    'admin preview not audited',
  )
})

await test('counselor queue lists assigned students only', async (page) => {
  await demoLogin(page, 'Counselor')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/documents`)
  await page.getByText('Documents from your assigned students').waitFor()
  await page.getByRole('row').filter({ hasText: 'Kavindu Jayasinghe' }).first().waitFor()
})

await test('instructor cannot open the document queue', async (page) => {
  await demoLogin(page, 'Instructor')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/documents`)
  await page.waitForURL(`${APP}/unauthorized`)
})

// ------------------------------------------------------------------ onboarding
async function loginAs(page, email) {
  await page.goto(`${APP}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel(/^Password( \*)?$/).fill('Demo#Pass123')
  await page.getByRole('button', { name: 'Sign in' }).click()
}

await test('onboarding: a new student is guided through 6 steps, can resume, and sees completion', async (page) => {
  await loginAs(page, 'new.student@demo.portal')
  await page.waitForURL(`${APP}/app/onboarding`)
  await page.getByRole('heading', { name: '1. Personal information' }).waitFor()
  await page.getByLabel(/^Date of birth/).fill('2001-03-09')
  await page.getByLabel(/^Gender/).selectOption('Female')
  await page.getByLabel(/^Nationality/).fill('Kenyan')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.getByRole('heading', { name: '2. Education' }).waitFor()
  await page.getByLabel(/^Institution/).fill('Nairobi National University (demo)')
  await page.getByLabel(/^Qualification/).fill("Bachelor's degree")
  await page.getByLabel(/^Start date/).fill('2019-09-01')
  await page.getByLabel(/^End date/).fill('2018-01-01')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.getByText('End date must be after the start date').waitFor()
  await page.getByLabel(/^End date/).fill('2023-07-01')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.getByRole('heading', { name: '3. English test' }).waitFor()
  // resume: reload lands on the same step
  await page.reload()
  await page.getByRole('heading', { name: '3. English test' }).waitFor()
  await page.getByRole('button', { name: "I haven't taken a test yet" }).click()
  await page.getByRole('heading', { name: '4. Passport' }).waitFor()
  await page.getByLabel(/^Passport number/).fill('ke1234567')
  await page.getByLabel(/^Passport expiry date/).fill('2030-05-01')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.getByRole('heading', { name: '5. Study preferences' }).waitFor()
  await page.getByText('United Kingdom', { exact: true }).click()
  await page.getByLabel(/^Study level/).selectOption('postgraduate')
  await page.getByLabel(/^Preferred intake/).selectOption({ index: 1 })
  await page.getByLabel(/^Subjects/).fill('Public Health, Data Science')
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.getByRole('heading', { name: '6. Application goals' }).waitFor()
  await page.getByRole('button', { name: 'Back' }).click()
  await page.getByRole('heading', { name: '5. Study preferences' }).waitFor()
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page
    .getByLabel(/^What do you want to achieve/)
    .fill('Study public health in the UK and work for an international NGO.')
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await page.getByText(/Your profile is \d+% complete\./).waitFor()
  const s = db.students.find((x) => x.profile_id === users.get('new.student@demo.portal').id)
  assert(s.onboarding_completed && s.onboarding_step === 7, 'onboarding not saved as complete')
  assert(
    db.student_profiles.find((p) => p.student_id === s.id)?.passport_number === 'KE1234567',
    'passport not normalised and saved',
  )
  assert(s.preferred_subjects.join('|') === 'Public Health|Data Science', 'subjects not saved as a list')
  await shot(page, 'onboarding-complete')
  await page.getByRole('link', { name: 'Go to my dashboard' }).click()
  await page.waitForURL(`${APP}/app`)
  assert(
    (await page.getByText('Finish setting up your profile').count()) === 0,
    'setup banner should be gone',
  )
})

await test('onboarding: empty states for a student with no documents or applications', async (page) => {
  await loginAs(page, 'new.student@demo.portal')
  await page.waitForURL(`${APP}/app`)
  await page.goto(`${APP}/app/documents`)
  await page.getByText('No documents yet').waitFor()
  await page.getByText('No active applications yet').waitFor()
})

// ------------------------------------------------------------------ profile
await test('profile: editing updates the completion percentage and missing list', async (page) => {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  await page.goto(`${APP}/app/profile`)
  const aside = page.getByRole('complementary', { name: 'Profile completion' })
  await aside.getByText('88%').waitFor()
  await aside.getByRole('link', { name: 'Home address' }).waitFor()
  await page.getByRole('button', { name: 'Edit contact' }).click()
  const contact = page.locator('#contact')
  await contact.getByLabel(/^Address/).fill('12 Demo Lane')
  await contact.getByRole('button', { name: 'Save' }).click()
  await page.getByText('Contact details saved').waitFor()
  await aside.getByText('94%').waitFor()
  assert(
    (await aside.getByRole('link', { name: 'Home address' }).count()) === 0,
    'address still listed as missing',
  )
  await page.getByRole('button', { name: 'Edit emergency contact' }).click()
  const em = page.locator('#emergency')
  await em.getByLabel(/^Full name/).fill('Demo Guardian')
  await em.getByLabel(/^Relationship/).fill('Parent')
  await em.getByLabel(/^Phone/).fill('+94 77 000 9999')
  await em.getByRole('button', { name: 'Save' }).click()
  await aside.getByText('100%').waitFor()
  await aside.getByText('Everything universities need is here.').waitFor()
  await shot(page, 'profile')
})

await test('profile: add and remove a work experience record; English score rules enforced', async (page) => {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  await page.goto(`${APP}/app/profile`)
  const work = page.locator('#work')
  await work.getByRole('button', { name: 'Add' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/^Company/).fill('Lanka Health Analytics')
  await dialog.getByLabel(/^Position/).fill('Data Analyst')
  await dialog.getByLabel(/^Start date/).fill('2022-09-01')
  await dialog.getByText('I work here now').click()
  await dialog.getByRole('button', { name: 'Add role' }).click()
  await work.getByText('Data Analyst').waitFor()
  await work.getByRole('button', { name: 'Delete Data Analyst' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click()
  await work.getByText('No roles yet').waitFor()
  const english = page.locator('#english')
  await english.getByRole('button', { name: 'Add' }).click()
  const d2 = page.getByRole('dialog')
  await d2.getByLabel(/^Overall score/).fill('9.5')
  await d2.getByLabel(/^Test date/).fill('2026-01-10')
  await d2.getByRole('button', { name: 'Add test result' }).click()
  await d2.getByText('IELTS Academic scores are 0–9').waitFor()
})

await test(
  'mobile 375px: documents page and upload dialog fit the screen',
  async (page) => {
    await studentDocs(page)
    assert(await noOverflow(page), 'documents page overflows at 375px')
    await page.getByRole('button', { name: 'Upload document' }).click()
    await page.getByRole('dialog').getByText('Choose a file or drag it here').waitFor()
    assert(await noOverflow(page), 'upload dialog overflows at 375px')
    await shot(page, 'mobile-documents-upload')
  },
  { width: 375, height: 812 },
)

await test(
  'mobile 375px: onboarding and profile fit the screen',
  async (page) => {
    await demoLogin(page, 'Student')
    await page.waitForURL(`${APP}/app`)
    await page.goto(`${APP}/app/profile`)
    await page.getByRole('heading', { name: 'My profile' }).waitFor()
    assert(await noOverflow(page), 'profile overflows at 375px')
    await page.goto(`${APP}/app/onboarding`)
    await page.getByText(/Your profile is \d+% complete\./).waitFor()
    assert(await noOverflow(page), 'onboarding overflows at 375px')
  },
  { width: 375, height: 812 },
)

// ------------------------------------------------------------------ Phase 4: admin & counselor workspaces
const sid = (email) => db.students.find((x) => x.profile_id === users.get(email).id).id
const notesFor = (email, type) =>
  db.notifications.filter((n) => n.recipient_id === users.get(email).id && n.type === type)

await test('admin dashboard: tiles and charts come from admin_dashboard_metrics, with a table view', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  const tile = page.getByText('Total students', { exact: true }).locator('xpath=../..')
  await tile.getByText(String(db.students.length), { exact: true }).waitFor()
  await page.getByText('Applications by status').waitFor()
  assert(
    calls.some((c) => c.path === '/rest/v1/rpc/admin_dashboard_metrics'),
    'metrics RPC not called',
  )
  await page.getByRole('button', { name: 'Show Applications by status as a table' }).click()
  await page.getByRole('table', { name: 'Applications by status' }).getByText('Documents required').waitFor()
  await shot(page, 'admin-dashboard-metrics')
})

await test('counselor dashboard: assigned students only, documents waiting, attention list', async (page) => {
  await demoLogin(page, 'Counselor')
  await page.waitForURL(`${APP}/admin`)
  await page.getByText('Documents waiting for you').waitFor()
  await page.getByRole('link', { name: /Passport.*Kavindu Jayasinghe/ }).waitFor()
  await page.getByText('Students who need attention').waitFor()
  await page.getByRole('link', { name: /Nimali Fernando.*Northbridge/ }).waitFor()
  assert((await page.getByText('Farhan Siddiqui').count()) === 0, 'unassigned student on counselor dashboard')
  await shot(page, 'counselor-dashboard')
})

await test('counselor: students list is scoped and an unassigned student cannot be opened', async (page) => {
  await demoLogin(page, 'Counselor')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students`)
  await page.getByRole('row').filter({ hasText: 'Kavindu Jayasinghe' }).waitFor()
  assert(
    (await page.getByRole('row').filter({ hasText: 'Farhan Siddiqui' }).count()) === 0,
    'unassigned student listed',
  )
  await page.goto(`${APP}/admin/students/${sid('farhan.siddiqui@demo.portal')}`)
  await page.getByText('Student not found').waitFor()
  assert((await page.getByRole('button', { name: /Assign counselor/ }).count()) === 0, 'counselor can assign')
})

await test('students: admin searches and filters the directory', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Students', exact: true })
    .click()
  await page.getByRole('heading', { name: 'Students' }).waitFor()
  await page.getByRole('row').filter({ hasText: 'Farhan Siddiqui' }).waitFor()
  await page.getByLabel('Filter by counselor').selectOption('none')
  await page.getByRole('row').filter({ hasText: 'Farhan Siddiqui' }).waitFor()
  assert(
    (await page.getByRole('row').filter({ hasText: 'Kavindu' }).count()) === 0,
    'unassigned filter failed',
  )
  await page.getByLabel('Filter by counselor').selectOption('')
  await page.getByPlaceholder('Search name, email, ID or phone').fill('STU-1002')
  await page.getByRole('row').filter({ hasText: 'Kavindu Jayasinghe' }).waitFor()
  assert((await page.getByRole('row').filter({ hasText: 'Nimali' }).count()) === 0, 'search failed')
  await shot(page, 'admin-students')
})

await test('student detail: every tab loads real data; audit tab is admin-only', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students/${studentId()}`)
  await page.getByRole('heading', { name: 'Nimali Fernando' }).waitFor()
  await page.getByText('Sri Lankan').waitFor()
  const tab = (n) => page.getByRole('tab', { name: n, exact: true }).click()
  await tab('applications')
  await page.getByRole('tabpanel').getByText('Northbridge University').waitFor()
  await tab('documents')
  await page.getByRole('tabpanel').getByText('Bank Statement').waitFor()
  await tab('learning')
  await page.getByRole('tabpanel').getByText('IELTS Academic Complete').waitFor()
  await tab('payments')
  await page.getByText('No invoices').waitFor()
  await tab('messages')
  await page.getByText('No conversations yet').waitFor()
  await tab('audit')
  await page.getByRole('tabpanel').getByRole('table').waitFor()
  await shot(page, 'admin-student-detail')
})

await test('student detail: admin requests a document (student notified, audited)', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students/${studentId()}?tab=documents`)
  await page.getByRole('button', { name: 'Request a document' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Send request' }).click()
  await dialog.getByText('Choose a document type').waitFor()
  await dialog.getByLabel(/Document type/).selectOption({ label: 'TB Certificate' })
  await dialog.getByLabel(/Message/).fill('Needed for the visa file by Friday.')
  await dialog.getByRole('button', { name: 'Send request' }).click()
  await page.getByText('Request sent').waitFor()
  assert(
    notesFor('student@demo.portal', 'document_required').some((n) => n.body.includes('Friday')),
    'student not notified',
  )
  assert(
    audit.some((a) => a.action === 'document.requested'),
    'request not audited',
  )
})

await test('assign counselor: admin assigns, both people are notified, the change is audited', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students/${sid('farhan.siddiqui@demo.portal')}`)
  await page.getByText('Counselor: Unassigned').waitFor()
  await page.getByRole('button', { name: 'Assign counselor' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Counselor').selectOption(`staff-${users.get('counselor@demo.portal').id}`)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await page.getByText('Counselor: Priya Raman').waitFor()
  assert(notesFor('counselor@demo.portal', 'counselor_assigned').length === 1, 'counselor not notified')
  assert(notesFor('farhan.siddiqui@demo.portal', 'counselor_assigned').length === 1, 'student not notified')
  assert(
    audit.some((a) => a.action === 'student.counselor_assigned' && a.actor === 'admin@demo.portal'),
    'not audited',
  )
})

await test('add student: created through the Edge Function with the admin JWT (no secret key in the browser)', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students`)
  await page.getByRole('button', { name: 'Add student' }).click()
  const dialog = page.getByRole('dialog')
  assert((await dialog.getByLabel(/^Role/).count()) === 0, 'admin offered staff roles')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await dialog.getByText('Enter your first name').waitFor()
  await dialog.getByLabel(/First name/).fill('Tariq')
  await dialog.getByLabel(/Last name/).fill('Hamid')
  await dialog.getByLabel(/^Email( \*)?$/).fill('student@demo.portal')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('An account with this email already exists.').waitFor()
  await dialog.getByLabel(/^Email( \*)?$/).fill('tariq.hamid@example.com')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('Account created').waitFor()
  await page.getByRole('row').filter({ hasText: 'Tariq Hamid' }).waitFor()
  const call = calls.filter((c) => c.path === '/functions/v1/admin-create-user').pop()
  assert(
    call.body.role === 'student' && call.body.email === 'tariq.hamid@example.com',
    'wrong function payload',
  )
  assert(!JSON.stringify(calls).includes('service_role'), 'service role mentioned in a browser request')
  assert(
    audit.some((a) => a.action === 'user.created' && a.actor === 'admin@demo.portal'),
    'creation not audited',
  )
})

await test('super admin may create staff; admin is refused by the function', async (page) => {
  const res = await fetch(`http://127.0.0.1:${MOCK_PORT}/functions/v1/admin-create-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'x@example.com', first_name: 'X', last_name: 'Y', role: 'counselor' }),
  })
  assert(res.status === 401, `anonymous call should be 401, got ${res.status}`)
  await demoLogin(page, 'Super Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students`)
  await page.getByRole('button', { name: 'Add user' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/First name/).fill('Lena')
  await dialog.getByLabel(/Last name/).fill('Cho')
  await dialog.getByLabel(/^Email( \*)?$/).fill('lena.cho@example.com')
  await dialog.getByLabel(/^Role/).selectOption('counselor')
  await dialog.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('Account created').waitFor()
  assert(users.get('lena.cho@example.com')?.role === 'counselor', 'staff account not created')
})

await test('deactivate: admin deactivates a student, who then loses access; reactivation restores it', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students/${sid('tariq.hamid@example.com')}`)
  await page.getByRole('button', { name: 'Deactivate' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click()
  await page.getByText('Account deactivated').waitFor()
  await page.getByText('Deactivated', { exact: true }).waitFor()
  assert(users.get('tariq.hamid@example.com').active === false, 'not deactivated')
  assert(
    audit.some((a) => a.action === 'profile.deactivated'),
    'deactivation not audited',
  )
  const page2 = await page.context().browser().newPage()
  await loginAs(page2, 'tariq.hamid@example.com')
  await page2
    .getByText(/inactive|deactivated/i)
    .first()
    .waitFor()
  await page2.close()
  await page.getByRole('button', { name: 'Reactivate' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivate' }).click()
  await page.getByText('Account reactivated').waitFor()
  assert(users.get('tariq.hamid@example.com').active === true, 'not reactivated')
})

const ieltsId = () =>
  db.documents.find((d) => d.student_id === studentId() && d.document_type_id === 'type-ielts').id

await test('review workspace: reject and resubmission need a reason (nothing is sent without one)', async (page) => {
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/documents/${ieltsId()}`)
  await page.getByRole('heading', { name: 'IELTS Certificate' }).waitFor()
  await page.locator('iframe').waitFor()
  await page.getByText('Version history').waitFor()
  const before = calls.filter((c) => c.path === '/rest/v1/rpc/review_document').length
  await page.locator('label').filter({ hasText: 'Reject' }).click()
  await page.getByRole('button', { name: 'Reject' }).click()
  await page.getByText('Give the student a reason (at least 5 characters)').waitFor()
  assert(
    calls.filter((c) => c.path === '/rest/v1/rpc/review_document').length === before,
    'RPC called without a reason',
  )
  await shot(page, 'review-workspace')
})

await test('GATE review: reject with reason → student sees it → uploads replacement → admin approves; notifications and audit for each step', async (page) => {
  const reason = 'The scan is blurred and the TRF number is unreadable.'
  const fix = 'Upload a clear colour scan of the full Test Report Form.'
  // 1. admin rejects with a reason
  await demoLogin(page, 'Admin')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/documents/${ieltsId()}`)
  await page.locator('label').filter({ hasText: 'Reject' }).click()
  await page.getByLabel(/Reason/).fill(reason)
  await page.getByLabel(/What the student should do/).fill(fix)
  await page.getByRole('button', { name: 'Reject' }).click()
  await page.getByText('Document rejected').waitFor()
  await page.getByText(`Reason: ${reason}`, { exact: false }).first().waitFor()
  const review = calls.filter((c) => c.path === '/rest/v1/rpc/review_document').pop()
  assert(
    review.body.p_action === 'rejected' &&
      review.body.p_reason === reason &&
      review.body.p_required_action === fix,
    'wrong RPC args',
  )
  assert(
    notesFor('student@demo.portal', 'document_rejected').some((n) => n.body === reason),
    'student not notified of rejection',
  )

  // 2. the student sees the reason and the required action, and uploads a replacement
  const student = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1280, height: 860 } })
  const sp = await student.newPage()
  await studentDocs(sp)
  const ielts = card(sp, 'IELTS Certificate')
  await ielts.getByText(reason).waitFor()
  await ielts.getByText(fix).waitFor()
  await sp.goto(`${APP}/app`)
  await sp.getByText('IELTS Certificate rejected').waitFor()
  await sp.goto(`${APP}/app/documents`)
  await card(sp, 'IELTS Certificate').getByRole('button', { name: 'Upload replacement' }).click()
  const dialog = sp.getByRole('dialog')
  await dialog.getByText(fix).waitFor()
  await dialog.locator('input[type=file]').setInputFiles(pdf('ielts-trf-clear.pdf', 'v2'))
  await dialog.getByRole('button', { name: 'Upload new version' }).click()
  await sp.getByText('Version 2 uploaded').waitFor()
  await shot(sp, 'gate-student-replaced')
  await student.close()
  assert(
    notesFor('counselor@demo.portal', 'document_uploaded').some((n) => n.body.includes('version 2')),
    'counselor not notified of the new version',
  )

  // 3. the admin approves version 2
  await page.reload()
  await page.getByText('Version 2', { exact: false }).first().waitFor()
  await page.getByText('ielts-trf-clear.pdf', { exact: false }).first().waitFor()
  await page.locator('label').filter({ hasText: 'Approve' }).click()
  await page.getByRole('button', { name: 'Approve' }).click()
  await page.getByText('Document approved').waitFor()
  await page.getByText(reason).first().waitFor() // previous review kept in the history
  assert(
    notesFor('student@demo.portal', 'document_approved').some(
      (n) => n.title === 'IELTS Certificate approved',
    ),
    'student not notified of approval',
  )

  // audit trail: one entry per step, in order, with the right actor
  const trail = audit.filter(
    (a) =>
      a.documentId === ieltsId() &&
      ['document.rejected', 'document.replaced', 'document.approved'].includes(a.action),
  )
  assert(
    trail.map((a) => `${a.action}:${a.actor}`).join(' ') ===
      'document.rejected:admin@demo.portal document.replaced:student@demo.portal document.approved:admin@demo.portal',
    `audit trail wrong: ${trail.map((a) => a.action).join(', ')}`,
  )
  await page.getByText('Audit trail').waitFor()
  await page.getByText('document.approved').waitFor()
  await shot(page, 'gate-admin-approved')
})

await test('student cannot open the review workspace; instructor cannot open student detail', async (page) => {
  await demoLogin(page, 'Student')
  await page.waitForURL(`${APP}/app`)
  await page.goto(`${APP}/admin/documents/${ieltsId()}`)
  await page.waitForURL(`${APP}/unauthorized`)
  const r = await page.evaluate(async (port) => {
    const key = Object.keys(localStorage).find((k) => k.includes('auth-token'))
    const token = JSON.parse(localStorage.getItem(key)).access_token
    const res = await fetch(`http://127.0.0.1:${port}/rest/v1/rpc/review_document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ p_document_id: 'x', p_action: 'approved' }),
    })
    return res.status
  }, MOCK_PORT)
  assert(r === 403, `student review_document should be refused, got ${r}`)
})

await test(
  'mobile 375px: students list, detail tabs and review workspace fit the screen',
  async (page) => {
    await demoLogin(page, 'Admin')
    await page.waitForURL(`${APP}/admin`)
    await page.getByText('Total students').waitFor()
    assert(await noOverflow(page), 'dashboard overflows at 375px')
    await page.goto(`${APP}/admin/students`)
    await page.getByRole('heading', { name: 'Students' }).waitFor()
    assert(await noOverflow(page), 'students overflow at 375px')
    await page.goto(`${APP}/admin/students/${studentId()}`)
    await page.getByRole('tab', { name: 'audit' }).waitFor()
    assert(await noOverflow(page), 'student detail overflows at 375px')
    await page.goto(`${APP}/admin/documents/${ieltsId()}`)
    await page.getByText('Decision', { exact: true }).waitFor()
    assert(await noOverflow(page), 'review workspace overflows at 375px')
  },
  { width: 375, height: 812 },
)

await browser.close()
vite.kill()
server.close()

for (const r of results)
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.error}`}`)
if (consoleErrors.length) console.log('\nUncaught page errors:\n  ' + consoleErrors.join('\n  '))
const failed = results.filter((r) => !r.ok).length + consoleErrors.length
console.log(
  `\n${results.length - results.filter((r) => !r.ok).length}/${results.length} passed${consoleErrors.length ? `, ${consoleErrors.length} page errors` : ''}`,
)
process.exit(failed ? 1 : 0)
