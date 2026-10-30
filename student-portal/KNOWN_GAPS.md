# Known gaps

Honest list of what is not done or not verified. Updated at the end of every phase.

## Not built yet (planned phases)

| Area                                                                                                       | Phase |
| ---------------------------------------------------------------------------------------------------------- | ----- |
| Auth screens, route guards, layouts, demo login panel, seed script (`npm run seed`), generated DB types    | 2     |
| Onboarding wizard, profile UI, document UI                                                                 | 3     |
| University discovery, application UI, journey/next-action engine                                           | 5     |
| LMS UI (player, quizzes, assignments, analytics, course builder)                                           | 6     |
| Payments UI + provider abstraction, messaging UI + Realtime, notifications UI, calendar, support, settings | 7     |
| Reports + CSV export, audit log viewer, global search RPC/UI, accessibility & mobile pass                  | 8     |

## Environment limitations (build sandbox)

- **No Supabase project access.** No Supabase credentials or CLI are available in this environment
  and Docker is not running, so `supabase db push`, `supabase gen types`, `supabase test db`,
  `npm run seed` and `npm run verify:live` have **not** been run against a real project from here.
  Migrations, the RLS suite and the full seed were verified on PostgreSQL 16 + pgTAP with a stub of
  the Supabase platform schemas. Please run `npm run seed` then `npm run verify:live` and share the
  output.
- **Your results for `supabase db push` (now including 0013 and 0014), `npm run seed` and
  `npm run verify:live` are unconfirmed**: both the Phase 2 and Phase 3 requests still had the
  placeholder text. Phase 3 changes storage policies, so please run `verify:live` before relying on it.
- **Auth flows were browser-tested against a mocked Supabase API**, not real Supabase Auth. Real
  email delivery, the verification link and the password-recovery link have not been exercised.
- **No deployed URL yet.** Vercel deployment needs your Vercel account (README §2).
- **`src/types/database.ts` is generated from the local schema**, not your project. Run
  `npm run db:types` after linking and commit the result; differences should be cosmetic.
- **Bucket privacy over HTTP is not verified.** The test proves every bucket has `public = false`
  and that object RLS denies cross-student reads; requesting a public URL against a real project
  (expected: 400/404) is a manual check listed in TEST_REPORT.md.

## Phase 3 specifics

- **Orphaned files**: if an upload succeeds but saving the document row fails, the app tries to
  remove the file. If that also fails (e.g. the network drops), the file stays in the student's
  folder, unreferenced. The storage policy lets the owner see and delete such files, but no
  scheduled clean-up exists yet.
- **Malware scanning** is not implemented. Files are checked for type, size and leading bytes only.
  For production, add a scanning step (e.g. a Storage webhook to a scanner) before staff open files.
- **DOCX files can't be previewed** in the browser; staff and students download them instead.
- Students can replace a document that is _under review_ (it goes back to _uploaded_). Approved
  documents need a counselor; this matches the spec's "delete/replace where permitted".
- Expired documents are shown as expired from their expiry date; the stored status changes only
  when `expire_documents()` runs (not scheduled yet).

## Phase 4 specifics

- **Hosted project state**: migrations 0001–0014 are applied on `pyiucgqgkhvdqyanzzgc`; 0015 and
  0016 are not (they wait for your Phase 4 acceptance). The project has no users or data until
  `npm run seed` runs. Until 0016 is applied, anonymous callers can still invoke SECURITY DEFINER
  functions through `PUBLIC`. Each function refuses a null `auth.uid()` and the project holds no
  data, but apply 0016 before seeding real data.
- **Real-project checks are pending**: `npm run seed`, `npm run verify:live` and the Edge Function
  deployment need your secret key / CLI login. Nothing in Phase 4 has been verified against
  Supabase Auth, PostgREST or the Edge runtime yet. The browser tests use the mock API.
- **The Edge Function's `handler.ts` is unit-tested, but `index.ts` (the Deno wiring) has not been
  typechecked or run here** (no Deno or Edge runtime in this environment). Check the `verify:live`
  Edge Function lines after deploying.
- **No role-management screen.** Roles are changed only by a super admin (database-enforced); a UI
  for it is planned with the Phase 8 settings and audit work. Use SQL as a super admin until then.
- **Deactivation does not end existing sessions in Supabase Auth.** Every query a deactivated user
  makes returns nothing or is refused (RLS), and the app shows "Your account is inactive", but
  their JWT remains valid until it expires (1 hour by default).
- **Email changes** for a student are not offered in the admin edit dialog (Supabase Auth owns the
  email; the student changes it from Settings in Phase 7).
- **The Messages tab** lists threads only; reading and replying arrive with the messaging centre
  (Phase 7). The **Audit** tab shows the last 200 entries for the student; the full audit viewer
  with filters and export is Phase 8.
- **Advisor performance warnings** (`auth_rls_initplan` ×20, `multiple_permissive_policies` ×22)
  are planned for the Phase 8 performance pass; `pg_trgm` stays in `public` because moving it
  breaks the trigram indexes (needs a coordinated migration).
- **Charts in dark mode**: the app has no dark theme yet; chart colours use the light tokens.
- **Revenue** is shown one currency at a time; there is no FX conversion to a single total.

## Behaviour to be aware of

- Sidebar entries for modules in Phases 5–8 open a "being built" page; nothing on them is active.
- Header search goes to a placeholder search page until Phase 8.
- Demo lesson videos use a public CC0 sample clip; replace `lessons.video_ref` with real hosted videos.
- The seed uses Supabase's admin API, which assigns user ids itself; re-runs match users by email.
- The main demo student's profile is 88% complete (address and emergency contact deliberately left empty).

- `expire_documents()` exists but is not scheduled. Enable `pg_cron` in the dashboard and schedule
  it daily (or call it from a scheduled Edge Function).
- `notification_outbox` is written but not drained: no email/WhatsApp is sent until a sender is
  implemented.
- Staff accounts can be created by a super admin from **Students → Add user** once the
  `admin-create-user` Edge Function is deployed. Until then, staff come from the seed script.
