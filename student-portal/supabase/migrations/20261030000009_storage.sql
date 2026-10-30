-- =============================================================================
-- 0009 · Private storage buckets & object policies
--
-- Path conventions (first segment is always the access anchor):
--   student-documents      {student_id}/{category}/{uuid}-{filename}
--   assignment-submissions {student_id}/{assignment_id}/{uuid}-{filename}
--   message-attachments    {thread_id}/{uuid}-{filename}  |  tickets/{ticket_id}/{uuid}-{filename}
--   course-resources       {course_id}/{uuid}-{filename}
-- All buckets are private; the app only ever hands out short-lived signed URLs.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('student-documents', 'student-documents', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('assignment-submissions', 'assignment-submissions', false, 20971520,
    array['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  ('message-attachments', 'message-attachments', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']),
  ('course-resources', 'course-resources', false, 52428800,
    array['application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'audio/mpeg',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Safe uuid parse for path segments (a malformed path must deny, not error).
create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

create or replace function public.path_segment(p_name text, p_index int)
returns text language sql immutable as $$
  select (string_to_array(p_name, '/'))[p_index]
$$;

-- ---- student-documents --------------------------------------------------------
create policy "student-documents read" on storage.objects for select to authenticated using (
  bucket_id = 'student-documents' and public.can_access_student(public.try_uuid(public.path_segment(name, 1)))
);
create policy "student-documents upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'student-documents'
  and (public.owns_student(public.try_uuid(public.path_segment(name, 1)))
       or public.can_manage_student(public.try_uuid(public.path_segment(name, 1))))
  and public.path_segment(name, 2) in ('identity', 'education', 'english_language', 'financial', 'employment', 'university', 'visa', 'other')
);
-- Objects are immutable (replacement = new object + new version row). Only admins delete.
create policy "student-documents delete" on storage.objects for delete to authenticated using (
  bucket_id = 'student-documents'
  and (public.is_admin()
       or (public.owns_student(public.try_uuid(public.path_segment(name, 1)))
           and not exists (select 1 from public.document_versions v join public.documents d on d.id = v.document_id
                           where v.file_path = objects.name and d.status in ('approved', 'under_review'))))
);

-- ---- assignment-submissions -----------------------------------------------------
create policy "submissions read" on storage.objects for select to authenticated using (
  bucket_id = 'assignment-submissions' and (
    public.can_access_student(public.try_uuid(public.path_segment(name, 1)))
    or exists (select 1 from public.assignments a where a.id = public.try_uuid(public.path_segment(name, 2))
               and public.can_manage_course(a.course_id)))
);
create policy "submissions upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'assignment-submissions'
  and public.owns_student(public.try_uuid(public.path_segment(name, 1)))
  and exists (select 1 from public.assignments a where a.id = public.try_uuid(public.path_segment(name, 2))
              and public.is_enrolled(a.course_id))
);

-- ---- message-attachments ----------------------------------------------------------
create policy "attachments read" on storage.objects for select to authenticated using (
  bucket_id = 'message-attachments' and (
    public.can_access_thread(public.try_uuid(public.path_segment(name, 1)))
    or (public.path_segment(name, 1) = 'tickets' and exists (
          select 1 from public.support_tickets t where t.id = public.try_uuid(public.path_segment(name, 2))
            and (t.created_by = auth.uid() or public.has_permission('support.manage')))))
);
create policy "attachments upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'message-attachments' and (
    public.can_access_thread(public.try_uuid(public.path_segment(name, 1)))
    or (public.path_segment(name, 1) = 'tickets' and exists (
          select 1 from public.support_tickets t where t.id = public.try_uuid(public.path_segment(name, 2))
            and (t.created_by = auth.uid() or public.has_permission('support.manage')))))
);

-- ---- course-resources ---------------------------------------------------------------
create policy "course-resources read" on storage.objects for select to authenticated using (
  bucket_id = 'course-resources' and (
    public.can_manage_course(public.try_uuid(public.path_segment(name, 1)))
    or (public.course_is_published(public.try_uuid(public.path_segment(name, 1)))
        and public.is_enrolled(public.try_uuid(public.path_segment(name, 1)))))
);
create policy "course-resources write" on storage.objects for insert to authenticated with check (
  bucket_id = 'course-resources' and public.can_manage_course(public.try_uuid(public.path_segment(name, 1)))
);
create policy "course-resources update" on storage.objects for update to authenticated using (
  bucket_id = 'course-resources' and public.can_manage_course(public.try_uuid(public.path_segment(name, 1)))
);
create policy "course-resources delete" on storage.objects for delete to authenticated using (
  bucket_id = 'course-resources' and public.can_manage_course(public.try_uuid(public.path_segment(name, 1)))
);
