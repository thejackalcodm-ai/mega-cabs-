-- =============================================================================
-- 0001 · Extensions & enumerated types
-- =============================================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create type public.app_role as enum ('student', 'counselor', 'instructor', 'admin', 'super_admin');

create type public.journey_stage as enum (
  'register', 'complete_profile', 'select_destination', 'explore_universities',
  'select_course', 'start_application', 'upload_documents', 'document_review',
  'submit_application', 'receive_offer', 'accept_offer', 'pay_deposit',
  'visa_preparation', 'visa_application', 'pre_departure', 'start_studies'
);

create type public.application_status as enum (
  'planning', 'application_started', 'documents_required', 'submitted',
  'under_university_review', 'conditional_offer', 'unconditional_offer',
  'deposit_required', 'deposit_paid', 'cas_pending', 'cas_issued',
  'visa_preparation', 'visa_submitted', 'visa_approved', 'visa_refused',
  'withdrawn', 'completed'
);

create type public.document_category as enum (
  'identity', 'education', 'english_language', 'financial', 'employment',
  'university', 'visa', 'other'
);

create type public.document_status as enum (
  'uploaded', 'under_review', 'approved', 'rejected', 'resubmission_required', 'expired'
);

create type public.review_action as enum (
  'under_review', 'approved', 'rejected', 'resubmission_required'
);

create type public.course_status as enum ('draft', 'published', 'archived');
create type public.enrollment_status as enum ('active', 'completed', 'dropped');
create type public.lesson_content_type as enum ('video', 'article', 'pdf');

create type public.question_type as enum (
  'multiple_choice', 'multiple_answer', 'true_false', 'short_answer', 'matching', 'ordering'
);

create type public.submission_status as enum (
  'not_started', 'in_progress', 'submitted', 'under_review', 'graded', 'resubmission_required'
);

create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'cancelled');
create type public.invoice_status as enum ('draft', 'open', 'paid', 'cancelled', 'refunded');

create type public.thread_category as enum ('counselor', 'admin', 'instructor', 'support');

create type public.calendar_event_type as enum (
  'assignment_deadline', 'class', 'counselor_meeting', 'university_deadline',
  'visa_deadline', 'payment_deadline', 'exam', 'other'
);

create type public.ticket_status as enum ('open', 'in_progress', 'waiting_for_student', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');

create type public.notification_type as enum (
  'document_approved', 'document_rejected', 'document_required', 'application_status',
  'university_offer', 'payment_received', 'payment_due', 'new_course',
  'assignment_deadline', 'assignment_graded', 'quiz_result', 'new_message',
  'counselor_message', 'support_update', 'system'
);

-- Generic updated_at trigger used by every mutable table.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
