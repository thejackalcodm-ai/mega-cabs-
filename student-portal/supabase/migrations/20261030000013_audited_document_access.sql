-- =============================================================================
-- 0013 · Audited document access
--
-- Every view/download of a stored document must leave an audit entry, and a client
-- that skips a "log" call must not be able to read files anyway. So:
--   * reading an object in student-documents requires a short-lived access grant;
--   * grants are issued only by authorize_document_access(), which checks access
--     and writes the audit row in the same transaction;
--   * deletes go through delete_document(), which checks the status rule and is
--     audited by a trigger (so service-role deletes are audited too).
-- Uploads (insert) and replacements are already audited (0005).
-- =============================================================================

create table public.document_access_grants (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  file_path   text not null,
  purpose     text not null check (purpose in ('view', 'download')),
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index document_access_grants_lookup on public.document_access_grants(profile_id, file_path, expires_at);
create index document_access_grants_document_idx on public.document_access_grants(document_id);
alter table public.document_access_grants enable row level security;
-- No policies: only SECURITY DEFINER functions read or write grants.

create or replace function public.has_document_grant(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.document_access_grants
                 where profile_id = auth.uid() and file_path = p_path and expires_at > now())
$$;

-- Returns the object path of the requested version and opens a 2-minute window in which the
-- caller may sign a URL for it (the URL itself should be requested with a <=60s expiry).
create or replace function public.authorize_document_access(p_document_id uuid, p_purpose text default 'view',
  p_version int default null)
returns table (file_path text, file_name text, mime_type text, version int)
language plpgsql security definer set search_path = public as $$
declare d public.documents; v public.document_versions;
begin
  if p_purpose not in ('view', 'download') then
    raise exception 'Unsupported purpose' using errcode = '22023';
  end if;
  select * into d from public.documents where id = p_document_id;
  if d.id is null or not public.can_access_student(d.student_id) then
    raise exception 'Document not found' using errcode = '42501';
  end if;
  select dv.* into v from public.document_versions dv
   where dv.document_id = d.id and dv.version = coalesce(p_version, d.version);
  if v.id is null then raise exception 'Version not found' using errcode = '22023'; end if;

  delete from public.document_access_grants g where g.profile_id = auth.uid() and g.expires_at < now() - interval '1 hour';
  insert into public.document_access_grants (profile_id, document_id, file_path, purpose, expires_at)
  values (auth.uid(), d.id, v.file_path, p_purpose, now() + interval '2 minutes');

  perform public.write_audit(case when p_purpose = 'download' then 'document.downloaded' else 'document.viewed' end,
    'document', d.id, d.student_id, jsonb_build_object('version', v.version, 'file_name', v.file_name));

  return query select v.file_path, v.file_name, v.mime_type, v.version;
end $$;
grant execute on function public.authorize_document_access(uuid, text, int) to authenticated;

-- Deletes a document (all versions, reviews and grants cascade). Returns the object paths so the
-- client can remove the files; once the rows are gone those objects are unreferenced and the
-- storage policy below lets the owner delete them.
create or replace function public.delete_document(p_document_id uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare d public.documents; v_paths text[];
begin
  select * into d from public.documents where id = p_document_id for update;
  if d.id is null or not public.can_access_student(d.student_id) then
    raise exception 'Document not found' using errcode = '42501';
  end if;
  if not public.is_admin() then
    if not public.owns_student(d.student_id) then
      raise exception 'Only the student or an administrator can delete documents' using errcode = '42501';
    end if;
    if d.status in ('approved', 'under_review') then
      raise exception 'Approved documents and documents under review cannot be deleted. Contact your counselor.'
        using errcode = '42501';
    end if;
  end if;
  select array_agg(file_path) into v_paths from public.document_versions where document_id = d.id;
  delete from public.documents where id = d.id;   -- audited by documents_audit_delete
  return coalesce(v_paths, array[d.file_path]);
end $$;
grant execute on function public.delete_document(uuid) to authenticated;

create or replace function public.audit_document_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit('document.deleted', 'document', old.id, old.student_id,
    jsonb_build_object('file_name', old.file_name, 'status', old.status, 'versions', old.version));
  return old;
end $$;
create trigger documents_audit_delete after delete on public.documents
  for each row execute function public.audit_document_delete();

-- Direct deletes are replaced by delete_document().
drop policy if exists documents_delete on public.documents;

-- ---- storage: student-documents -------------------------------------------------
-- An object referenced by a document version can only be read with an active grant.
-- An unreferenced object (e.g. an upload whose row insert failed, or a deleted document)
-- is visible to its owner / managing staff so they can clean it up.
create or replace function public.is_referenced_document_object(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.document_versions where file_path = p_path)
      or exists (select 1 from public.documents where file_path = p_path)
$$;

drop policy if exists "student-documents read" on storage.objects;
create policy "student-documents read" on storage.objects for select to authenticated using (
  bucket_id = 'student-documents' and (
    public.has_document_grant(name)
    or (not public.is_referenced_document_object(name)
        and (public.owns_student(public.try_uuid(public.path_segment(name, 1)))
             or public.can_manage_student(public.try_uuid(public.path_segment(name, 1)))))
  )
);

drop policy if exists "student-documents delete" on storage.objects;
create policy "student-documents delete" on storage.objects for delete to authenticated using (
  bucket_id = 'student-documents'
  and not public.is_referenced_document_object(name)
  and (public.owns_student(public.try_uuid(public.path_segment(name, 1)))
       or public.can_manage_student(public.try_uuid(public.path_segment(name, 1))))
);

-- ---- onboarding progress -------------------------------------------------------------
-- Saves the wizard position for the signed-in student (resume where they left off).
create or replace function public.save_onboarding_progress(p_step int, p_completed boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.current_student_id() is null then raise exception 'Not a student' using errcode = '42501'; end if;
  if p_step < 1 or p_step > 7 then raise exception 'Invalid step' using errcode = '22023'; end if;
  update public.students set
    onboarding_step = greatest(onboarding_step, p_step),
    onboarding_completed = onboarding_completed or p_completed,
    journey_stage = case when p_completed and journey_stage in ('register', 'complete_profile')
                         then 'select_destination' else journey_stage end
  where id = public.current_student_id();
end $$;
grant execute on function public.save_onboarding_progress(int, boolean) to authenticated;
