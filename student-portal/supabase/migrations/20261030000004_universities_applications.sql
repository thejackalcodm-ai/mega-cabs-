-- =============================================================================
-- 0004 · Universities, programs, scholarships, applications & timeline
-- =============================================================================

create table public.universities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  country     text not null,
  city        text not null,
  website     text,
  ranking     int,
  description text,
  established int,
  student_population int,
  is_active   boolean not null default true,
  external_ref text,               -- id in a partner/university API
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index universities_country_idx on public.universities(country);
create index universities_name_trgm on public.universities using gin (name gin_trgm_ops);
create trigger universities_updated before update on public.universities for each row execute function public.set_updated_at();

-- University programs ("courses" offered by universities; LMS courses live in public.courses).
create table public.programs (
  id                   uuid primary key default gen_random_uuid(),
  university_id        uuid not null references public.universities(id) on delete cascade,
  name                 text not null,
  subject              text not null,
  study_level          text not null check (study_level in ('foundation', 'undergraduate', 'postgraduate', 'phd', 'diploma')),
  duration_months      int,
  tuition_fee          numeric(12,2),
  currency             text not null default 'GBP',
  intakes              text[] not null default '{}',
  entry_requirements   text,
  english_requirements text,
  ielts_min            numeric(3,1),
  application_deadline date,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index programs_university_idx on public.programs(university_id);
create index programs_subject_idx on public.programs(subject);
create index programs_name_trgm on public.programs using gin (name gin_trgm_ops);
create trigger programs_updated before update on public.programs for each row execute function public.set_updated_at();

create table public.scholarships (
  id            uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name          text not null,
  amount        numeric(12,2),
  currency      text not null default 'GBP',
  description   text,
  eligibility   text,
  deadline      date,
  created_at    timestamptz not null default now()
);
create index scholarships_university_idx on public.scholarships(university_id);

create table public.saved_universities (
  student_id    uuid not null references public.students(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (student_id, university_id)
);

create sequence public.application_ref_seq start 1;

create table public.applications (
  id            uuid primary key default gen_random_uuid(),
  reference     text not null unique
                default ('APP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.application_ref_seq')::text, 5, '0')),
  student_id    uuid not null references public.students(id) on delete cascade,
  university_id uuid not null references public.universities(id),
  program_id    uuid references public.programs(id),
  intake        text,
  status        public.application_status not null default 'planning',
  submitted_at  timestamptz,
  decision_at   timestamptz,
  offer_conditions text,
  notes         text,                         -- staff-only notes are kept in application_events (internal)
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index applications_student_idx on public.applications(student_id);
create index applications_status_idx on public.applications(status);
create index applications_university_idx on public.applications(university_id);
create index applications_created_idx on public.applications(created_at desc);
create trigger applications_updated before update on public.applications for each row execute function public.set_updated_at();

create table public.application_events (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  status         public.application_status,
  title          text not null,
  description    text,
  is_internal    boolean not null default false,      -- hidden from the student
  actor_id       uuid references public.profiles(id) default auth.uid(),
  occurred_at    timestamptz not null default now()
);
create index application_events_app_idx on public.application_events(application_id, occurred_at);

-- Human-readable labels used in timeline + notifications.
create or replace function public.application_status_label(s public.application_status)
returns text language sql immutable as $$
  select initcap(replace(replace(s::text, 'cas_', 'CAS '), '_', ' '))
$$;

-- Students can create applications only in early stages; status transitions are staff-only.
create or replace function public.guard_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'submitted' and new.submitted_at is null then new.submitted_at := now(); end if;
  if new.status in ('conditional_offer', 'unconditional_offer', 'visa_approved', 'visa_refused')
     and new.decision_at is null then new.decision_at := now(); end if;
  if auth.uid() is null or public.is_staff() then return new; end if;
  if tg_op = 'INSERT' then
    if new.status not in ('planning', 'application_started') then
      raise exception 'Students can only start applications' using errcode = '42501';
    end if;
  else
    if new.student_id <> old.student_id or new.university_id <> old.university_id then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    -- students may only withdraw, or move planning → started
    if new.status is distinct from old.status
       and not (new.status = 'withdrawn' or (old.status = 'planning' and new.status = 'application_started')) then
      raise exception 'Only staff can change application status' using errcode = '42501';
    end if;
    if new.offer_conditions is distinct from old.offer_conditions or new.decision_at is distinct from old.decision_at then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger applications_guard before insert or update on public.applications
  for each row execute function public.guard_application();

create or replace function public.on_application_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uni text;
  v_profile uuid := public.student_profile_id(new.student_id);
begin
  select name into v_uni from public.universities where id = new.university_id;
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, status, title, description)
    values (new.id, new.status, 'Application created', 'Application to ' || v_uni || ' was created.');
    perform public.write_audit('application.created', 'application', new.id, new.student_id,
      jsonb_build_object('university', v_uni, 'status', new.status));
    perform public.emit_event('application.created', 'application', new.id, to_jsonb(new));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.application_events (application_id, status, title)
    values (new.id, new.status, public.application_status_label(new.status));
    perform public.write_audit('application.status_changed', 'application', new.id, new.student_id,
      jsonb_build_object('from', old.status, 'to', new.status));
    perform public.emit_event('application.status_changed', 'application', new.id,
      jsonb_build_object('from', old.status, 'to', new.status, 'student_id', new.student_id));
    if new.status in ('conditional_offer', 'unconditional_offer') then
      perform public.notify(v_profile, 'university_offer', 'New offer from ' || v_uni,
        'You received a ' || replace(new.status::text, '_', ' ') || '. Review it in My Applications.',
        '/applications/' || new.id);
    else
      perform public.notify(v_profile, 'application_status', 'Application update: ' || v_uni,
        'Status changed to ' || public.application_status_label(new.status) || '.', '/applications/' || new.id);
    end if;
  end if;
  return new;
end $$;
create trigger applications_after after insert or update on public.applications
  for each row execute function public.on_application_change();

alter table public.universities enable row level security;
alter table public.programs enable row level security;
alter table public.scholarships enable row level security;
alter table public.saved_universities enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;

create policy universities_read on public.universities for select to authenticated using (is_active or public.is_staff());
create policy universities_write on public.universities for all to authenticated
  using (public.has_permission('universities.manage')) with check (public.has_permission('universities.manage'));
create policy programs_read on public.programs for select to authenticated using (is_active or public.is_staff());
create policy programs_write on public.programs for all to authenticated
  using (public.has_permission('universities.manage')) with check (public.has_permission('universities.manage'));
create policy scholarships_read on public.scholarships for select to authenticated using (true);
create policy scholarships_write on public.scholarships for all to authenticated
  using (public.has_permission('universities.manage')) with check (public.has_permission('universities.manage'));

create policy saved_self on public.saved_universities for all to authenticated
  using (student_id = public.current_student_id()) with check (student_id = public.current_student_id());

create policy applications_select on public.applications for select to authenticated using (public.can_access_student(student_id));
create policy applications_insert on public.applications for insert to authenticated with check (
  student_id = public.current_student_id()
  or (public.has_permission('applications.manage') and public.can_manage_student(student_id))
);
create policy applications_update on public.applications for update to authenticated
  using (student_id = public.current_student_id() or (public.has_permission('applications.manage') and public.can_manage_student(student_id)))
  with check (student_id = public.current_student_id() or (public.has_permission('applications.manage') and public.can_manage_student(student_id)));
create policy applications_delete on public.applications for delete to authenticated using (public.is_admin());

create policy app_events_select on public.application_events for select to authenticated using (
  exists (select 1 from public.applications a where a.id = application_id and public.can_access_student(a.student_id))
  and (not is_internal or public.is_staff())
);
create policy app_events_insert on public.application_events for insert to authenticated with check (
  public.is_staff() and exists (select 1 from public.applications a where a.id = application_id and public.can_manage_student(a.student_id))
);
