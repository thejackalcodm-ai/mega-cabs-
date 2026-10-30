-- =============================================================================
-- 0010 · Computed values served by the database (single source of truth)
-- =============================================================================

-- Profile completion: equal-weighted checklist of the information universities ask for.
-- Returns {percent, completed, total, missing: [{key, label, section}]}.
create or replace function public.profile_completion(p_student_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := coalesce(p_student_id, public.current_student_id());
  s public.students; sp public.student_profiles; p public.profiles;
  v_items jsonb := '[]'; v_done int := 0; v_total int := 0;
  item record;
begin
  if v_student is null or not (public.can_access_student(v_student) or public.instructor_teaches_student(v_student)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into s from public.students where id = v_student;
  select * into sp from public.student_profiles where student_id = v_student;
  select * into p from public.profiles where id = s.profile_id;

  for item in
    select * from (values
      ('first_name', 'First name', 'personal', coalesce(btrim(p.first_name), '') <> ''),
      ('last_name', 'Last name', 'personal', coalesce(btrim(p.last_name), '') <> ''),
      ('date_of_birth', 'Date of birth', 'personal', sp.date_of_birth is not null),
      ('gender', 'Gender', 'personal', coalesce(sp.gender, '') <> ''),
      ('nationality', 'Nationality', 'personal', coalesce(sp.nationality, '') <> ''),
      ('passport_number', 'Passport number', 'passport', coalesce(sp.passport_number, '') <> ''),
      ('passport_expiry', 'Passport expiry date', 'passport', sp.passport_expiry is not null),
      ('phone', 'Phone number', 'contact', coalesce(p.phone, '') <> ''),
      ('address', 'Home address', 'contact', coalesce(sp.address_line, '') <> '' and coalesce(sp.city, '') <> ''),
      ('country', 'Country of residence', 'contact', coalesce(sp.country, p.country, '') <> ''),
      ('education', 'At least one education record', 'education',
         exists (select 1 from public.education_records where student_id = v_student)),
      ('english_test', 'English language test', 'english',
         exists (select 1 from public.english_tests where student_id = v_student)),
      ('destinations', 'Preferred study destination', 'preferences', cardinality(s.preferred_destinations) > 0),
      ('study_level', 'Preferred study level', 'preferences', coalesce(s.preferred_study_level, '') <> ''),
      ('goals', 'Application goals', 'goals', coalesce(btrim(s.application_goals), '') <> ''),
      ('emergency_contact', 'Emergency contact', 'emergency',
         coalesce(sp.emergency_name, '') <> '' and coalesce(sp.emergency_phone, '') <> '')
    ) as t(key, label, section, done)
  loop
    v_total := v_total + 1;
    if item.done then
      v_done := v_done + 1;
    else
      v_items := v_items || jsonb_build_object('key', item.key, 'label', item.label, 'section', item.section);
    end if;
  end loop;

  return jsonb_build_object('percent', round(v_done * 100.0 / v_total), 'completed', v_done, 'total', v_total,
                            'missing', v_items);
end $$;
grant execute on function public.profile_completion(uuid) to authenticated;

-- Per-application checklist summary with automatic completion percentage.
create view public.application_checklist_summary with (security_invoker = true) as
select
  application_id,
  student_id,
  count(*) filter (where is_required)                               as required_count,
  count(*) filter (where is_required and item_state = 'complete')   as completed_count,
  count(*) filter (where is_required and item_state = 'missing')    as missing_count,
  count(*) filter (where item_state = 'pending')                    as pending_count,
  count(*) filter (where item_state = 'rejected')                   as rejected_count,
  count(*) filter (where item_state = 'expired')                    as expired_count,
  case when count(*) filter (where is_required) = 0 then 100
       else round(100.0 * count(*) filter (where is_required and item_state = 'complete')
                  / count(*) filter (where is_required)) end         as completion_percent
from public.application_checklist
group by application_id, student_id;

-- Least privilege for anonymous callers: nothing in public is executable by anon.
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;
