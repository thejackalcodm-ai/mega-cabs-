-- =============================================================================
-- 0005 · Documents, versions, reviews, requirements & application checklists
-- =============================================================================

create table public.document_types (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  category    public.document_category not null,
  name        text not null,
  description text,
  has_expiry  boolean not null default false,
  is_custom   boolean not null default false,
  created_by  uuid references public.profiles(id) default auth.uid(),
  created_at  timestamptz not null default now()
);

insert into public.document_types (key, category, name, has_expiry) values
  ('passport', 'identity', 'Passport', true),
  ('national_id', 'identity', 'National ID', true),
  ('birth_certificate', 'identity', 'Birth Certificate', false),
  ('passport_photo', 'identity', 'Passport Photo', false),
  ('degree_certificate', 'education', 'Degree Certificate', false),
  ('diploma', 'education', 'Diploma', false),
  ('transcript', 'education', 'Transcript', false),
  ('school_certificate', 'education', 'School Certificates', false),
  ('academic_reference', 'education', 'Academic Reference', false),
  ('sop', 'education', 'Statement of Purpose', false),
  ('ielts', 'english_language', 'IELTS Certificate', true),
  ('pte', 'english_language', 'PTE Certificate', true),
  ('toefl', 'english_language', 'TOEFL Certificate', true),
  ('english_other', 'english_language', 'Other English Certificate', true),
  ('bank_statement', 'financial', 'Bank Statement', true),
  ('fixed_deposit', 'financial', 'Fixed Deposit Certificate', true),
  ('sponsor_document', 'financial', 'Sponsor Documents', false),
  ('bank_letter', 'financial', 'Bank Letter', true),
  ('income_document', 'financial', 'Income Documents', false),
  ('employment_letter', 'employment', 'Employment Letter', false),
  ('payslips', 'employment', 'Payslips', false),
  ('experience_letter', 'employment', 'Experience Letter', false),
  ('offer_letter', 'university', 'Offer Letter', false),
  ('acceptance_letter', 'university', 'Acceptance Letter', false),
  ('deposit_receipt', 'university', 'Deposit Receipt', false),
  ('cas_document', 'university', 'CAS Documents', false),
  ('visa_application', 'visa', 'Visa Application Documents', false),
  ('tb_certificate', 'visa', 'TB Certificate', true),
  ('insurance', 'visa', 'Health Insurance', true),
  ('accommodation', 'visa', 'Accommodation Confirmation', false),
  ('visa_form', 'visa', 'Visa Forms', false),
  ('other', 'other', 'Other Document', false);

create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id),
  category         public.document_category not null,
  custom_type_name text,
  file_path        text not null,                -- student-documents bucket: {student_id}/{category}/{uuid}-{filename}
  file_name        text not null,
  file_size        bigint not null check (file_size > 0 and file_size <= 10485760),
  mime_type        text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp',
                     'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  status           public.document_status not null default 'uploaded',
  version          int not null default 1,
  uploaded_by      uuid references public.profiles(id) default auth.uid(),
  uploaded_at      timestamptz not null default now(),
  reviewer_id      uuid references public.profiles(id),
  reviewer_comment text,
  rejection_reason text,
  required_action  text,
  reviewed_at      timestamptz,
  verified_at      timestamptz,
  expiry_date      date,
  ai_classification jsonb,                       -- reserved for AI document classification
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index documents_student_idx on public.documents(student_id);
create index documents_status_idx on public.documents(status);
create index documents_type_idx on public.documents(document_type_id);
create trigger documents_updated before update on public.documents for each row execute function public.set_updated_at();

create table public.document_versions (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version     int not null,
  file_path   text not null,
  file_name   text not null,
  file_size   bigint not null,
  mime_type   text not null,
  uploaded_by uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (document_id, version)
);

create table public.document_reviews (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  version     int not null,
  reviewer_id uuid not null references public.profiles(id),
  action      public.review_action not null,
  reason      text,
  comment     text,
  created_at  timestamptz not null default now()
);
create index document_reviews_doc_idx on public.document_reviews(document_id, created_at desc);

-- Checklist templates, e.g. "UK Student Visa" → passport, transcript, …
create table public.document_requirements (
  id               uuid primary key default gen_random_uuid(),
  checklist_key    text not null,
  checklist_name   text not null,
  country          text,                 -- null = applies to every destination
  document_type_id uuid not null references public.document_types(id),
  is_required      boolean not null default true,
  sort_order       int not null default 0,
  unique (checklist_key, document_type_id)
);

-- Per-application checklist instance (copied from templates, editable by staff).
create table public.application_documents (
  id               uuid primary key default gen_random_uuid(),
  application_id   uuid not null references public.applications(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id),
  is_required      boolean not null default true,
  note             text,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  unique (application_id, document_type_id)
);

-- Checklist view: one row per checklist item, resolved to the student's latest document of
-- that type. security_invoker so the caller's RLS applies.
create view public.application_checklist with (security_invoker = true) as
select
  ad.id, ad.application_id, a.student_id, ad.document_type_id, dt.name as document_name, dt.category,
  ad.is_required, ad.sort_order, ad.note,
  d.id as document_id, d.status as document_status, d.expiry_date,
  case
    when d.id is null then 'missing'
    when d.status = 'expired' or (d.expiry_date is not null and d.expiry_date < current_date) then 'expired'
    when d.status in ('rejected', 'resubmission_required') then 'rejected'
    when d.status = 'approved' then 'complete'
    else 'pending'
  end as item_state
from public.application_documents ad
join public.applications a on a.id = ad.application_id
join public.document_types dt on dt.id = ad.document_type_id
left join lateral (
  select * from public.documents x
  where x.student_id = a.student_id and x.document_type_id = ad.document_type_id
  order by x.uploaded_at desc limit 1
) d on true;

-- Populate a new application's checklist from templates for its destination country.
create or replace function public.seed_application_checklist()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_country text;
begin
  select country into v_country from public.universities where id = new.university_id;
  insert into public.application_documents (application_id, document_type_id, is_required, sort_order)
  select new.id, r.document_type_id, r.is_required, r.sort_order
  from public.document_requirements r
  where r.country is null or r.country = v_country
  on conflict do nothing;
  return new;
end $$;
create trigger applications_checklist after insert on public.applications
  for each row execute function public.seed_application_checklist();

-- -----------------------------------------------------------------------------
-- Document lifecycle guards
-- -----------------------------------------------------------------------------
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
    if not public.is_staff() or auth.uid() is null then
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
create trigger documents_guard before insert or update on public.documents
  for each row execute function public.guard_document();

create or replace function public.on_document_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.document_versions (document_id, version, file_path, file_name, file_size, mime_type, uploaded_by)
  values (new.id, new.version, new.file_path, new.file_name, new.file_size, new.mime_type, new.uploaded_by);
  perform public.write_audit('document.uploaded', 'document', new.id, new.student_id,
    jsonb_build_object('file_name', new.file_name, 'category', new.category));
  perform public.emit_event('document.uploaded', 'document', new.id,
    jsonb_build_object('student_id', new.student_id, 'document_type_id', new.document_type_id));
  return new;
end $$;
create trigger documents_after_insert after insert on public.documents
  for each row execute function public.on_document_insert();

-- Replace a document's file (new version). Resets review state.
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
    rejection_reason = null, required_action = null, verified_at = null
  where id = p_document_id returning * into d;

  insert into public.document_versions (document_id, version, file_path, file_name, file_size, mime_type, uploaded_by)
  values (d.id, d.version, p_file_path, p_file_name, p_file_size, p_mime_type, auth.uid());
  perform public.write_audit('document.replaced', 'document', d.id, d.student_id,
    jsonb_build_object('version', d.version, 'file_name', p_file_name));
  return d;
end $$;
grant execute on function public.replace_document(uuid, text, text, bigint, text, date) to authenticated;

-- Staff review action. Reason is mandatory for rejection / resubmission.
create or replace function public.review_document(p_document_id uuid, p_action public.review_action,
  p_reason text default null, p_comment text default null, p_required_action text default null)
returns public.documents language plpgsql security definer set search_path = public as $$
declare d public.documents; v_type text;
begin
  select * into d from public.documents where id = p_document_id for update;
  if d.id is null or not public.has_permission('documents.review') or not public.can_manage_student(d.student_id) then
    raise exception 'Not allowed to review this document' using errcode = '42501';
  end if;
  if p_action in ('rejected', 'resubmission_required') and coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required' using errcode = '22023';
  end if;

  update public.documents set
    status = p_action::text::public.document_status,
    reviewer_id = auth.uid(), reviewed_at = now(),
    reviewer_comment = nullif(btrim(coalesce(p_comment, '')), ''),
    rejection_reason = case when p_action in ('rejected', 'resubmission_required') then btrim(p_reason) end,
    required_action = case when p_action in ('rejected', 'resubmission_required')
                           then coalesce(nullif(btrim(p_required_action), ''), 'Upload a corrected replacement document') end,
    verified_at = case when p_action = 'approved' then now() end
  where id = p_document_id returning * into d;

  insert into public.document_reviews (document_id, version, reviewer_id, action, reason, comment)
  values (d.id, d.version, auth.uid(), p_action, nullif(btrim(p_reason), ''), nullif(btrim(p_comment), ''));

  perform public.write_audit('document.' || p_action::text, 'document', d.id, d.student_id,
    jsonb_build_object('reason', p_reason, 'version', d.version));

  select coalesce(d.custom_type_name, name) into v_type from public.document_types where id = d.document_type_id;
  if p_action = 'approved' then
    perform public.notify(public.student_profile_id(d.student_id), 'document_approved', v_type || ' approved',
      'Your ' || v_type || ' has been verified.', '/documents?doc=' || d.id);
  elsif p_action in ('rejected', 'resubmission_required') then
    perform public.notify(public.student_profile_id(d.student_id), 'document_rejected',
      v_type || case when p_action = 'rejected' then ' rejected' else ' needs resubmission' end,
      p_reason, '/documents?doc=' || d.id);
  end if;
  perform public.emit_event('document.reviewed', 'document', d.id, jsonb_build_object('action', p_action));
  return d;
end $$;
grant execute on function public.review_document(uuid, public.review_action, text, text, text) to authenticated;

-- Staff request a document (adds to checklist if an application is given, notifies the student).
create or replace function public.request_document(p_student_id uuid, p_document_type_id uuid,
  p_message text default null, p_application_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_type text;
begin
  if not public.can_manage_student(p_student_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select name into v_type from public.document_types where id = p_document_type_id;
  if p_application_id is not null then
    insert into public.application_documents (application_id, document_type_id, note)
    select p_application_id, p_document_type_id, p_message
    where exists (select 1 from public.applications where id = p_application_id and student_id = p_student_id)
    on conflict (application_id, document_type_id) do update set note = excluded.note;
  end if;
  perform public.notify(public.student_profile_id(p_student_id), 'document_required',
    'New document required: ' || v_type, coalesce(p_message, 'Please upload your ' || v_type || '.'), '/documents');
  perform public.write_audit('document.requested', 'document_type', p_document_type_id, p_student_id,
    jsonb_build_object('application_id', p_application_id));
end $$;
grant execute on function public.request_document(uuid, uuid, text, uuid) to authenticated;

-- Mark expired documents (run daily via pg_cron or a scheduled edge function).
create or replace function public.expire_documents()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.documents set status = 'expired'
   where expiry_date < current_date and status <> 'expired';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_documents() from public, anon, authenticated;

alter table public.document_types enable row level security;
alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_reviews enable row level security;
alter table public.document_requirements enable row level security;
alter table public.application_documents enable row level security;

create policy doc_types_read on public.document_types for select to authenticated using (true);
create policy doc_types_custom on public.document_types for insert to authenticated
  with check (is_custom and category = 'other' or public.is_admin());
create policy doc_types_admin on public.document_types for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy documents_select on public.documents for select to authenticated using (public.can_access_student(student_id));
create policy documents_insert on public.documents for insert to authenticated with check (
  student_id = public.current_student_id() or public.can_manage_student(student_id)
);
create policy documents_update_staff on public.documents for update to authenticated
  using (public.can_manage_student(student_id)) with check (public.can_manage_student(student_id));
-- Students may delete only documents that are not approved / under review.
create policy documents_delete on public.documents for delete to authenticated using (
  (student_id = public.current_student_id() and status in ('uploaded', 'rejected', 'resubmission_required', 'expired'))
  or public.is_admin()
);

create policy doc_versions_select on public.document_versions for select to authenticated using (
  exists (select 1 from public.documents d where d.id = document_id and public.can_access_student(d.student_id))
);
create policy doc_reviews_select on public.document_reviews for select to authenticated using (
  exists (select 1 from public.documents d where d.id = document_id and public.can_access_student(d.student_id))
);

create policy doc_req_read on public.document_requirements for select to authenticated using (true);
create policy doc_req_write on public.document_requirements for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy app_docs_select on public.application_documents for select to authenticated using (
  exists (select 1 from public.applications a where a.id = application_id and public.can_access_student(a.student_id))
);
create policy app_docs_write on public.application_documents for all to authenticated using (
  exists (select 1 from public.applications a where a.id = application_id and public.can_manage_student(a.student_id))
) with check (
  exists (select 1 from public.applications a where a.id = application_id and public.can_manage_student(a.student_id))
);
