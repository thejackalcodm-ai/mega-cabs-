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

## Phase 3 — Onboarding, profile, documents, checklists (2026-10-30)

### Status of the items you asked me to confirm first

| Item                                            | Result                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GitHub Actions run #2 (Phase 2)                 | **Green**: both jobs, every step, including 36 browser tests and the seed idempotency check |
| `supabase db push` (incl. 0012) on your project | **Not reported** — your message still contained the placeholder                             |
| `npm run seed` on your project                  | **Not reported**                                                                            |
| `npm run verify:live` on your project           | **Not reported** — no output to compare yet                                                 |

### Automated results

| Suite                                                   | Result                     | Runs against                                                                                                                                                                                                 |
| ------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run build`, `npm run lint`, `npm run format:check` | PASS                       | —                                                                                                                                                                                                            |
| Unit tests (`npm test`)                                 | **54 / 54**                | pure functions: file validation, document rules (expiry, delete/replace permissions, checklist counts), profile schemas (IELTS/PTE/TOEFL score ranges, dates, passport), auth schemas, errors, roles, tables |
| Database / RLS suite                                    | **161 / 161**              | **real PostgreSQL 16 + pgTAP**, all migrations, Supabase platform stub                                                                                                                                       |
| Seed idempotency                                        | PASS (50 tables unchanged) | real PostgreSQL 16                                                                                                                                                                                           |
| Browser tests (`npm run e2e`)                           | **54 / 54**, 0 page errors | real app in Chromium against the **mocked** Supabase API                                                                                                                                                     |

### What each kind of test proves

**A. Real database (pgTAP, PostgreSQL 16)** — these are the security proofs:

- Stored documents are unreadable (so no signed URL can be issued) **even by their owner** without a grant from `authorize_document_access()`; with a grant exactly that one file becomes readable; grants expire.
- A student cannot obtain a grant for another student's document; a counselor can for assigned students only.
- Every view and download writes an audit row (actor, document, version); uploads, replacements and deletes are audited too (deletes by trigger, so service-role deletes are covered).
- Deletes only through `delete_document()`: approved / under-review documents can't be deleted by students; direct `DELETE` on `documents` is refused; files still referenced by a version can't be deleted from storage; unreferenced leftovers can be cleaned up by their owner.
- Replacement creates a new version, keeps history and now clears the previous review (migration 0014).
- Disallowed MIME types and files over 10 MB are rejected by table constraints; uploads must follow `{student_id}/{category}/…`.
- Mutation check: replacing the grant check with `true` makes 5 tests fail.

**B. Browser tests against the mocked API** (`e2e/mock-supabase.mjs`) — UI behaviour only, **not** security:
| Gate / requirement | Test |
|---|---|
| **Student uploads** a document | stored under `{student_id}/education/{uuid}-Final-Transcript-Oct-e.pdf` (sanitised from `Final Transcript (Oct) é.pdf`), real PDF bytes stored, card shows _Uploaded_, checklist updates |
| **Student replaces** a document | version 2 created via `replace_document`, history lists v1 and v2, the old reviewer comment no longer appears as current feedback |
| **Student previews** | iframe uses a storage _signed_ URL; the app requested an audited grant first; URL expiry is 60 s |
| **Student downloads** | browser download of `passport.pdf`; audited grant requested with purpose _download_ |
| **Admin sees it in the review queue** | `/admin/documents` lists the new transcript for Nimali Fernando; preview works and is audited |
| Delete only where allowed | approved / under-review cards have no Delete or Replace; an uploaded document is deleted, its file removed |
| File validation | `.exe` refused; executable renamed `.pdf` refused (content check); 10 MB+ refused; PNG/JPEG mismatch refused; nothing reaches storage |
| Reviewer feedback | reason, required action and reviewer comments shown on a resubmission-required document |
| Checklist | per-application checklist with automatic % (20% → stays 20% with 2 awaiting review after upload) |
| Onboarding | new student redirected to the wizard; validation; saves each step; **resume after reload**; skip; back; finishes with "Your profile is 81% complete." and the missing list |
| Profile | editing contact + emergency contact moves completion 88% → 94% → 100% and empties the missing list; add/remove work experience; IELTS range enforced |
| Loading / error / empty states | error state with _Try again_ recovers (after automatic retries); empty documents + empty checklist for a new student; skeletons while loading |
| Roles | counselor queue shows assigned students; instructor gets _not authorized_ on the queue |
| Mobile 375 px | documents, upload dialog, profile, onboarding: no horizontal scroll (fixed a checklist-card overflow found by this test) |

**C. Only a real Supabase project can prove** — covered by `npm run verify:live` (48 checks, up from 32) or manual steps below:

- Supabase Storage actually enforces the object policies (signing, download, upload into another folder, delete).
- Signed URLs work and **expire** (verify:live requests a 1-second URL and checks it fails after 3 s).
- Public URLs fail for every file; bucket MIME and size limits are applied by the Storage API.
- Real upload → replace → download (older version) → delete cycle with an audit row for each step.
- Auth emails (verification, reset) arrive and their links work.

### Manual steps for your project (≈10 minutes)

1. `npm run seed`, then `npm run verify:live` — every line should read PASS. Send me the output.
2. With `VITE_ENABLE_DEMO_LOGIN=true`, run `npm run dev` and sign in as **Student**.
3. Documents → **Upload document** → Education → Transcript → pick a real PDF → Upload. Expect "Document uploaded".
4. Click **Preview** on it. In the browser devtools Network tab, the file URL must contain `/object/sign/` and `token=`. Copy that URL, wait 90 seconds, open it in a new tab: it must fail.
5. Replace it (**Replace**) with another PDF: the card shows _version 2_; **History** shows v1 and v2.
6. **Download** v1 from History: the original file downloads.
7. Sign out, sign in as **Admin** → Documents: the transcript is listed for Nimali Fernando.
8. In the Supabase SQL editor run
   `select action, created_at from audit_logs where entity_type = 'document' order by created_at desc limit 10;`
   Expect `document.uploaded`, `document.viewed`, `document.replaced`, `document.downloaded`, `document.viewed` (admin).
9. Storage → `student-documents` → open any file's "Get URL" / public URL: it must return an error (bucket is private).
10. Sign up a brand-new account with a real email: the verification email arrives, the link signs you in and starts the onboarding wizard.

## Phase 4 — Admin dashboard, student management, review workspace, counselors (2026-10-30)

### Real-project status (as you asked: pending, not passed)

| Item                                                     | Status                                                                                                                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations 0001–0014 on project `pyiucgqgkhvdqyanzzgc`   | **Applied by me through the Supabase connector** after you chose that option. Each call returned success. 0015 and 0016 are **not** applied (they wait for your Phase 4 acceptance).               |
| Supabase security / performance advisors after 0001–0014 | Run. Findings are listed under **C** below. One real issue (anon EXECUTE through `PUBLIC`) led to migration 0016.                                                                                  |
| Read-only checks on the project                          | 52 public tables, **0 without RLS**, 117 policies, 4 buckets, **0 public**, 17 role-permission rows, 32 document types, 0 auth users (not seeded yet).                                             |
| `npm run seed` on your project                           | **Pending** (needs your secret key)                                                                                                                                                                |
| `npm run verify:live` on your project                    | **Pending**: now 48 + Phase 4 checks (see C). Until 0015 is applied the Phase 4 checks fail with "function does not exist", and the anon-RPC check fails until 0016 is applied. Both are expected. |

### Automated results

| Suite                                                   | Result                     | Runs against                                                                                                   |
| ------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run build`, `npm run lint`, `npm run format:check` | PASS                       | —                                                                                                              |
| Unit tests (`npm test`)                                 | **64 / 64**                | pure functions, plus 10 tests of the Edge Function handler (`supabase/functions/admin-create-user/handler.ts`) |
| Database / RLS suite                                    | **220 / 220**              | **real PostgreSQL 16 + pgTAP**, migrations 0001–0016, Supabase platform stub                                   |
| Seed idempotency                                        | PASS (50 tables unchanged) | real PostgreSQL 16                                                                                             |
| Browser tests (`npm run e2e`)                           | **68 / 68**, 0 page errors | real app in Chromium against the **mocked** Supabase API                                                       |

### A. Mock-API evidence (browser tests): UI behaviour only, not security

The mock (`e2e/mock-supabase.mjs`) imitates the new RPCs (`admin_dashboard_metrics`, `counselor_dashboard`,
`review_document`, `assign_counselor`, `request_document`), the `student_directory` / `counselor_directory`
views, a table-backed notifications store, `audit_logs` and the `admin-create-user` function. It shows that
the UI calls the right things and renders the results. It proves nothing about RLS.

| Requirement                               | Test                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GATE** reject → see → replace → approve | Admin rejects the IELTS certificate with a reason and a required action (RPC arguments checked). The student sees both on the card and the dashboard notification, then uploads v2. The counselor gets a "version 2" notification. The admin approves v2, the earlier review stays in the history, and the student is notified. Audit trail = `document.rejected:admin → document.replaced:student → document.approved:admin`, in that order. |
| Reason is mandatory                       | Reject with an empty reason shows "Give the student a reason" and **no** `review_document` call is made                                                                                                                                                                                                                                                                                                                                       |
| Admin dashboard                           | Tiles and 6 charts come from one `admin_dashboard_metrics` call; "Total students" equals the mock's row count; table view toggle works                                                                                                                                                                                                                                                                                                        |
| Counselor dashboard                       | Pending documents, attention list; an unassigned student never appears                                                                                                                                                                                                                                                                                                                                                                        |
| Student list                              | Search by ID, counselor filter (incl. Unassigned); counselors see only their students and get "Student not found" for an unassigned one                                                                                                                                                                                                                                                                                                       |
| Student detail                            | Profile, Applications, Documents, Learning, Payments, Messages and Audit tabs each load data; the Audit tab is admin-only                                                                                                                                                                                                                                                                                                                     |
| Request a document                        | Validation, then the student is notified and the request is audited                                                                                                                                                                                                                                                                                                                                                                           |
| Assign counselor                          | Counselor and student are both notified; audited with the admin as actor                                                                                                                                                                                                                                                                                                                                                                      |
| Create user (Edge Function)               | Admin creates a student; duplicate email → friendly 409 message; admin is not offered staff roles; super admin creates a counselor; anonymous call → 401; no request mentions a service key                                                                                                                                                                                                                                                   |
| Deactivate / reactivate                   | Deactivated student sees "Your account is inactive" on sign-in; reactivation restores access; both audited                                                                                                                                                                                                                                                                                                                                    |
| Route guards                              | A student opening the review workspace → not authorized; a student calling `review_document` directly → 403                                                                                                                                                                                                                                                                                                                                   |
| Mobile 375 px                             | Dashboard, students, student detail and review workspace have no horizontal scroll (fixed two grid overflows this test found)                                                                                                                                                                                                                                                                                                                 |

### B. Real-database evidence (pgTAP on PostgreSQL 16): the security proofs

- **Counselor scope**: a counselor sees only assigned students in `students`, `student_directory`, documents and metrics (`scope = 'assigned'`). For an unassigned student, `review_document`, `authorize_document_access` and `request_document` are refused. Instructors are refused the dashboards.
- **A student calling `review_document`**, even on their own document, gets `42501`. The same goes for `admin_dashboard_metrics`, `counselor_dashboard`, `assign_counselor` and `log_admin_user_created`.
- **Role changes**: an admin's `UPDATE`/`DELETE` on `user_roles` affects **0 rows**, for their own role and anyone else's, and the roles are unchanged afterwards. A super admin changing their own role → `42501`. A super admin may record creating staff; an admin may not.
- **Deactivated users lose access**: a deactivated counselor sees 0 students, 0 directory rows, cannot review, cannot open documents and has no dashboard. A deactivated student cannot open their own documents or read their profile data.
- **GATE in one transaction each**: reject without a reason → `22023`. Reject → the student reads the status, reason and required action. Replace → v2, the review fields are cleared and the counselor is notified. Approve → approved. Exactly one student notification per decision; the audit order is rejected → replaced → approved (now reliable thanks to `clock_timestamp()` in 0015).
- **Counselor assignment** only via `assign_counselor` / `students.manage`, audited, both parties notified; assigning a non-counselor is refused.
- **0016 function privileges**: anon can execute **no** function in `public`, authenticated cannot call trigger functions, internal functions stay revoked, and the RLS helpers and app RPCs stay callable. The three anon/trigger assertions **fail without 0016** (checked by removing it), so the test catches the hole the local stub had hidden.

### C. Evidence only your Supabase project can give

**Advisor findings on your project (after 0001–0014):**

| Advisor                                                                   | Level | Count | Action                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------- | ----- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anon_security_definer_function_executable`                               | WARN  | 66    | **Real gap, fixed in 0016.** 0010 revoked EXECUTE from `anon`, but functions are granted to `PUBLIC`, which anon inherits. Every function refuses a null `auth.uid()`, and the project holds no data, so nothing was exposed. [lint 0028](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| `authenticated_security_definer_function_executable`                      | WARN  | 66    | By design: RLS helpers must be executable by signed-in users, and each RPC checks permissions inside. 0016 removes trigger functions from this list. [lint 0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)                                                                 |
| `function_search_path_mutable`                                            | WARN  | 7     | Fixed in 0016 (`set search_path = public`). [lint 0011](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)                                                                                                                                                                                                |
| `extension_in_public` (pg_trgm)                                           | WARN  | 1     | Left as is (moving it breaks the trigram indexes). See KNOWN_GAPS. [lint 0014](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)                                                                                                                                                                                  |
| `rls_enabled_no_policy` (`document_access_grants`, `notification_outbox`) | INFO  | 2     | Intentional: only SECURITY DEFINER functions touch these tables.                                                                                                                                                                                                                                                                                         |
| `auth_rls_initplan`                                                       | WARN  | 20    | Performance only (`auth.uid()` re-evaluated per row). Planned for the Phase 8 performance pass. [lint 0003](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)                                                                                                                                                       |
| `multiple_permissive_policies`                                            | WARN  | 22    | Performance only (separate read and write policies). Phase 8.                                                                                                                                                                                                                                                                                            |
| `unused_index`                                                            | INFO  | 97    | Expected on an empty database.                                                                                                                                                                                                                                                                                                                           |

**`npm run verify:live` Phase 4 checks (need 0015 + seed; the last one needs 0016):**

- Admin metrics cover every student; counselor metrics, dashboard and directory = assigned students only.
- Counselor cannot review or open an unassigned student's document, and cannot assign counselors.
- A student calling `review_document`, the dashboards, `assign_counselor` or `request_document` is refused.
- Admin cannot change their own role or a student's, cannot grant or revoke roles; a super admin cannot change their own role; every role is unchanged afterwards.
- Deactivated student and counselor (with **existing sessions**) lose access; an admin cannot change a staff account's status; restored afterwards.
- **GATE on the real API**: reject without reason refused → reject with reason → student reads reason and required action → notified → replacement v2 → counselor notified → approve → student notified → audit order rejected:admin, replaced:student, approved:admin → both reviews kept. The test document, its files and notifications are removed afterwards.
- Edge Function (SKIP until deployed): anonymous → 401, student → 403, admin creating staff → 403.
- Anonymous callers cannot execute RPCs (fails until 0016 is applied).

### Manual steps for your project

1. After you accept Phase 4: apply 0015 and 0016 (I can do it through the connector, or run `supabase db push` after the `migration repair` in README §Migrations).
2. `npm run seed`, then `npm run verify:live`. Send me the output.
3. `supabase functions deploy admin-create-user`, then re-run `verify:live` so the Edge Function checks run instead of SKIP.
4. In the app, as **Admin**: Documents → open a document → Reject with a reason. As **Student**: the card shows the reason and what to do; upload a replacement. As **Admin**: approve version 2. In the SQL editor:
   `select action, actor_role, created_at from audit_logs order by created_at desc limit 5;` and
   `select type, title, created_at from notifications order by created_at desc limit 5;`
5. As **Admin**: Students → Add student with a real email you control. The "set a password" email arrives.

## Section F — end-to-end checklist

| Flow                                             | Status                                                        |
| ------------------------------------------------ | ------------------------------------------------------------- |
| Registration, email verification, login, logout  | UI verified (mocked API); real Supabase Auth pending your run |
| Role-based route access                          | PASS (browser, all 5 roles)                                   |
| Profile editing + completion %                   | DB function tested; UI pending (Phase 3)                      |
| Document upload / replace / review / signed URLs | DB tested; UI tested against mock; real project pending       |
| Application creation + status timeline           | DB tested; UI pending (Phase 5)                               |
| Enrollment, lesson completion, progress          | DB tested; UI pending (Phase 6)                               |
| Quiz submission + server grading                 | DB tested; UI pending (Phase 6)                               |
| Assignment submission + grading                  | DB tested; UI pending (Phase 6)                               |
| Notifications for key events                     | DB triggers tested; header counts live; UI pending (Phase 7)  |
| Messaging                                        | Schema + RLS tested; unread count live; UI pending (Phase 7)  |
| Payments + invoices                              | Schema + RLS tested; UI pending (Phase 7)                     |
| Admin dashboard, student management, counselors  | DB tested; UI tested against mock; real project pending       |
| Reports, global audit viewer                     | Pending (Phase 8)                                             |
| Mobile 375 / 768 / 1280                          | Phase 2 screens PASS; full pass in Phase 8                    |
