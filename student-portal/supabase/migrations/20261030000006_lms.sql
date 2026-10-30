-- =============================================================================
-- 0006 · LMS: courses, modules, lessons, resources, enrollments, progress,
--        quizzes (server-graded), assignments & submissions, learning analytics
-- =============================================================================

create table public.courses (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  subtitle      text,
  description   text,
  category      text,
  level         text check (level in ('beginner', 'intermediate', 'advanced', 'all')),
  thumbnail_url text,
  status        public.course_status not null default 'draft',
  instructor_id uuid references public.profiles(id) on delete set null default auth.uid(),
  estimated_hours numeric(5,1),
  published_at  timestamptz,
  created_by    uuid references public.profiles(id) default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index courses_status_idx on public.courses(status);
create index courses_title_trgm on public.courses using gin (title gin_trgm_ops);
create trigger courses_updated before update on public.courses for each row execute function public.set_updated_at();

create table public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  description text,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index modules_course_idx on public.course_modules(course_id, position);
create trigger modules_updated before update on public.course_modules for each row execute function public.set_updated_at();

-- Videos are NOT stored in the database or storage: lessons reference an external host
-- (YouTube, Vimeo, Mux, Cloudflare Stream, Bunny…) via provider + external id / URL.
create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  module_id        uuid not null references public.course_modules(id) on delete cascade,
  course_id        uuid not null references public.courses(id) on delete cascade,
  title            text not null,
  description      text,
  content_type     public.lesson_content_type not null default 'video',
  video_provider   text check (video_provider in ('youtube', 'vimeo', 'mux', 'cloudflare', 'url')),
  video_ref        text,               -- provider video id or https URL
  duration_seconds int not null default 0,
  body             text,               -- article content (markdown)
  transcript       text,
  is_preview       boolean not null default false,
  position         int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index lessons_module_idx on public.lessons(module_id, position);
create index lessons_course_idx on public.lessons(course_id);
create trigger lessons_updated before update on public.lessons for each row execute function public.set_updated_at();

create table public.lesson_resources (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  title        text not null,
  file_path    text,                  -- course-resources bucket
  external_url text,
  mime_type    text,
  file_size    bigint,
  created_at   timestamptz not null default now(),
  check (file_path is not null or external_url is not null)
);
create index lesson_resources_lesson_idx on public.lesson_resources(lesson_id);

create table public.enrollments (
  id               uuid primary key default gen_random_uuid(),
  course_id        uuid not null references public.courses(id) on delete cascade,
  student_id       uuid not null references public.students(id) on delete cascade,
  status           public.enrollment_status not null default 'active',
  progress_percent numeric(5,2) not null default 0,
  enrolled_at      timestamptz not null default now(),
  last_accessed_at timestamptz,
  completed_at     timestamptz,
  certificate_number text unique,
  unique (course_id, student_id)
);
create index enrollments_student_idx on public.enrollments(student_id);

create table public.lesson_progress (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  lesson_id       uuid not null references public.lessons(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete cascade,
  watched_seconds int not null default 0,
  last_position   int not null default 0,
  completed       boolean not null default false,
  completed_at    timestamptz,
  notes           text,
  updated_at      timestamptz not null default now(),
  unique (student_id, lesson_id)
);
create index lesson_progress_course_idx on public.lesson_progress(student_id, course_id);

create table public.learning_activity (
  student_id        uuid not null references public.students(id) on delete cascade,
  course_id         uuid not null references public.courses(id) on delete cascade,
  activity_date     date not null default current_date,
  minutes           int not null default 0,
  lessons_completed int not null default 0,
  primary key (student_id, course_id, activity_date)
);

create table public.quizzes (
  id                       uuid primary key default gen_random_uuid(),
  course_id                uuid not null references public.courses(id) on delete cascade,
  module_id                uuid references public.course_modules(id) on delete set null,
  title                    text not null,
  description              text,
  time_limit_minutes       int check (time_limit_minutes > 0),
  passing_score            int not null default 70 check (passing_score between 0 and 100),
  max_attempts             int check (max_attempts > 0),      -- null = unlimited
  randomize_questions      boolean not null default false,
  show_results_immediately boolean not null default true,
  is_published             boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index quizzes_course_idx on public.quizzes(course_id);
create trigger quizzes_updated before update on public.quizzes for each row execute function public.set_updated_at();

create table public.quiz_questions (
  id               uuid primary key default gen_random_uuid(),
  quiz_id          uuid not null references public.quizzes(id) on delete cascade,
  type             public.question_type not null,
  prompt           text not null,
  explanation      text,
  accepted_answers text[] not null default '{}',   -- short_answer only
  points           int not null default 1 check (points > 0),
  position         int not null default 0,
  created_at       timestamptz not null default now()
);
create index quiz_questions_quiz_idx on public.quiz_questions(quiz_id, position);

-- For matching: label = left item, match_text = correct right item.
-- For ordering: correct_position = 1-based correct order.
create table public.quiz_options (
  id               uuid primary key default gen_random_uuid(),
  question_id      uuid not null references public.quiz_questions(id) on delete cascade,
  label            text not null,
  match_text       text,
  is_correct       boolean not null default false,
  correct_position int,
  position         int not null default 0
);
create index quiz_options_question_idx on public.quiz_options(question_id, position);

create table public.quiz_attempts (
  id             uuid primary key default gen_random_uuid(),
  quiz_id        uuid not null references public.quizzes(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  attempt_number int not null,
  started_at     timestamptz not null default now(),
  submitted_at   timestamptz,
  answers        jsonb,
  results        jsonb,           -- per question: {question_id: {correct: bool, points: n}}
  score          numeric(7,2),
  max_score      numeric(7,2),
  percentage     numeric(5,2),
  passed         boolean,
  unique (quiz_id, student_id, attempt_number)
);
create index quiz_attempts_student_idx on public.quiz_attempts(student_id, quiz_id);

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  course_id    uuid not null references public.courses(id) on delete cascade,
  module_id    uuid references public.course_modules(id) on delete set null,
  title        text not null,
  instructions text,
  due_at       timestamptz,
  max_points   int not null default 100,
  allow_file   boolean not null default true,
  allow_text   boolean not null default true,
  is_published boolean not null default true,
  created_by   uuid references public.profiles(id) default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index assignments_course_idx on public.assignments(course_id);
create trigger assignments_updated before update on public.assignments for each row execute function public.set_updated_at();

create table public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  status        public.submission_status not null default 'in_progress',
  text_answer   text,
  file_path     text,          -- assignment-submissions bucket
  file_name     text,
  file_size     bigint,
  submitted_at  timestamptz,
  grade         numeric(6,2),
  feedback      text,
  graded_by     uuid references public.profiles(id),
  graded_at     timestamptz,
  attempt       int not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index submissions_student_idx on public.assignment_submissions(student_id);
create trigger submissions_updated before update on public.assignment_submissions for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Access helpers
-- -----------------------------------------------------------------------------
create or replace function public.can_manage_course(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or (public.has_permission('courses.manage') and exists (
            select 1 from public.courses c where c.id = p_course_id
              and (c.instructor_id = auth.uid() or c.created_by = auth.uid())))
$$;

create or replace function public.is_enrolled(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrollments e
                 where e.course_id = p_course_id and e.student_id = public.current_student_id()
                   and e.status <> 'dropped')
$$;

create or replace function public.course_is_published(p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courses where id = p_course_id and status = 'published')
$$;

-- Instructor of any course the student is enrolled in can see that student's learning data.
create or replace function public.can_view_learning(p_student_id uuid, p_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_access_student(p_student_id) or public.can_manage_course(p_course_id)
$$;

-- Instructors see the students enrolled in courses they manage (names for grading etc.).
create or replace function public.instructor_teaches_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission('courses.manage') and exists (
    select 1 from public.enrollments e join public.courses c on c.id = e.course_id
    where e.student_id = p_student_id and (c.instructor_id = auth.uid() or c.created_by = auth.uid()))
$$;

-- Course publishing timestamps + "new course" notification fan-out to students.
create or replace function public.on_course_publish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger courses_publish before insert or update on public.courses for each row execute function public.on_course_publish();

create or replace function public.notify_new_course()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' and old.published_at is null then
    insert into public.notifications (recipient_id, type, title, body, link)
    select p.id, 'new_course', 'New course: ' || new.title, new.subtitle, '/courses/' || new.id
    from public.profiles p join public.user_roles ur on ur.user_id = p.id and ur.role = 'student' where p.is_active;
  end if;
  return new;
end $$;
create trigger courses_notify after update on public.courses for each row execute function public.notify_new_course();

-- Keep lessons.course_id consistent with its module.
create or replace function public.sync_lesson_course()
returns trigger language plpgsql as $$
begin
  select course_id into new.course_id from public.course_modules where id = new.module_id;
  return new;
end $$;
create trigger lessons_sync before insert or update of module_id on public.lessons
  for each row execute function public.sync_lesson_course();

-- -----------------------------------------------------------------------------
-- Progress
-- -----------------------------------------------------------------------------
create or replace function public.recompute_course_progress(p_student_id uuid, p_course_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_total int; v_done int; v_pct numeric;
begin
  select count(*) into v_total from public.lessons where course_id = p_course_id;
  select count(*) into v_done from public.lesson_progress lp
    join public.lessons l on l.id = lp.lesson_id
   where lp.student_id = p_student_id and lp.course_id = p_course_id and lp.completed;
  v_pct := case when v_total = 0 then 0 else round(v_done * 100.0 / v_total, 2) end;
  update public.enrollments set
    progress_percent = v_pct,
    last_accessed_at = now(),
    status = (case when v_pct >= 100 then 'completed' else 'active' end)::public.enrollment_status,
    completed_at = case when v_pct >= 100 then coalesce(completed_at, now()) end,
    certificate_number = case when v_pct >= 100
      then coalesce(certificate_number, 'CERT-' || upper(substr(md5(id::text), 1, 10))) end
  where student_id = p_student_id and course_id = p_course_id;
  return v_pct;
end $$;
revoke execute on function public.recompute_course_progress(uuid, uuid) from public, anon, authenticated;

-- Called by the lesson player (periodically while watching, and on "Mark as complete").
create or replace function public.update_lesson_progress(p_lesson_id uuid, p_watched_seconds int default null,
  p_position int default null, p_completed boolean default null, p_minutes int default 0, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_lesson public.lessons;
  v_prev public.lesson_progress;
  v_newly_completed boolean := false;
  v_pct numeric;
begin
  select * into v_lesson from public.lessons where id = p_lesson_id;
  if v_student is null or v_lesson.id is null or not public.is_enrolled(v_lesson.course_id) then
    raise exception 'You are not enrolled in this course' using errcode = '42501';
  end if;
  select * into v_prev from public.lesson_progress where student_id = v_student and lesson_id = p_lesson_id;

  insert into public.lesson_progress as lp (student_id, lesson_id, course_id, watched_seconds, last_position, completed, completed_at, notes)
  values (v_student, p_lesson_id, v_lesson.course_id, greatest(coalesce(p_watched_seconds, 0), 0), coalesce(p_position, 0),
          coalesce(p_completed, false), case when p_completed then now() end, p_notes)
  on conflict (student_id, lesson_id) do update set
    watched_seconds = greatest(lp.watched_seconds, coalesce(p_watched_seconds, lp.watched_seconds)),
    last_position   = coalesce(p_position, lp.last_position),
    completed       = lp.completed or coalesce(p_completed, false),
    completed_at    = coalesce(lp.completed_at, case when p_completed then now() end),
    notes           = coalesce(p_notes, lp.notes),
    updated_at      = now();

  v_newly_completed := coalesce(p_completed, false) and not coalesce(v_prev.completed, false);

  insert into public.learning_activity as la (student_id, course_id, activity_date, minutes, lessons_completed)
  values (v_student, v_lesson.course_id, current_date, least(greatest(coalesce(p_minutes, 0), 0), 60),
          case when v_newly_completed then 1 else 0 end)
  on conflict (student_id, course_id, activity_date) do update set
    minutes = la.minutes + excluded.minutes,
    lessons_completed = la.lessons_completed + excluded.lessons_completed;

  v_pct := public.recompute_course_progress(v_student, v_lesson.course_id);
  return jsonb_build_object('course_progress', v_pct, 'lesson_completed', coalesce(v_prev.completed, false) or coalesce(p_completed, false));
end $$;
grant execute on function public.update_lesson_progress(uuid, int, int, boolean, int, text) to authenticated;

-- Public outline for the catalogue (non-enrolled students cannot read lesson content).
create or replace function public.course_outline(p_course_id uuid)
returns table (module_id uuid, module_title text, module_position int, lesson_id uuid, lesson_title text,
               lesson_position int, content_type public.lesson_content_type, duration_seconds int, is_preview boolean)
language sql stable security definer set search_path = public as $$
  select m.id, m.title, m.position, l.id, l.title, l.position, l.content_type, l.duration_seconds, l.is_preview
  from public.course_modules m
  left join public.lessons l on l.module_id = m.id
  where m.course_id = p_course_id
    and (public.course_is_published(p_course_id) or public.can_manage_course(p_course_id))
  order by m.position, l.position
$$;
grant execute on function public.course_outline(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Quizzes: questions and answer keys are never readable by students through the
-- table API. Students start / submit attempts through these functions; grading
-- happens in the database.
-- -----------------------------------------------------------------------------
create or replace function public.start_quiz_attempt(p_quiz_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  q public.quizzes;
  v_used int;
  v_open public.quiz_attempts;
  v_attempt public.quiz_attempts;
  v_questions jsonb;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if v_student is null or q.id is null or not q.is_published or not public.is_enrolled(q.course_id) then
    raise exception 'Quiz not available' using errcode = '42501';
  end if;

  -- resume an unfinished attempt that is still within its time limit
  select * into v_open from public.quiz_attempts
   where quiz_id = q.id and student_id = v_student and submitted_at is null
     and (q.time_limit_minutes is null or started_at + make_interval(mins => q.time_limit_minutes) > now())
   order by attempt_number desc limit 1;

  if v_open.id is not null then
    v_attempt := v_open;
  else
    select count(*) into v_used from public.quiz_attempts where quiz_id = q.id and student_id = v_student;
    if q.max_attempts is not null and v_used >= q.max_attempts then
      raise exception 'No attempts remaining' using errcode = 'P0001';
    end if;
    insert into public.quiz_attempts (quiz_id, student_id, attempt_number)
    values (q.id, v_student, v_used + 1) returning * into v_attempt;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', qq.id, 'type', qq.type, 'prompt', qq.prompt, 'points', qq.points,
      'options', (
        select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label) order by
               case when qq.type in ('ordering') then md5(o.id::text || v_attempt.id::text) else lpad(o.position::text, 6, '0') end), '[]')
        from public.quiz_options o where o.question_id = qq.id),
      'match_choices', case when qq.type = 'matching' then (
        select jsonb_agg(o.match_text order by md5(o.match_text || v_attempt.id::text))
        from public.quiz_options o where o.question_id = qq.id) end
    ) order by case when q.randomize_questions then md5(qq.id::text || v_attempt.id::text) else lpad(qq.position::text, 6, '0') end), '[]')
  into v_questions
  from public.quiz_questions qq where qq.quiz_id = q.id;

  return jsonb_build_object(
    'attempt_id', v_attempt.id, 'attempt_number', v_attempt.attempt_number,
    'started_at', v_attempt.started_at,
    'expires_at', case when q.time_limit_minutes is not null
                       then v_attempt.started_at + make_interval(mins => q.time_limit_minutes) end,
    'quiz', jsonb_build_object('id', q.id, 'title', q.title, 'description', q.description,
                               'passing_score', q.passing_score, 'time_limit_minutes', q.time_limit_minutes),
    'questions', v_questions);
end $$;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;

create or replace function public.grade_question(p_question public.quiz_questions, p_answer jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_ok boolean;
begin
  if p_answer is null or p_answer = 'null'::jsonb then return false; end if;
  case p_question.type
    when 'multiple_choice', 'true_false' then
      select coalesce(bool_and(o.is_correct), false) into v_ok
        from public.quiz_options o where o.question_id = p_question.id and o.id::text = p_answer #>> '{}';
    when 'multiple_answer' then
      select coalesce(array_agg(o.id::text order by o.id::text) filter (where o.is_correct), '{}')
             = coalesce((select array_agg(x order by x) from jsonb_array_elements_text(
                 case when jsonb_typeof(p_answer) = 'array' then p_answer else '[]' end) x), '{}')
        into v_ok from public.quiz_options o where o.question_id = p_question.id;
    when 'short_answer' then
      v_ok := lower(btrim(p_answer #>> '{}')) = any (select lower(btrim(a)) from unnest(p_question.accepted_answers) a);
    when 'matching' then
      select coalesce(bool_and(coalesce(p_answer ->> o.id::text, '') = o.match_text), false) into v_ok
        from public.quiz_options o where o.question_id = p_question.id;
      if jsonb_typeof(p_answer) <> 'object' then v_ok := false; end if;
    when 'ordering' then
      select coalesce(array_agg(o.id::text order by o.correct_position), '{}')
             = coalesce((select array_agg(x order by ord) from jsonb_array_elements_text(
                 case when jsonb_typeof(p_answer) = 'array' then p_answer else '[]' end) with ordinality t(x, ord)), '{}')
        into v_ok from public.quiz_options o where o.question_id = p_question.id;
  end case;
  return coalesce(v_ok, false);
end $$;
revoke execute on function public.grade_question(public.quiz_questions, jsonb) from public, anon, authenticated;

create or replace function public.submit_quiz_attempt(p_attempt_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.quiz_attempts; q public.quizzes; qq public.quiz_questions;
  v_results jsonb := '{}'; v_score numeric := 0; v_max numeric := 0; v_ok boolean; v_pct numeric;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id for update;
  if a.id is null or a.student_id <> public.current_student_id() then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;
  if a.submitted_at is not null then raise exception 'Attempt already submitted' using errcode = 'P0001'; end if;
  select * into q from public.quizzes where id = a.quiz_id;
  -- allow a 60s grace period for network latency
  if q.time_limit_minutes is not null and now() > a.started_at + make_interval(mins => q.time_limit_minutes) + interval '60 seconds' then
    p_answers := '{}';   -- late: graded as unanswered
  end if;

  for qq in select * from public.quiz_questions where quiz_id = q.id loop
    v_ok := public.grade_question(qq, p_answers -> qq.id::text);
    v_max := v_max + qq.points;
    if v_ok then v_score := v_score + qq.points; end if;
    v_results := v_results || jsonb_build_object(qq.id::text, jsonb_build_object('correct', v_ok, 'points', case when v_ok then qq.points else 0 end));
  end loop;

  v_pct := case when v_max = 0 then 0 else round(v_score * 100 / v_max, 2) end;
  update public.quiz_attempts set submitted_at = now(), answers = coalesce(p_answers, '{}'), results = v_results,
    score = v_score, max_score = v_max, percentage = v_pct, passed = v_pct >= q.passing_score
  where id = a.id;

  perform public.notify(auth.uid(), 'quiz_result', 'Quiz result: ' || q.title,
    'You scored ' || v_pct || '% (' || case when v_pct >= q.passing_score then 'passed' else 'not passed' end || ').',
    '/learning/quiz/' || q.id || '/attempt/' || a.id);
  return jsonb_build_object('attempt_id', a.id, 'score', v_score, 'max_score', v_max, 'percentage', v_pct,
                            'passed', v_pct >= q.passing_score, 'show_results', q.show_results_immediately);
end $$;
grant execute on function public.submit_quiz_attempt(uuid, jsonb) to authenticated;

-- Review a submitted attempt: correct answers & explanations, when the quiz allows it.
create or replace function public.get_quiz_attempt_review(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a public.quiz_attempts; q public.quizzes; v_reveal boolean;
begin
  select * into a from public.quiz_attempts where id = p_attempt_id;
  if a.id is null then raise exception 'Attempt not found' using errcode = '42501'; end if;
  select * into q from public.quizzes where id = a.quiz_id;
  if not (a.student_id = public.current_student_id() or public.can_view_learning(a.student_id, q.course_id)) then
    raise exception 'Attempt not found' using errcode = '42501';
  end if;
  if a.submitted_at is null then raise exception 'Attempt not submitted yet' using errcode = 'P0001'; end if;
  v_reveal := q.show_results_immediately or public.is_staff();

  return jsonb_build_object(
    'attempt', to_jsonb(a) - 'answers' - 'results',
    'quiz', jsonb_build_object('id', q.id, 'title', q.title, 'passing_score', q.passing_score),
    'revealed', v_reveal,
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', qq.id, 'type', qq.type, 'prompt', qq.prompt, 'points', qq.points,
        'your_answer', a.answers -> qq.id::text,
        'correct', (a.results -> qq.id::text ->> 'correct')::boolean,
        'explanation', case when v_reveal then qq.explanation end,
        'accepted_answers', case when v_reveal then to_jsonb(qq.accepted_answers) end,
        'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label,
                      'match_text', case when v_reveal then o.match_text end,
                      'is_correct', case when v_reveal then o.is_correct end,
                      'correct_position', case when v_reveal then o.correct_position end) order by o.position)
                    from public.quiz_options o where o.question_id = qq.id)
      ) order by qq.position), '[]') from public.quiz_questions qq where qq.quiz_id = q.id));
end $$;
grant execute on function public.get_quiz_attempt_review(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Assignments
-- -----------------------------------------------------------------------------
create or replace function public.guard_submission()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_course uuid; v_title text;
begin
  select course_id, title into v_course, v_title from public.assignments where id = new.assignment_id;
  if auth.uid() is not null and public.can_manage_course(v_course) then
    if new.status = 'graded' and (tg_op = 'INSERT' or old.status is distinct from 'graded') then
      new.graded_by := auth.uid(); new.graded_at := now();
      perform public.notify(public.student_profile_id(new.student_id), 'assignment_graded', 'Assignment graded: ' || v_title,
        'Your grade: ' || coalesce(new.grade::text, '-'), '/learning/assignments/' || new.assignment_id);
    elsif new.status = 'resubmission_required' and (tg_op = 'INSERT' or old.status is distinct from 'resubmission_required') then
      perform public.notify(public.student_profile_id(new.student_id), 'assignment_graded', 'Resubmission requested: ' || v_title,
        new.feedback, '/learning/assignments/' || new.assignment_id);
    end if;
    return new;
  end if;
  if auth.uid() is null then return new; end if;

  -- student path
  if new.student_id <> public.current_student_id() then raise exception 'Not allowed' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' then
    if old.status not in ('not_started', 'in_progress', 'resubmission_required') then
      raise exception 'This submission can no longer be edited' using errcode = '42501';
    end if;
    if old.status = 'resubmission_required' and new.status = 'submitted' then new.attempt := old.attempt + 1; end if;
    new.grade := old.grade; new.feedback := old.feedback; new.graded_by := old.graded_by; new.graded_at := old.graded_at;
  else
    new.grade := null; new.feedback := null; new.graded_by := null; new.graded_at := null; new.attempt := 1;
  end if;
  if new.status not in ('in_progress', 'submitted') then
    raise exception 'Invalid status' using errcode = '42501';
  end if;
  if new.status = 'submitted' then
    if coalesce(btrim(new.text_answer), '') = '' and new.file_path is null then
      raise exception 'Add an answer or a file before submitting' using errcode = '22023';
    end if;
    new.submitted_at := now();
  end if;
  if new.file_path is not null and split_part(new.file_path, '/', 1) <> new.student_id::text then
    raise exception 'Invalid storage path' using errcode = '22023';
  end if;
  return new;
end $$;
create trigger submissions_guard before insert or update on public.assignment_submissions
  for each row execute function public.guard_submission();

-- -----------------------------------------------------------------------------
-- Learning analytics (student self, or staff with access)
-- -----------------------------------------------------------------------------
create or replace function public.get_learning_analytics(p_student_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := coalesce(p_student_id, public.current_student_id());
  v_streak int := 0; d date;
begin
  if v_student is null or not public.can_access_student(v_student) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- streak: consecutive days with activity ending today or yesterday
  d := case when exists (select 1 from public.learning_activity where student_id = v_student and activity_date = current_date)
            then current_date else current_date - 1 end;
  while exists (select 1 from public.learning_activity where student_id = v_student and activity_date = d) loop
    v_streak := v_streak + 1; d := d - 1;
  end loop;

  return jsonb_build_object(
    'overall_progress', (select coalesce(round(avg(progress_percent), 1), 0) from public.enrollments where student_id = v_student and status <> 'dropped'),
    'minutes_studied', (select coalesce(sum(minutes), 0) from public.learning_activity where student_id = v_student),
    'lessons_completed', (select count(*) from public.lesson_progress where student_id = v_student and completed),
    'quiz_average', (select round(avg(percentage), 1) from public.quiz_attempts where student_id = v_student and submitted_at is not null),
    'assignment_average', (select round(avg(s.grade * 100.0 / nullif(a.max_points, 0)), 1)
                            from public.assignment_submissions s join public.assignments a on a.id = s.assignment_id
                           where s.student_id = v_student and s.status = 'graded'),
    'current_streak', v_streak,
    'weekly_activity', (select jsonb_agg(jsonb_build_object('date', g::date, 'minutes',
                          coalesce((select sum(minutes) from public.learning_activity la where la.student_id = v_student and la.activity_date = g::date), 0))
                          order by g)
                        from generate_series(current_date - 6, current_date, interval '1 day') g),
    'course_progress', (select coalesce(jsonb_agg(jsonb_build_object('course_id', c.id, 'title', c.title, 'progress', e.progress_percent) order by c.title), '[]')
                        from public.enrollments e join public.courses c on c.id = e.course_id
                        where e.student_id = v_student and e.status <> 'dropped'),
    'quiz_performance', (select coalesce(jsonb_agg(jsonb_build_object('quiz', qz.title, 'best', x.best, 'attempts', x.n) order by qz.title), '[]')
                         from (select quiz_id, max(percentage) best, count(*) n from public.quiz_attempts
                               where student_id = v_student and submitted_at is not null group by quiz_id) x
                         join public.quizzes qz on qz.id = x.quiz_id)
  );
end $$;
grant execute on function public.get_learning_analytics(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.learning_activity enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_options enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

create policy students_select_instructor on public.students for select to authenticated
  using (public.instructor_teaches_student(id));
create policy profiles_select_instructor on public.profiles for select to authenticated
  using (exists (select 1 from public.students s where s.profile_id = profiles.id and public.instructor_teaches_student(s.id)));

create policy courses_select on public.courses for select to authenticated
  using (status = 'published' or public.can_manage_course(id) or public.is_staff());
create policy courses_insert on public.courses for insert to authenticated
  with check (public.has_permission('courses.manage'));
create policy courses_update on public.courses for update to authenticated
  using (public.can_manage_course(id)) with check (public.has_permission('courses.manage'));
create policy courses_delete on public.courses for delete to authenticated using (public.is_admin());

create policy modules_select on public.course_modules for select to authenticated
  using (public.course_is_published(course_id) or public.can_manage_course(course_id));
create policy modules_write on public.course_modules for all to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));

create policy lessons_select on public.lessons for select to authenticated using (
  public.can_manage_course(course_id)
  or (public.course_is_published(course_id) and (public.is_enrolled(course_id) or is_preview))
);
create policy lessons_write on public.lessons for all to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));

create policy resources_select on public.lesson_resources for select to authenticated
  using (public.can_manage_course(course_id) or (public.course_is_published(course_id) and public.is_enrolled(course_id)));
create policy resources_write on public.lesson_resources for all to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));

create policy enrollments_select on public.enrollments for select to authenticated
  using (public.can_view_learning(student_id, course_id));
create policy enrollments_self_insert on public.enrollments for insert to authenticated with check (
  (student_id = public.current_student_id() and public.course_is_published(course_id) and status = 'active' and progress_percent = 0)
  or public.can_manage_course(course_id) or public.has_permission('students.manage')
);
create policy enrollments_staff_update on public.enrollments for update to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));
create policy enrollments_self_drop on public.enrollments for delete to authenticated
  using (student_id = public.current_student_id() or public.can_manage_course(course_id));

create policy progress_select on public.lesson_progress for select to authenticated
  using (public.can_view_learning(student_id, course_id));
create policy activity_select on public.learning_activity for select to authenticated
  using (public.can_view_learning(student_id, course_id));

create policy quizzes_select on public.quizzes for select to authenticated
  using (public.can_manage_course(course_id) or (is_published and public.course_is_published(course_id) and public.is_enrolled(course_id)));
create policy quizzes_write on public.quizzes for all to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));

-- Answer keys: staff only. Students use start_quiz_attempt / get_quiz_attempt_review.
create policy questions_staff on public.quiz_questions for all to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)))
  with check (exists (select 1 from public.quizzes q where q.id = quiz_id and public.can_manage_course(q.course_id)));
create policy options_staff on public.quiz_options for all to authenticated
  using (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                 where qq.id = question_id and public.can_manage_course(q.course_id)))
  with check (exists (select 1 from public.quiz_questions qq join public.quizzes q on q.id = qq.quiz_id
                 where qq.id = question_id and public.can_manage_course(q.course_id)));

-- Attempts are created/updated only via the functions above.
create policy attempts_select on public.quiz_attempts for select to authenticated using (
  student_id = public.current_student_id()
  or exists (select 1 from public.quizzes q where q.id = quiz_id and public.can_view_learning(student_id, q.course_id))
);

create policy assignments_select on public.assignments for select to authenticated using (
  public.can_manage_course(course_id)
  or (is_published and public.course_is_published(course_id) and public.is_enrolled(course_id))
);
create policy assignments_write on public.assignments for all to authenticated
  using (public.can_manage_course(course_id)) with check (public.can_manage_course(course_id));

create policy submissions_select on public.assignment_submissions for select to authenticated using (
  student_id = public.current_student_id()
  or exists (select 1 from public.assignments a where a.id = assignment_id and public.can_view_learning(student_id, a.course_id))
);
create policy submissions_student_insert on public.assignment_submissions for insert to authenticated with check (
  student_id = public.current_student_id()
  and exists (select 1 from public.assignments a where a.id = assignment_id and a.is_published and public.is_enrolled(a.course_id))
);
create policy submissions_update on public.assignment_submissions for update to authenticated using (
  student_id = public.current_student_id()
  or exists (select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id))
) with check (
  student_id = public.current_student_id()
  or exists (select 1 from public.assignments a where a.id = assignment_id and public.can_manage_course(a.course_id))
);
