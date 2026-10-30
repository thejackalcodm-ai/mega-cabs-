-- =============================================================================
-- 0015 · Admin & counselor workspaces
--   * notification types for staff
--   * counselor changes only by student managers (guard + assign_counselor())
--   * counselor is notified when an assigned student uploads or replaces a document
--   * student_directory view (security_invoker: RLS applies)
--   * admin_dashboard_metrics() and counselor_dashboard() aggregates
--   * log_admin_user_created() so user creation (Edge Function) is audited with the real actor
-- =============================================================================
alter type public.notification_type add value if not exists 'document_uploaded';
alter type public.notification_type add value if not exists 'counselor_assigned';

-- ---------------------------------------------------------------- counselor assignment
create or replace function public.guard_student_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;   -- service role / migrations
  if new.student_number is distinct from old.student_number or new.profile_id is distinct from old.profile_id then
    raise exception 'Not allowed to change these fields' using errcode = '42501';
  end if;
  -- only student managers (admins, or staff explicitly granted students.manage) assign counselors
  if new.counselor_id is distinct from old.counselor_id and not public.has_permission('students.manage') then
    raise exception 'Only an administrator can assign counselors' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.assign_counselor(p_student_id uuid, p_staff_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_old uuid; v_counselor_profile uuid; v_student_name text;
begin
  if not public.has_permission('students.manage') then
    raise exception 'Only an administrator can assign counselors' using errcode = '42501';
  end if;
  select counselor_id into v_old from public.students where id = p_student_id for update;
  if not found then raise exception 'Student not found' using errcode = '22023'; end if;
  if p_staff_id is not null then
    select st.profile_id into v_counselor_profile
      from public.staff st join public.profiles p on p.id = st.profile_id
      join public.user_roles ur on ur.user_id = st.profile_id and ur.role = 'counselor'
     where st.id = p_staff_id and p.is_active;
    if v_counselor_profile is null then
      raise exception 'Choose an active counselor' using errcode = '22023';
    end if;
  end if;
  if v_old is not distinct from p_staff_id then return; end if;

  update public.students set counselor_id = p_staff_id where id = p_student_id;
  perform public.write_audit('student.counselor_assigned', 'student', p_student_id, p_student_id,
    jsonb_build_object('from', v_old, 'to', p_staff_id));

  select first_name || ' ' || last_name into v_student_name from public.profiles where id = public.student_profile_id(p_student_id);
  if v_counselor_profile is not null then
    perform public.notify(v_counselor_profile, 'counselor_assigned', 'New student assigned: ' || v_student_name,
      'You are now the counselor for ' || v_student_name || '.', '/admin/students/' || p_student_id);
    perform public.notify(public.student_profile_id(p_student_id), 'counselor_assigned', 'Your counselor has been assigned',
      (select first_name || ' ' || last_name from public.profiles where id = v_counselor_profile) || ' will guide your applications.', '/app/messages');
  end if;
end $$;
grant execute on function public.assign_counselor(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- counselor notified of new uploads
create or replace function public.notify_document_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_counselor uuid; v_student_profile uuid; v_name text; v_type text;
begin
  if tg_op = 'UPDATE' and new.version <= old.version then return null; end if;
  v_student_profile := public.student_profile_id(new.student_id);
  if new.uploaded_by is distinct from v_student_profile then return null; end if;   -- staff/service uploads
  select st.profile_id into v_counselor from public.students s join public.staff st on st.id = s.counselor_id where s.id = new.student_id;
  if v_counselor is null then return null; end if;
  select first_name || ' ' || last_name into v_name from public.profiles where id = v_student_profile;
  select coalesce(new.custom_type_name, name) into v_type from public.document_types where id = new.document_type_id;
  perform public.notify(v_counselor, 'document_uploaded',
    case when tg_op = 'INSERT' then 'New document from ' else 'Updated document from ' end || v_name,
    v_type || case when tg_op = 'UPDATE' then ' (version ' || new.version || ')' else '' end || ' is ready for review.',
    '/admin/documents/' || new.id);
  return null;
end $$;
create trigger documents_notify_insert after insert on public.documents
  for each row execute function public.notify_document_submitted();
create trigger documents_notify_version after update of version on public.documents
  for each row execute function public.notify_document_submitted();

-- ---------------------------------------------------------------- directory
create view public.student_directory with (security_invoker = true) as
select
  s.id, s.student_number, s.profile_id, p.first_name, p.last_name, p.email, p.phone,
  coalesce(sp.country, p.country) as country, sp.nationality, p.is_active, p.last_seen_at,
  s.counselor_id, nullif(btrim(coalesce(cp.first_name, '') || ' ' || coalesce(cp.last_name, '')), '') as counselor_name,
  s.journey_stage, s.onboarding_completed, s.created_at,
  (select count(*) from public.applications a where a.student_id = s.id
     and a.status not in ('withdrawn', 'completed', 'visa_refused'))::int as active_applications,
  (select count(*) from public.documents d where d.student_id = s.id and d.status in ('uploaded', 'under_review'))::int as documents_pending,
  (select count(*) from public.documents d where d.student_id = s.id and d.status in ('rejected', 'resubmission_required', 'expired'))::int as documents_action,
  (select a.status from public.applications a where a.student_id = s.id order by a.updated_at desc limit 1) as latest_application_status
from public.students s
join public.profiles p on p.id = s.profile_id
left join public.student_profiles sp on sp.student_id = s.id
left join public.staff c on c.id = s.counselor_id
left join public.profiles cp on cp.id = c.profile_id;

-- Active counselors, for the assignment picker (staff profiles are visible to signed-in users).
create view public.counselor_directory with (security_invoker = true) as
select st.id as staff_id, p.id as profile_id, p.first_name, p.last_name, p.email,
  (select count(*) from public.students s where s.counselor_id = st.id)::int as assigned_students
from public.staff st
join public.profiles p on p.id = st.profile_id
join public.user_roles ur on ur.user_id = st.profile_id and ur.role = 'counselor'
where p.is_active;

-- ---------------------------------------------------------------- dashboards
create or replace function public.admin_dashboard_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public.has_permission('students.view_all') or public.has_role('counselor')) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  with vis as (select s.id, s.profile_id, s.created_at from public.students s where public.can_access_student(s.id)),
  apps as (select a.* from public.applications a join vis on vis.id = a.student_id),
  docs as (select d.* from public.documents d join vis on vis.id = d.student_id),
  pays as (select p.* from public.payments p join vis on vis.id = p.student_id)
  select jsonb_build_object(
    'scope', case when public.has_permission('students.view_all') then 'all' else 'assigned' end,
    'total_students', (select count(*) from vis),
    'active_students', (select count(*) from vis join public.profiles p on p.id = vis.profile_id
                        where p.is_active and p.last_seen_at >= now() - interval '30 days'),   -- signed in within 30 days
    'new_applications', (select count(*) from apps where created_at >= now() - interval '30 days'),
    'applications_pending', (select count(*) from apps where status in ('application_started', 'documents_required', 'submitted', 'under_university_review')),
    'documents_pending', (select count(*) from docs where status in ('uploaded', 'under_review')),
    'offers_received', (select count(*) from apps where status in ('conditional_offer', 'unconditional_offer', 'deposit_required', 'deposit_paid',
                          'cas_pending', 'cas_issued', 'visa_preparation', 'visa_submitted', 'visa_approved', 'completed')),
    'visa_applications', (select count(*) from apps where status in ('visa_preparation', 'visa_submitted', 'visa_approved', 'visa_refused')),
    'course_enrollments', (select count(*) from public.enrollments e join vis on vis.id = e.student_id where e.status <> 'dropped'),
    'payments_30d', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount)), '[]') from (
                       select currency, sum(amount) amount from pays where status = 'paid' and paid_at >= now() - interval '30 days' group by currency) x),
    'outstanding', (select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount)), '[]') from (
                       select i.currency, sum(i.total - i.amount_paid) amount from public.invoices i join vis on vis.id = i.student_id
                       where i.status = 'open' group by i.currency) x),
    'applications_by_status', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', n) order by n desc), '[]')
                               from (select status, count(*) n from apps group by status) x),
    'students_by_country', (select coalesce(jsonb_agg(jsonb_build_object('country', country, 'count', n) order by n desc, country), '[]')
                            from (select coalesce(sp.country, p.country, 'Unknown') country, count(*) n from vis
                                  join public.profiles p on p.id = vis.profile_id
                                  left join public.student_profiles sp on sp.student_id = vis.id group by 1) x),
    'documents_awaiting', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', n) order by n desc), '[]')
                           from (select category, count(*) n from docs where status in ('uploaded', 'under_review') group by category) x),
    'monthly_applications', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                               'count', (select count(*) from apps where date_trunc('month', created_at) = m)) order by m)
                             from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m),
    'revenue_by_month', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                           'amounts', (select coalesce(jsonb_object_agg(currency, amount), '{}') from (
                              select currency, sum(amount) amount from pays where status = 'paid' and date_trunc('month', paid_at) = m group by currency) y)) order by m)
                         from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m),
    'course_engagement', (select coalesce(jsonb_agg(jsonb_build_object('course', c.title, 'enrollments', x.n, 'avg_progress', x.avg_progress, 'completed', x.done) order by x.n desc), '[]')
                          from (select e.course_id, count(*) n, round(avg(e.progress_percent), 1) avg_progress, count(*) filter (where e.status = 'completed') done
                                from public.enrollments e join vis on vis.id = e.student_id where e.status <> 'dropped' group by e.course_id) x
                          join public.courses c on c.id = x.course_id)
  ) into v;
  return v;
end $$;
grant execute on function public.admin_dashboard_metrics() to authenticated;

create or replace function public.counselor_dashboard()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_staff uuid := public.current_staff_id(); v jsonb;
begin
  if v_staff is null or not public.has_role('counselor') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  with mine as (select s.id, s.profile_id, s.student_number, s.journey_stage from public.students s where s.counselor_id = v_staff)
  select jsonb_build_object(
    'assigned_students', (select count(*) from mine),
    'pending_documents', (select coalesce(jsonb_agg(x order by x.uploaded_at), '[]') from (
        select d.id, d.uploaded_at, d.status, d.version, coalesce(d.custom_type_name, dt.name) as type_name,
               p.first_name || ' ' || p.last_name as student_name, m.id as student_id
        from public.documents d join mine m on m.id = d.student_id join public.profiles p on p.id = m.profile_id
        join public.document_types dt on dt.id = d.document_type_id
        where d.status in ('uploaded', 'under_review') order by d.uploaded_at limit 10) x),
    'pending_documents_total', (select count(*) from public.documents d join mine m on m.id = d.student_id where d.status in ('uploaded', 'under_review')),
    'upcoming_deadlines', (select coalesce(jsonb_agg(x order by x.starts_at), '[]') from (
        select e.id, e.title, e.event_type, e.starts_at, p.first_name || ' ' || p.last_name as student_name, m.id as student_id
        from public.calendar_events e
        join mine m on m.id = e.student_id or m.id = (select a.student_id from public.applications a where a.id = e.application_id)
        join public.profiles p on p.id = m.profile_id
        where e.starts_at between now() and now() + interval '21 days'
        union all
        select i.id, 'Invoice due: ' || i.title, 'payment_deadline', i.due_date::timestamptz, p.first_name || ' ' || p.last_name, m.id
        from public.invoices i join mine m on m.id = i.student_id join public.profiles p on p.id = m.profile_id
        where i.status = 'open' and i.due_date between current_date and current_date + 21
        order by 4 limit 12) x),
    'attention', (select coalesce(jsonb_agg(x order by x.updated_at), '[]') from (
        select a.id, a.reference, a.status, a.updated_at, u.name as university, p.first_name || ' ' || p.last_name as student_name, m.id as student_id,
               (select count(*) from public.documents d where d.student_id = m.id and d.status in ('rejected', 'resubmission_required', 'expired'))::int as documents_action,
               case when a.status = 'documents_required' then 'Documents required'
                    when a.status in ('conditional_offer', 'unconditional_offer') then 'Offer to review with the student'
                    when a.status = 'deposit_required' then 'Deposit not yet paid'
                    when a.status = 'visa_preparation' then 'Visa documents in preparation'
                    else 'Documents need re-uploading' end as reason
        from public.applications a join mine m on m.id = a.student_id join public.profiles p on p.id = m.profile_id
        join public.universities u on u.id = a.university_id
        where a.status in ('documents_required', 'conditional_offer', 'unconditional_offer', 'deposit_required', 'visa_preparation')
           or exists (select 1 from public.documents d where d.student_id = m.id and d.status in ('rejected', 'resubmission_required', 'expired'))
        limit 20) x),
    'unread_messages', (select count(*) from public.messages msg
        join public.thread_participants tp on tp.thread_id = msg.thread_id and tp.profile_id = auth.uid()
        where msg.sender_id <> auth.uid() and (tp.last_read_at is null or msg.created_at > tp.last_read_at))
  ) into v;
  return v;
end $$;
grant execute on function public.counselor_dashboard() to authenticated;

-- ---------------------------------------------------------------- user creation audit (called by the Edge Function with the caller's JWT)
create or replace function public.log_admin_user_created(p_user_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_student uuid;
begin
  if p_role = 'student' and not public.has_permission('students.manage') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_role <> 'student' and not public.is_super_admin() then
    raise exception 'Only a super admin can create staff accounts' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User not found' using errcode = '22023';
  end if;
  select id into v_student from public.students where profile_id = p_user_id;
  perform public.write_audit('user.created', 'profile', p_user_id, v_student, jsonb_build_object('role', p_role));
end $$;
grant execute on function public.log_admin_user_created(uuid, public.app_role) to authenticated;

-- Audit rows written in one transaction (e.g. review + notification + audit) all got the same
-- now(); clock_timestamp() keeps the real order of events in the trail.
alter table public.audit_logs alter column created_at set default clock_timestamp();
