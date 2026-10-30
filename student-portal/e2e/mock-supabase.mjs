/**
 * TEST DOUBLE for the Supabase Auth, PostgREST and Storage endpoints the app uses, so the real
 * React app can run end to end in a browser without a Supabase project.
 *
 * It imitates behaviour (filters, upserts, embeds, RPCs, per-role row scoping, the storage
 * "grant before signing" rule) closely enough to exercise the UI. It is NOT a security boundary
 * and proves nothing about RLS: that is what supabase/tests/rls.test.sql and verify:live are for.
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PASSWORD = 'Demo#Pass123'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (user) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
const now = () => new Date().toISOString()
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString()
const dateIn = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10)

/** supabase-js sends Blob uploads as multipart/form-data; keep only the file part's bytes. */
function fileBytes(raw, contentType = '') {
  const m = contentType.match(/boundary=(.+)$/)
  if (!m) return raw
  const boundary = Buffer.from(`--${m[1]}`)
  const parts = []
  let start = raw.indexOf(boundary)
  while (start !== -1) {
    const next = raw.indexOf(boundary, start + boundary.length)
    if (next === -1) break
    parts.push(raw.subarray(start + boundary.length, next))
    start = next
  }
  const file = parts.sort((a, b) => b.length - a.length)[0] ?? raw
  const body = file.subarray(file.indexOf('\r\n\r\n') + 4)
  return body.subarray(0, body.length - 2)
}

export function createMock() {
  // ------------------------------------------------------------------ users & roles
  const users = new Map()
  const addUser = (email, role, first, last, extra = {}) => {
    const id = randomUUID()
    users.set(email, {
      id,
      email,
      password: PASSWORD,
      role,
      first,
      last,
      confirmed: true,
      active: true,
      ...extra,
    })
    return users.get(email)
  }
  const sa = addUser('superadmin@demo.portal', 'super_admin', 'Sofia', 'Reyes')
  const ad = addUser('admin@demo.portal', 'admin', 'Daniel', 'Okafor')
  const co = addUser('counselor@demo.portal', 'counselor', 'Priya', 'Raman')
  const ins = addUser('instructor@demo.portal', 'instructor', 'Marcus', 'Bell')
  const st = addUser('student@demo.portal', 'student', 'Nimali', 'Fernando', {
    phone: '+94 77 000 1001',
    country: 'Sri Lanka',
  })
  const kv = addUser('kavindu.jayasinghe@demo.portal', 'student', 'Kavindu', 'Jayasinghe', {
    country: 'Sri Lanka',
  })
  const fh = addUser('farhan.siddiqui@demo.portal', 'student', 'Farhan', 'Siddiqui', { country: 'Pakistan' })
  const nw = addUser('new.student@demo.portal', 'student', 'Asha', 'Newman', {
    country: 'Kenya',
    phone: '+254 700 000 111',
  })
  addUser('unverified@demo.portal', 'student', 'Una', 'Verified', { confirmed: false })
  addUser('inactive@demo.portal', 'student', 'Ina', 'Active', { active: false })

  // ------------------------------------------------------------------ tables
  const db = {
    staff: [sa, ad, co, ins].map((u) => ({ id: `staff-${u.id}`, profile_id: u.id })),
    students: [],
    student_profiles: [],
    education_records: [],
    english_tests: [],
    work_experience: [],
    document_types: [
      ['passport', 'identity', 'Passport', true],
      ['national_id', 'identity', 'National ID', true],
      ['transcript', 'education', 'Transcript', false],
      ['degree_certificate', 'education', 'Degree Certificate', false],
      ['sop', 'education', 'Statement of Purpose', false],
      ['ielts', 'english_language', 'IELTS Certificate', true],
      ['bank_statement', 'financial', 'Bank Statement', true],
      ['offer_letter', 'university', 'Offer Letter', false],
      ['tb_certificate', 'visa', 'TB Certificate', true],
      ['other', 'other', 'Other Document', false],
    ].map(([key, category, name, has_expiry]) => ({
      id: `type-${key}`,
      key,
      category,
      name,
      has_expiry,
      is_custom: false,
      description: null,
      created_by: null,
      created_at: now(),
    })),
    documents: [],
    document_versions: [],
    document_reviews: [],
    applications: [],
    universities: [{ id: 'uni-northbridge', name: 'Northbridge University', country: 'United Kingdom' }],
    programs: [{ id: 'prog-ds', name: 'MSc Data Science' }],
  }
  const REQUIREMENTS = {
    'United Kingdom': ['passport', 'transcript', 'ielts', 'offer_letter', 'bank_statement'],
  }
  const counselorStaff = `staff-${co.id}`
  const addStudent = (u, number, counselor, extra = {}) => {
    const s = {
      id: `stu-${u.id}`,
      profile_id: u.id,
      student_number: number,
      counselor_id: counselor,
      created_at: daysAgo(30),
      onboarding_step: 7,
      onboarding_completed: true,
      preferred_destinations: ['United Kingdom'],
      preferred_study_level: 'postgraduate',
      preferred_intake: 'September 2027',
      preferred_subjects: ['Data Science'],
      budget_max: null,
      application_goals: 'Study data science in the UK and work in health-tech analytics.',
      ...extra,
    }
    db.students.push(s)
    return s
  }
  const sMain = addStudent(st, 'STU-1001', counselorStaff)
  const sKav = addStudent(kv, 'STU-1002', counselorStaff)
  addStudent(fh, 'STU-1008', null)
  const sNew = addStudent(nw, 'STU-1020', counselorStaff, {
    onboarding_step: 1,
    onboarding_completed: false,
    preferred_destinations: [],
    preferred_study_level: null,
    preferred_intake: null,
    preferred_subjects: [],
    application_goals: null,
  })
  db.student_profiles.push({
    student_id: sMain.id,
    date_of_birth: '2000-04-12',
    gender: 'Female',
    nationality: 'Sri Lankan',
    passport_number: 'N0000001',
    passport_expiry: dateIn(1600),
    national_id: null,
    whatsapp: null,
    address_line: null,
    city: 'Colombo',
    country: 'Sri Lanka',
    emergency_name: null,
    emergency_relationship: null,
    emergency_phone: null,
    emergency_email: null,
  })
  db.education_records.push({
    id: randomUUID(),
    student_id: sMain.id,
    institution: 'University of Colombo (demo)',
    qualification: "Bachelor's degree",
    field_of_study: 'Computer Science',
    start_date: '2018-09-01',
    end_date: '2022-07-31',
    grade: 'First Class',
    graduation_year: 2022,
  })
  db.english_tests.push({
    id: randomUUID(),
    student_id: sMain.id,
    test_type: 'ielts',
    test_name: null,
    overall: 7,
    listening: 7.5,
    reading: 7,
    writing: 6.5,
    speaking: 7,
    test_date: '2026-06-01',
  })
  db.applications.push({
    id: 'app-main',
    reference: 'APP-2026-00001',
    student_id: sMain.id,
    status: 'documents_required',
    intake: 'September 2027',
    university_id: 'uni-northbridge',
    program_id: 'prog-ds',
    created_at: daysAgo(20),
  })

  const objects = new Map() // bucket/path -> { bytes, type }
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
  const addDoc = (student, typeKey, status, extra = {}) => {
    const type = db.document_types.find((t) => t.key === typeKey)
    const id = randomUUID()
    const path = `${student.id}/${type.category}/${randomUUID()}-${typeKey}.pdf`
    objects.set(`student-documents/${path}`, { bytes: PDF, type: 'application/pdf' })
    const doc = {
      id,
      student_id: student.id,
      document_type_id: type.id,
      category: type.category,
      custom_type_name: null,
      file_path: path,
      file_name: `${typeKey}.pdf`,
      file_size: PDF.length,
      mime_type: 'application/pdf',
      status,
      version: 1,
      uploaded_by: student.profile_id,
      uploaded_at: daysAgo(5),
      reviewer_id: status === 'uploaded' ? null : co.id,
      reviewer_comment: null,
      rejection_reason: null,
      required_action: null,
      reviewed_at: status === 'uploaded' ? null : daysAgo(4),
      verified_at: status === 'approved' ? daysAgo(4) : null,
      expiry_date: type.has_expiry ? dateIn(500) : null,
      created_at: daysAgo(5),
      updated_at: daysAgo(5),
      ai_classification: null,
      ...extra,
    }
    db.documents.push(doc)
    db.document_versions.push({
      id: randomUUID(),
      document_id: id,
      version: 1,
      file_path: path,
      file_name: doc.file_name,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      uploaded_by: student.profile_id,
      created_at: doc.uploaded_at,
    })
    if (status !== 'uploaded')
      db.document_reviews.push({
        id: randomUUID(),
        document_id: id,
        version: 1,
        reviewer_id: co.id,
        action: status,
        reason: extra.rejection_reason ?? null,
        comment: extra.reviewer_comment ?? null,
        created_at: daysAgo(4),
      })
    return doc
  }
  addDoc(sMain, 'passport', 'approved', { reviewer_comment: 'Clear scan, all pages present.' })
  addDoc(sMain, 'bank_statement', 'resubmission_required', {
    rejection_reason: 'The statement is older than 31 days.',
    required_action: 'Upload a statement dated within the last 31 days.',
    reviewer_comment: 'Ask your bank for a stamped statement.',
  })
  addDoc(sMain, 'ielts', 'under_review')
  addDoc(sKav, 'passport', 'uploaded')

  const grants = [] // { profileId, path, expires }
  const failures = new Map() // table name -> number of upcoming GETs that return HTTP 500 (error-state tests)
  const audit = []
  const tokens = new Map()
  const calls = []

  // ------------------------------------------------------------------ access helpers (imitate RLS)
  const byId = (id) => [...users.values()].find((u) => u.id === id)
  const studentOf = (u) => db.students.find((s) => s.profile_id === u.id)
  const canAccessStudent = (me, sid) => {
    if (!me || !me.active) return false
    if (me.role === 'student') return studentOf(me)?.id === sid
    if (me.role === 'counselor')
      return db.students.find((s) => s.id === sid)?.counselor_id === `staff-${me.id}`
    return me.role === 'admin' || me.role === 'super_admin'
  }
  const docOf = (id) => db.documents.find((d) => d.id === id)
  const visible = {
    students: (me, r) => canAccessStudent(me, r.id),
    profiles: (me, r) =>
      r.id === me.id ||
      r.role !== 'student' ||
      db.students.some((s) => s.profile_id === r.id && canAccessStudent(me, s.id)),
    staff: () => true,
    document_types: () => true,
    universities: () => true,
    programs: () => true,
    document_versions: (me, r) => canAccessStudent(me, docOf(r.document_id)?.student_id),
    document_reviews: (me, r) => canAccessStudent(me, docOf(r.document_id)?.student_id),
  }
  const isVisible = (table, me, row) =>
    visible[table] ? visible[table](me, row) : canAccessStudent(me, row.student_id)
  const profileRows = () =>
    [...users.values()].map((u) => ({
      id: u.id,
      email: u.email,
      first_name: u.first,
      last_name: u.last,
      phone: u.phone ?? null,
      country: u.country ?? null,
      avatar_url: null,
      is_active: u.active,
      role: u.role,
    }))
  const tableRows = (name) => (name === 'profiles' ? profileRows() : db[name])

  const checklistItems = () =>
    db.applications.flatMap((a) => {
      const uni = db.universities.find((u) => u.id === a.university_id)
      return (REQUIREMENTS[uni.country] ?? []).map((key, i) => {
        const type = db.document_types.find((t) => t.key === key)
        const doc = db.documents
          .filter((d) => d.student_id === a.student_id && d.document_type_id === type.id)
          .sort((x, y) => y.uploaded_at.localeCompare(x.uploaded_at))[0]
        const expired = doc && (doc.status === 'expired' || (doc.expiry_date && doc.expiry_date < dateIn(0)))
        const item_state = !doc
          ? 'missing'
          : expired
            ? 'expired'
            : ['rejected', 'resubmission_required'].includes(doc.status)
              ? 'rejected'
              : doc.status === 'approved'
                ? 'complete'
                : 'pending'
        return {
          id: `${a.id}-${key}`,
          application_id: a.id,
          student_id: a.student_id,
          document_type_id: type.id,
          document_name: type.name,
          category: type.category,
          is_required: true,
          sort_order: i,
          note: null,
          document_id: doc?.id ?? null,
          document_status: doc?.status ?? null,
          expiry_date: doc?.expiry_date ?? null,
          item_state,
        }
      })
    })
  const viewRows = {
    application_checklist: checklistItems,
    application_checklist_summary: () => {
      const items = checklistItems()
      return db.applications.map((a) => {
        const mine = items.filter((i) => i.application_id === a.id)
        return {
          application_id: a.id,
          student_id: a.student_id,
          completion_percent: mine.length
            ? Math.round((100 * mine.filter((i) => i.item_state === 'complete').length) / mine.length)
            : 100,
        }
      })
    },
    my_threads: () => [],
  }

  function profileCompletion(me) {
    const s = studentOf(me)
    const d = db.student_profiles.find((p) => p.student_id === s.id) ?? {}
    const has = (v) => v !== null && v !== undefined && String(v).trim() !== ''
    const items = [
      ['first_name', 'First name', 'personal', has(me.first)],
      ['last_name', 'Last name', 'personal', has(me.last)],
      ['date_of_birth', 'Date of birth', 'personal', has(d.date_of_birth)],
      ['gender', 'Gender', 'personal', has(d.gender)],
      ['nationality', 'Nationality', 'personal', has(d.nationality)],
      ['passport_number', 'Passport number', 'passport', has(d.passport_number)],
      ['passport_expiry', 'Passport expiry date', 'passport', has(d.passport_expiry)],
      ['phone', 'Phone number', 'contact', has(me.phone)],
      ['address', 'Home address', 'contact', has(d.address_line) && has(d.city)],
      ['country', 'Country of residence', 'contact', has(d.country ?? me.country)],
      [
        'education',
        'At least one education record',
        'education',
        db.education_records.some((r) => r.student_id === s.id),
      ],
      [
        'english_test',
        'English language test',
        'english',
        db.english_tests.some((r) => r.student_id === s.id),
      ],
      [
        'destinations',
        'Preferred study destination',
        'preferences',
        (s.preferred_destinations ?? []).length > 0,
      ],
      ['study_level', 'Preferred study level', 'preferences', has(s.preferred_study_level)],
      ['goals', 'Application goals', 'goals', has(s.application_goals)],
      [
        'emergency_contact',
        'Emergency contact',
        'emergency',
        has(d.emergency_name) && has(d.emergency_phone),
      ],
    ]
    const done = items.filter((i) => i[3]).length
    return {
      percent: Math.round((done * 100) / items.length),
      completed: done,
      total: items.length,
      missing: items.filter((i) => !i[3]).map(([key, label, section]) => ({ key, label, section })),
    }
  }

  // ------------------------------------------------------------------ PostgREST query handling
  const parseValue = (v) => (v === 'true' ? true : v === 'false' ? false : v === 'null' ? null : v)
  function applyFilters(rows, params) {
    for (const [col, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(col)) continue
      if (col === 'or') {
        const parts = raw
          .replace(/^\(|\)$/g, '')
          .split(',')
          .map((p) => p.split('.'))
        rows = rows.filter((r) => parts.some(([c, , v]) => String(r[c]) === v))
        continue
      }
      const m = raw.match(/^(not\.)?(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/)
      if (!m) continue
      const [, neg, op, val] = m
      const test = (r) => {
        const x = r[col]
        switch (op) {
          case 'eq':
            return String(x) === val
          case 'neq':
            return String(x) !== val
          case 'gt':
            return Number(x) > Number(val)
          case 'gte':
            return Number(x) >= Number(val)
          case 'lt':
            return Number(x) < Number(val)
          case 'lte':
            return Number(x) <= Number(val)
          case 'in':
            return val
              .replace(/^\(|\)$/g, '')
              .split(',')
              .map((s) => s.replace(/^"|"$/g, ''))
              .includes(String(x))
          case 'is':
            return val === 'null' ? x === null || x === undefined : x === parseValue(val)
        }
      }
      rows = rows.filter((r) => (neg ? !test(r) : test(r)))
    }
    const order = params.get('order')
    if (order) {
      const [col, dir] = order.split(',')[0].split('.')
      rows = [...rows].sort(
        (a, b) =>
          String(a[col] ?? '').localeCompare(String(b[col] ?? ''), undefined, { numeric: true }) *
          (dir === 'desc' ? -1 : 1),
      )
    }
    const limit = Number(params.get('limit'))
    return limit ? rows.slice(0, limit) : rows
  }
  function embed(table, rows, select) {
    return rows.map((r) => {
      const out = { ...r }
      if (table === 'students') {
        const u = byId(r.profile_id)
        out.profile = {
          first_name: u.first,
          last_name: u.last,
          email: u.email,
          country: u.country ?? null,
          is_active: u.active,
        }
        const staff = db.staff.find((s) => s.id === r.counselor_id)
        out.counselor = staff
          ? { profile: { first_name: byId(staff.profile_id).first, last_name: byId(staff.profile_id).last } }
          : null
      }
      if (table === 'documents' && select.includes('student:')) {
        const s = db.students.find((x) => x.id === r.student_id)
        const u = byId(s.profile_id)
        out.student = {
          student_number: s.student_number,
          profile: { first_name: u.first, last_name: u.last },
        }
      }
      if (table === 'applications') {
        const uni = db.universities.find((u) => u.id === r.university_id)
        out.university = { name: uni.name, country: uni.country }
        out.program = db.programs.find((p) => p.id === r.program_id) ?? null
      }
      if (table === 'courses') out.enrollments = [{ count: r.enrolled ?? 0 }]
      return out
    })
  }
  const COURSES = [
    {
      id: 'c1',
      title: 'IELTS Academic Complete',
      status: 'published',
      updated_at: '2026-10-28T10:00:00Z',
      instructor_id: ins.id,
      enrolled: 7,
    },
    {
      id: 'c5',
      title: 'Academic Writing Masterclass',
      status: 'draft',
      updated_at: '2026-10-29T10:00:00Z',
      instructor_id: ins.id,
      enrolled: 0,
    },
  ]
  const PERMS = {
    counselor: ['applications.manage', 'calendar.manage', 'documents.review', 'students.view_assigned'],
    instructor: ['calendar.manage', 'courses.manage'],
    admin: [
      'applications.manage',
      'audit.view',
      'courses.manage',
      'documents.review',
      'payments.manage',
      'reports.view',
      'students.manage',
      'students.view_all',
    ],
  }
  const NOTIFICATIONS = [
    {
      id: '1',
      type: 'document_rejected',
      title: 'Bank Statement needs resubmission',
      body: 'The statement is older than 31 days.',
      link: '/app/documents',
      is_read: false,
      created_at: daysAgo(1),
    },
    {
      id: '2',
      type: 'university_offer',
      title: 'New offer from Westmere University',
      body: 'You received a conditional offer.',
      link: '/app/applications',
      is_read: false,
      created_at: daysAgo(2),
    },
    {
      id: '3',
      type: 'document_approved',
      title: 'Passport approved',
      body: null,
      link: '/app/documents',
      is_read: true,
      created_at: daysAgo(9),
    },
  ]
  const fail = (code, message, status = 400) => ({
    status,
    body: { code, message, details: null, hint: null },
  })

  // ------------------------------------------------------------------ RPCs (imitate the database functions)
  const rpcs = {
    log_client_event: () => ({ status: 204 }),
    profile_completion: (me) => ({ status: 200, body: profileCompletion(me) }),
    save_onboarding_progress: (me, a) => {
      const s = studentOf(me)
      s.onboarding_step = Math.max(s.onboarding_step, a.p_step)
      s.onboarding_completed = s.onboarding_completed || !!a.p_completed
      return { status: 204 }
    },
    authorize_document_access: (me, a) => {
      const d = docOf(a.p_document_id)
      if (!d || !canAccessStudent(me, d.student_id)) return fail('42501', 'Document not found', 403)
      const v = db.document_versions.find(
        (x) => x.document_id === d.id && x.version === (a.p_version ?? d.version),
      )
      if (!v) return fail('22023', 'Version not found')
      grants.push({ profileId: me.id, path: v.file_path, expires: Date.now() + 120_000 })
      audit.push({
        action: a.p_purpose === 'download' ? 'document.downloaded' : 'document.viewed',
        documentId: d.id,
        actor: me.email,
        version: v.version,
      })
      return {
        status: 200,
        body: [
          { file_path: v.file_path, file_name: v.file_name, mime_type: v.mime_type, version: v.version },
        ],
      }
    },
    replace_document: (me, a) => {
      const d = docOf(a.p_document_id)
      if (!d || !canAccessStudent(me, d.student_id)) return fail('42501', 'Document not found', 403)
      if (d.status === 'approved' && me.role === 'student')
        return fail('42501', 'Approved documents cannot be replaced. Contact your counselor.', 403)
      Object.assign(d, {
        file_path: a.p_file_path,
        file_name: a.p_file_name,
        file_size: a.p_file_size,
        mime_type: a.p_mime_type,
        version: d.version + 1,
        status: 'uploaded',
        uploaded_at: now(),
        rejection_reason: null,
        required_action: null,
        verified_at: null,
        reviewer_id: null,
        reviewer_comment: null,
        reviewed_at: null,
        expiry_date: a.p_expiry_date ?? d.expiry_date,
      })
      db.document_versions.push({
        id: randomUUID(),
        document_id: d.id,
        version: d.version,
        file_path: d.file_path,
        file_name: d.file_name,
        file_size: d.file_size,
        mime_type: d.mime_type,
        uploaded_by: me.id,
        created_at: now(),
      })
      audit.push({ action: 'document.replaced', documentId: d.id, actor: me.email, version: d.version })
      return { status: 200, body: d }
    },
    delete_document: (me, a) => {
      const d = docOf(a.p_document_id)
      if (!d || !canAccessStudent(me, d.student_id)) return fail('42501', 'Document not found', 403)
      if (!['admin', 'super_admin'].includes(me.role) && ['approved', 'under_review'].includes(d.status))
        return fail(
          '42501',
          'Approved documents and documents under review cannot be deleted. Contact your counselor.',
          403,
        )
      const paths = db.document_versions.filter((v) => v.document_id === d.id).map((v) => v.file_path)
      db.documents = db.documents.filter((x) => x.id !== d.id)
      db.document_versions = db.document_versions.filter((v) => v.document_id !== d.id)
      audit.push({ action: 'document.deleted', documentId: d.id, actor: me.email })
      return { status: 200, body: paths }
    },
  }

  // ------------------------------------------------------------------ auth payloads
  const authUser = (u) => ({
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.confirmed ? now() : null,
    phone: '',
    app_metadata: { provider: 'email', role: u.role },
    user_metadata: { first_name: u.first, last_name: u.last },
    identities: [{ id: u.id, provider: 'email' }],
    created_at: now(),
    updated_at: now(),
  })
  const session = (u) => {
    const access_token = jwt(u)
    const refresh_token = randomUUID()
    tokens.set(access_token, u.id)
    tokens.set(`r:${refresh_token}`, u.id)
    return {
      access_token,
      refresh_token,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: authUser(u),
    }
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x')
    const cors = {
      'Access-Control-Allow-Origin': req.headers.origin ?? '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Range, X-Total-Count, Content-Disposition',
    }
    if (req.method === 'OPTIONS') return res.writeHead(204, cors).end()
    const chunks = []
    for await (const c of req) chunks.push(c)
    const raw = Buffer.concat(chunks)
    const isJson = (req.headers['content-type'] ?? '').includes('json')
    const json = isJson && raw.length ? JSON.parse(raw.toString()) : {}
    calls.push({
      method: req.method,
      path: u.pathname,
      query: u.search,
      body: isJson ? json : { bytes: raw.length },
    })
    const send = (status, data, headers = {}) => {
      res.writeHead(status, { ...cors, 'Content-Type': 'application/json', ...headers })
      res.end(data === undefined ? '' : JSON.stringify(data))
    }
    const bearer = (req.headers.authorization ?? '').replace('Bearer ', '')
    const me = byId(tokens.get(bearer))

    // ---------------- auth
    if (u.pathname === '/auth/v1/token') {
      if (u.searchParams.get('grant_type') === 'password') {
        const user = users.get(String(json.email).toLowerCase())
        if (!user || user.password !== json.password)
          return send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })
        if (!user.confirmed)
          return send(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' })
        return send(200, session(user))
      }
      const id = tokens.get(`r:${json.refresh_token}`)
      return id ? send(200, session(byId(id))) : send(400, { msg: 'Invalid Refresh Token' })
    }
    if (u.pathname === '/auth/v1/signup') {
      const email = String(json.email).toLowerCase()
      if (users.has(email)) return send(200, { ...authUser(users.get(email)), identities: [] })
      const md = json.data ?? {}
      const nu = addUser(email, 'student', md.first_name, md.last_name, { confirmed: false, metadata: md })
      return send(200, authUser(nu))
    }
    if (u.pathname === '/auth/v1/user' && req.method === 'GET')
      return me ? send(200, authUser(me)) : send(401, { msg: 'invalid JWT' })
    if (u.pathname === '/auth/v1/user' && req.method === 'PUT') {
      if (!me) return send(401, { msg: 'Auth session missing!' })
      if (json.password) me.password = json.password
      return send(200, authUser(me))
    }
    if (u.pathname === '/auth/v1/logout') {
      tokens.delete(bearer)
      return send(204)
    }
    if (u.pathname === '/auth/v1/recover' || u.pathname === '/auth/v1/resend') return send(200, {})

    // ---------------- storage
    const so = u.pathname.match(/^\/storage\/v1\/object\/(sign\/|public\/)?([^/]+)\/?(.*)$/)
    if (so) {
      const [, kind, bucket, rest] = so
      const path = decodeURIComponent(rest)
      const key = `${bucket}/${path}`
      if (kind === 'public/')
        return send(400, { statusCode: '400', error: 'Bucket not public', message: 'Bucket not found' })
      if (kind === 'sign/' && req.method === 'GET') {
        const obj = objects.get(key)
        if (!obj || u.searchParams.get('token') !== 'mock-signed')
          return send(400, { error: 'InvalidSignature', message: 'Invalid signature' })
        const headers = { ...cors, 'Content-Type': obj.type }
        if (u.searchParams.has('download'))
          headers['Content-Disposition'] =
            `attachment; filename="${u.searchParams.get('download') || 'file'}"`
        res.writeHead(200, headers)
        return res.end(obj.bytes)
      }
      if (!me)
        return send(400, {
          statusCode: '403',
          error: 'Unauthorized',
          message: 'new row violates row-level security policy',
        })
      if (kind === 'sign/' && req.method === 'POST') {
        const referenced = db.document_versions.some((v) => v.file_path === path)
        const owner = canAccessStudent(me, path.split('/')[0])
        const granted = grants.some((g) => g.profileId === me.id && g.path === path && g.expires > Date.now())
        if (!objects.has(key) || !(granted || (!referenced && owner)))
          return send(400, { statusCode: '404', error: 'not_found', message: 'Object not found' })
        return send(200, { signedURL: `/object/sign/${bucket}/${encodeURI(path)}?token=mock-signed` })
      }
      if (req.method === 'POST' || req.method === 'PUT') {
        if (!canAccessStudent(me, path.split('/')[0]))
          return send(400, {
            statusCode: '403',
            error: 'Unauthorized',
            message: 'new row violates row-level security policy',
          })
        if (raw.length > 10 * 1024 * 1024)
          return send(413, {
            statusCode: '413',
            error: 'Payload too large',
            message: 'The object exceeded the maximum allowed size',
          })
        objects.set(key, {
          bytes: fileBytes(raw, req.headers['content-type']),
          type: req.headers['content-type'],
        })
        return send(200, { Key: key, Id: randomUUID() })
      }
      if (req.method === 'DELETE') {
        const removed = (json.prefixes ?? []).filter(
          (p) =>
            !db.document_versions.some((v) => v.file_path === p) &&
            canAccessStudent(me, p.split('/')[0]) &&
            objects.delete(`${bucket}/${p}`),
        )
        return send(
          200,
          removed.map((name) => ({ name })),
        )
      }
    }

    // ---------------- rest
    const m = u.pathname.match(/^\/rest\/v1\/(rpc\/)?([a-z_]+)$/)
    if (!m) return send(404, { message: 'not found' })
    if (!me) return send(200, [])
    const [, rpc, name] = m
    if (rpc) {
      const fn = rpcs[name]
      if (!fn) return send(404, { message: 'unknown rpc' })
      const r = fn(me, json)
      return send(r.status, r.body)
    }

    const wantsObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
    const reply = (list) => {
      if (req.method === 'HEAD') return send(200, undefined, { 'Content-Range': `*/${list.length}` })
      if (wantsObject)
        return list.length === 1
          ? send(200, list[0])
          : send(406, {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
              details: 'The result contains 0 rows',
            })
      return send(200, list, { 'Content-Range': `0-${Math.max(list.length - 1, 0)}/${list.length}` })
    }
    const select = u.searchParams.get('select') ?? '*'

    // fixed / computed resources
    if (name === 'user_roles') return reply([{ role: me.role }])
    if (name === 'role_permissions')
      return reply((PERMS[me.role] ?? []).map((permission) => ({ permission })))
    if (name === 'notifications')
      return reply(me.email === 'student@demo.portal' ? applyFilters(NOTIFICATIONS, u.searchParams) : [])
    if (name === 'my_threads') return reply(me.email === 'student@demo.portal' ? [{ unread_count: 1 }] : [])
    if (name === 'courses') return reply(me.role === 'instructor' ? embed('courses', COURSES, select) : [])
    if (viewRows[name])
      return reply(
        applyFilters(
          viewRows[name]().filter((r) => canAccessStudent(me, r.student_id)),
          u.searchParams,
        ),
      )
    if (name === 'staff' && u.searchParams.get('profile_id'))
      return reply(me.role === 'student' ? [] : [{ id: `staff-${me.id}` }])

    if ((req.method === 'GET' || req.method === 'HEAD') && failures.get(name) > 0) {
      failures.set(name, failures.get(name) - 1)
      return send(500, { code: 'XX000', message: 'mock failure' })
    }
    const rows = tableRows(name)
    if (!rows) return send(404, { code: '42P01', message: `relation ${name} does not exist (mock)` })

    if (req.method === 'GET' || req.method === 'HEAD') {
      return reply(
        embed(
          name,
          applyFilters(
            rows.filter((r) => isVisible(name, me, r)),
            u.searchParams,
          ),
          select,
        ),
      )
    }

    const writable = (row) =>
      name === 'profiles'
        ? row.id === me.id || ['admin', 'super_admin'].includes(me.role)
        : isVisible(name, me, row)
    const rls = () =>
      send(403, { code: '42501', message: `new row violates row-level security policy for table "${name}"` })
    const returning = (req.headers.prefer ?? '').includes('return=representation')

    if (req.method === 'POST') {
      const input = Array.isArray(json) ? json : [json]
      const upsert = (req.headers.prefer ?? '').includes('resolution=merge-duplicates')
      const conflict = (u.searchParams.get('on_conflict') ?? 'id').split(',')
      const out = []
      for (const r of input) {
        if (!writable(r)) return rls()
        if (name === 'documents') {
          if (r.status && me.role === 'student') r.status = 'uploaded'
          const type = db.document_types.find((t) => t.id === r.document_type_id)
          if (r.file_path.split('/')[0] !== r.student_id || r.file_path.split('/')[1] !== type.category)
            return send(400, { code: '22023', message: 'Invalid storage path' })
          Object.assign(r, {
            id: randomUUID(),
            status: 'uploaded',
            version: 1,
            uploaded_at: now(),
            uploaded_by: me.id,
            created_at: now(),
            updated_at: now(),
            reviewer_id: null,
            reviewer_comment: null,
            rejection_reason: null,
            required_action: null,
            reviewed_at: null,
            verified_at: null,
          })
          db.document_versions.push({
            id: randomUUID(),
            document_id: r.id,
            version: 1,
            file_path: r.file_path,
            file_name: r.file_name,
            file_size: r.file_size,
            mime_type: r.mime_type,
            uploaded_by: me.id,
            created_at: now(),
          })
          audit.push({ action: 'document.uploaded', documentId: r.id, actor: me.email })
        }
        const existing = upsert && rows.find((x) => conflict.every((c) => String(x[c]) === String(r[c])))
        if (existing) {
          Object.assign(existing, r)
          out.push(existing)
        } else {
          const row = { id: randomUUID(), ...r }
          rows.push(row)
          out.push(row)
        }
      }
      if (!returning) return send(201)
      return wantsObject ? send(201, out[0]) : send(201, out)
    }
    if (req.method === 'PATCH') {
      const targets = applyFilters(
        rows.filter((r) => isVisible(name, me, r) && writable(r)),
        u.searchParams,
      )
      if (name === 'profiles')
        targets.forEach((t) => {
          const user = byId(t.id)
          Object.assign(user, {
            first: json.first_name ?? user.first,
            last: json.last_name ?? user.last,
            phone: json.phone ?? user.phone,
            country: json.country ?? user.country,
          })
        })
      else targets.forEach((t) => Object.assign(t, json))
      return returning ? send(200, targets) : send(204)
    }
    if (req.method === 'DELETE') {
      const targets = applyFilters(
        rows.filter((r) => isVisible(name, me, r) && writable(r)),
        u.searchParams,
      )
      db[name] = rows.filter((r) => !targets.includes(r))
      return returning ? send(200, targets) : send(204)
    }
    return send(405, { message: 'method not allowed' })
  })
  return { server, users, calls, db, audit, objects, grants, failures }
}
