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
`sudo -u postgres bash supabase/tests/run-local.sh` → **137 / 137 passed**.

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

## Section F — end-to-end checklist

| Flow                                             | Status                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| Registration, email verification, login, logout  | Pending (Phase 2)                                     |
| Role-based route access                          | Pending (Phase 2)                                     |
| Profile editing + completion %                   | DB function tested; UI pending (Phase 3)              |
| Document upload / replace / review / signed URLs | DB + storage policies tested; UI pending (Phases 3–4) |
| Application creation + status timeline           | DB tested; UI pending (Phase 5)                       |
| Enrollment, lesson completion, progress          | DB tested; UI pending (Phase 6)                       |
| Quiz submission + server grading                 | DB tested; UI pending (Phase 6)                       |
| Assignment submission + grading                  | DB tested; UI pending (Phase 6)                       |
| Notifications for key events                     | DB triggers tested; UI pending (Phase 7)              |
| Messaging                                        | Schema + RLS tested; UI pending (Phase 7)             |
| Payments + invoices                              | Schema + RLS tested; UI pending (Phase 7)             |
| Admin functions, reports, audit viewer           | Pending (Phases 4, 8)                                 |
| Mobile 375 / 768 / 1280                          | Placeholder only (Phase 0); full pass in Phase 8      |
