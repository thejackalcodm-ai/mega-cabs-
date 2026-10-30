/**
 * Demo data seed. Idempotent: every row has a deterministic id and is upserted, so running it
 * again refreshes the demo instead of duplicating it. Relative dates (due dates, events) are
 * re-anchored to "now" on every run.
 *
 *   npm run seed                      # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env
 *   SEED_TARGET=pg DATABASE_URL=… npm run seed   # local verification against plain Postgres
 *
 * Never run against production: it creates accounts with a published password.
 */
import 'dotenv/config'
import {
  APPLICATIONS,
  CHECKLISTS,
  COURSES,
  DEMO_DOMAIN,
  DOCUMENTS,
  FAQS,
  LESSON_VIDEO,
  STAFF,
  STATUS_PATH,
  STUDENTS,
  UNIVERSITIES,
} from './data.ts'
import { dateFromNow, daysFromNow, sid } from './ids.ts'
import { makePdf } from './pdf.ts'
import { PgTarget, SupabaseTarget, type Row, type SeedTarget } from './target.ts'

const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Demo#Pass123'

function createTarget(): SeedTarget {
  if (process.env.SEED_TARGET === 'pg') {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required when SEED_TARGET=pg')
    return new PgTarget(process.env.DATABASE_URL)
  }
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (service role key: Project Settings → API).',
    )
  }
  if (process.env.SEED_ALLOW_PRODUCTION !== 'true' && /prod/i.test(url)) {
    throw new Error(
      'Refusing to seed a URL that looks like production. Set SEED_ALLOW_PRODUCTION=true to override.',
    )
  }
  return new SupabaseTarget(url, key)
}

const log = (msg: string) => console.log(`  ✓ ${msg}`)

async function seed(t: SeedTarget) {
  console.log(`Seeding demo data → ${t.name}`)

  // ---------------------------------------------------------------- accounts
  const profileId: Record<string, string> = {}
  for (const s of STAFF) {
    profileId[s.key] = await t.ensureUser({
      id: sid('user', s.key),
      email: `${s.key}@${DEMO_DOMAIN}`,
      password: PASSWORD,
      role: s.role,
      firstName: s.first,
      lastName: s.last,
      phone: s.phone,
      country: 'United Kingdom',
    })
  }
  for (const s of STUDENTS) {
    profileId[s.key] = await t.ensureUser({
      id: sid('user', s.key),
      email: s.email,
      password: PASSWORD,
      role: 'student',
      firstName: s.first,
      lastName: s.last,
      phone: s.phone,
      country: s.country,
    })
  }
  // Accounts that existed before the seed may lack their role / staff / student rows.
  await t.upsert(
    'user_roles',
    [
      ...STAFF.map((s) => ({ user_id: profileId[s.key], role: s.role })),
      ...STUDENTS.map((s) => ({ user_id: profileId[s.key], role: 'student' })),
    ],
    'user_id,role',
    { ignoreDuplicates: true },
  )
  await t.upsert(
    'staff',
    STAFF.map((s) => ({ profile_id: profileId[s.key] })),
    'profile_id',
    { ignoreDuplicates: true },
  )
  for (const s of STAFF)
    await t.update('staff', { title: s.title, department: s.dept }, { eq: { profile_id: profileId[s.key] } })
  await t.upsert(
    'students',
    STUDENTS.map((s) => ({ profile_id: profileId[s.key] })),
    'profile_id',
    { ignoreDuplicates: true },
  )
  for (const s of [
    ...STAFF.map((x) => ({
      key: x.key,
      first: x.first,
      last: x.last,
      phone: x.phone,
      country: 'United Kingdom',
    })),
    ...STUDENTS,
  ]) {
    await t.update(
      'profiles',
      { first_name: s.first, last_name: s.last, phone: s.phone, country: s.country, is_active: true },
      { eq: { id: profileId[s.key] } },
    )
  }

  const staffRows = await t.select<{ id: string; profile_id: string }>('staff', 'id,profile_id', {
    in: { profile_id: Object.values(profileId) },
  })
  const staffId = (key: string) => staffRows.find((r) => r.profile_id === profileId[key])!.id
  const studentRows = await t.select<{ id: string; profile_id: string }>('students', 'id,profile_id', {
    in: { profile_id: Object.values(profileId) },
  })
  const studentId: Record<string, string> = {}
  for (const s of STUDENTS) studentId[s.key] = studentRows.find((r) => r.profile_id === profileId[s.key])!.id
  log(`${STAFF.length} staff accounts and ${STUDENTS.length} students`)

  // ---------------------------------------------------------------- student profiles
  for (const s of STUDENTS) {
    const isMain = s.key === 'main'
    await t.update(
      'students',
      {
        counselor_id: s.assigned ? staffId('counselor') : null,
        preferred_destinations: s.destinations,
        preferred_study_level: s.level,
        preferred_subjects: s.subjects,
        preferred_intake: 'September 2027',
        application_goals: isMain
          ? 'Complete an MSc in Data Science in the UK and work in health-tech analytics.'
          : `Study ${s.subjects[0]} abroad and build an international career.`,
        onboarding_step: 7,
        onboarding_completed: true,
        journey_stage: 'upload_documents',
      },
      { eq: { id: studentId[s.key] } },
    )
  }
  await t.upsert(
    'student_profiles',
    STUDENTS.map((s) => ({
      student_id: studentId[s.key],
      date_of_birth: s.dob,
      gender: s.gender,
      nationality: s.nationality,
      passport_number: s.passport,
      passport_expiry: dateFromNow(1600),
      national_id: `ID-${s.passport}`,
      whatsapp: s.phone,
      city: s.city,
      country: s.country,
      // the main student deliberately has no address / emergency contact yet (≈80% complete)
      address_line: s.key === 'main' ? null : `${10 + s.passport.length} Demo Street`,
      emergency_name: s.key === 'main' ? null : 'Demo Guardian',
      emergency_relationship: s.key === 'main' ? null : 'Parent',
      emergency_phone: s.key === 'main' ? null : s.phone.replace(/\d{2}$/, '99'),
    })),
    'student_id',
  )
  await t.upsert(
    'education_records',
    STUDENTS.map((s) => ({
      id: sid('edu', s.key),
      student_id: studentId[s.key],
      institution: s.key === 'main' ? 'University of Colombo (demo)' : `${s.city} National University (demo)`,
      qualification:
        s.level === 'undergraduate' || s.level === 'foundation' ? 'High School Diploma' : "Bachelor's degree",
      field_of_study: s.subjects[0],
      start_date: '2018-09-01',
      end_date: '2022-07-31',
      grade: s.key === 'main' ? 'First Class (3.8 GPA)' : 'Upper Second (3.4 GPA)',
      graduation_year: 2022,
    })),
  )
  await t.upsert(
    'english_tests',
    STUDENTS.filter((s) => s.key !== 'farhan').map((s, i) => ({
      id: sid('english', s.key),
      student_id: studentId[s.key],
      test_type: i % 3 === 2 ? 'pte' : 'ielts',
      overall: i % 3 === 2 ? 65 : 6.5 + (i % 2) * 0.5,
      listening: 7,
      reading: 6.5,
      writing: 6,
      speaking: 7,
      test_date: dateFromNow(-60 - i * 7),
    })),
  )
  await t.upsert('work_experience', [
    {
      id: sid('work', 'main'),
      student_id: studentId.main,
      company: 'Lanka Health Analytics (demo)',
      position: 'Junior Data Analyst',
      start_date: '2022-09-01',
      is_current: true,
      responsibilities:
        'Built dashboards for hospital bed occupancy and automated weekly reporting in Python.',
    },
    {
      id: sid('work', 'chidi'),
      student_id: studentId.chidi,
      company: 'Lagos Retail Group (demo)',
      position: 'Business Analyst',
      start_date: '2020-01-06',
      end_date: '2023-12-22',
      is_current: false,
      responsibilities: 'Pricing analysis and supplier reporting.',
    },
  ])
  log('student profiles, education, English tests, work experience')

  // ---------------------------------------------------------------- universities
  const uniId = (k: string) => sid('uni', k)
  const progId = (u: string, p: string) => sid('program', u, p)
  await t.upsert(
    'universities',
    UNIVERSITIES.map((u) => ({
      id: uniId(u.key),
      name: u.name,
      slug: u.key,
      country: u.country,
      city: u.city,
      website: u.website,
      ranking: u.ranking,
      description: u.description,
      established: u.established,
      student_population: u.population,
      is_active: true,
    })),
  )
  await t.upsert(
    'programs',
    UNIVERSITIES.flatMap((u) =>
      u.programs.map((p) => ({
        id: progId(u.key, p.key),
        university_id: uniId(u.key),
        name: p.name,
        subject: p.subject,
        study_level: p.level,
        duration_months: p.months,
        tuition_fee: p.fee,
        currency: 'currency' in p ? p.currency : 'GBP',
        intakes: [...p.intakes],
        entry_requirements:
          p.level === 'undergraduate' || p.level === 'foundation'
            ? 'High school diploma with strong grades in relevant subjects.'
            : "A bachelor's degree (2:2 or equivalent) in a related subject.",
        english_requirements: `IELTS Academic ${p.ielts} overall with no band below ${(p.ielts - 0.5).toFixed(1)}, or equivalent PTE.`,
        ielts_min: p.ielts,
        application_deadline: dateFromNow(45),
        is_active: true,
      })),
    ),
  )
  await t.upsert(
    'scholarships',
    UNIVERSITIES.map((u) => ({
      id: sid('scholarship', u.key),
      university_id: uniId(u.key),
      name: u.scholarship.name,
      amount: u.scholarship.amount,
      currency: 'currency' in u.scholarship ? u.scholarship.currency : 'GBP',
      description: 'Merit-based award for international students, deducted from first-year tuition.',
      eligibility: 'Offer holders with a strong academic record. Automatically considered.',
      deadline: dateFromNow(60),
    })),
  )
  await t.upsert(
    'saved_universities',
    ['northbridge', 'westmere', 'stbrennans'].map((u) => ({
      student_id: studentId.main,
      university_id: uniId(u),
    })),
    'student_id,university_id',
  )
  log(`${UNIVERSITIES.length} universities with programmes and scholarships`)

  // ---------------------------------------------------------------- checklists (before applications)
  const docTypes = await t.select<{ id: string; key: string; category: string }>(
    'document_types',
    'id,key,category',
  )
  const type = (key: string) => {
    const d = docTypes.find((x) => x.key === key)
    if (!d) throw new Error(`Unknown document type ${key}`)
    return d
  }
  await t.upsert(
    'document_requirements',
    CHECKLISTS.flatMap((c) =>
      c.docs.map((d, i) => ({
        id: sid('req', c.key, d),
        checklist_key: c.key,
        checklist_name: c.name,
        country: c.country,
        document_type_id: type(d).id,
        is_required: true,
        sort_order: i + 1,
      })),
    ),
    'checklist_key,document_type_id',
  )

  // ---------------------------------------------------------------- applications + timeline
  const appId = (k: string) => sid('application', k)
  const pathTo = (status: string) => {
    if (status === 'unconditional_offer') return [...STATUS_PATH.slice(1, 5), 'unconditional_offer']
    const i = STATUS_PATH.indexOf(status as (typeof STATUS_PATH)[number])
    return STATUS_PATH.slice(1, i + 1)
  }
  await t.upsert(
    'applications',
    APPLICATIONS.map((a) => {
      const path = pathTo(a.status)
      return {
        id: appId(a.key),
        student_id: studentId[a.student],
        university_id: uniId(a.uni),
        program_id: progId(a.uni, a.program),
        intake: a.intake,
        status: a.status,
        created_at: daysFromNow(-a.startedDaysAgo),
        submitted_at: path.includes('submitted') ? daysFromNow(-a.startedDaysAgo + 6) : null,
        offer_conditions: 'conditions' in a ? a.conditions : null,
      }
    }),
  )
  const eventIds: string[] = []
  const events: Row[] = []
  const DESCRIPTIONS: Record<string, string> = {
    application_started: 'Your counselor opened the application.',
    documents_required: 'The university requested your final transcript and an updated bank statement.',
    submitted: 'Application submitted to the university admissions office.',
    under_university_review: 'The admissions team is assessing your application.',
    conditional_offer: 'Conditional offer received. Check the conditions in your offer letter.',
    unconditional_offer: 'Unconditional offer received.',
    deposit_required: 'Pay the tuition deposit to secure your place.',
    deposit_paid: 'Tuition deposit received by the university.',
    cas_pending: 'The university is preparing your CAS / confirmation of enrolment.',
    cas_issued: 'Confirmation issued. You can now prepare your visa application.',
    visa_preparation: 'Visa document checklist started with your counselor.',
    visa_submitted: 'Visa application submitted.',
    visa_approved: 'Visa approved. Congratulations!',
  }
  for (const a of APPLICATIONS) {
    const path = pathTo(a.status)
    path.forEach((status, i) => {
      const id = sid('event', a.key, status)
      eventIds.push(id)
      const daysAgo = Math.round(
        a.startedDaysAgo - (i * (a.startedDaysAgo - 1)) / Math.max(path.length - 1, 1),
      )
      events.push({
        id,
        application_id: appId(a.key),
        status,
        title: status
          .replace(/_/g, ' ')
          .replace(/^\w/, (c) => c.toUpperCase())
          .replace('Cas', 'CAS'),
        description: DESCRIPTIONS[status] ?? null,
        occurred_at: daysFromNow(-daysAgo, 9 + (i % 7)),
        actor_id: profileId.counselor,
      })
    })
  }
  // the main student's Northbridge timeline also records the document step from the spec example
  const storyId = sid('event', 'main-northbridge', 'transcript-uploaded')
  eventIds.push(storyId)
  events.push({
    id: storyId,
    application_id: appId('main-northbridge'),
    status: null,
    title: 'Transcript uploaded',
    description: 'Final transcript added to the application.',
    occurred_at: daysFromNow(-12, 15),
    actor_id: profileId.main,
  })
  await t.upsert('application_events', events)
  // remove the automatic "Application created" rows written by the insert trigger
  await t.delete('application_events', {
    in: { application_id: APPLICATIONS.map((a) => appId(a.key)) },
    notIn: { id: eventIds },
  })
  log(`${APPLICATIONS.length} applications with timelines and checklists`)

  // ---------------------------------------------------------------- documents (storage + rows + reviews)
  let docCount = 0
  for (const [studentKey, specs] of Object.entries(DOCUMENTS)) {
    const stu = STUDENTS.find((s) => s.key === studentKey)!
    for (const d of specs) {
      const docId = sid('document', studentKey, d.key)
      const dt = type(d.type)
      const versions = d.versions ?? 1
      const versionRows: Row[] = []
      for (let v = 1; v <= versions; v++) {
        const fileName = v === versions ? d.file : d.file.replace('.pdf', `-v${v}.pdf`)
        const path = `${studentId[studentKey]}/${dt.category}/${sid('object', studentKey, d.key, v)}-${fileName}`
        const pdf = makePdf(`${dt.key.replace(/_/g, ' ').toUpperCase()}`, [
          `Holder: ${stu.first} ${stu.last}`,
          `Reference: ${stu.passport}`,
          `Version ${v}`,
        ])
        await t.upload('student-documents', path, pdf, 'application/pdf')
        versionRows.push({
          id: sid('docver', studentKey, d.key, v),
          document_id: docId,
          version: v,
          file_path: path,
          file_name: fileName,
          file_size: pdf.byteLength,
          mime_type: 'application/pdf',
          uploaded_by: profileId[studentKey],
          created_at: daysFromNow(-d.daysAgo - (versions - v) * 4),
        })
      }
      const current = versionRows[versionRows.length - 1]
      const reviewed = d.status !== 'uploaded'
      await t.upsert('documents', [
        {
          id: docId,
          student_id: studentId[studentKey],
          document_type_id: dt.id,
          category: dt.category,
          file_path: current.file_path,
          file_name: current.file_name,
          file_size: current.file_size,
          mime_type: 'application/pdf',
          status: d.status,
          version: versions,
          uploaded_by: profileId[studentKey],
          uploaded_at: current.created_at,
          reviewer_id: reviewed ? profileId.counselor : null,
          reviewer_comment: d.comment ?? null,
          rejection_reason: d.reason ?? null,
          required_action: d.action ?? null,
          reviewed_at: reviewed ? daysFromNow(-d.daysAgo + 1) : null,
          verified_at: d.status === 'approved' ? daysFromNow(-d.daysAgo + 1) : null,
          expiry_date: d.expiry !== undefined ? dateFromNow(d.expiry) : null,
        },
      ])
      await t.upsert('document_versions', versionRows, 'document_id,version')
      const reviews: Row[] = []
      if (versions > 1)
        reviews.push({
          id: sid('review', studentKey, d.key, 1),
          document_id: docId,
          version: 1,
          reviewer_id: profileId.counselor,
          action: 'resubmission_required',
          reason: 'First version was incomplete.',
          comment: null,
          created_at: daysFromNow(-d.daysAgo - 2),
        })
      if (reviewed && d.status !== 'expired') {
        reviews.push({
          id: sid('review', studentKey, d.key, versions),
          document_id: docId,
          version: versions,
          reviewer_id: profileId.counselor,
          action: d.status,
          reason: d.reason ?? null,
          comment: d.comment ?? null,
          created_at: daysFromNow(-d.daysAgo + 1),
        })
      }
      if (reviews.length) await t.upsert('document_reviews', reviews)
      docCount++
    }
  }
  log(`${docCount} documents with versions, reviews and stored files`)

  // ---------------------------------------------------------------- LMS
  const courseId = (k: string) => sid('course', k)
  const lessonIds: Record<string, string[]> = {}
  for (const c of COURSES) {
    await t.upsert('courses', [
      {
        id: courseId(c.key),
        slug: c.slug,
        title: c.title,
        subtitle: c.subtitle,
        description: c.description,
        category: c.category,
        level: c.level,
        status: c.status,
        instructor_id: profileId[c.instructor],
        created_by: profileId[c.instructor],
        estimated_hours: c.hours,
      },
    ])
    const lessons: Row[] = []
    lessonIds[c.key] = []
    await t.upsert(
      'course_modules',
      c.modules.map((m, mi) => ({
        id: sid('module', c.key, mi),
        course_id: courseId(c.key),
        title: m.title,
        position: mi + 1,
      })),
    )
    c.modules.forEach((m, mi) =>
      m.lessons.forEach((title, li) => {
        const id = sid('lesson', c.key, mi, li)
        lessonIds[c.key].push(id)
        lessons.push({
          id,
          module_id: sid('module', c.key, mi),
          course_id: courseId(c.key),
          title,
          position: li + 1,
          description: `${title}: key ideas, worked examples and a short practice task.`,
          content_type: 'video',
          video_provider: 'url',
          video_ref: LESSON_VIDEO,
          duration_seconds: 420 + li * 180,
          transcript: `In this lesson we cover ${title.toLowerCase()}. We start with the core idea, look at two examples and finish with a practice task you can attempt before the next lesson.`,
          is_preview: mi === 0 && li === 0,
        })
      }),
    )
    await t.upsert('lessons', lessons)
  }
  const resourcePath = `${courseId('ielts')}/${sid('resource-object', 'band')}-ielts-band-descriptors.pdf`
  await t.upload(
    'course-resources',
    resourcePath,
    makePdf('IELTS Writing band descriptors', [
      'Task achievement',
      'Coherence and cohesion',
      'Lexical resource',
      'Grammatical range and accuracy',
    ]),
    'application/pdf',
  )
  await t.upsert('lesson_resources', [
    {
      id: sid('resource', 'band'),
      lesson_id: lessonIds.ielts[1],
      course_id: courseId('ielts'),
      title: 'Writing band descriptors (PDF)',
      file_path: resourcePath,
      mime_type: 'application/pdf',
      file_size: 1200,
    },
  ])

  // quiz with all six question types
  const quizId = sid('quiz', 'ielts-foundations')
  await t.upsert('quizzes', [
    {
      id: quizId,
      course_id: courseId('ielts'),
      module_id: sid('module', 'ielts', 0),
      title: 'IELTS Foundations Check',
      description: 'Six quick questions on test format and scoring.',
      time_limit_minutes: 15,
      passing_score: 60,
      max_attempts: 3,
      randomize_questions: false,
      show_results_immediately: true,
      is_published: true,
    },
  ])
  const Q = (n: number) => sid('question', 'ielts-foundations', n)
  const O = (n: number, o: number) => sid('option', 'ielts-foundations', n, o)
  await t.upsert('quiz_questions', [
    {
      id: Q(1),
      quiz_id: quizId,
      type: 'multiple_choice',
      prompt: 'How many sections does the IELTS Academic test have?',
      explanation: 'Listening, Reading, Writing and Speaking.',
      points: 1,
      position: 1,
      accepted_answers: [],
    },
    {
      id: Q(2),
      quiz_id: quizId,
      type: 'multiple_answer',
      prompt: 'Which skills are assessed in Writing Task 2? (Select all that apply)',
      explanation: 'Task response, coherence, lexical resource and grammar are the four criteria.',
      points: 1,
      position: 2,
      accepted_answers: [],
    },
    {
      id: Q(3),
      quiz_id: quizId,
      type: 'true_false',
      prompt: 'The overall band score is the average of the four skills, rounded to the nearest half band.',
      explanation: 'True. For example 6.25 rounds up to 6.5.',
      points: 1,
      position: 3,
      accepted_answers: [],
    },
    {
      id: Q(4),
      quiz_id: quizId,
      type: 'short_answer',
      prompt: 'What is the highest possible band score? (number)',
      explanation: 'Bands range from 0 to 9.',
      points: 1,
      position: 4,
      accepted_answers: ['9', 'nine', '9.0'],
    },
    {
      id: Q(5),
      quiz_id: quizId,
      type: 'matching',
      prompt: 'Match each section to its duration.',
      explanation: 'Listening ~30 min, Reading 60 min, Writing 60 min.',
      points: 1,
      position: 5,
      accepted_answers: [],
    },
    {
      id: Q(6),
      quiz_id: quizId,
      type: 'ordering',
      prompt: 'Put the paper-based test sections in the order they are taken.',
      explanation: 'Listening, Reading and Writing are taken in that order on the same day.',
      points: 1,
      position: 6,
      accepted_answers: [],
    },
  ])
  await t.upsert(
    'quiz_options',
    [
      { id: O(1, 1), question_id: Q(1), label: 'Three', is_correct: false, position: 1 },
      { id: O(1, 2), question_id: Q(1), label: 'Four', is_correct: true, position: 2 },
      { id: O(1, 3), question_id: Q(1), label: 'Five', is_correct: false, position: 3 },
      { id: O(2, 1), question_id: Q(2), label: 'Task response', is_correct: true, position: 1 },
      { id: O(2, 2), question_id: Q(2), label: 'Pronunciation', is_correct: false, position: 2 },
      { id: O(2, 3), question_id: Q(2), label: 'Coherence and cohesion', is_correct: true, position: 3 },
      { id: O(2, 4), question_id: Q(2), label: 'Lexical resource', is_correct: true, position: 4 },
      { id: O(3, 1), question_id: Q(3), label: 'True', is_correct: true, position: 1 },
      { id: O(3, 2), question_id: Q(3), label: 'False', is_correct: false, position: 2 },
      { id: O(5, 1), question_id: Q(5), label: 'Listening', match_text: 'About 30 minutes', position: 1 },
      { id: O(5, 2), question_id: Q(5), label: 'Reading', match_text: '60 minutes (Reading)', position: 2 },
      { id: O(5, 3), question_id: Q(5), label: 'Writing', match_text: '60 minutes (Writing)', position: 3 },
      { id: O(6, 1), question_id: Q(6), label: 'Listening', correct_position: 1, position: 1 },
      { id: O(6, 2), question_id: Q(6), label: 'Reading', correct_position: 2, position: 2 },
      { id: O(6, 3), question_id: Q(6), label: 'Writing', correct_position: 3, position: 3 },
    ].map((o) => ({ match_text: null, correct_position: null, is_correct: false, ...o })),
  )

  const assignmentId = (k: string) => sid('assignment', k)
  await t.upsert('assignments', [
    {
      id: assignmentId('task1'),
      course_id: courseId('ielts'),
      module_id: sid('module', 'ielts', 2),
      title: 'Writing Task 1: Describe a line graph',
      instructions:
        'Write at least 150 words summarising the graph in the attached PDF. Spend about 20 minutes.',
      due_at: daysFromNow(-4, 17),
      max_points: 100,
      allow_file: true,
      allow_text: true,
      is_published: true,
      created_by: profileId.instructor,
    },
    {
      id: assignmentId('task2'),
      course_id: courseId('ielts'),
      module_id: sid('module', 'ielts', 2),
      title: 'Writing Task 2: Opinion essay',
      instructions:
        '“Some people believe university education should be free for everyone.” To what extent do you agree or disagree? Write at least 250 words.',
      due_at: daysFromNow(5, 17),
      max_points: 100,
      allow_file: true,
      allow_text: true,
      is_published: true,
      created_by: profileId.instructor,
    },
    {
      id: assignmentId('pte-essay'),
      course_id: courseId('pte'),
      module_id: sid('module', 'pte', 1),
      title: 'Summarise Written Text practice',
      instructions: 'Summarise the passage in one sentence of 5–75 words.',
      due_at: daysFromNow(9, 17),
      max_points: 100,
      allow_file: false,
      allow_text: true,
      is_published: true,
      created_by: profileId.instructor,
    },
  ])

  // enrollments: [student, course, lessons completed]
  const ENROLL: [string, string, number][] = [
    ['main', 'ielts', 4],
    ['main', 'study-skills', 3],
    ['main', 'visa', 0],
    ['kavindu', 'ielts', 10],
    ['aisha', 'ielts', 6],
    ['meilin', 'ielts', 2],
    ['chidi', 'study-skills', 1],
    ['ananya', 'pte', 3],
    ['linh', 'pte', 1],
    ['farhan', 'ielts', 0],
    ['grace', 'study-skills', 3],
  ]
  await t.upsert(
    'enrollments',
    ENROLL.map(([s, c], i) => ({
      id: sid('enrollment', s, c),
      course_id: courseId(c),
      student_id: studentId[s],
      status: 'active',
      enrolled_at: daysFromNow(-30 + i),
    })),
    'course_id,student_id',
  )
  await t.upsert(
    'lesson_progress',
    ENROLL.flatMap(([s, c, done]) =>
      lessonIds[c].slice(0, done).map((lessonId, i) => ({
        id: sid('progress', s, lessonId),
        student_id: studentId[s],
        lesson_id: lessonId,
        course_id: courseId(c),
        watched_seconds: 600,
        last_position: 600,
        completed: true,
        completed_at: daysFromNow(-done + i),
        notes: s === 'main' && i === 0 ? 'Band 7 needs a clear overview paragraph in Task 1.' : null,
      })),
    ),
    'student_id,lesson_id',
  )
  for (const [s, c] of ENROLL)
    await t.rpc('recompute_course_progress', { p_student_id: studentId[s], p_course_id: courseId(c) })

  // learning activity: rebuilt each run so streaks stay anchored to today
  await t.delete('learning_activity', { in: { student_id: Object.values(studentId) } })
  await t.upsert(
    'learning_activity',
    [
      ...[0, 1, 2, 3, 4].map((d) => ({
        student_id: studentId.main,
        course_id: courseId('ielts'),
        activity_date: dateFromNow(-d),
        minutes: [35, 50, 20, 45, 30][d],
        lessons_completed: d < 4 ? 1 : 0,
      })),
      {
        student_id: studentId.main,
        course_id: courseId('study-skills'),
        activity_date: dateFromNow(-8),
        minutes: 60,
        lessons_completed: 3,
      },
      ...['kavindu', 'aisha', 'ananya'].map((s, i) => ({
        student_id: studentId[s],
        course_id: courseId(s === 'ananya' ? 'pte' : 'ielts'),
        activity_date: dateFromNow(-i),
        minutes: 40,
      })),
    ],
    'student_id,course_id,activity_date',
  )

  const attempt = (s: string, n: number, pct: number, daysAgo: number) => ({
    id: sid('attempt', s, n),
    quiz_id: quizId,
    student_id: studentId[s],
    attempt_number: n,
    started_at: daysFromNow(-daysAgo, 11),
    submitted_at: daysFromNow(-daysAgo, 12),
    answers: {},
    results: {},
    score: Math.round((pct / 100) * 6 * 100) / 100,
    max_score: 6,
    percentage: pct,
    passed: pct >= 60,
  })
  await t.upsert(
    'quiz_attempts',
    [
      attempt('main', 1, 66.67, 3),
      attempt('kavindu', 1, 83.33, 20),
      attempt('aisha', 1, 50, 6),
      attempt('aisha', 2, 83.33, 4),
      attempt('meilin', 1, 33.33, 2),
    ],
    'quiz_id,student_id,attempt_number',
  )

  await t.upsert(
    'assignment_submissions',
    [
      {
        id: sid('submission', 'main', 'task1'),
        assignment_id: assignmentId('task1'),
        student_id: studentId.main,
        status: 'graded',
        text_answer:
          'The line graph illustrates the number of international students enrolled at three universities between 2015 and 2025…',
        submitted_at: daysFromNow(-5, 16),
        grade: 72,
        feedback:
          'Clear overview and accurate data. To reach band 7.5, group similar trends and vary your comparison language.',
        graded_by: profileId.instructor,
        graded_at: daysFromNow(-2, 10),
      },
      {
        id: sid('submission', 'main', 'task2'),
        assignment_id: assignmentId('task2'),
        student_id: studentId.main,
        status: 'in_progress',
        text_answer: 'It is often argued that higher education should be free of charge…',
        submitted_at: null,
      },
      {
        id: sid('submission', 'kavindu', 'task2'),
        assignment_id: assignmentId('task2'),
        student_id: studentId.kavindu,
        status: 'submitted',
        text_answer: 'Free university education is a topic that divides opinion…',
        submitted_at: daysFromNow(-1, 20),
      },
      {
        id: sid('submission', 'aisha', 'task1'),
        assignment_id: assignmentId('task1'),
        student_id: studentId.aisha,
        status: 'resubmission_required',
        text_answer: 'The graph shows…',
        submitted_at: daysFromNow(-6, 9),
        feedback: 'Under 150 words — please expand your overview and key comparisons.',
      },
    ].map((r) => ({ grade: null, feedback: null, graded_by: null, graded_at: null, ...r })),
    'assignment_id,student_id',
  )
  log(`${COURSES.length} courses, quiz (6 question types), assignments, enrollments and progress`)

  // ---------------------------------------------------------------- invoices & payments
  const INVOICES = [
    {
      key: 'main-service',
      student: 'main',
      title: 'Application service package',
      items: [
        ['University application service', 1, 450],
        ['Document verification', 1, 50],
      ],
      due: -20,
      paid: [500, 'card', -22] as const,
    },
    {
      key: 'main-visa',
      student: 'main',
      title: 'UK visa application support',
      items: [
        ['Visa application support', 1, 300],
        ['Courier and printing', 1, 50],
      ],
      due: 10,
    },
    {
      key: 'kavindu-service',
      student: 'kavindu',
      title: 'Application service package',
      items: [['University application service', 1, 450]],
      due: -60,
      paid: [450, 'bank_transfer', -58] as const,
    },
    {
      key: 'chidi-service',
      student: 'chidi',
      title: 'Application service package',
      items: [['University application service', 1, 450]],
      due: -40,
      paid: [450, 'card', -41] as const,
    },
    {
      key: 'grace-visa',
      student: 'grace',
      title: 'Visa application support',
      items: [['Visa application support', 1, 300]],
      due: -30,
      paid: [300, 'card', -31] as const,
    },
    {
      key: 'aisha-service',
      student: 'aisha',
      title: 'Application service package',
      items: [['University application service', 1, 450]],
      due: 5,
      paid: [200, 'bank_transfer', -3] as const,
    },
    {
      key: 'tomas-ielts',
      student: 'tomas',
      title: 'IELTS course fee',
      items: [['IELTS Academic Complete', 1, 120]],
      due: -15,
      failed: true,
    },
  ]
  await t.upsert(
    'invoices',
    INVOICES.map((i) => ({
      id: sid('invoice', i.key),
      student_id: studentId[i.student],
      title: i.title,
      currency: 'GBP',
      status: 'open',
      issued_at: daysFromNow(i.due - 14),
      due_date: dateFromNow(i.due),
      created_by: profileId.admin,
    })),
  )
  await t.upsert(
    'invoice_items',
    INVOICES.flatMap((i) =>
      i.items.map(([description, quantity, unit], n) => ({
        id: sid('invoice-item', i.key, n),
        invoice_id: sid('invoice', i.key),
        description,
        quantity,
        unit_amount: unit,
        position: n + 1,
      })),
    ),
  )
  await t.upsert(
    'payments',
    INVOICES.flatMap((i) => {
      const rows: Row[] = []
      if (i.paid)
        rows.push({
          id: sid('payment', i.key),
          student_id: studentId[i.student],
          invoice_id: sid('invoice', i.key),
          amount: i.paid[0],
          currency: 'GBP',
          status: 'paid',
          method: i.paid[1],
          provider: 'manual',
          provider_reference: `DEMO-${i.key.toUpperCase()}`,
          paid_at: daysFromNow(i.paid[2]),
          recorded_by: profileId.admin,
        })
      if (i.failed)
        rows.push({
          id: sid('payment', i.key),
          student_id: studentId[i.student],
          invoice_id: sid('invoice', i.key),
          amount: 120,
          currency: 'GBP',
          status: 'failed',
          method: 'card',
          provider: 'manual',
          provider_reference: `DEMO-${i.key.toUpperCase()}`,
          paid_at: null,
          recorded_by: profileId.admin,
          notes: 'Card declined by issuer (demo).',
        })
      return rows
    }),
  )
  for (const i of INVOICES) await t.rpc('recompute_invoice', { p_invoice_id: sid('invoice', i.key) })
  log(`${INVOICES.length} invoices and payments`)

  // ---------------------------------------------------------------- messages
  const THREADS = [
    {
      key: 'main-counselor',
      student: 'main',
      staff: 'counselor',
      subject: 'Your Northbridge application',
      category: 'counselor',
      messages: [
        ['main', 'Hi Priya, I uploaded my transcript. Is there anything else Northbridge needs?', -6],
        [
          'counselor',
          'Thanks Nimali — the transcript is approved. They also need a bank statement dated within the last 31 days.',
          -5,
        ],
        ['main', 'Understood, I will request one from my bank this week.', -5],
        [
          'counselor',
          'Great. I also booked a call for Thursday to go through your Westmere offer conditions. See your calendar.',
          -1,
        ],
      ],
      studentReadThrough: 2,
    },
    {
      key: 'main-instructor',
      student: 'main',
      staff: 'instructor',
      subject: 'Writing Task 1 feedback',
      category: 'instructor',
      messages: [
        [
          'instructor',
          'Nice work on Task 1. Focus on grouping trends — I left detailed feedback on the assignment.',
          -2,
        ],
        ['main', 'Thank you! I will apply that in Task 2.', -2],
      ],
      studentReadThrough: 2,
    },
    {
      key: 'aisha-counselor',
      student: 'aisha',
      staff: 'counselor',
      subject: 'IELTS certificate',
      category: 'counselor',
      messages: [['aisha', 'I have uploaded my IELTS certificate.', -2]],
      studentReadThrough: 1,
    },
    {
      key: 'chidi-counselor',
      student: 'chidi',
      staff: 'counselor',
      subject: 'TB test booking',
      category: 'counselor',
      messages: [
        ['counselor', 'Your CAS is issued. Please book your TB test at an approved clinic.', -4],
        ['chidi', 'Booked for next Monday.', -3],
      ],
      studentReadThrough: 2,
    },
  ] as const
  for (const th of THREADS) {
    const threadId = sid('thread', th.key)
    const msgs = th.messages.map(([who, body, d], i) => ({
      id: sid('message', th.key, i),
      thread_id: threadId,
      sender_id: profileId[who],
      body,
      created_at: daysFromNow(d, 9 + i),
    }))
    await t.upsert('message_threads', [
      {
        id: threadId,
        subject: th.subject,
        category: th.category,
        student_id: studentId[th.student],
        created_by: profileId[th.messages[0][0]],
        created_at: msgs[0].created_at,
        last_message_at: msgs[msgs.length - 1].created_at,
      },
    ])
    // messages first: the insert trigger marks the sender as having read the thread "now"
    await t.upsert('messages', msgs)
    await t.upsert(
      'thread_participants',
      [
        {
          thread_id: threadId,
          profile_id: profileId[th.student],
          last_read_at: msgs[th.studentReadThrough - 1].created_at,
        },
        {
          thread_id: threadId,
          profile_id: profileId[th.staff],
          last_read_at: msgs[msgs.length - 1].created_at,
        },
      ],
      'thread_id,profile_id',
    )
    await t.update(
      'message_threads',
      { last_message_at: msgs[msgs.length - 1].created_at },
      { eq: { id: threadId } },
    )
  }
  log(`${THREADS.length} conversations`)

  // ---------------------------------------------------------------- calendar, tasks, support, FAQs
  await t.upsert(
    'calendar_events',
    [
      {
        id: sid('event-cal', 'main-meeting'),
        title: 'Counselor call: Westmere offer conditions',
        event_type: 'counselor_meeting',
        starts_at: daysFromNow(3, 10),
        ends_at: daysFromNow(3, 11),
        meeting_url: 'https://meet.example.com/demo-nimali',
        student_id: studentId.main,
        created_by: profileId.counselor,
      },
      {
        id: sid('event-cal', 'ielts-mock'),
        title: 'IELTS full mock test',
        event_type: 'exam',
        starts_at: daysFromNow(9, 9),
        ends_at: daysFromNow(9, 12),
        location: 'Online test centre',
        course_id: courseId('ielts'),
        created_by: profileId.instructor,
      },
      {
        id: sid('event-cal', 'speaking-class'),
        title: 'Live class: Speaking Part 2 practice',
        event_type: 'class',
        starts_at: daysFromNow(2, 14),
        ends_at: daysFromNow(2, 15),
        meeting_url: 'https://meet.example.com/demo-class',
        course_id: courseId('ielts'),
        created_by: profileId.instructor,
      },
      {
        id: sid('event-cal', 'northbridge-deadline'),
        title: 'Northbridge: documents deadline',
        event_type: 'university_deadline',
        starts_at: daysFromNow(14, 17),
        all_day: true,
        application_id: appId('main-northbridge'),
        student_id: studentId.main,
        created_by: profileId.counselor,
      },
      {
        id: sid('event-cal', 'main-visa'),
        title: 'Target date: UK visa submission',
        event_type: 'visa_deadline',
        starts_at: daysFromNow(40, 9),
        all_day: true,
        student_id: studentId.main,
        created_by: profileId.counselor,
      },
      {
        id: sid('event-cal', 'main-payment'),
        title: 'Invoice due: UK visa application support',
        event_type: 'payment_deadline',
        starts_at: daysFromNow(10, 9),
        all_day: true,
        student_id: studentId.main,
        created_by: profileId.admin,
      },
      {
        id: sid('event-cal', 'webinar'),
        title: 'Webinar: Pre-departure briefing',
        event_type: 'class',
        starts_at: daysFromNow(6, 16),
        ends_at: daysFromNow(6, 17),
        meeting_url: 'https://meet.example.com/demo-webinar',
        is_public: true,
        created_by: profileId.admin,
      },
    ].map((e) => ({
      ends_at: null,
      all_day: false,
      location: null,
      meeting_url: null,
      student_id: null,
      course_id: null,
      application_id: null,
      is_public: false,
      ...e,
    })),
  )
  await t.upsert(
    'student_tasks',
    [
      {
        id: sid('task', 'main', 'bank'),
        student_id: studentId.main,
        title: 'Upload an updated bank statement',
        description: 'Dated within the last 31 days, showing 28 days of funds.',
        link: '/app/documents',
        due_at: daysFromNow(7),
        status: 'todo',
        created_by: profileId.counselor,
      },
      {
        id: sid('task', 'main', 'sop'),
        student_id: studentId.main,
        title: 'Revise your statement of purpose',
        description: 'Under 1,000 words; mention two course modules.',
        link: '/app/documents',
        due_at: daysFromNow(5),
        status: 'todo',
        created_by: profileId.counselor,
      },
      {
        id: sid('task', 'main', 'writing'),
        student_id: studentId.main,
        title: 'Finish the IELTS Writing module',
        link: '/app/learning',
        due_at: daysFromNow(6),
        status: 'todo',
        created_by: profileId.instructor,
      },
      {
        id: sid('task', 'main', 'profile'),
        student_id: studentId.main,
        title: 'Add an emergency contact',
        link: '/app/profile',
        status: 'todo',
        created_by: profileId.main,
      },
      {
        id: sid('task', 'main', 'passport'),
        student_id: studentId.main,
        title: 'Upload passport',
        status: 'done',
        created_by: profileId.counselor,
      },
    ].map((r) => ({ description: null, link: null, due_at: null, ...r })),
  )
  const ticketId = sid('ticket', 'main-deposit')
  await t.upsert('support_tickets', [
    {
      id: ticketId,
      student_id: studentId.main,
      created_by: profileId.main,
      subject: 'Is the Westmere deposit refundable?',
      category: 'payments',
      priority: 'medium',
      description:
        'If my visa is refused, will I get the tuition deposit back? I could not find it in the offer letter.',
      status: 'in_progress',
      assigned_to: profileId.admin,
      created_at: daysFromNow(-2),
    },
  ])
  await t.upsert('ticket_replies', [
    {
      id: sid('ticket-reply', 'main-deposit', 1),
      ticket_id: ticketId,
      author_id: profileId.admin,
      body: 'Good question — Westmere refunds the deposit minus a £250 fee on visa refusal. I am confirming the latest policy with them and will update you here.',
      created_at: daysFromNow(-1),
    },
  ])
  await t.upsert(
    'faqs',
    FAQS.map(([category, question, answer], i) => ({
      id: sid('faq', i),
      category,
      question,
      answer,
      position: i + 1,
      is_published: true,
    })),
  )

  // ---------------------------------------------------------------- notifications
  const N = (
    key: string,
    who: string,
    type: string,
    title: string,
    body: string,
    link: string,
    daysAgo: number,
    read: boolean,
  ) => ({
    id: sid('notification', key),
    recipient_id: profileId[who],
    type,
    title,
    body,
    link,
    is_read: read,
    read_at: read ? daysFromNow(-daysAgo + 1) : null,
    created_at: daysFromNow(-daysAgo, 12),
  })
  const fixedNotifications = [
    N(
      'main-bank',
      'main',
      'document_rejected',
      'Bank Statement needs resubmission',
      'The statement is older than 31 days and does not show funds held for 28 consecutive days.',
      '/app/documents',
      8,
      false,
    ),
    N(
      'main-sop',
      'main',
      'document_rejected',
      'Statement of Purpose rejected',
      'The statement exceeds 1,000 words and does not mention the course modules.',
      '/app/documents',
      5,
      false,
    ),
    N(
      'main-offer',
      'main',
      'university_offer',
      'New offer from Westmere University',
      'You received a conditional offer. Review it in My Applications.',
      '/app/applications',
      4,
      false,
    ),
    N(
      'main-graded',
      'main',
      'assignment_graded',
      'Assignment graded: Writing Task 1',
      'Your grade: 72',
      '/app/assignments',
      2,
      true,
    ),
    N(
      'main-passport',
      'main',
      'document_approved',
      'Passport approved',
      'Your Passport has been verified.',
      '/app/documents',
      21,
      true,
    ),
    N(
      'main-docs',
      'main',
      'application_status',
      'Application update: Northbridge University',
      'Status changed to Documents Required.',
      '/app/applications',
      18,
      true,
    ),
    N(
      'main-due',
      'main',
      'payment_due',
      'Invoice issued: UK visa application support',
      'Due in 10 days.',
      '/app/payments',
      4,
      false,
    ),
    N(
      'counselor-aisha',
      'counselor',
      'new_message',
      'New message from Aisha Rahman',
      'I have uploaded my IELTS certificate.',
      '/admin/messages',
      2,
      false,
    ),
    N(
      'instructor-sub',
      'instructor',
      'system',
      'New submission: Writing Task 2',
      'Kavindu Jayasinghe submitted an essay for review.',
      '/admin/assignments',
      1,
      false,
    ),
  ]
  await t.upsert('notifications', fixedNotifications)
  // Triggers may add notifications on first insert (payments, messages). Keep the demo inbox predictable.
  await t.delete('notifications', {
    in: { recipient_id: Object.values(profileId) },
    notIn: { id: fixedNotifications.map((n) => n.id) },
  })
  log('calendar, tasks, support ticket, FAQs, notifications')

  console.log(
    `\nDone. Sign in with any demo account (password: ${process.env.SEED_DEMO_PASSWORD ? '<SEED_DEMO_PASSWORD>' : PASSWORD}):`,
  )
  for (const s of STAFF) console.log(`  ${s.role.padEnd(12)} ${s.key}@${DEMO_DOMAIN}`)
  console.log(`  ${'student'.padEnd(12)} ${STUDENTS[0].email}  (+ ${STUDENTS.length - 1} more students)`)
}

const target = createTarget()
seed(target)
  .then(() => target.close())
  .catch(async (e) => {
    console.error(`\nSeed failed: ${e instanceof Error ? e.message : e}`)
    await target.close()
    process.exit(1)
  })
