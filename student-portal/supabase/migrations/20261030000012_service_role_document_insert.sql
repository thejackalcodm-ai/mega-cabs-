-- =============================================================================
-- 0012 · Trusted (service-role) document inserts keep their review state.
-- 0005 forced status = 'uploaded' for every insert without a signed-in staff user,
-- which included the service role (auth.uid() is null). Only end users who are not
-- staff should be forced; the service role (seed, provider webhooks, back-office
-- jobs) is trusted. Everything else is unchanged.
-- =============================================================================
create or replace function public.guard_document()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_type record;
begin
  select * into v_type from public.document_types where id = new.document_type_id;
  new.category := v_type.category;
  -- object key convention: {student_id}/{category}/{uuid}-{filename}
  if split_part(new.file_path, '/', 1) <> new.student_id::text
     or split_part(new.file_path, '/', 2) <> new.category::text then
    raise exception 'Invalid storage path' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not public.is_staff() then
      new.status := 'uploaded';
      new.version := 1;
      new.reviewer_id := null; new.reviewer_comment := null; new.rejection_reason := null;
      new.required_action := null; new.verified_at := null; new.reviewed_at := null;
    end if;
    new.uploaded_by := coalesce(auth.uid(), new.uploaded_by);
  elsif auth.uid() is not null and not public.is_staff()
        and coalesce(current_setting('app.document_rpc', true), '') <> new.id::text then
    raise exception 'Use replace_document() to update a document' using errcode = '42501';
  end if;
  return new;
end $$;
