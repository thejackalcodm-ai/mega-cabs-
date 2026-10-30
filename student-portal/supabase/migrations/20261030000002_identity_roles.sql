-- =============================================================================
-- 0002 · Identity, roles, students, staff, profile sub-records
-- =============================================================================

-- Reference table of roles. Assignments live in public.user_roles.
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  key         public.app_role not null unique,
  name        text not null,
  description text,
  rank        int  not null,            -- higher rank = more privileges
  created_at  timestamptz not null default now()
);

insert into public.roles (key, name, description, rank) values
  ('student',     'Student',     'Applicant / learner. Sees only their own data.', 10),
  ('counselor',   'Counselor',   'Manages assigned students and their applications.', 20),
  ('instructor',  'Instructor',  'Manages courses, lessons, assignments and quizzes.', 20),
  ('admin',       'Admin',       'Manages students, applications, documents, courses, payments.', 40),
  ('super_admin', 'Super Admin', 'Full system access including role management.', 50);

-- Granular permission catalogue. Roles get defaults; staff rows can be granted extras.
create table public.role_permissions (
  role       public.app_role not null references public.roles(key) on delete cascade,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission) values
  ('counselor', 'students.view_assigned'), ('counselor', 'documents.review'),
  ('counselor', 'applications.manage'),    ('counselor', 'calendar.manage'),
  ('instructor', 'courses.manage'),        ('instructor', 'calendar.manage'),
  ('admin', 'students.view_all'),  ('admin', 'students.manage'), ('admin', 'documents.review'),
  ('admin', 'applications.manage'), ('admin', 'courses.manage'), ('admin', 'payments.manage'),
  ('admin', 'calendar.manage'), ('admin', 'support.manage'), ('admin', 'audit.view'),
  ('admin', 'reports.view'), ('admin', 'universities.manage');

-- One row per auth user.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  first_name   text not null default '',
  last_name    text not null default '',
  phone        text,
  country      text,
  avatar_url   text,
  is_active    boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index profiles_name_trgm on public.profiles using gin ((first_name || ' ' || last_name || ' ' || email) gin_trgm_ops);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

-- Role assignments live in their own table. No user can write here except a super admin
-- (or the service role / signup trigger). A user may hold several roles; the highest
-- ranked one is their "primary" role for routing.
create table public.user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.app_role not null references public.roles(key),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_idx on public.user_roles(user_id);
create index user_roles_role_idx on public.user_roles(role);

create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null unique references public.profiles(id) on delete cascade,
  title       text,
  department  text,
  bio         text,
  permissions text[] not null default '{}',   -- additional grants beyond role defaults
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger staff_updated before update on public.staff for each row execute function public.set_updated_at();

create sequence public.student_number_seq start 1001;

create table public.students (
  id                     uuid primary key default gen_random_uuid(),
  profile_id             uuid not null unique references public.profiles(id) on delete cascade,
  student_number         text not null unique default ('STU-' || nextval('public.student_number_seq')),
  counselor_id           uuid references public.staff(id) on delete set null,
  journey_stage          public.journey_stage not null default 'complete_profile',
  preferred_destinations text[] not null default '{}',
  preferred_study_level  text,
  preferred_intake       text,
  preferred_subjects     text[] not null default '{}',
  budget_max             numeric(12,2),
  application_goals      text,
  onboarding_step        int not null default 1,
  onboarding_completed   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index students_counselor_idx on public.students(counselor_id);
create trigger students_updated before update on public.students for each row execute function public.set_updated_at();

create table public.student_profiles (
  student_id             uuid primary key references public.students(id) on delete cascade,
  date_of_birth          date,
  gender                 text,
  nationality            text,
  passport_number        text,
  passport_expiry        date,
  national_id            text,
  whatsapp               text,
  address_line           text,
  city                   text,
  country                text,
  emergency_name         text,
  emergency_relationship text,
  emergency_phone        text,
  emergency_email        text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger student_profiles_updated before update on public.student_profiles for each row execute function public.set_updated_at();

create table public.education_records (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  institution     text not null,
  qualification   text not null,
  field_of_study  text,
  start_date      date,
  end_date        date,
  grade           text,
  graduation_year int check (graduation_year between 1950 and 2100),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index education_student_idx on public.education_records(student_id);
create trigger education_updated before update on public.education_records for each row execute function public.set_updated_at();

create table public.work_experience (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  company          text not null,
  position         text not null,
  start_date       date,
  end_date         date,
  is_current       boolean not null default false,
  responsibilities text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index work_student_idx on public.work_experience(student_id);
create trigger work_updated before update on public.work_experience for each row execute function public.set_updated_at();

create table public.english_tests (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test_type  text not null check (test_type in ('ielts', 'pte', 'toefl', 'other')),
  test_name  text,                 -- for "other"
  overall    numeric(5,1),
  listening  numeric(5,1),
  reading    numeric(5,1),
  writing    numeric(5,1),
  speaking   numeric(5,1),
  test_date  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index english_student_idx on public.english_tests(student_id);
create trigger english_updated before update on public.english_tests for each row execute function public.set_updated_at();

create table public.notification_preferences (
  profile_id     uuid primary key references public.profiles(id) on delete cascade,
  email_notifications jsonb not null default
    '{"documents":true,"applications":true,"payments":true,"courses":true,"messages":true,"marketing":false}',
  inapp_notifications jsonb not null default
    '{"documents":true,"applications":true,"payments":true,"courses":true,"messages":true}',
  privacy jsonb not null default '{"share_profile_with_universities":true,"show_online_status":true}',
  timezone       text not null default 'UTC',
  updated_at     timestamptz not null default now()
);
create trigger prefs_updated before update on public.notification_preferences for each row execute function public.set_updated_at();

create table public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  reason       text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so they can be used inside RLS
-- policies without recursive policy evaluation. All are STABLE and pin the
-- search_path to avoid hijacking.
-- -----------------------------------------------------------------------------
-- Primary (highest ranked) role of the caller; null for inactive / unknown users.
-- (Named current_app_role because CURRENT_ROLE is a reserved SQL keyword.)
create or replace function public.current_app_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select ur.role from public.user_roles ur
  join public.roles r on r.key = ur.role
  join public.profiles p on p.id = ur.user_id
  where ur.user_id = auth.uid() and p.is_active
  order by r.rank desc limit 1
$$;

create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
                 where ur.user_id = auth.uid() and p.is_active and ur.role = p_role)
$$;

create or replace function public.has_any_role(p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
                 where ur.user_id = auth.uid() and p.is_active and ur.role = any(p_roles))
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role('{counselor,instructor,admin,super_admin}')
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_any_role('{admin,super_admin}')
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('super_admin')
$$;

-- Is the given profile a staff account? (used to let students see staff names)
create or replace function public.is_staff_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = p_profile_id and role <> 'student')
$$;

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where profile_id = auth.uid()
$$;

create or replace function public.current_staff_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.staff where profile_id = auth.uid()
$$;

-- Role defaults + per-staff extra grants. Super admin has everything.
create or replace function public.has_permission(perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or exists (select 1 from public.user_roles ur
                 join public.role_permissions rp on rp.role = ur.role
                 join public.profiles p on p.id = ur.user_id
                 where ur.user_id = auth.uid() and p.is_active and rp.permission = perm)
      or exists (select 1 from public.staff s join public.profiles p on p.id = s.profile_id
                 where s.profile_id = auth.uid() and p.is_active and perm = any(s.permissions))
$$;

-- The caller is the student (owner of the record).
create or replace function public.owns_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.students s join public.profiles p on p.id = s.profile_id
                 where s.id = p_student_id and s.profile_id = auth.uid() and p.is_active)
$$;

-- The caller is the counselor assigned to this student.
create or replace function public.is_assigned_counselor(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('counselor') and exists (
    select 1 from public.students s where s.id = p_student_id and s.counselor_id is not null
      and s.counselor_id = public.current_staff_id())
$$;

-- Can the current user see data belonging to this student?
create or replace function public.can_access_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.owns_student(p_student_id)
      or public.is_assigned_counselor(p_student_id)
      or (public.is_staff() and public.has_permission('students.view_all'))
$$;

-- Staff (not the student themselves) who may manage this student's records.
create or replace function public.can_manage_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() and (public.has_permission('students.view_all') or public.is_assigned_counselor(p_student_id))
$$;

create or replace function public.student_profile_id(p_student_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select profile_id from public.students where id = p_student_id
$$;

-- -----------------------------------------------------------------------------
-- Signup: create profile + student records. Role comes ONLY from
-- raw_app_meta_data (settable by service role, never by the end user).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := coalesce(nullif(new.raw_app_meta_data->>'role', '')::public.app_role, 'student');
  v_student_id uuid;
begin
  insert into public.profiles (id, email, first_name, last_name, phone, country)
  values (
    new.id, new.email,
    left(coalesce(new.raw_user_meta_data->>'first_name', ''), 80),
    left(coalesce(new.raw_user_meta_data->>'last_name', ''), 80),
    left(new.raw_user_meta_data->>'phone', 30),
    left(new.raw_user_meta_data->>'country', 80)
  );
  insert into public.user_roles (user_id, role) values (new.id, v_role);
  insert into public.notification_preferences (profile_id) values (new.id);

  if v_role = 'student' then
    insert into public.students (profile_id) values (new.id) returning id into v_student_id;
    insert into public.student_profiles (student_id, country)
      values (v_student_id, left(new.raw_user_meta_data->>'country', 80));
  else
    insert into public.staff (profile_id, title) values (new.id, initcap(replace(v_role::text, '_', ' ')));
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Keep profile email in sync when the user changes it through auth.
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end $$;
create trigger on_auth_user_email_changed
  after update of email on auth.users for each row
  when (old.email is distinct from new.email) execute function public.handle_user_email_change();

-- Prevent privilege escalation through profile updates.
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- service role / migrations
  if new.id <> old.id or new.email <> old.email then
    raise exception 'Profile identity fields cannot be changed' using errcode = '42501';
  end if;
  if new.is_active is distinct from old.is_active then
    if not public.has_permission('students.manage') or new.id = auth.uid()
       or (public.is_staff_profile(old.id) and not public.is_super_admin()) then
      raise exception 'Not allowed to change account status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

-- Students may update their own onboarding/preferences but not counselor or stage.
create or replace function public.guard_student_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_staff() then return new; end if;
  if new.counselor_id is distinct from old.counselor_id
     or new.student_number is distinct from old.student_number
     or new.profile_id is distinct from old.profile_id then
    raise exception 'Not allowed to change these fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger students_guard before update on public.students for each row execute function public.guard_student_update();

-- Staff may edit their own bio/title, but extra permission grants are admin-only and never self-granted.
create or replace function public.guard_staff_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.permissions is distinct from old.permissions
     and (not public.is_admin() or (new.profile_id = auth.uid() and not public.is_super_admin())) then
    raise exception 'Not allowed to change permissions' using errcode = '42501';
  end if;
  if new.profile_id is distinct from old.profile_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger staff_guard before update on public.staff for each row execute function public.guard_staff_update();

-- Role changes: super admin only, never on yourself. Service role (auth.uid() null) allowed.
create or replace function public.guard_user_roles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if not public.is_super_admin() then
    raise exception 'Only a super admin can change roles' using errcode = '42501';
  end if;
  if coalesce(new.user_id, old.user_id) = auth.uid() then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then new.granted_by := auth.uid(); end if;
  return coalesce(new, old);
end $$;
create trigger user_roles_guard before insert or update or delete on public.user_roles
  for each row execute function public.guard_user_roles();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.user_roles enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.staff enable row level security;
alter table public.students enable row level security;
alter table public.student_profiles enable row level security;
alter table public.education_records enable row level security;
alter table public.work_experience enable row level security;
alter table public.english_tests enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy roles_read on public.roles for select to authenticated using (true);
create policy role_permissions_read on public.role_permissions for select to authenticated using (true);
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Profiles: self, staff who can access the student, all staff profiles are visible to
-- authenticated users (so students can see their counselor's name).
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_staff_profile(user_id) or public.is_admin());
create policy user_roles_write on public.user_roles for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Profiles: self; staff profiles are visible to signed-in users (so students can see their
-- counselor's name); student profiles only to staff who can access that student.
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_staff_profile(id)
  or (public.is_staff() and exists (select 1 from public.students s where s.profile_id = profiles.id and public.can_access_student(s.id)))
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.has_permission('students.manage')) with check (public.has_permission('students.manage'));

create policy staff_select on public.staff for select to authenticated using (true);
create policy staff_write on public.staff for all to authenticated
  using (public.is_super_admin() or (public.is_admin() and profile_id <> auth.uid()))
  with check (public.is_super_admin() or (public.is_admin() and profile_id <> auth.uid()));
create policy staff_update_self on public.staff for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy students_select on public.students for select to authenticated using (public.can_access_student(id));
create policy students_update on public.students for update to authenticated
  using (public.can_access_student(id)) with check (public.can_access_student(id));
create policy students_admin_insert on public.students for insert to authenticated with check (public.has_permission('students.manage'));

-- Shared pattern for student-owned child tables.
create policy sp_select on public.student_profiles for select to authenticated using (public.can_access_student(student_id));
create policy sp_insert on public.student_profiles for insert to authenticated with check (public.can_access_student(student_id));
create policy sp_update on public.student_profiles for update to authenticated using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

create policy edu_all on public.education_records for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));
create policy work_all on public.work_experience for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));
create policy english_all on public.english_tests for all to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));

create policy prefs_self on public.notification_preferences for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy deletion_insert_self on public.account_deletion_requests for insert to authenticated
  with check (profile_id = auth.uid() and status = 'pending');
create policy deletion_select on public.account_deletion_requests for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy deletion_update_admin on public.account_deletion_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
