-- =============================================================================
-- 0008 · Messaging, calendar, support tickets, FAQs
-- =============================================================================

create table public.message_threads (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null,
  category        public.thread_category not null default 'counselor',
  student_id      uuid references public.students(id) on delete cascade,  -- student this thread concerns
  created_by      uuid references public.profiles(id) default auth.uid(),
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index threads_student_idx on public.message_threads(student_id);
create index threads_last_idx on public.message_threads(last_message_at desc);

create table public.thread_participants (
  thread_id    uuid not null references public.message_threads(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at    timestamptz not null default now(),
  primary key (thread_id, profile_id)
);
create index participants_profile_idx on public.thread_participants(profile_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  thread_id       uuid not null references public.message_threads(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) default auth.uid(),
  body            text not null default '' check (length(body) <= 10000),
  attachment_path text,             -- message-attachments bucket: <thread_id>/<file>
  attachment_name text,
  attachment_size bigint check (attachment_size is null or attachment_size <= 10485760),
  attachment_type text,
  created_at      timestamptz not null default now(),
  check (btrim(body) <> '' or attachment_path is not null)
);
create index messages_thread_idx on public.messages(thread_id, created_at);
create index messages_body_trgm on public.messages using gin (body gin_trgm_ops);

create or replace function public.is_thread_participant(p_thread_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.thread_participants where thread_id = p_thread_id and profile_id = auth.uid())
$$;

create or replace function public.can_access_thread(p_thread_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_thread_participant(p_thread_id)
      or exists (select 1 from public.message_threads t where t.id = p_thread_id and t.student_id is not null
                 and public.is_staff() and public.can_manage_student(t.student_id))
$$;

-- Start a conversation. Students are routed to the right staff member automatically:
-- counselor → their assigned counselor; admin/support → admins; instructor → given recipient.
create or replace function public.start_thread(p_subject text, p_category public.thread_category, p_body text,
  p_recipient_ids uuid[] default '{}', p_student_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_thread uuid; v_student uuid; v_recipients uuid[] := coalesce(p_recipient_ids, '{}'); r uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if coalesce(btrim(p_subject), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'Subject and message are required' using errcode = '22023';
  end if;
  if public.is_staff() then
    v_student := p_student_id;
    if v_student is not null then
      if not public.can_manage_student(v_student) then raise exception 'Not allowed' using errcode = '42501'; end if;
      v_recipients := array_append(v_recipients, public.student_profile_id(v_student));
    end if;
  else
    v_student := public.current_student_id();
    -- students may only address staff
    select coalesce(array_agg(id), '{}') into v_recipients from public.profiles
      where id = any(v_recipients) and public.is_staff_profile(id) and is_active;
    if p_category = 'counselor' then
      select v_recipients || coalesce(array_agg(st.profile_id), '{}') into v_recipients
        from public.students s join public.staff st on st.id = s.counselor_id where s.id = v_student;
    elsif p_category in ('admin', 'support') and cardinality(v_recipients) = 0 then
      select coalesce(array_agg(distinct p.id), '{}') into v_recipients from public.profiles p
        join public.user_roles ur on ur.user_id = p.id and ur.role = 'admin' where p.is_active;
    end if;
    if cardinality(v_recipients) = 0 then
      raise exception 'No staff member is available for this conversation yet' using errcode = 'P0001';
    end if;
  end if;

  insert into public.message_threads (subject, category, student_id) values (btrim(p_subject), p_category, v_student)
    returning id into v_thread;
  insert into public.thread_participants (thread_id, profile_id, last_read_at) values (v_thread, auth.uid(), now());
  foreach r in array v_recipients loop
    insert into public.thread_participants (thread_id, profile_id) values (v_thread, r) on conflict do nothing;
  end loop;
  insert into public.messages (thread_id, sender_id, body) values (v_thread, auth.uid(), btrim(p_body));
  return v_thread;
end $$;
grant execute on function public.start_thread(text, public.thread_category, text, uuid[], uuid) to authenticated;

create or replace function public.mark_thread_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_access_thread(p_thread_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  insert into public.thread_participants (thread_id, profile_id, last_read_at) values (p_thread_id, auth.uid(), now())
  on conflict (thread_id, profile_id) do update set last_read_at = now();
end $$;
grant execute on function public.mark_thread_read(uuid) to authenticated;

create or replace function public.on_message_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sender text; v_is_counselor boolean;
begin
  update public.message_threads set last_message_at = new.created_at where id = new.thread_id;
  -- staff replying to a thread they were not in become participants
  insert into public.thread_participants (thread_id, profile_id, last_read_at) values (new.thread_id, new.sender_id, now())
    on conflict (thread_id, profile_id) do update set last_read_at = now();
  select first_name || ' ' || last_name into v_sender from public.profiles where id = new.sender_id;
  select exists (select 1 from public.user_roles where user_id = new.sender_id and role = 'counselor') into v_is_counselor;
  insert into public.notifications (recipient_id, type, title, body, link)
  select tp.profile_id,
         case when v_is_counselor then 'counselor_message'::public.notification_type else 'new_message' end,
         'New message from ' || v_sender, left(coalesce(nullif(new.body, ''), 'Sent an attachment'), 140),
         '/messages/' || new.thread_id
  from public.thread_participants tp where tp.thread_id = new.thread_id and tp.profile_id <> new.sender_id;
  perform public.emit_event('message.created', 'thread', new.thread_id, jsonb_build_object('message_id', new.id));
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages for each row execute function public.on_message_insert();

-- Thread list with unread counts for the current user.
create or replace view public.my_threads with (security_invoker = true) as
select t.*, tp.last_read_at,
  (select count(*) from public.messages m where m.thread_id = t.id and m.sender_id <> auth.uid()
     and (tp.last_read_at is null or m.created_at > tp.last_read_at))::int as unread_count,
  (select m.body from public.messages m where m.thread_id = t.id order by m.created_at desc limit 1) as last_message
from public.message_threads t
left join public.thread_participants tp on tp.thread_id = t.id and tp.profile_id = auth.uid();

-- -----------------------------------------------------------------------------
-- Calendar
-- -----------------------------------------------------------------------------
create table public.calendar_events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  event_type     public.calendar_event_type not null default 'other',
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  all_day        boolean not null default false,
  location       text,
  meeting_url    text,
  student_id     uuid references public.students(id) on delete cascade,      -- personal event
  course_id      uuid references public.courses(id) on delete cascade,       -- for everyone enrolled
  application_id uuid references public.applications(id) on delete cascade,
  assignment_id  uuid unique references public.assignments(id) on delete cascade,
  is_public      boolean not null default false,                             -- all students
  created_by     uuid references public.profiles(id) default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index calendar_student_idx on public.calendar_events(student_id, starts_at);
create index calendar_course_idx on public.calendar_events(course_id, starts_at);
create index calendar_starts_idx on public.calendar_events(starts_at);
create trigger calendar_updated before update on public.calendar_events for each row execute function public.set_updated_at();

-- Assignment due dates appear on enrolled students' calendars automatically.
create or replace function public.sync_assignment_calendar()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.due_at is null or not new.is_published then
    delete from public.calendar_events where assignment_id = new.id;
  else
    insert into public.calendar_events (title, event_type, starts_at, course_id, assignment_id, created_by)
    values ('Due: ' || new.title, 'assignment_deadline', new.due_at, new.course_id, new.id, new.created_by)
    on conflict (assignment_id) do update set title = excluded.title, starts_at = excluded.starts_at;
  end if;
  return null;
end $$;
create trigger assignments_calendar after insert or update of due_at, title, is_published on public.assignments
  for each row execute function public.sync_assignment_calendar();

-- -----------------------------------------------------------------------------
-- Support
-- -----------------------------------------------------------------------------
create sequence public.ticket_ref_seq start 1;

create table public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique default ('TCK-' || lpad(nextval('public.ticket_ref_seq')::text, 6, '0')),
  student_id      uuid references public.students(id) on delete cascade,
  created_by      uuid not null references public.profiles(id) default auth.uid(),
  subject         text not null check (length(subject) between 3 and 200),
  category        text not null check (category in ('technical', 'application', 'documents', 'payments', 'courses', 'visa', 'other')),
  priority        public.ticket_priority not null default 'medium',
  description     text not null check (length(description) between 10 and 5000),
  status          public.ticket_status not null default 'open',
  assigned_to     uuid references public.profiles(id),
  attachment_path text,                 -- message-attachments bucket: tickets/<ticket_id>/<file>
  attachment_name text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index tickets_student_idx on public.support_tickets(student_id);
create index tickets_status_idx on public.support_tickets(status);
create trigger tickets_updated before update on public.support_tickets for each row execute function public.set_updated_at();

create table public.ticket_replies (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) default auth.uid(),
  body        text not null check (length(body) between 1 and 5000),
  is_internal boolean not null default false,
  created_at  timestamptz not null default now()
);
create index ticket_replies_ticket_idx on public.ticket_replies(ticket_id, created_at);

create or replace function public.guard_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('resolved', 'closed') and (tg_op = 'INSERT' or old.status not in ('resolved', 'closed')) then
    new.resolved_at := now();
  end if;
  if auth.uid() is null or public.has_permission('support.manage') then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      perform public.notify(new.created_by, 'support_update', 'Ticket ' || new.reference || ' updated',
        'Status: ' || initcap(replace(new.status::text, '_', ' ')), '/support/tickets/' || new.id);
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.student_id := public.current_student_id();
    new.status := 'open'; new.assigned_to := null;
  else
    -- requesters may only close their own ticket or reopen it
    if new.status is distinct from old.status and new.status not in ('closed', 'open') then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    if new.assigned_to is distinct from old.assigned_to or new.priority is distinct from old.priority then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger tickets_guard before insert or update on public.support_tickets for each row execute function public.guard_ticket();

create or replace function public.on_ticket_reply()
returns trigger language plpgsql security definer set search_path = public as $$
declare t public.support_tickets;
begin
  select * into t from public.support_tickets where id = new.ticket_id;
  if new.is_internal then return null; end if;
  if new.author_id <> t.created_by then
    perform public.notify(t.created_by, 'support_update', 'New reply on ' || t.reference, left(new.body, 140), '/support/tickets/' || t.id);
    if t.status = 'open' then update public.support_tickets set status = 'in_progress' where id = t.id; end if;
  elsif t.status = 'waiting_for_student' then
    update public.support_tickets set status = 'in_progress' where id = t.id;
  end if;
  return null;
end $$;
create trigger ticket_replies_after after insert on public.ticket_replies for each row execute function public.on_ticket_reply();

create table public.faqs (
  id           uuid primary key default gen_random_uuid(),
  category     text not null,
  question     text not null,
  answer       text not null,
  position     int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.message_threads enable row level security;
alter table public.thread_participants enable row level security;
alter table public.messages enable row level security;
alter table public.calendar_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_replies enable row level security;
alter table public.faqs enable row level security;

create policy threads_select on public.message_threads for select to authenticated using (public.can_access_thread(id));
create policy participants_select on public.thread_participants for select to authenticated using (public.can_access_thread(thread_id));
create policy participants_update_self on public.thread_participants for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy messages_select on public.messages for select to authenticated using (public.can_access_thread(thread_id));
create policy messages_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.can_access_thread(thread_id)
  and (attachment_path is null or split_part(attachment_path, '/', 1) = thread_id::text)
);

create policy calendar_select on public.calendar_events for select to authenticated using (
  is_public
  or (student_id is not null and public.can_access_student(student_id))
  or (course_id is not null and (public.is_enrolled(course_id) or public.can_manage_course(course_id)))
  or (application_id is not null and exists (select 1 from public.applications a where a.id = application_id and public.can_access_student(a.student_id)))
  or created_by = auth.uid()
  or public.is_admin()
);
create policy calendar_write on public.calendar_events for all to authenticated using (
  public.has_permission('calendar.manage') and (public.is_admin() or created_by = auth.uid()
    or (student_id is not null and public.can_manage_student(student_id))
    or (course_id is not null and public.can_manage_course(course_id)))
) with check (
  public.has_permission('calendar.manage') and (public.is_admin()
    or (student_id is not null and public.can_manage_student(student_id))
    or (course_id is not null and public.can_manage_course(course_id))
    or (student_id is null and course_id is null and not is_public))
);

create policy tickets_select on public.support_tickets for select to authenticated using (
  created_by = auth.uid() or public.has_permission('support.manage')
  or (student_id is not null and public.can_manage_student(student_id))
);
create policy tickets_insert on public.support_tickets for insert to authenticated with check (true);  -- guard trigger pins owner
create policy tickets_update on public.support_tickets for update to authenticated
  using (created_by = auth.uid() or public.has_permission('support.manage'))
  with check (created_by = auth.uid() or public.has_permission('support.manage'));

create policy replies_select on public.ticket_replies for select to authenticated using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id
          and (t.created_by = auth.uid() or public.has_permission('support.manage')))
  and (not is_internal or public.has_permission('support.manage'))
);
create policy replies_insert on public.ticket_replies for insert to authenticated with check (
  author_id = auth.uid() and exists (select 1 from public.support_tickets t where t.id = ticket_id
    and (t.created_by = auth.uid() or public.has_permission('support.manage')))
  and (not is_internal or public.has_permission('support.manage'))
);

create policy faqs_read on public.faqs for select to authenticated using (is_published or public.is_admin());
create policy faqs_anon_read on public.faqs for select to anon using (is_published);
create policy faqs_write on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Student tasks (assigned by counselors/admins, or created by the student)
-- -----------------------------------------------------------------------------
create table public.student_tasks (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  title        text not null check (length(title) between 2 and 200),
  description  text,
  link         text,                                -- in-app route the task points to
  due_at       timestamptz,
  status       text not null default 'todo' check (status in ('todo', 'done')),
  completed_at timestamptz,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tasks_student_idx on public.student_tasks(student_id, status, due_at);
create trigger tasks_updated before update on public.student_tasks for each row execute function public.set_updated_at();

create or replace function public.on_task_change()
returns trigger language plpgsql as $$
begin
  new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) end;
  return new;
end $$;
create trigger tasks_completed before insert or update on public.student_tasks for each row execute function public.on_task_change();

alter table public.student_tasks enable row level security;
create policy tasks_select on public.student_tasks for select to authenticated using (public.can_access_student(student_id));
create policy tasks_insert on public.student_tasks for insert to authenticated
  with check (public.owns_student(student_id) or public.can_manage_student(student_id));
create policy tasks_update on public.student_tasks for update to authenticated
  using (public.can_access_student(student_id)) with check (public.can_access_student(student_id));
create policy tasks_delete on public.student_tasks for delete to authenticated
  using ((public.owns_student(student_id) and created_by = auth.uid()) or public.can_manage_student(student_id));
