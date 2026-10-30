# Design decisions

Decisions made during the build, with the reason for each. Newest at the bottom of each section.

## Project layout

- **The app lives in `student-portal/` inside the existing repository.** The repository root
  already contains an unrelated Java coursework project (Mega City Cab). Building in a sub-folder
  keeps both intact. Vercel's _Root Directory_ is set to `student-portal`.
- **Product name "Meridian"** is a placeholder brand; change it in `index.html` and the layout.

## Database & security

- **Roles in `user_roles`, not on `profiles`.** A user may hold several roles; the highest-ranked
  one (from `roles.rank`) is the primary role used for routing. Writes are blocked by both RLS and
  a trigger: only a super admin can change roles, and never their own.
- **`current_app_role()` instead of `current_role()`.** `CURRENT_ROLE` is a reserved SQL keyword
  in PostgreSQL, so a function with that name would have to be quoted everywhere.
- **Role at signup comes only from `raw_app_meta_data`.** End users control `user_metadata`
  (`signUp({ options: { data } })`) but cannot set `app_metadata`, so self-registration always
  produces a student. Staff accounts are created by the seed script / admin tooling using the
  service role.
- **Granular permissions on top of roles** (`role_permissions` + `staff.permissions`). This is how
  "counselors manage only assigned students unless granted additional permissions" is modelled:
  grant `students.view_all` to a counselor's staff row. Only admins can grant; nobody self-grants.
- **Multi-step operations are database functions** (`review_document`, `replace_document`,
  `request_document`, `start_quiz_attempt`, `submit_quiz_attempt`, `update_lesson_progress`,
  `start_thread`, …). Each runs in a single transaction and re-checks authorization itself, so the
  client cannot skip a step (e.g. approve without writing the review row or audit entry).
- **Side effects via triggers**: application status changes write the timeline event, the
  notification, the audit row and an outbox event; payments recompute invoice balances and issue
  receipt numbers; assignment due dates appear on enrolled students' calendars.
- **Students never see quiz answer keys.** `quiz_questions` / `quiz_options` have staff-only RLS.
  Students get questions through `start_quiz_attempt()` (without answers) and submit through
  `submit_quiz_attempt()`, which grades on the server. Attempts cannot be inserted or updated
  directly.
- **Students cannot update documents directly.** Uploading inserts a row whose status is forced to
  `uploaded`; replacing goes through `replace_document()` which adds a `document_versions` row
  (history is never overwritten); reviewing goes through `review_document()`.
- **Document file rules are enforced twice**: by the bucket (`allowed_mime_types`, 10 MB
  `file_size_limit`) and by table check constraints. The UI validates too, for good messages.
- **Audit log is append-only.** No insert/update/delete policies exist; rows are written only by
  SECURITY DEFINER functions. Clients may log only a whitelist of client-side events (login,
  logout, document viewed/downloaded, report exported) via `log_client_event()`; IP and user agent
  are read from the request headers PostgREST exposes.
- **`notification_outbox`** (transactional outbox) records every domain event an external system
  could care about — email, WhatsApp/SMS, CRM, analytics, AI pipelines — written in the same
  transaction as the change. A worker (Edge Function or cron) will drain it; nothing is sent yet.
- **`notification_preferences`** holds per-user email and in-app notification toggles plus privacy
  settings. Senders consult it when draining the outbox.
- **Deactivated accounts lose access immediately**: every helper checks `profiles.is_active`.
- **Profile completion is computed in the database** (`profile_completion()`), so the student
  dashboard, onboarding and the admin views always agree.
- **Videos are referenced, never stored**: `lessons.video_provider` + `video_ref` point at YouTube,
  Vimeo, Mux, Cloudflare Stream or a URL.
- **University programs are called `programs`** to avoid clashing with LMS `courses`.
- **`student_tasks`** was added: the spec lists "Tasks" among the data a student owns.
- **Every foreign key is indexed** (migration 0011, generated from the catalog and re-checked).

## Testing

- **RLS tests are pgTAP** in `supabase/tests/rls.test.sql`, runnable with `supabase test db`.
  Because Docker/Supabase local was not available in the build environment, the same file is also
  run against plain PostgreSQL 16 with a small stub of the Supabase platform
  (`supabase/tests/local/supabase-stub.sql`: `anon`/`authenticated` roles, `auth.uid()`, storage
  tables, default grants). Identity switching sets the JWT-claims setting and the session role
  exactly the way PostgREST does.
- **Mutation-checked.** The suite was run against deliberately weakened policies (documents
  readable by all; open `user_roles` inserts; updatable quiz attempts) and failed each time.

## Frontend

- **shadcn/ui components are vendored by hand** into `src/components/ui` (the shadcn registry was
  unreachable from the build environment). They follow the standard shadcn source and
  `components.json` is present, so `npx shadcn add …` works on a normal machine.
- **Design: "Laurel & Brass"** — deep laurel green for trust, warm paper neutrals, brass accent used
  sparingly; Fraunces (display) + Inter (UI). Status colours always pair with text and an icon.
- **ESLint enforces the services layer**: importing the Supabase client outside `src/services`
  is a lint error.

## Phase 2

- **`database.ts` generated from the local schema.** `supabase gen types` needs a linked project,
  which this environment can't reach. `supabase/tests/local/gen-types.py` produces the same shape
  (tables, relationships for typed joins, views, RPC signatures, enums) from the migrated catalog.
  Run `npm run db:types` once linked; the output should be equivalent.
- **Migration 0012 instead of editing 0005.** Phase 1 may already be applied to your project, so
  the document-guard fix (trust the service role) is a new migration. Applied migrations are never
  edited.
- **Roles drive routing in one place**: `navigation.ts` lists every page with its allowed roles; the
  router generates guarded routes from it and the sidebar filters by the same list. UI hiding is a
  convenience; RLS remains the actual enforcement.
- **Pages from later phases are reachable but honest**: they show "this module is being built in
  phase N" and perform no actions, instead of fake data or dead buttons.
- **Demo login is compiled out** unless `VITE_ENABLE_DEMO_LOGIN=true` at build time (verified by
  grepping the production bundle).
- **The verify-email page always resends via Supabase** and the forgot-password page always shows
  the same message whether or not the email exists, so accounts can't be enumerated.
- **Seed is idempotent by construction**: deterministic ids (UUID v5-style), upserts, and cleanup of
  rows that triggers create on first insert (automatic timeline and notification rows), so the demo
  looks the same after every run. It talks to Supabase only through a small `SeedTarget` interface;
  a second implementation writes to plain Postgres so the full seed can be verified locally.
- **Browser tests use a mock of the Supabase HTTP API** (`e2e/mock-supabase.mjs`) because no Supabase
  stack (and no PostgREST binary) is available here. They verify UI behaviour: forms, redirects,
  guards, layouts, session handling. Data security is verified by pgTAP and, on a real project,
  by `npm run verify:live`.
- **Uploads are validated three times**: extension + declared MIME type + leading-byte signature in
  the browser (`src/lib/files.ts`), bucket MIME/size limits, and table check constraints.

## Phase 3

- **Every document read requires an audited grant.** Logging downloads from the client could be
  skipped, so the storage read policy for `student-documents` now requires a row in
  `document_access_grants` (2-minute window) for that exact object. The only way to get one is
  `authorize_document_access()`, which checks access and writes the `document.viewed` /
  `document.downloaded` audit entry in the same transaction. The app then signs a 60-second URL.
  This applies to staff as well, so reviewer access is audited too.
- **Deletes go through `delete_document()`** (status rule + audit trigger). The direct delete
  policy was removed. Files that belong to a document version can't be removed from storage
  directly; once the rows are deleted the files become unreferenced and the owner can remove them.
- **Replacing a document starts a fresh review** (migration 0014): the current reviewer, comment
  and review time are cleared; the previous feedback stays in the review history.
- **Upload order**: file to storage first, then the document row (whose insert trigger records
  version 1 and the audit entry). If the row insert fails the file is removed.
- **Custom document types** use the "Other document" type plus a free-text name
  (`custom_type_name`), so students can't create new global types.
- **One set of section forms** (`src/features/profile/forms.tsx`) and save functions
  (`ProfileSaves.ts`) serve both the onboarding wizard and the profile page.
- **Onboarding**: new students are sent to the wizard once; "Finish later" returns to the
  dashboard with a "continue setup" card. Education, English test and passport can be skipped
  (students often don't have them yet); progress is saved after every step and resumed from
  `students.onboarding_step`.
- **Profile completion stays in the database** (`profile_completion()`); the UI never recomputes it.
- **The mock API grew into a small in-memory PostgREST/Storage stand-in** so the browser tests can
  drive uploads, replacements, previews and downloads. It deliberately mirrors the grant rule, but
  it is not evidence of security; that's pgTAP plus `verify:live`.
