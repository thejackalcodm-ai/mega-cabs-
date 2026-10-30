-- =============================================================================
-- 0011 · Indexes on every remaining foreign key (joins, cascades, RLS lookups)
-- =============================================================================
create index if not exists account_deletion_requests_processed_by_idx on public.account_deletion_requests (processed_by);
create index if not exists account_deletion_requests_profile_id_idx on public.account_deletion_requests (profile_id);
create index if not exists application_documents_document_type_id_idx on public.application_documents (document_type_id);
create index if not exists application_events_actor_id_idx on public.application_events (actor_id);
create index if not exists applications_created_by_idx on public.applications (created_by);
create index if not exists applications_program_id_idx on public.applications (program_id);
create index if not exists assignment_submissions_graded_by_idx on public.assignment_submissions (graded_by);
create index if not exists assignments_created_by_idx on public.assignments (created_by);
create index if not exists assignments_module_id_idx on public.assignments (module_id);
create index if not exists calendar_events_application_id_idx on public.calendar_events (application_id);
create index if not exists calendar_events_created_by_idx on public.calendar_events (created_by);
create index if not exists courses_created_by_idx on public.courses (created_by);
create index if not exists courses_instructor_id_idx on public.courses (instructor_id);
create index if not exists document_requirements_document_type_id_idx on public.document_requirements (document_type_id);
create index if not exists document_reviews_reviewer_id_idx on public.document_reviews (reviewer_id);
create index if not exists document_types_created_by_idx on public.document_types (created_by);
create index if not exists document_versions_uploaded_by_idx on public.document_versions (uploaded_by);
create index if not exists documents_reviewer_id_idx on public.documents (reviewer_id);
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by);
create index if not exists invoices_application_id_idx on public.invoices (application_id);
create index if not exists invoices_created_by_idx on public.invoices (created_by);
create index if not exists learning_activity_course_id_idx on public.learning_activity (course_id);
create index if not exists lesson_progress_course_id_idx on public.lesson_progress (course_id);
create index if not exists lesson_progress_lesson_id_idx on public.lesson_progress (lesson_id);
create index if not exists lesson_resources_course_id_idx on public.lesson_resources (course_id);
create index if not exists message_threads_created_by_idx on public.message_threads (created_by);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists payments_recorded_by_idx on public.payments (recorded_by);
create index if not exists quizzes_module_id_idx on public.quizzes (module_id);
create index if not exists saved_universities_university_id_idx on public.saved_universities (university_id);
create index if not exists student_tasks_created_by_idx on public.student_tasks (created_by);
create index if not exists support_tickets_assigned_to_idx on public.support_tickets (assigned_to);
create index if not exists support_tickets_created_by_idx on public.support_tickets (created_by);
create index if not exists ticket_replies_author_id_idx on public.ticket_replies (author_id);
create index if not exists user_roles_granted_by_idx on public.user_roles (granted_by);
