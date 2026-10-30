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

const { server, calls, users } = createMock()
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
