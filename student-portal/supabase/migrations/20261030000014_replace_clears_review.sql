-- =============================================================================
-- 0014 · A replacement starts a fresh review.
-- replace_document() kept the previous reviewer, comment and review time on the document, so a
-- new version appeared to carry the old version's feedback. Those belong to the earlier
-- version and remain in document_reviews; the current-review fields are now cleared.
-- =============================================================================
create or replace function public.replace_document(p_document_id uuid, p_file_path text, p_file_name text,
  p_file_size bigint, p_mime_type text, p_expiry_date date default null)
returns public.documents language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from public.documents where id = p_document_id for update;
  if d.id is null or not (d.student_id = public.current_student_id() or public.can_manage_student(d.student_id)) then
    raise exception 'Document not found' using errcode = '42501';
  end if;
  if d.status = 'approved' and not public.is_staff() then
    raise exception 'Approved documents cannot be replaced. Contact your counselor.' using errcode = '42501';
  end if;
  if split_part(p_file_path, '/', 1) <> d.student_id::text or split_part(p_file_path, '/', 2) <> d.category::text then
    raise exception 'Invalid storage path' using errcode = '22023';
  end if;

  perform set_config('app.document_rpc', d.id::text, true);
  update public.documents set
    file_path = p_file_path, file_name = p_file_name, file_size = p_file_size, mime_type = p_mime_type,
    version = d.version + 1, status = 'uploaded', uploaded_by = auth.uid(), uploaded_at = now(),
    expiry_date = coalesce(p_expiry_date, d.expiry_date),
    rejection_reason = null, required_action = null, verified_at = null,
    reviewer_id = null, reviewer_comment = null, reviewed_at = null
  where id = p_document_id returning * into d;

  insert into public.document_versions (document_id, version, file_path, file_name, file_size, mime_type, uploaded_by)
  values (d.id, d.version, p_file_path, p_file_name, p_file_size, p_mime_type, auth.uid());
  perform public.write_audit('document.replaced', 'document', d.id, d.student_id,
    jsonb_build_object('version', d.version, 'file_name', p_file_name));
  return d;
end $$;
