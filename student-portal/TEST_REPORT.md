# Test report

How each item was verified. "Pending" = the feature belongs to a later phase.

## Phase 0 — Foundation (2026-10-30)

| Check                                         | Result | How                                                             |
| --------------------------------------------- | ------ | --------------------------------------------------------------- |
| `npm install`                                 | PASS   | clean install, 0 errors                                         |
| `npm run build` (tsc strict + vite)           | PASS   | 0 TypeScript errors                                             |
| `npm run lint`, `npm run format:check`        | PASS   | ESLint 9 + Prettier                                             |
| Dev server boots                              | PASS   | `vite` → HTTP 200 on `/`                                        |
| Styled placeholder renders, no console errors | PASS   | Playwright/Chromium at 1280px and 375px; no horizontal overflow |

## Phase 1 — Database, RLS, storage (2026-10-30)

Environment: PostgreSQL 16.x + pgTAP, Supabase platform stub. Command:
`sudo -u postgres bash supabase/tests/run-local.sh` → **137 / 137 passed** (138 after Phase 2 added a test for migration 0012).

| Requirement (Section G)                                                                                                 | Result          | Test(s)                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Student A cannot SELECT/UPDATE/DELETE B's profile, applications, documents, payments, messages, notifications, tasks | PASS            | 34 assertions tagged `[1]` (also invoices, timeline, versions, enrollments, RPCs)                                                    |
| 2. Student A cannot download B's storage object even with the exact path                                                | PASS            | `[2]` — object invisible to A (so no signed URL can be issued); cannot upload into or delete from B's folder                         |
| 3. Student cannot change own role / insert into `user_roles`                                                            | PASS            | `[3]` — insert throws 42501; update/delete affect 0 rows; cannot change account status or counselor                                  |
| 4. Counselor sees only assigned students                                                                                | PASS            | `[4]` — 2 of 3 students visible; 0 rows for unassigned student's profile, documents, applications, storage                           |
| 5. Student cannot write `document_reviews` or change document status                                                    | PASS            | `[5]` — insert throws; direct update 0 rows; status forced to `uploaded`; MIME and 10 MB limits enforced                             |
| 6. Student cannot read `audit_logs`                                                                                     | PASS            | `[6]` — 0 rows; cannot insert or forge privileged events                                                                             |
| 7. Unauthenticated request returns nothing from any table                                                               | PASS            | `[7]` — loops over all 51 tables as `anon`; RPCs not executable                                                                      |
| 8. Buckets are private                                                                                                  | PASS (DB level) | `[8]` — 4 buckets, all `public = false`, size limits set. HTTP public-URL check: **pending** (needs real project)                    |
| 9. Quiz scores cannot be set by the client                                                                              | PASS            | `[9]` — answer keys hidden; attempt insert/update refused; server grades MC, ordering, short answer, matching; max attempts enforced |

Also verified in the same run:

- Signup trigger creates profile, student, student_profile and role; a `role` smuggled in user metadata is ignored.
- `review_document`: reason required; one call writes status, review row, notification and audit entry.
- Application status change writes timeline event, offer notification, audit entry, outbox event and decision date.
- `replace_document` creates version 2 and keeps version 1.
- Lesson completion recalculates enrollment progress (1 of 2 lessons → 50%); non-enrolled students refused.
- Assignment: student cannot self-grade; instructor grading records grader and notifies the student.
- Instructor: sees only their course's enrollments/students, no documents or passport data, cannot edit other courses.
- Admin cannot change roles or deactivate staff; super admin can grant roles but not change their own; deactivated users lose access.
- RLS enabled on every public table; every foreign key indexed.

**Mutation check:** the suite was re-run against three deliberately weakened copies of the schema
(documents readable by everyone; open inserts on `user_roles`; updatable quiz attempts). Each
produced failing tests (`not ok 14/89/112`, `not ok 46`, `not ok 74`), so the tests detect these regressions.

## Phase 2 — Auth, roles, layouts, shared components, seed (2026-10-30)

### Pre-checks requested

| Request                                 | Result                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions run for the Phase 1 push | **PASS** — run #1 `success` (web + database jobs)                                                                                                                           |
| `supabase gen types --linked`           | **Not possible here** (no Supabase credentials/CLI). Generated the same shape from the migrated local schema instead; run `npm run db:types` once linked                    |
| RLS re-check against your real project  | **Not possible here.** Wrote `npm run verify:live` (32 checks over HTTP as signed-in demo users with the anon key). Please run it after `npm run seed` and share the output |
| Your `supabase db push` result          | **Unknown** — the message still contained the placeholder text                                                                                                              |

### Automated results

| Check                                           | Result                          | How                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build` (tsc strict + vite)             | PASS                            | 0 TypeScript errors                                                                                                                                                                                                                                                                                                 |
| `npm run lint`, `npm run format:check`          | PASS                            | ESLint (incl. "only services may import Supabase") + Prettier                                                                                                                                                                                                                                                       |
| `npm test` (Vitest)                             | **40 / 40 PASS**                | file validation (extension, MIME, size, magic bytes, name sanitising, storage path), error mapping (no raw DB errors), role routing, per-role navigation, table sort/filter/paginate, auth form schemas                                                                                                             |
| RLS suite                                       | **138 / 138 PASS**              | as Phase 1, plus service-role document insert (migration 0012)                                                                                                                                                                                                                                                      |
| Seed (`npm run seed` logic)                     | PASS                            | full seed against migrated PostgreSQL 16 with all triggers/constraints, via the `SeedTarget` Postgres implementation                                                                                                                                                                                                |
| Seed idempotency                                | PASS                            | `supabase/tests/seed-idempotency.sh`: second run leaves all 49 tables' row counts unchanged                                                                                                                                                                                                                         |
| Main demo student mid-journey                   | PASS                            | checked **as the student through RLS**: Northbridge at _Documents required_, Westmere _Conditional offer_; IELTS 40%; 1 paid + 1 unpaid invoice; 4 unread notifications; 1 unread message; documents approved / under review / rejected / resubmission required; UK checklist 33%; sees only her own student record |
| Demo credentials excluded from production build | PASS                            | `VITE_ENABLE_DEMO_LOGIN=false` build: 0 files contain the demo password or emails; `true` build: present                                                                                                                                                                                                            |
| Browser tests (`npm run e2e`)                   | **36 / 36 PASS**, 0 page errors | Playwright + Chromium against the real app; Supabase **API mocked** (`e2e/mock-supabase.mjs`)                                                                                                                                                                                                                       |

### Phase 2 gate (browser-verified against the mocked API)

| Gate item                                                           | Result | Test                                                                                                                                                                              |
| ------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Register (validation, success → verify-email page, duplicate email) | PASS   | 3 tests; signup sends first/last name, phone, country and the `/auth/callback` redirect, and **never a role**                                                                     |
| Log in as each of the 5 demo roles → correct dashboard shell        | PASS   | Student → `/app`; Counselor, Instructor, Admin, Super Admin → `/admin`; per-role sidebar verified (e.g. counselor has no Courses/Payments/Audit; instructor has no Students)      |
| Wrong-role page → not-authorized page                               | PASS   | 8 cases: student → `/admin`, `/admin/students`; counselor → `/app`, `/admin/courses`, `/admin/audit`; instructor → `/admin/students`, `/admin/payments`; admin → `/app/documents` |
| Login errors                                                        | PASS   | wrong password, unverified email (with resend link), deactivated account                                                                                                          |
| Logout                                                              | PASS   | session ended, audit event sent, protected page redirects to login                                                                                                                |
| Session persistence                                                 | PASS   | reload and new tab stay signed in                                                                                                                                                 |
| Deep link while signed out                                          | PASS   | `/app/documents` → login → back to `/app/documents`                                                                                                                               |
| Forgot / reset password                                             | PASS   | generic confirmation (no enumeration), expired-link state, new password saved                                                                                                     |
| Verification-link error                                             | PASS   | expired link explained with next steps                                                                                                                                            |
| Responsive                                                          | PASS   | 375px: bottom nav + drawer, no horizontal scroll (login, register, student, admin); 768px: icon rail, expand persists; 1280px: full sidebar                                       |
| Accessibility spot checks                                           | PASS   | skip link first in tab order; visible focus ring; labelled inputs; status badges use text + icon                                                                                  |

Bugs found and fixed while testing Phase 2:

- Document guard forced `status = 'uploaded'` on trusted service-role inserts → migration 0012.
- Registration hid "Passwords don't match" until every other field was valid → schema fix + unit test.
- A failed lazy-loaded page showed a blank screen → route error boundary with a reload prompt.
- Counselor student table wrapped IDs/dates and clipped the status column at 1280px → layout fix.

### Not verified (needs your Supabase project)

- Real Supabase Auth: confirmation email delivery, verification and recovery links, rate limits.
- `npm run seed` through the Supabase API (logic verified on Postgres; API path not run).
- `npm run verify:live` results on your project.

## Section F — end-to-end checklist

| Flow                                             | Status                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Registration, email verification, login, logout  | UI verified (mocked API); real Supabase Auth pending your run |
| Role-based route access                          | PASS (browser, all 5 roles)                                   |
| Profile editing + completion %                   | DB function tested; UI pending (Phase 3)                      |
| Document upload / replace / review / signed URLs | DB + storage policies tested; UI pending (Phases 3–4)         |
| Application creation + status timeline           | DB tested; UI pending (Phase 5)                               |
| Enrollment, lesson completion, progress          | DB tested; UI pending (Phase 6)                               |
| Quiz submission + server grading                 | DB tested; UI pending (Phase 6)                               |
| Assignment submission + grading                  | DB tested; UI pending (Phase 6)                               |
| Notifications for key events                     | DB triggers tested; header counts live; UI pending (Phase 7)  |
| Messaging                                        | Schema + RLS tested; unread count live; UI pending (Phase 7)  |
| Payments + invoices                              | Schema + RLS tested; UI pending (Phase 7)                     |
| Admin functions, reports, audit viewer           | Pending (Phases 4, 8)                                         |
| Mobile 375 / 768 / 1280                          | Phase 2 screens PASS; full pass in Phase 8                    |
