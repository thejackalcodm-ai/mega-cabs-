# Known gaps

Honest list of what is not done or not verified. Updated at the end of every phase.

## Not built yet (planned phases)

| Area                                                                                                       | Phase |
| ---------------------------------------------------------------------------------------------------------- | ----- |
| Auth screens, route guards, layouts, demo login panel, seed script (`npm run seed`), generated DB types    | 2     |
| Onboarding wizard, profile UI, document UI                                                                 | 3     |
| Admin dashboard, student management, document review workspace, counselor dashboard                        | 4     |
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
- **Whether your `supabase db push` succeeded is unconfirmed** (the Phase 2 request still had the
  placeholder text). If it failed, paste the error.
- **Auth flows were browser-tested against a mocked Supabase API**, not real Supabase Auth. Real
  email delivery, the verification link and the password-recovery link have not been exercised.
- **No deployed URL yet.** Vercel deployment needs your Vercel account (README §2).
- **`src/types/database.ts` is generated from the local schema**, not your project. Run
  `npm run db:types` after linking and commit the result; differences should be cosmetic.
- **Bucket privacy over HTTP is not verified.** The test proves every bucket has `public = false`
  and that object RLS denies cross-student reads; requesting a public URL against a real project
  (expected: 400/404) is a manual check listed in TEST_REPORT.md.

## Behaviour to be aware of

- Sidebar entries for modules in Phases 3–8 open a "being built" page; nothing on them is active.
- Header search goes to a placeholder search page until Phase 8.
- Demo lesson videos use a public CC0 sample clip; replace `lessons.video_ref` with real hosted videos.
- The seed uses Supabase's admin API, which assigns user ids itself; re-runs match users by email.
- The main demo student's profile is 88% complete (address and emergency contact deliberately left empty).

- `expire_documents()` exists but is not scheduled. Enable `pg_cron` in the dashboard and schedule
  it daily (or call it from a scheduled Edge Function).
- `notification_outbox` is written but not drained: no email/WhatsApp is sent until a sender is
  implemented.
- Creating staff accounts from the admin UI will need an Edge Function holding the service role
  key (Phase 4); until then staff come from the seed script.
