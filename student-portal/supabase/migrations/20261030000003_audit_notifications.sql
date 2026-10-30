-- =============================================================================
-- 0003 · Audit log, notifications, integration outbox
-- =============================================================================

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_role  public.app_role,
  action      text not null,                 -- e.g. 'document.approved'
  entity_type text,                          -- e.g. 'document'
  entity_id   uuid,
  student_id  uuid,                          -- affected student, when applicable
  metadata    jsonb not null default '{}',
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index audit_created_idx on public.audit_logs(created_at desc);
create index audit_actor_idx on public.audit_logs(actor_id);
create index audit_entity_idx on public.audit_logs(entity_type, entity_id);
create index audit_action_idx on public.audit_logs(action);

-- Request headers are exposed by PostgREST as a GUC.
create or replace function public.request_header(p_name text)
returns text language sql stable as $$
  select nullif(current_setting('request.headers', true), '')::jsonb ->> p_name
$$;

create or replace function public.write_audit(
  p_action text, p_entity_type text default null, p_entity_id uuid default null,
  p_student_id uuid default null, p_metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, student_id, metadata, ip_address, user_agent)
  values (
    auth.uid(), public.current_app_role(), p_action, p_entity_type, p_entity_id, p_student_id,
    coalesce(p_metadata, '{}'),
    split_part(coalesce(public.request_header('x-forwarded-for'), public.request_header('x-real-ip')), ',', 1),
    left(public.request_header('user-agent'), 400)
  );
end $$;
revoke execute on function public.write_audit(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

-- Client-callable logger restricted to a whitelist of client-originated events.
create or replace function public.log_client_event(p_action text, p_entity_type text default null,
  p_entity_id uuid default null, p_metadata jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare v_student uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if p_action not in ('auth.login', 'auth.logout', 'auth.password_changed', 'document.downloaded',
                      'document.viewed', 'report.exported') then
    raise exception 'Unsupported audit action' using errcode = '22023';
  end if;
  if p_entity_type = 'document' then
    select student_id into v_student from public.documents where id = p_entity_id;
    if v_student is null or not public.can_access_student(v_student) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
  end if;
  if p_action = 'auth.login' then
    update public.profiles set last_seen_at = now() where id = auth.uid();
  end if;
  perform public.write_audit(p_action, p_entity_type, p_entity_id, v_student, case when length(p_metadata::text) > 2000 then '{}'::jsonb else coalesce(p_metadata, '{}') end);
end $$;
grant execute on function public.log_client_event(text, text, uuid, jsonb) to authenticated;

-- Transactional outbox: every domain event that an external system (email, SMS/WhatsApp,
-- CRM, analytics, AI pipelines) might care about is written here, inside the same
-- transaction. A worker / edge function drains it. Nothing reads it from the client.
create table public.notification_outbox (
  id           uuid primary key default gen_random_uuid(),
  event_type   text not null,
  aggregate    text,
  aggregate_id uuid,
  payload      jsonb not null default '{}',
  status       text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed')),
  attempts     int not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
create index outbox_pending_idx on public.notification_outbox(created_at) where status = 'pending';

create or replace function public.emit_event(p_type text, p_aggregate text, p_id uuid, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.notification_outbox (event_type, aggregate, aggregate_id, payload)
  values (p_type, p_aggregate, p_id, coalesce(p_payload, '{}'));
$$;
revoke execute on function public.emit_event(text, text, uuid, jsonb) from public, anon, authenticated;

create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  body         text,
  link         text,                -- in-app route, e.g. /documents/<id>
  metadata     jsonb not null default '{}',
  is_read      boolean not null default false,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_id, is_read, created_at desc);

create or replace function public.notify(p_recipient uuid, p_type public.notification_type, p_title text,
  p_body text default null, p_link text default null, p_metadata jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null then return; end if;
  insert into public.notifications (recipient_id, type, title, body, link, metadata)
  values (p_recipient, p_type, p_title, p_body, p_link, coalesce(p_metadata, '{}'));
  perform public.emit_event('notification.created', 'profile', p_recipient,
    jsonb_build_object('type', p_type, 'title', p_title, 'body', p_body, 'link', p_link));
end $$;
revoke execute on function public.notify(uuid, public.notification_type, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.mark_all_notifications_read()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.notifications set is_read = true, read_at = now()
   where recipient_id = auth.uid() and not is_read;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.mark_all_notifications_read() to authenticated;

alter table public.audit_logs enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notifications enable row level security;

create policy audit_select on public.audit_logs for select to authenticated using (public.has_permission('audit.view'));
-- No insert/update/delete policies: audit rows are written only by SECURITY DEFINER functions.

create policy notifications_select on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (recipient_id = auth.uid());

-- Audit role changes and account activation changes.
create or replace function public.audit_profile_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_student uuid;
begin
  select id into v_student from public.students where profile_id = new.id;
  if new.is_active is distinct from old.is_active then
    perform public.write_audit(case when new.is_active then 'user.activated' else 'user.deactivated' end,
      'profile', new.id, v_student, '{}');
  end if;
  if (new.first_name, new.last_name, new.phone, new.country) is distinct from (old.first_name, old.last_name, old.phone, old.country) then
    perform public.write_audit('profile.updated', 'profile', new.id, v_student, '{}');
  end if;
  return new;
end $$;
create trigger profiles_audit after update on public.profiles for each row execute function public.audit_profile_change();

create or replace function public.audit_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    perform public.write_audit('user.role_granted', 'profile', new.user_id, null, jsonb_build_object('role', new.role));
  elsif tg_op = 'DELETE' and auth.uid() is not null then
    perform public.write_audit('user.role_revoked', 'profile', old.user_id, null, jsonb_build_object('role', old.role));
  elsif tg_op = 'UPDATE' then
    perform public.write_audit('user.role_changed', 'profile', new.user_id, null,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return null;
end $$;
create trigger user_roles_audit after insert or update or delete on public.user_roles
  for each row execute function public.audit_role_change();
