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

- **No Supabase project access.** No Supabase MCP/CLI credentials were available, and Docker was not
  running, so `supabase start` / `supabase db push` / `supabase test db` could not be run here.
  Migrations and RLS tests were verified on **PostgreSQL 16 + pgTAP** with a stub of the Supabase
  platform schemas instead. The first `supabase db push` against a real project is therefore the
  first run on real Supabase; report any error and it will be fixed.
- **No deployed URL yet.** Vercel deployment needs your Vercel account (README §2).
- **`src/types/database.ts` not generated yet** (needs `supabase gen types` against a project). It
  will be hand-written in the generated format in Phase 2 and replaced by `npm run db:types` once
  linked.
- **Bucket privacy over HTTP is not verified.** The test proves every bucket has `public = false`
  and that object RLS denies cross-student reads; requesting a public URL against a real project
  (expected: 400/404) is a manual check listed in TEST_REPORT.md.

## Behaviour to be aware of

- `expire_documents()` exists but is not scheduled. Enable `pg_cron` in the dashboard and schedule
  it daily (or call it from a scheduled Edge Function).
- `notification_outbox` is written but not drained: no email/WhatsApp is sent until a sender is
  implemented.
- Creating staff accounts from the admin UI will need an Edge Function holding the service role
  key (Phase 4); until then staff come from the seed script.
