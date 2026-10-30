-- =============================================================================
-- RLS / security test suite (pgTAP).
-- Runs in one transaction and rolls back. Works with `supabase test db` and with
-- supabase/tests/run-local.sh (plain PostgreSQL + local platform stub).
--
-- Identity switching mirrors PostgREST exactly: the JWT claims GUC is set and the
-- session role is switched to `authenticated` (or `anon`).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
create schema tests;
create table tests.fixtures (name text primary key, id uuid not null);
grant usage on schema tests to anon, authenticated;
grant select on tests.fixtures to anon, authenticated;

create function tests.id(p_name text) returns uuid language sql stable as $$
  select id from tests.fixtures where name = p_name
$$;
create function tests.auth_as(p_name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.id(p_name), 'role', 'authenticated')::text, true);
end $$;
create function tests.clear_auth() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
end $$;
-- Executes a statement as the CURRENT role and returns the number of affected rows.
create function tests.affected(p_sql text) returns int language plpgsql as $$
declare n int;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;
-- Tables in public that return at least one row to the current role.
create function tests.visible_tables() returns setof text language plpgsql as $$
declare t text; n int;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by 1 loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then return next t; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the database owner, i.e. like the service role)
-- ---------------------------------------------------------------------------
insert into tests.fixtures values
  ('super', '10000000-0000-0000-0000-000000000001'), ('admin', '10000000-0000-0000-0000-000000000002'),
  ('counselor', '10000000-0000-0000-0000-000000000003'), ('instructor', '10000000-0000-0000-0000-000000000004'),
  ('alice', '10000000-0000-0000-0000-000000000005'), ('bob', '10000000-0000-0000-0000-000000000006'),
  ('carol', '10000000-0000-0000-0000-000000000007'), ('counselor2', '10000000-0000-0000-0000-000000000008');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  (tests.id('super'), 'super@test.local', '{"role":"super_admin"}', '{"first_name":"Sam","last_name":"Super"}'),
  (tests.id('admin'), 'admin@test.local', '{"role":"admin"}', '{"first_name":"Ada","last_name":"Admin"}'),
  (tests.id('counselor'), 'counselor@test.local', '{"role":"counselor"}', '{"first_name":"Cleo","last_name":"Counsel"}'),
  (tests.id('counselor2'), 'counselor2@test.local', '{"role":"counselor"}', '{"first_name":"Cy","last_name":"Other"}'),
  (tests.id('instructor'), 'instructor@test.local', '{"role":"instructor"}', '{"first_name":"Ivy","last_name":"Teach"}'),
  (tests.id('alice'), 'alice@test.local', '{}', '{"first_name":"Alice","last_name":"Student","country":"Sri Lanka","phone":"+94000000001"}'),
  -- Bob tries to self-assign a role through user metadata at signup: must be ignored.
  (tests.id('bob'), 'bob@test.local', '{}', '{"first_name":"Bob","last_name":"Student","role":"super_admin"}'),
  (tests.id('carol'), 'carol@test.local', '{}', '{"first_name":"Carol","last_name":"Student"}');

insert into tests.fixtures select 'stu_' || p.first_name, s.id from public.students s join public.profiles p on p.id = s.profile_id;
insert into tests.fixtures select 'staff_' || p.first_name, st.id from public.staff st join public.profiles p on p.id = st.profile_id;

-- Counselor Cleo is assigned Alice and Bob; Carol is assigned to counselor2.
update public.students set counselor_id = tests.id('staff_Cleo') where id in (tests.id('stu_Alice'), tests.id('stu_Bob'));
update public.students set counselor_id = tests.id('staff_Cy') where id = tests.id('stu_Carol');

insert into public.universities (id, name, slug, country, city) values
  ('20000000-0000-0000-0000-000000000001', 'Northbridge University', 'northbridge', 'United Kingdom', 'Leeds');
insert into tests.fixtures values ('uni', '20000000-0000-0000-0000-000000000001');
insert into public.document_requirements (checklist_key, checklist_name, country, document_type_id, sort_order)
select 'uk_student_visa', 'UK Student Visa', 'United Kingdom', id, row_number() over ()
from public.document_types where key in ('passport', 'transcript', 'bank_statement');

insert into public.applications (id, student_id, university_id, intake, status) values
  ('30000000-0000-0000-0000-000000000001', tests.id('stu_Alice'), tests.id('uni'), 'Sep 2027', 'documents_required'),
  ('30000000-0000-0000-0000-000000000002', tests.id('stu_Bob'), tests.id('uni'), 'Jan 2027', 'submitted'),
  ('30000000-0000-0000-0000-000000000003', tests.id('stu_Carol'), tests.id('uni'), 'Jan 2027', 'planning');
insert into tests.fixtures values ('app_alice', '30000000-0000-0000-0000-000000000001'),
  ('app_bob', '30000000-0000-0000-0000-000000000002'), ('app_carol', '30000000-0000-0000-0000-000000000003');

insert into public.documents (id, student_id, document_type_id, category, file_path, file_name, file_size, mime_type)
select v.id::uuid, tests.id(v.stu), dt.id, dt.category, tests.id(v.stu) || '/' || dt.category || '/' || v.id || '-' || v.fname,
       v.fname, 2048, 'application/pdf'
from (values
  ('40000000-0000-0000-0000-000000000001', 'stu_Alice', 'passport', 'passport.pdf'),
  ('40000000-0000-0000-0000-000000000002', 'stu_Alice', 'bank_statement', 'bank.pdf'),
  ('40000000-0000-0000-0000-000000000003', 'stu_Bob', 'passport', 'bob-passport.pdf'),
  ('40000000-0000-0000-0000-000000000004', 'stu_Carol', 'passport', 'carol-passport.pdf')
) v(id, stu, key, fname) join public.document_types dt on dt.key = v.key;
insert into tests.fixtures values ('doc_alice_passport', '40000000-0000-0000-0000-000000000001'),
  ('doc_alice_bank', '40000000-0000-0000-0000-000000000002'), ('doc_bob_passport', '40000000-0000-0000-0000-000000000003'),
  ('doc_carol_passport', '40000000-0000-0000-0000-000000000004');
insert into storage.objects (bucket_id, name, owner)
select 'student-documents', file_path, null from public.documents;
update public.documents set status = 'approved' where id = tests.id('doc_alice_passport');

insert into public.invoices (id, student_id, title, due_date) values
  ('50000000-0000-0000-0000-000000000001', tests.id('stu_Alice'), 'Service fee', current_date + 14),
  ('50000000-0000-0000-0000-000000000002', tests.id('stu_Bob'), 'Service fee', current_date + 14);
insert into public.invoice_items (invoice_id, description, unit_amount) values
  ('50000000-0000-0000-0000-000000000001', 'Application service', 500),
  ('50000000-0000-0000-0000-000000000002', 'Application service', 500);
insert into public.payments (student_id, invoice_id, amount, status, provider) values
  (tests.id('stu_Bob'), '50000000-0000-0000-0000-000000000002', 200, 'paid', 'manual');

insert into public.message_threads (id, subject, category, student_id) values
  ('60000000-0000-0000-0000-000000000001', 'Alice visa questions', 'counselor', tests.id('stu_Alice')),
  ('60000000-0000-0000-0000-000000000002', 'Bob offer questions', 'counselor', tests.id('stu_Bob'));
insert into tests.fixtures values ('thread_alice', '60000000-0000-0000-0000-000000000001'), ('thread_bob', '60000000-0000-0000-0000-000000000002');
insert into public.thread_participants (thread_id, profile_id) values
  (tests.id('thread_alice'), tests.id('alice')), (tests.id('thread_alice'), tests.id('counselor')),
  (tests.id('thread_bob'), tests.id('bob')), (tests.id('thread_bob'), tests.id('counselor'));
insert into public.messages (thread_id, sender_id, body) values
  (tests.id('thread_alice'), tests.id('alice'), 'Hello from Alice'),
  (tests.id('thread_bob'), tests.id('bob'), 'Hello from Bob, private');
insert into storage.objects (bucket_id, name) values ('message-attachments', tests.id('thread_bob') || '/x-bob.pdf');

insert into public.student_tasks (student_id, title) values (tests.id('stu_Bob'), 'Book TB test');
insert into public.notifications (recipient_id, type, title) values (tests.id('bob'), 'system', 'Bob only');

-- LMS: instructor's published course; Alice enrolled, Bob not.
insert into public.courses (id, slug, title, status, instructor_id, created_by) values
  ('70000000-0000-0000-0000-000000000001', 'ielts', 'IELTS Academic', 'published', tests.id('instructor'), tests.id('instructor')),
  ('70000000-0000-0000-0000-000000000002', 'other', 'Other course', 'published', tests.id('admin'), tests.id('admin'));
insert into tests.fixtures values ('course', '70000000-0000-0000-0000-000000000001'), ('course_other', '70000000-0000-0000-0000-000000000002');
insert into public.course_modules (id, course_id, title, position) values
  ('71000000-0000-0000-0000-000000000001', tests.id('course'), 'Introduction', 1);
insert into public.lessons (id, module_id, course_id, title, position) values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', tests.id('course'), 'Understanding IELTS', 1),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', tests.id('course'), 'Scoring System', 2);
insert into tests.fixtures values ('lesson1', '72000000-0000-0000-0000-000000000001');
insert into public.enrollments (course_id, student_id) values
  (tests.id('course'), tests.id('stu_Alice')), (tests.id('course_other'), tests.id('stu_Bob'));

insert into public.quizzes (id, course_id, title, passing_score, max_attempts, is_published) values
  ('73000000-0000-0000-0000-000000000001', tests.id('course'), 'Intro quiz', 50, 2, true);
insert into tests.fixtures values ('quiz', '73000000-0000-0000-0000-000000000001');
insert into public.quiz_questions (id, quiz_id, type, prompt, points, position, accepted_answers) values
  ('74000000-0000-0000-0000-000000000001', tests.id('quiz'), 'multiple_choice', 'How many sections?', 1, 1, '{}'),
  ('74000000-0000-0000-0000-000000000002', tests.id('quiz'), 'ordering', 'Order the sections', 1, 2, '{}'),
  ('74000000-0000-0000-0000-000000000003', tests.id('quiz'), 'short_answer', 'Max band score?', 1, 3, '{9,nine}'),
  ('74000000-0000-0000-0000-000000000004', tests.id('quiz'), 'matching', 'Match skill to minutes', 1, 4, '{}');
insert into public.quiz_options (id, question_id, label, is_correct, correct_position, match_text, position) values
  ('75000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'Four', true, null, null, 1),
  ('75000000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000001', 'Three', false, null, null, 2),
  ('75000000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000002', 'Listening', false, 1, null, 1),
  ('75000000-0000-0000-0000-000000000004', '74000000-0000-0000-0000-000000000002', 'Reading', false, 2, null, 2),
  ('75000000-0000-0000-0000-000000000005', '74000000-0000-0000-0000-000000000004', 'Reading', false, null, '60', 1),
  ('75000000-0000-0000-0000-000000000006', '74000000-0000-0000-0000-000000000004', 'Speaking', false, null, '14', 2);

insert into public.assignments (id, course_id, title, due_at) values
  ('76000000-0000-0000-0000-000000000001', tests.id('course'), 'Task 1 essay', now() + interval '7 days');
insert into tests.fixtures values ('assignment', '76000000-0000-0000-0000-000000000001');

-- =============================================================================
-- 0. Signup trigger & role storage
-- =============================================================================
select is((select count(*)::int from public.students where profile_id = tests.id('alice')), 1, 'signup creates a students row');
select is((select count(*)::int from public.student_profiles where student_id = tests.id('stu_Alice')), 1, 'signup creates a student_profiles row');
select is((select country from public.profiles where id = tests.id('alice')), 'Sri Lanka', 'signup copies registration fields to profile');
select is((select array_agg(role::text) from public.user_roles where user_id = tests.id('bob')), array['student'],
  'user_metadata role is ignored at signup: Bob is only a student');
select is((select role::text from public.user_roles where user_id = tests.id('admin')), 'admin', 'app_metadata role (service-controlled) is honoured');
select is((select count(*)::int from public.students where profile_id = tests.id('admin')), 0, 'staff signup does not create a student row');
select hasnt_column('public', 'profiles', 'role', 'roles are not stored on the user-editable profiles table');
insert into public.documents (student_id, document_type_id, category, file_path, file_name, file_size, mime_type, status)
select tests.id('stu_Carol'), id, category, tests.id('stu_Carol') || '/education/99999999-0000-0000-0000-000000000000-svc.pdf', 'svc.pdf', 10, 'application/pdf', 'approved'
from public.document_types where key = 'transcript';
select is((select status::text from public.documents where file_name = 'svc.pdf'), 'approved',
  'service-role (trusted) document inserts keep their review status (migration 0012)');
select is((select count(*)::int from public.application_documents where application_id = tests.id('app_alice')), 3,
  'new application gets its destination checklist automatically');

-- =============================================================================
-- 1. Student A cannot read / modify Student B's data
-- =============================================================================
select tests.auth_as('alice');
set local role authenticated;

select is((select count(*)::int from public.profiles where id = tests.id('bob')), 0, '[1] alice cannot read bob profile');
select is((select count(*)::int from public.students where id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob student row');
select is((select count(*)::int from public.student_profiles where student_id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob passport/personal data');
select is((select count(*)::int from public.applications where student_id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob applications');
select is((select count(*)::int from public.application_events where application_id = tests.id('app_bob')), 0, '[1] alice cannot read bob application timeline');
select is((select count(*)::int from public.documents where student_id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob documents');
select is((select count(*)::int from public.document_versions where document_id = tests.id('doc_bob_passport')), 0, '[1] alice cannot read bob document versions');
select is((select count(*)::int from public.invoices where student_id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob invoices');
select is((select count(*)::int from public.payments where student_id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob payments');
select is((select count(*)::int from public.message_threads where id = tests.id('thread_bob')), 0, '[1] alice cannot read bob threads');
select is((select count(*)::int from public.messages where thread_id = tests.id('thread_bob')), 0, '[1] alice cannot read bob messages');
select is((select count(*)::int from public.notifications where recipient_id = tests.id('bob')), 0, '[1] alice cannot read bob notifications');
select is((select count(*)::int from public.student_tasks where student_id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob tasks');
select is((select count(*)::int from public.enrollments where student_id = tests.id('stu_Bob')), 0, '[1] alice cannot read bob enrollments');
select is((select count(*)::int from public.documents where student_id = tests.id('stu_Alice')), 2, '[1] alice can read her own documents');
select is((select count(*)::int from public.applications), 1, '[1] alice sees exactly her own application');

select is(tests.affected($$update public.profiles set first_name = 'Hacked' where id = tests.id('bob')$$), 0, '[1] alice cannot update bob profile');
select is(tests.affected($$update public.student_profiles set passport_number = 'X' where student_id = tests.id('stu_Bob')$$), 0, '[1] alice cannot update bob personal data');
select is(tests.affected($$update public.applications set intake = 'X' where student_id = tests.id('stu_Bob')$$), 0, '[1] alice cannot update bob application');
select is(tests.affected($$update public.notifications set is_read = true where recipient_id = tests.id('bob')$$), 0, '[1] alice cannot update bob notifications');
select is(tests.affected($$update public.student_tasks set status = 'done' where student_id = tests.id('stu_Bob')$$), 0, '[1] alice cannot update bob tasks');
select is(tests.affected($$delete from public.documents where student_id = tests.id('stu_Bob')$$), 0, '[1] alice cannot delete bob documents');
select is(tests.affected($$delete from public.notifications where recipient_id = tests.id('bob')$$), 0, '[1] alice cannot delete bob notifications');
select is(tests.affected($$delete from public.student_tasks where student_id = tests.id('stu_Bob')$$), 0, '[1] alice cannot delete bob tasks');
select is(tests.affected($$delete from public.applications where student_id = tests.id('stu_Bob')$$), 0, '[1] alice cannot delete bob applications');

select throws_ok($$insert into public.documents (student_id, document_type_id, category, file_path, file_name, file_size, mime_type)
  select tests.id('stu_Bob'), id, category, tests.id('stu_Bob') || '/identity/x-planted.pdf', 'planted.pdf', 10, 'application/pdf'
  from public.document_types where key = 'passport'$$, '42501', null, '[1] alice cannot insert a document into bob record');
select throws_ok($$insert into public.applications (student_id, university_id) values (tests.id('stu_Bob'), tests.id('uni'))$$,
  '42501', null, '[1] alice cannot create an application for bob');
select throws_ok($$insert into public.messages (thread_id, sender_id, body) values (tests.id('thread_bob'), tests.id('alice'), 'hi')$$,
  '42501', null, '[1] alice cannot post into bob thread');
select throws_ok($$select public.profile_completion(tests.id('stu_Bob'))$$, '42501', null, '[1] alice cannot compute bob profile completion');
select throws_ok($$select public.get_learning_analytics(tests.id('stu_Bob'))$$, '42501', null, '[1] alice cannot read bob learning analytics');

-- =============================================================================
-- 2. Storage: Alice cannot read or plant objects in Bob's folders, even with the exact path
-- =============================================================================
select is((select count(*)::int from storage.objects where bucket_id = 'student-documents'
            and name = (select file_path from public.documents where id = tests.id('doc_bob_passport')) ), 0,
  '[2] alice cannot see bob storage object by exact path (signed URL creation is refused)');
select is((select count(*)::int from storage.objects where bucket_id = 'student-documents'
            and name like tests.id('stu_Alice') || '/%'), 0, '[2] even her own stored documents are unreadable without an audited access grant');
select is((select count(*)::int from public.authorize_document_access(tests.id('doc_alice_passport'), 'download')), 1,
  '[2] authorize_document_access issues a grant for her own document');
select is((select count(*)::int from storage.objects where bucket_id = 'student-documents'
            and name like tests.id('stu_Alice') || '/%'), 1, '[2] with a grant, exactly that one object becomes readable (signed URL can be created)');
select throws_ok($$select * from public.authorize_document_access(tests.id('doc_bob_passport'))$$, '42501', null,
  '[2] alice cannot obtain a grant for bob document');
select throws_ok($$select * from public.authorize_document_access(tests.id('doc_alice_passport'), 'delete')$$, '22023', null,
  '[2] only view/download grants exist');
select is((select count(*)::int from public.document_access_grants), 0, '[2] grants table is not readable by clients');
select is((select count(*)::int from storage.objects where bucket_id = 'message-attachments'), 0, '[2] alice cannot see bob message attachment');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('student-documents', tests.id('stu_Bob') || '/identity/x.pdf')$$,
  '42501', null, '[2] alice cannot upload into bob folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('student-documents', tests.id('stu_Alice') || '/not-a-category/x.pdf')$$,
  '42501', null, '[2] uploads must follow the {student_id}/{category}/ path convention');
select lives_ok($$insert into storage.objects (bucket_id, name) values ('student-documents', tests.id('stu_Alice') || '/financial/new-bank.pdf')$$,
  '[2] alice can upload into her own folder');
select is(tests.affected($$delete from storage.objects where name like tests.id('stu_Bob') || '/%'$$), 0, '[2] alice cannot delete bob objects');
select is((select count(*)::int from storage.objects where name = tests.id('stu_Alice') || '/financial/new-bank.pdf'), 1,
  '[2] an unreferenced upload (no document row yet) is visible to its owner for clean-up');
select is(tests.affected($$delete from storage.objects where name = (select file_path from public.document_versions where document_id = tests.id('doc_alice_passport') and version = 1)$$), 0,
  '[2] files that belong to a document cannot be deleted directly');
-- deletes go through delete_document(): status rule + audit
select throws_ok($$select public.delete_document(tests.id('doc_alice_passport'))$$, '42501', null, '[2] approved documents cannot be deleted by the student');
select throws_ok($$select public.delete_document(tests.id('doc_bob_passport'))$$, '42501', null, '[2] alice cannot delete bob document');
select is(tests.affected($$delete from public.documents where id = tests.id('doc_alice_bank')$$), 0, '[2] direct deletes on documents are not allowed');

-- =============================================================================
-- 3. No self role escalation
-- =============================================================================
select throws_ok($$insert into public.user_roles (user_id, role) values (tests.id('alice'), 'super_admin')$$,
  '42501', null, '[3] student cannot insert into user_roles');
select is(tests.affected($$update public.user_roles set role = 'admin' where user_id = tests.id('alice')$$), 0, '[3] student cannot update own role');
select is(tests.affected($$delete from public.user_roles where user_id = tests.id('alice')$$), 0, '[3] student cannot delete own role row');
select throws_ok($$update public.profiles set is_active = false where id = tests.id('alice')$$, '42501', null, '[3] student cannot change own account status');
select throws_ok($$update public.students set counselor_id = null where id = tests.id('stu_Alice')$$, '42501', null, '[3] student cannot reassign own counselor');
select is(tests.affected($$update public.role_permissions set permission = 'x'$$), 0, '[3] student cannot alter role permissions');
select is(public.current_app_role()::text, 'student', '[3] alice is still a student');

-- =============================================================================
-- 5. Students cannot review documents or set their status
-- =============================================================================
select throws_ok($$insert into public.document_reviews (document_id, version, reviewer_id, action)
  values (tests.id('doc_alice_bank'), 1, tests.id('alice'), 'approved')$$, '42501', null, '[5] student cannot insert document_reviews');
select is(tests.affected($$update public.documents set status = 'approved' where id = tests.id('doc_alice_bank')$$), 0,
  '[5] student cannot update own document status directly');
select throws_ok($$select public.review_document(tests.id('doc_alice_bank'), 'approved')$$, '42501', null, '[5] student cannot call review_document');
insert into public.documents (student_id, document_type_id, category, file_path, file_name, file_size, mime_type, status, reviewer_comment)
select tests.id('stu_Alice'), id, category, tests.id('stu_Alice') || '/education/77777777-0000-0000-0000-000000000000-t.pdf', 't.pdf', 10, 'application/pdf', 'approved', 'self-approved'
from public.document_types where key = 'transcript';
select is((select status::text from public.documents where file_name = 't.pdf'), 'uploaded', '[5] status forced to uploaded on student insert');
select is((select reviewer_comment from public.documents where file_name = 't.pdf'), null, '[5] review fields stripped on student insert');
select throws_ok($$insert into public.documents (student_id, document_type_id, category, file_path, file_name, file_size, mime_type)
  select tests.id('stu_Alice'), id, category, tests.id('stu_Alice') || '/identity/x.exe', 'x.exe', 10, 'application/x-msdownload'
  from public.document_types where key = 'passport'$$, '23514', null, '[5] disallowed MIME type is rejected by the database');
select throws_ok($$insert into public.documents (student_id, document_type_id, category, file_path, file_name, file_size, mime_type)
  select tests.id('stu_Alice'), id, category, tests.id('stu_Alice') || '/identity/x.pdf', 'x.pdf', 20000000, 'application/pdf'
  from public.document_types where key = 'passport'$$, '23514', null, '[5] files over 10 MB are rejected by the database');

-- Replacement creates a new version and never overwrites history.
select is((public.replace_document(tests.id('doc_alice_bank'), tests.id('stu_Alice') || '/financial/88888888-0000-0000-0000-000000000000-bank-v2.pdf',
  'bank-v2.pdf', 4096, 'application/pdf')).version, 2, '[5] replace_document bumps the version');
select is((select count(*)::int from public.document_versions where document_id = tests.id('doc_alice_bank')), 2, '[5] version history keeps both versions');
select is((select coalesce(reviewer_comment, '') || coalesce(rejection_reason, '') || coalesce(reviewer_id::text, '') from public.documents where id = tests.id('doc_alice_bank')), '',
  '[5] a replacement starts a fresh review (old feedback stays in document_reviews)');

-- Student cannot set application status beyond starting it.
select throws_ok($$update public.applications set status = 'unconditional_offer' where id = tests.id('app_alice')$$, '42501', null,
  '[5] student cannot change application status to an offer');

-- =============================================================================
-- 6. Audit log is admin-only and append-only
-- =============================================================================
select is((select count(*)::int from public.audit_logs), 0, '[6] student cannot read audit_logs');
select throws_ok($$insert into public.audit_logs (action) values ('forged')$$, '42501', null, '[6] student cannot insert audit_logs directly');
select throws_ok($$select public.write_audit('forged')$$, '42501', null, '[6] write_audit is not callable by clients');
select lives_ok($$select public.log_client_event('auth.login')$$, '[6] whitelisted client events can be logged');
select throws_ok($$select public.log_client_event('document.approved')$$, '22023', null, '[6] clients cannot log privileged actions');
select throws_ok($$select public.log_client_event('document.downloaded', 'document', tests.id('doc_bob_passport'))$$, '42501', null,
  '[6] cannot log access to a document you cannot see');

-- =============================================================================
-- 9. Quiz scores cannot be set by the client; grading is server-side
-- =============================================================================
select is((select count(*)::int from public.quiz_options), 0, '[9] students cannot read the answer key (quiz_options)');
select is((select count(*)::int from public.quiz_questions), 0, '[9] students cannot read question rows (accepted answers)');
select throws_ok($$insert into public.quiz_attempts (quiz_id, student_id, attempt_number, score, percentage, passed, submitted_at)
  values (tests.id('quiz'), tests.id('stu_Alice'), 1, 100, 100, true, now())$$, '42501', null, '[9] students cannot insert a quiz attempt');
select throws_ok($$select public.grade_question(q, '"x"') from public.quiz_questions q limit 1$$, '42501', null, '[9] grading helper is not client-callable');

create temp table t_attempt on commit drop as select public.start_quiz_attempt(tests.id('quiz')) as payload;
select ok((select payload -> 'questions' -> 0 -> 'options' -> 0 ? 'is_correct' from t_attempt) is false,
  '[9] questions served to the student contain no answer key');
select is(tests.affected($$update public.quiz_attempts set score = 100, passed = true$$), 0, '[9] students cannot update attempt scores');
select is((public.submit_quiz_attempt((select (payload->>'attempt_id')::uuid from t_attempt), jsonb_build_object(
    '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001',
    '74000000-0000-0000-0000-000000000002', jsonb_build_array('75000000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000004'),
    '74000000-0000-0000-0000-000000000003', ' NINE ',
    '74000000-0000-0000-0000-000000000004', jsonb_build_object('75000000-0000-0000-0000-000000000005', '60', '75000000-0000-0000-0000-000000000006', '14')
  )) ->> 'percentage')::numeric, 100.00, '[9] server grades all 4 question types correctly (MC, ordering, short answer, matching)');
select throws_ok(format($$select public.submit_quiz_attempt(%L, '{}')$$, (select payload->>'attempt_id' from t_attempt)), 'P0001', null,
  '[9] an attempt cannot be resubmitted');
create temp table t_attempt2 on commit drop as select public.start_quiz_attempt(tests.id('quiz')) as payload;
select is((public.submit_quiz_attempt((select (payload->>'attempt_id')::uuid from t_attempt2), jsonb_build_object(
    '74000000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000002',
    '74000000-0000-0000-0000-000000000002', jsonb_build_array('75000000-0000-0000-0000-000000000004', '75000000-0000-0000-0000-000000000003'),
    '74000000-0000-0000-0000-000000000003', '9'
  )) ->> 'percentage')::numeric, 25.00, '[9] wrong answers score 0: only the short answer is right (25%)');
select throws_ok($$select public.start_quiz_attempt(tests.id('quiz'))$$, 'P0001', 'No attempts remaining', '[9] max_attempts is enforced');
select is((select (public.get_quiz_attempt_review((select (payload->>'attempt_id')::uuid from t_attempt2)) -> 'questions' -> 0 ->> 'correct')::boolean),
  false, '[9] attempt review reports per-question correctness');

-- Lesson completion recalculates course progress.
select is((public.update_lesson_progress(tests.id('lesson1'), 300, 300, true, 5) ->> 'course_progress')::numeric, 50.00,
  'completing 1 of 2 lessons sets course progress to 50%');
select is((select progress_percent from public.enrollments where student_id = tests.id('stu_Alice')), 50.00::numeric(5,2), 'enrollment progress stored');
select throws_ok($$select public.update_lesson_progress(tests.id('lesson1'), 1, 1, true)$$, '42501', null, 'non-enrolled students cannot record progress')
  from (select tests.auth_as('bob')) x;
select tests.auth_as('alice');

-- Assignments: students cannot grade themselves.
select lives_ok($$insert into public.assignment_submissions (assignment_id, student_id, status, text_answer, grade, feedback)
  values (tests.id('assignment'), tests.id('stu_Alice'), 'submitted', 'My essay', 100, 'Perfect')$$, 'student submits an assignment');
select is((select grade from public.assignment_submissions where student_id = tests.id('stu_Alice')), null, 'self-assigned grade is stripped');
select throws_ok($$update public.assignment_submissions set status = 'graded', grade = 100 where student_id = tests.id('stu_Alice')$$,
  '42501', null, 'student cannot mark own submission graded');

-- =============================================================================
-- 4. Counselor sees only assigned students
-- =============================================================================
reset role;
select tests.auth_as('counselor');
set local role authenticated;
select is((select count(*)::int from public.students), 2, '[4] counselor sees exactly the 2 assigned students');
select is((select count(*)::int from public.students where id = tests.id('stu_Carol')), 0, '[4] counselor gets zero rows for unassigned student');
select is((select count(*)::int from public.profiles where id = tests.id('carol')), 0, '[4] counselor cannot read unassigned profile');
select is((select count(*)::int from public.documents where student_id = tests.id('stu_Carol')), 0, '[4] counselor cannot read unassigned documents');
select is((select count(*)::int from public.applications where student_id = tests.id('stu_Carol')), 0, '[4] counselor cannot read unassigned applications');
select is((select count(*)::int from storage.objects where name like tests.id('stu_Carol') || '/%'), 0, '[4] counselor cannot read unassigned storage objects');
select is((select count(*)::int from storage.objects where name like tests.id('stu_Bob') || '/%'), 0, '[4] counselor needs a grant to read even an assigned student file');
select lives_ok($$select * from public.authorize_document_access(tests.id('doc_bob_passport'), 'view')$$, '[4] counselor can authorize access to an assigned student document');
select is((select count(*)::int from storage.objects where name like tests.id('stu_Bob') || '/%'), 1, '[4] ... and then read it');
select throws_ok($$select * from public.authorize_document_access(tests.id('doc_carol_passport'))$$, '42501', null, '[4] counselor cannot authorize an unassigned student document');
select throws_ok($$select public.delete_document(tests.id('doc_bob_passport'))$$, '42501', null, '[4] counselors cannot delete student documents');
select throws_ok($$select public.review_document(tests.id('doc_carol_passport'), 'approved')$$, '42501', null, '[4] counselor cannot review unassigned student documents');
select throws_ok($$update public.staff set permissions = '{students.view_all}' where profile_id = tests.id('counselor')$$, '42501', null,
  '[4] counselor cannot grant themselves extra permissions');
select throws_ok($$insert into public.user_roles (user_id, role) values (tests.id('counselor'), 'admin')$$, '42501', null, '[4] counselor cannot escalate role');
select is((select count(*)::int from public.audit_logs), 0, '[4] counselor cannot read audit logs');

-- Document review flow (one transaction: status + review row + notification + audit).
select throws_ok($$select public.review_document(tests.id('doc_bob_passport'), 'rejected', '  ')$$, '22023', 'A reason is required',
  'reject without a reason is refused');
select is((public.review_document(tests.id('doc_bob_passport'), 'resubmission_required', 'Scan is blurred', 'Please rescan in colour')).status::text,
  'resubmission_required', 'counselor requests resubmission on assigned student document');
-- Application status change writes timeline + notification + audit.
select lives_ok($$update public.applications set status = 'conditional_offer' where id = tests.id('app_bob')$$, 'counselor moves application to conditional offer');
select is(tests.affected($$update public.applications set status = 'withdrawn' where id = tests.id('app_carol')$$), 0, '[4] counselor cannot update unassigned application');

reset role;
select is((select count(*)::int from public.document_reviews where document_id = tests.id('doc_bob_passport') and reason = 'Scan is blurred'), 1, 'review row recorded');
select is((select rejection_reason || ' | ' || required_action from public.documents where id = tests.id('doc_bob_passport')),
  'Scan is blurred | Upload a corrected replacement document', 'reason and required action stored on the document');
select is((select count(*)::int from public.notifications where recipient_id = tests.id('bob') and type = 'document_rejected'), 1, 'student notified of rejection');
select is((select count(*)::int from public.audit_logs where action = 'document.resubmission_required' and actor_id = tests.id('counselor')), 1, 'review audited with actor');
select is((select count(*)::int from public.audit_logs where action = 'document.downloaded' and actor_id = tests.id('alice') and entity_id = tests.id('doc_alice_passport')), 1, '[audit] download by the student was audited');
select is((select count(*)::int from public.audit_logs where action = 'document.viewed' and actor_id = tests.id('counselor') and entity_id = tests.id('doc_bob_passport')), 1, '[audit] view by the counselor was audited');
select is((select count(*)::int from public.audit_logs where action = 'document.replaced' and entity_id = tests.id('doc_alice_bank')), 1, '[audit] replacement was audited');
select is((select count(*)::int from public.audit_logs where action = 'document.uploaded' and entity_id = tests.id('doc_alice_bank')), 1, '[audit] upload was audited');
-- grants expire
update public.document_access_grants set expires_at = now() - interval '1 second';
select tests.auth_as('alice');
set local role authenticated;
select is((select count(*)::int from storage.objects where name like tests.id('stu_Alice') || '/identity/%'), 0, '[2] expired grants no longer allow reading');
-- student deletes an uploaded (not yet reviewed) document: allowed, files become removable, audited
select is(cardinality(public.delete_document((select id from public.documents where file_name = 't.pdf'))), 1, '[2] student can delete a document that is not approved / under review');
select is(tests.affected($$delete from storage.objects where name = $$ || quote_literal(tests.id('stu_Alice') || '/financial/new-bank.pdf')), 1,
  '[2] the owner can delete an unreferenced upload (clean-up after a failed or deleted document)');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'document.deleted' and actor_id = tests.id('alice')), 1, '[audit] delete was audited with the student as actor');
select is((select count(*)::int from public.application_events where application_id = tests.id('app_bob') and status = 'conditional_offer'), 1, 'timeline event written');
select is((select count(*)::int from public.notifications where recipient_id = tests.id('bob') and type = 'university_offer'), 1, 'offer notification written');
select is((select count(*)::int from public.audit_logs where action = 'application.status_changed' and entity_id = tests.id('app_bob')), 1, 'status change audited');
select isnt((select decision_at from public.applications where id = tests.id('app_bob')), null, 'decision timestamp set on offer');
select is((select count(*)::int from public.notification_outbox where event_type = 'application.status_changed'), 1, 'integration outbox event emitted');

-- =============================================================================
-- Instructor scope
-- =============================================================================
select tests.auth_as('instructor');
set local role authenticated;
select is((select count(*)::int from public.enrollments), 1, 'instructor sees only enrollments of their own course');
select is((select count(*)::int from public.students), 1, 'instructor sees only students enrolled in their course');
select is((select count(*)::int from public.documents), 0, 'instructor cannot read student documents');
select is((select count(*)::int from public.student_profiles), 0, 'instructor cannot read passport/personal data');
select is((select count(*)::int from public.quiz_options), 6, 'instructor can read answer keys of own quiz');
select is(tests.affected($$update public.courses set title = 'X' where id = tests.id('course_other')$$), 0, 'instructor cannot edit a course they do not teach');
select lives_ok($$update public.assignment_submissions set status = 'graded', grade = 78, feedback = 'Good structure' where student_id = tests.id('stu_Alice')$$,
  'instructor grades a submission');
reset role;
select is((select graded_by from public.assignment_submissions where student_id = tests.id('stu_Alice')), tests.id('instructor'), 'grader recorded');
select is((select count(*)::int from public.notifications where recipient_id = tests.id('alice') and type = 'assignment_graded'), 1, 'student notified of grade');

-- =============================================================================
-- Admin vs super admin
-- =============================================================================
select tests.auth_as('admin');
set local role authenticated;
select is((select count(*)::int from public.students), 3, 'admin sees all students');
select ok((select count(*) from public.audit_logs) > 0, 'admin can read audit logs');
select throws_ok($$insert into public.user_roles (user_id, role) values (tests.id('alice'), 'counselor')$$, '42501', null, 'admin cannot change roles');
select throws_ok($$update public.profiles set is_active = false where id = tests.id('super')$$, '42501', null, 'admin cannot deactivate a staff account');
select lives_ok($$update public.profiles set is_active = false where id = tests.id('carol')$$, 'admin can deactivate a student');
reset role;
select tests.auth_as('carol');
set local role authenticated;
select is((select count(*)::int from public.documents), 0, 'deactivated student loses access to their data');
select is(public.current_app_role(), null, 'deactivated user has no effective role');
reset role;
select tests.auth_as('super');
set local role authenticated;
select lives_ok($$insert into public.user_roles (user_id, role) values (tests.id('counselor2'), 'instructor')$$, 'super admin can grant roles');
select throws_ok($$delete from public.user_roles where user_id = tests.id('super')$$, '42501', null, 'super admin cannot change their own role');
reset role;
select is((select count(*)::int from public.audit_logs where action = 'user.role_granted' and entity_id = tests.id('counselor2')), 1, 'role grant audited');

-- =============================================================================
-- 7. Unauthenticated requests see nothing
-- =============================================================================
select tests.clear_auth();
set local role anon;
select is((select coalesce(array_agg(t), '{}') from tests.visible_tables() t), array['faqs']::text[],
  '[7] anon sees no rows in any table (faqs is intentionally public, and empty here)')
  where exists (select 1 from public.faqs)
union all
select is((select coalesce(array_agg(t), '{}') from tests.visible_tables() t), '{}'::text[], '[7] anon sees no rows in any table')
  where not exists (select 1 from public.faqs);
select is((select count(*)::int from storage.objects), 0, '[7] anon sees no storage objects');
select throws_ok($$select public.profile_completion()$$, '42501', null, '[7] anon cannot execute RPCs');
reset role;

-- =============================================================================
-- 8. Buckets are private
-- =============================================================================
select is((select count(*)::int from storage.buckets where public), 0, '[8] no storage bucket is public');
select is((select count(*)::int from storage.buckets where id in ('student-documents', 'course-resources', 'assignment-submissions', 'message-attachments')),
  4, '[8] all four private buckets exist');
select is((select file_size_limit from storage.buckets where id = 'student-documents'), 10485760::bigint, '[8] student-documents capped at 10 MB');

-- Every public table has RLS enabled.
select is((select coalesce(array_agg(tablename::text), '{}') from pg_tables where schemaname = 'public' and not rowsecurity), '{}'::text[],
  'RLS is enabled on every public table');

-- Profile completion is computed by the database.
select tests.auth_as('alice');
set local role authenticated;
select ok((public.profile_completion() ->> 'percent')::int between 1 and 99, 'profile completion returns a percentage');
select ok(jsonb_array_length(public.profile_completion() -> 'missing') > 0, 'profile completion lists missing information');
reset role;

select * from finish();
rollback;
