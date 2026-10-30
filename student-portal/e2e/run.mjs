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
    if (role === 'Admin') await page.getByText('Farhan Siddiqui').waitFor()
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

await test('allowed deep link: counselor opens /admin/students (coming soon page, no fake actions)', async (page) => {
  await demoLogin(page, 'Counselor')
  await page.waitForURL(`${APP}/admin`)
  await page.goto(`${APP}/admin/students`)
  await page.getByText('Students arrives in build phase 4').waitFor()
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
    await page.getByText('Farhan Siddiqui').waitFor()
    assert(await noOverflow(page), 'admin overflows at 375px')
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
  await row.getByRole('button', { name: /Preview/ }).click()
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
