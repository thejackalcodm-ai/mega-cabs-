# Meridian — Student Portal, LMS & Application Platform

A Supabase + React (Vite, TypeScript) SaaS platform for international students: profile and
onboarding, secure document management, university applications, an LMS (courses, quizzes,
assignments), payments, messaging and a separate admin/staff portal.

> **Build status: Phase 3 of 8 complete.** Database, auth, role-based routing, layouts, shared
> components, demo seed, plus the onboarding wizard, the full student profile with completion
> percentage, the secure document system (private storage, versions, audited previews/downloads,
> status-aware delete) with per-application checklists, and a read-only staff review queue. Modules
> for Phases 4–8 currently show an honest "being built" page. See [TEST_REPORT.md](TEST_REPORT.md) and [KNOWN_GAPS.md](KNOWN_GAPS.md).

This folder lives inside the `mega-cabs-` repository; everything for the portal is under
`student-portal/`. The Java project at the repo root is unrelated and untouched.

---

## 1. Quick start (about 20 minutes)

### Prerequisites

- Node.js 20+ and npm
- A free Supabase account — https://supabase.com
- Supabase CLI — `npm i -g supabase` (or `brew install supabase/tap/supabase`)

### Step 1 — Create the Supabase project

1. In the Supabase dashboard, click **New project**. Choose a region near your users and save the
   database password somewhere safe.
2. When it is ready, open **Project Settings → API** and copy:
   - **Project URL**
   - **anon public** key
   - **service_role** key (secret — only for the seed script on your machine)
3. Note the **project ref** (the `xxxx` in `https://xxxx.supabase.co`).

### Step 2 — Push the database

```bash
cd student-portal
npm install
```

```bash
supabase login
```

```bash
supabase link --project-ref <your-project-ref>
```

```bash
supabase db push
```

This applies every file in `supabase/migrations/` in order: tables, enums, RLS policies,
database functions, triggers and the four private storage buckets. No dashboard clicking needed.

### Step 3 — Environment variables

```bash
cp .env.example .env
```

Fill in:

| Variable                    | Value                                 | Where it is used                                               |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `VITE_SUPABASE_URL`         | Project URL                           | Browser (safe)                                                 |
| `VITE_SUPABASE_ANON_KEY`    | anon public key                       | Browser (safe; RLS protects data)                              |
| `VITE_ENABLE_DEMO_LOGIN`    | `true` locally, `false` in production | Shows the demo login panel                                     |
| `SUPABASE_URL`              | Project URL                           | Seed script only                                               |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key                      | **Seed script only. Never in Vercel, never `VITE_`-prefixed.** |

### Step 4 — Auth settings in the Supabase dashboard

**Authentication → URL Configuration**

- **Site URL:** `http://localhost:5173` while developing; your Vercel URL in production.
- **Redirect URLs:** add `http://localhost:5173/**` and `https://<your-app>.vercel.app/**`.

**Authentication → Providers → Email**

- Development: you may turn **Confirm email** off to sign up without checking mail.
- Production: keep **Confirm email** on.

**Authentication → SMTP (production)**: Supabase's built-in mailer is rate-limited and meant for
testing only. Configure your own SMTP provider (Resend, Postmark, SES, SendGrid…) before going live.

### Step 5 — Seed demo data

```bash
npm run seed
```

> The seed script arrives with Phase 2 (auth). Until then this command does not exist yet.

### Step 6 — Run

```bash
npm run dev
```

Open http://localhost:5173.

---

## 2. Deploying to Vercel

1. In Vercel, **Add New → Project** and import this GitHub repository.
2. Set **Root Directory** to `student-portal`. Framework preset: **Vite** (`vercel.json` already
   sets build command, output directory and the SPA rewrite).
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
   `VITE_ENABLE_DEMO_LOGIN=false`. Do **not** add the service role key.
4. Deploy, then add the Vercel URL to Supabase **Site URL** and **Redirect URLs** (Step 4).

---

## 3. Demo accounts (created by `npm run seed`)

| Role        | Email                  | Password     |
| ----------- | ---------------------- | ------------ |
| Super Admin | superadmin@demo.portal | Demo#Pass123 |
| Admin       | admin@demo.portal      | Demo#Pass123 |
| Counselor   | counselor@demo.portal  | Demo#Pass123 |
| Instructor  | instructor@demo.portal | Demo#Pass123 |
| Student     | student@demo.portal    | Demo#Pass123 |

Nine more students (for example `kavindu.jayasinghe@demo.portal`) use the same password. All people
and documents are fictional.

**Demo login panel:** set `VITE_ENABLE_DEMO_LOGIN=true` to show one-click buttons for each role on
the login page. With the flag off, the panel and its credentials are not even included in the
production bundle. These accounts are for development only; do not seed a production project.

---

## 4. Scripts

| Command                           | What it does                                                   |
| --------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                     | Start the dev server                                           |
| `npm run build`                   | Type-check (strict) and build for production                   |
| `npm run lint` / `npm run format` | ESLint / Prettier                                              |
| `npm test`                        | Vitest unit tests                                              |
| `npm run test:rls`                | Migrations + pgTAP RLS suite on a local PostgreSQL (see below) |
| `npm run db:push`                 | `supabase db push`                                             |
| `npm run db:types`                | Regenerate `src/types/database.ts` from the linked project     |

### Running the security tests

- **Against Supabase local** (`supabase start`, needs Docker): `supabase test db`
- **Without Docker** (plain PostgreSQL 15+ with pgTAP, which is what CI uses):
  `sudo -u postgres bash supabase/tests/run-local.sh`

---

## 5. Architecture

```
Browser (React SPA)
  ├─ features/*        screens, grouped by module
  ├─ services/*        the ONLY place that talks to Supabase (one file per module)
  └─ lib/integrations  typed interfaces for payments, email, SMS/WhatsApp, video, AI
        │  supabase-js (anon key + user JWT)
        ▼
Supabase
  ├─ Auth              sign-up, sessions, email verification, password reset
  ├─ PostgREST         table API; every table protected by RLS (default deny)
  ├─ RPC functions     multi-step operations in one transaction
  │                    (review_document, replace_document, quiz grading, progress…)
  ├─ Triggers          timeline events, notifications, audit log, integration outbox
  └─ Storage           4 private buckets, path-based policies, short-lived signed URLs
```

### Database (supabase/migrations)

| File                            | Contents                                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `…01_extensions_enums`          | Extensions and every status enum (single source of truth)                                                                    |
| `…02_identity_roles`            | roles, `user_roles`, role_permissions, profiles, students, staff, profile sub-records, authorization helpers, signup trigger |
| `…03_audit_notifications`       | audit_logs, notifications, notification_outbox, logging helpers                                                              |
| `…04_universities_applications` | universities, programs, scholarships, saved universities, applications + timeline                                            |
| `…05_documents`                 | document types, documents, versions, reviews, requirements, per-application checklists                                       |
| `…06_lms`                       | courses, modules, lessons, resources, enrollments, progress, quizzes (server-graded), assignments                            |
| `…07_payments`                  | invoices, invoice items, payments (provider-agnostic, no card data)                                                          |
| `…08_communication`             | message threads, messages, calendar, support tickets, FAQs, student tasks                                                    |
| `…09_storage`                   | private buckets + storage object policies                                                                                    |
| `…10_computed`                  | profile completion, checklist completion summary                                                                             |
| `…11_fk_indexes`                | indexes on every foreign key                                                                                                 |

### Roles and permissions

Roles are stored in `user_roles` (never on a user-editable column). Only a super admin can change
roles, never their own. Helper functions used by RLS: `current_app_role()`, `has_role()`,
`has_any_role()`, `is_staff()`, `is_admin()`, `owns_student()`, `is_assigned_counselor()`,
`can_access_student()`, `can_manage_student()`, `can_manage_course()`, `has_permission()`.

| Role        | Can access                                                                |
| ----------- | ------------------------------------------------------------------------- |
| Student     | Only their own records and files                                          |
| Counselor   | Students assigned to them (more only with an explicit permission grant)   |
| Instructor  | Courses they teach, and enrollments/submissions/attempts in those courses |
| Admin       | All operational data; cannot change roles                                 |
| Super Admin | Everything, including roles                                               |

### How document files are accessed

1. Upload: browser → Storage (`{student_id}/{category}/{uuid}-{name}`), then the `documents` row is
   inserted (status forced to _uploaded_, version 1 recorded, audited).
2. View / download: `authorize_document_access()` checks access, writes the audit entry and opens a
   2-minute grant → the browser asks Storage for a 60-second signed URL. Without a grant, Storage
   refuses to sign, even for the file's owner.
3. Replace: new object + `replace_document()` → new version, history kept, review restarted.
4. Delete: `delete_document()` (status rules, audited) → the now-unreferenced files are removed.

### Storage layout (all buckets private)

| Bucket                   | Path                                                                       |
| ------------------------ | -------------------------------------------------------------------------- |
| `student-documents`      | `{student_id}/{category}/{uuid}-{filename}`                                |
| `assignment-submissions` | `{student_id}/{assignment_id}/{uuid}-{filename}`                           |
| `message-attachments`    | `{thread_id}/{uuid}-{filename}` or `tickets/{ticket_id}/{uuid}-{filename}` |
| `course-resources`       | `{course_id}/{uuid}-{filename}`                                            |

### Frontend layout

| Path                    | Purpose                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/app`               | router, providers (auth, query), layouts (`AppShell`), route guards, navigation config                                   |
| `src/features/*`        | screens per module (`auth`, `dashboard`, `admin`, `system`, …)                                                           |
| `src/services/*`        | the only modules that call Supabase (ESLint-enforced)                                                                    |
| `src/components/ui`     | shadcn/Radix primitives                                                                                                  |
| `src/components/shared` | `StatusBadge`, `DataTable`, `EmptyState`, `ErrorState`, skeletons, `ConfirmDialog`, `FileUploader`, `FormField`, toasts… |
| `src/lib`               | constants (status maps), roles, errors, file validation, formatting, integrations                                        |
| `src/types/database.ts` | database types (`npm run db:types` regenerates from your project)                                                        |

Routing: `/app/*` is the student portal, `/admin/*` the staff portal. Sign-in redirects by role;
opening a page for another role goes to `/unauthorized`. Navigation and route guards come from the
same config (`src/app/navigation.ts`), so a menu item and its permission check can't drift apart.

See [DECISIONS.md](DECISIONS.md) for the reasoning behind the main design choices.
