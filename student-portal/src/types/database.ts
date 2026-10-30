// Generated from the migrated schema (format of `supabase gen types typescript`).
// Regenerate against your linked project with: npm run db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          id: string
          profile_id: string
          reason: string | null
          status: string
          processed_by: string | null
          processed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          reason?: string | null
          status?: string
          processed_by?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          reason?: string | null
          status?: string
          processed_by?: string | null
          processed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_deletion_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          id: string
          application_id: string
          document_type_id: string
          is_required: boolean
          note: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          application_id: string
          document_type_id: string
          is_required?: boolean
          note?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          document_type_id?: string
          is_required?: boolean
          note?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      application_events: {
        Row: {
          id: string
          application_id: string
          status: Database["public"]["Enums"]["application_status"] | null
          title: string
          description: string | null
          is_internal: boolean
          actor_id: string | null
          occurred_at: string
        }
        Insert: {
          id?: string
          application_id: string
          status?: Database["public"]["Enums"]["application_status"] | null
          title: string
          description?: string | null
          is_internal?: boolean
          actor_id?: string | null
          occurred_at?: string
        }
        Update: {
          id?: string
          application_id?: string
          status?: Database["public"]["Enums"]["application_status"] | null
          title?: string
          description?: string | null
          is_internal?: boolean
          actor_id?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          id: string
          reference: string
          student_id: string
          university_id: string
          program_id: string | null
          intake: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          decision_at: string | null
          offer_conditions: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reference?: string
          student_id: string
          university_id: string
          program_id?: string | null
          intake?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          decision_at?: string | null
          offer_conditions?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reference?: string
          student_id?: string
          university_id?: string
          program_id?: string | null
          intake?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          decision_at?: string | null
          offer_conditions?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          id: string
          assignment_id: string
          student_id: string
          status: Database["public"]["Enums"]["submission_status"]
          text_answer: string | null
          file_path: string | null
          file_name: string | null
          file_size: number | null
          submitted_at: string | null
          grade: number | null
          feedback: string | null
          graded_by: string | null
          graded_at: string | null
          attempt: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          assignment_id: string
          student_id: string
          status?: Database["public"]["Enums"]["submission_status"]
          text_answer?: string | null
          file_path?: string | null
          file_name?: string | null
          file_size?: number | null
          submitted_at?: string | null
          grade?: number | null
          feedback?: string | null
          graded_by?: string | null
          graded_at?: string | null
          attempt?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          assignment_id?: string
          student_id?: string
          status?: Database["public"]["Enums"]["submission_status"]
          text_answer?: string | null
          file_path?: string | null
          file_name?: string | null
          file_size?: number | null
          submitted_at?: string | null
          grade?: number | null
          feedback?: string | null
          graded_by?: string | null
          graded_at?: string | null
          attempt?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          id: string
          course_id: string
          module_id: string | null
          title: string
          instructions: string | null
          due_at: string | null
          max_points: number
          allow_file: boolean
          allow_text: boolean
          is_published: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          module_id?: string | null
          title: string
          instructions?: string | null
          due_at?: string | null
          max_points?: number
          allow_file?: boolean
          allow_text?: boolean
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          module_id?: string | null
          title?: string
          instructions?: string | null
          due_at?: string | null
          max_points?: number
          allow_file?: boolean
          allow_text?: boolean
          is_published?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"] | null
          action: string
          entity_type: string | null
          entity_id: string | null
          student_id: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          student_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          student_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          id: string
          title: string
          description: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          starts_at: string
          ends_at: string | null
          all_day: boolean
          location: string | null
          meeting_url: string | null
          student_id: string | null
          course_id: string | null
          application_id: string | null
          assignment_id: string | null
          is_public: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          starts_at: string
          ends_at?: string | null
          all_day?: boolean
          location?: string | null
          meeting_url?: string | null
          student_id?: string | null
          course_id?: string | null
          application_id?: string | null
          assignment_id?: string | null
          is_public?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          starts_at?: string
          ends_at?: string | null
          all_day?: boolean
          location?: string | null
          meeting_url?: string | null
          student_id?: string | null
          course_id?: string | null
          application_id?: string | null
          assignment_id?: string | null
          is_public?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          description?: string | null
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          id: string
          slug: string
          title: string
          subtitle: string | null
          description: string | null
          category: string | null
          level: string | null
          thumbnail_url: string | null
          status: Database["public"]["Enums"]["course_status"]
          instructor_id: string | null
          estimated_hours: number | null
          published_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          title: string
          subtitle?: string | null
          description?: string | null
          category?: string | null
          level?: string | null
          thumbnail_url?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          instructor_id?: string | null
          estimated_hours?: number | null
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          subtitle?: string | null
          description?: string | null
          category?: string | null
          level?: string | null
          thumbnail_url?: string | null
          status?: Database["public"]["Enums"]["course_status"]
          instructor_id?: string | null
          estimated_hours?: number | null
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_grants: {
        Row: {
          id: string
          profile_id: string
          document_id: string
          file_path: string
          purpose: string
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          document_id: string
          file_path: string
          purpose: string
          expires_at: string
          created_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          document_id?: string
          file_path?: string
          purpose?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_grants_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          id: string
          checklist_key: string
          checklist_name: string
          country: string | null
          document_type_id: string
          is_required: boolean
          sort_order: number
        }
        Insert: {
          id?: string
          checklist_key: string
          checklist_name: string
          country?: string | null
          document_type_id: string
          is_required?: boolean
          sort_order?: number
        }
        Update: {
          id?: string
          checklist_key?: string
          checklist_name?: string
          country?: string | null
          document_type_id?: string
          is_required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reviews: {
        Row: {
          id: string
          document_id: string
          version: number
          reviewer_id: string
          action: Database["public"]["Enums"]["review_action"]
          reason: string | null
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          version: number
          reviewer_id: string
          action: Database["public"]["Enums"]["review_action"]
          reason?: string | null
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          version?: number
          reviewer_id?: string
          action?: Database["public"]["Enums"]["review_action"]
          reason?: string | null
          comment?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_reviews_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          id: string
          key: string
          category: Database["public"]["Enums"]["document_category"]
          name: string
          description: string | null
          has_expiry: boolean
          is_custom: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          key: string
          category: Database["public"]["Enums"]["document_category"]
          name: string
          description?: string | null
          has_expiry?: boolean
          is_custom?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          key?: string
          category?: Database["public"]["Enums"]["document_category"]
          name?: string
          description?: string | null
          has_expiry?: boolean
          is_custom?: boolean
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          id: string
          document_id: string
          version: number
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          version: number
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          version?: number
          file_path?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_versions_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          id: string
          student_id: string
          document_type_id: string
          category: Database["public"]["Enums"]["document_category"]
          custom_type_name: string | null
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          status: Database["public"]["Enums"]["document_status"]
          version: number
          uploaded_by: string | null
          uploaded_at: string
          reviewer_id: string | null
          reviewer_comment: string | null
          rejection_reason: string | null
          required_action: string | null
          reviewed_at: string | null
          verified_at: string | null
          expiry_date: string | null
          ai_classification: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          document_type_id: string
          category: Database["public"]["Enums"]["document_category"]
          custom_type_name?: string | null
          file_path: string
          file_name: string
          file_size: number
          mime_type: string
          status?: Database["public"]["Enums"]["document_status"]
          version?: number
          uploaded_by?: string | null
          uploaded_at?: string
          reviewer_id?: string | null
          reviewer_comment?: string | null
          rejection_reason?: string | null
          required_action?: string | null
          reviewed_at?: string | null
          verified_at?: string | null
          expiry_date?: string | null
          ai_classification?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          document_type_id?: string
          category?: Database["public"]["Enums"]["document_category"]
          custom_type_name?: string | null
          file_path?: string
          file_name?: string
          file_size?: number
          mime_type?: string
          status?: Database["public"]["Enums"]["document_status"]
          version?: number
          uploaded_by?: string | null
          uploaded_at?: string
          reviewer_id?: string | null
          reviewer_comment?: string | null
          rejection_reason?: string | null
          required_action?: string | null
          reviewed_at?: string | null
          verified_at?: string | null
          expiry_date?: string | null
          ai_classification?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      education_records: {
        Row: {
          id: string
          student_id: string
          institution: string
          qualification: string
          field_of_study: string | null
          start_date: string | null
          end_date: string | null
          grade: string | null
          graduation_year: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          institution: string
          qualification: string
          field_of_study?: string | null
          start_date?: string | null
          end_date?: string | null
          grade?: string | null
          graduation_year?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          institution?: string
          qualification?: string
          field_of_study?: string | null
          start_date?: string | null
          end_date?: string | null
          grade?: string | null
          graduation_year?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      english_tests: {
        Row: {
          id: string
          student_id: string
          test_type: string
          test_name: string | null
          overall: number | null
          listening: number | null
          reading: number | null
          writing: number | null
          speaking: number | null
          test_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          test_type: string
          test_name?: string | null
          overall?: number | null
          listening?: number | null
          reading?: number | null
          writing?: number | null
          speaking?: number | null
          test_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          test_type?: string
          test_name?: string | null
          overall?: number | null
          listening?: number | null
          reading?: number | null
          writing?: number | null
          speaking?: number | null
          test_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "english_tests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          id: string
          course_id: string
          student_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          progress_percent: number
          enrolled_at: string
          last_accessed_at: string | null
          completed_at: string | null
          certificate_number: string | null
        }
        Insert: {
          id?: string
          course_id: string
          student_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          progress_percent?: number
          enrolled_at?: string
          last_accessed_at?: string | null
          completed_at?: string | null
          certificate_number?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          student_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          progress_percent?: number
          enrolled_at?: string
          last_accessed_at?: string | null
          completed_at?: string | null
          certificate_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          id: string
          category: string
          question: string
          answer: string
          position: number
          is_published: boolean
          created_at: string
        }
        Insert: {
          id?: string
          category: string
          question: string
          answer: string
          position?: number
          is_published?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          category?: string
          question?: string
          answer?: string
          position?: number
          is_published?: boolean
          created_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          description: string
          quantity: number
          unit_amount: number
          amount: number | null
          position: number
        }
        Insert: {
          id?: string
          invoice_id: string
          description: string
          quantity?: number
          unit_amount: number
          amount?: never
          position?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          description?: string
          quantity?: number
          unit_amount?: number
          amount?: never
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          student_id: string
          application_id: string | null
          title: string
          description: string | null
          currency: string
          subtotal: number
          tax: number
          total: number
          amount_paid: number
          status: Database["public"]["Enums"]["invoice_status"]
          issued_at: string
          due_date: string | null
          paid_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string
          student_id: string
          application_id?: string | null
          title: string
          description?: string | null
          currency?: string
          subtotal?: number
          tax?: number
          total?: number
          amount_paid?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          issued_at?: string
          due_date?: string | null
          paid_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          student_id?: string
          application_id?: string | null
          title?: string
          description?: string | null
          currency?: string
          subtotal?: number
          tax?: number
          total?: number
          amount_paid?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          issued_at?: string
          due_date?: string | null
          paid_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_activity: {
        Row: {
          student_id: string
          course_id: string
          activity_date: string
          minutes: number
          lessons_completed: number
        }
        Insert: {
          student_id: string
          course_id: string
          activity_date?: string
          minutes?: number
          lessons_completed?: number
        }
        Update: {
          student_id?: string
          course_id?: string
          activity_date?: string
          minutes?: number
          lessons_completed?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_activity_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_activity_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          id: string
          student_id: string
          lesson_id: string
          course_id: string
          watched_seconds: number
          last_position: number
          completed: boolean
          completed_at: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          lesson_id: string
          course_id: string
          watched_seconds?: number
          last_position?: number
          completed?: boolean
          completed_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          lesson_id?: string
          course_id?: string
          watched_seconds?: number
          last_position?: number
          completed?: boolean
          completed_at?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_resources: {
        Row: {
          id: string
          lesson_id: string
          course_id: string
          title: string
          file_path: string | null
          external_url: string | null
          mime_type: string | null
          file_size: number | null
          created_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          course_id: string
          title: string
          file_path?: string | null
          external_url?: string | null
          mime_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          course_id?: string
          title?: string
          file_path?: string | null
          external_url?: string | null
          mime_type?: string | null
          file_size?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_resources_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_resources_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          course_id: string
          title: string
          description: string | null
          content_type: Database["public"]["Enums"]["lesson_content_type"]
          video_provider: string | null
          video_ref: string | null
          duration_seconds: number
          body: string | null
          transcript: string | null
          is_preview: boolean
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          module_id: string
          course_id: string
          title: string
          description?: string | null
          content_type?: Database["public"]["Enums"]["lesson_content_type"]
          video_provider?: string | null
          video_ref?: string | null
          duration_seconds?: number
          body?: string | null
          transcript?: string | null
          is_preview?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          module_id?: string
          course_id?: string
          title?: string
          description?: string | null
          content_type?: Database["public"]["Enums"]["lesson_content_type"]
          video_provider?: string | null
          video_ref?: string | null
          duration_seconds?: number
          body?: string | null
          transcript?: string | null
          is_preview?: boolean
          position?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          id: string
          subject: string
          category: Database["public"]["Enums"]["thread_category"]
          student_id: string | null
          created_by: string | null
          last_message_at: string
          created_at: string
        }
        Insert: {
          id?: string
          subject: string
          category?: Database["public"]["Enums"]["thread_category"]
          student_id?: string | null
          created_by?: string | null
          last_message_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          subject?: string
          category?: Database["public"]["Enums"]["thread_category"]
          student_id?: string | null
          created_by?: string | null
          last_message_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          id: string
          thread_id: string
          sender_id: string
          body: string
          attachment_path: string | null
          attachment_name: string | null
          attachment_size: number | null
          attachment_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          sender_id?: string
          body?: string
          attachment_path?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          sender_id?: string
          body?: string
          attachment_path?: string | null
          attachment_name?: string | null
          attachment_size?: number | null
          attachment_type?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_outbox: {
        Row: {
          id: string
          event_type: string
          aggregate: string | null
          aggregate_id: string | null
          payload: Json
          status: string
          attempts: number
          last_error: string | null
          created_at: string
          processed_at: string | null
        }
        Insert: {
          id?: string
          event_type: string
          aggregate?: string | null
          aggregate_id?: string | null
          payload?: Json
          status?: string
          attempts?: number
          last_error?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: string
          event_type?: string
          aggregate?: string | null
          aggregate_id?: string | null
          payload?: Json
          status?: string
          attempts?: number
          last_error?: string | null
          created_at?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          profile_id: string
          email_notifications: Json
          inapp_notifications: Json
          privacy: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          profile_id: string
          email_notifications?: Json
          inapp_notifications?: Json
          privacy?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          profile_id?: string
          email_notifications?: Json
          inapp_notifications?: Json
          privacy?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
          title: string
          body: string | null
          link: string | null
          metadata: Json
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recipient_id: string
          type: Database["public"]["Enums"]["notification_type"]
          title: string
          body?: string | null
          link?: string | null
          metadata?: Json
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recipient_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
          title?: string
          body?: string | null
          link?: string | null
          metadata?: Json
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          id: string
          student_id: string
          invoice_id: string | null
          amount: number
          currency: string
          status: Database["public"]["Enums"]["payment_status"]
          method: string | null
          provider: string
          provider_reference: string | null
          receipt_number: string | null
          paid_at: string | null
          notes: string | null
          recorded_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          invoice_id?: string | null
          amount: number
          currency?: string
          status?: Database["public"]["Enums"]["payment_status"]
          method?: string | null
          provider?: string
          provider_reference?: string | null
          receipt_number?: string | null
          paid_at?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          invoice_id?: string | null
          amount?: number
          currency?: string
          status?: Database["public"]["Enums"]["payment_status"]
          method?: string | null
          provider?: string
          provider_reference?: string | null
          receipt_number?: string | null
          paid_at?: string | null
          notes?: string | null
          recorded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          phone: string | null
          country: string | null
          avatar_url: string | null
          is_active: boolean
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name?: string
          last_name?: string
          phone?: string | null
          country?: string | null
          avatar_url?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          phone?: string | null
          country?: string | null
          avatar_url?: string | null
          is_active?: boolean
          last_seen_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          id: string
          university_id: string
          name: string
          subject: string
          study_level: string
          duration_months: number | null
          tuition_fee: number | null
          currency: string
          intakes: string[]
          entry_requirements: string | null
          english_requirements: string | null
          ielts_min: number | null
          application_deadline: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          university_id: string
          name: string
          subject: string
          study_level: string
          duration_months?: number | null
          tuition_fee?: number | null
          currency?: string
          intakes?: string[]
          entry_requirements?: string | null
          english_requirements?: string | null
          ielts_min?: number | null
          application_deadline?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          university_id?: string
          name?: string
          subject?: string
          study_level?: string
          duration_months?: number | null
          tuition_fee?: number | null
          currency?: string
          intakes?: string[]
          entry_requirements?: string | null
          english_requirements?: string | null
          ielts_min?: number | null
          application_deadline?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          id: string
          quiz_id: string
          student_id: string
          attempt_number: number
          started_at: string
          submitted_at: string | null
          answers: Json | null
          results: Json | null
          score: number | null
          max_score: number | null
          percentage: number | null
          passed: boolean | null
        }
        Insert: {
          id?: string
          quiz_id: string
          student_id: string
          attempt_number: number
          started_at?: string
          submitted_at?: string | null
          answers?: Json | null
          results?: Json | null
          score?: number | null
          max_score?: number | null
          percentage?: number | null
          passed?: boolean | null
        }
        Update: {
          id?: string
          quiz_id?: string
          student_id?: string
          attempt_number?: number
          started_at?: string
          submitted_at?: string | null
          answers?: Json | null
          results?: Json | null
          score?: number | null
          max_score?: number | null
          percentage?: number | null
          passed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_options: {
        Row: {
          id: string
          question_id: string
          label: string
          match_text: string | null
          is_correct: boolean
          correct_position: number | null
          position: number
        }
        Insert: {
          id?: string
          question_id: string
          label: string
          match_text?: string | null
          is_correct?: boolean
          correct_position?: number | null
          position?: number
        }
        Update: {
          id?: string
          question_id?: string
          label?: string
          match_text?: string | null
          is_correct?: boolean
          correct_position?: number | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          id: string
          quiz_id: string
          type: Database["public"]["Enums"]["question_type"]
          prompt: string
          explanation: string | null
          accepted_answers: string[]
          points: number
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          quiz_id: string
          type: Database["public"]["Enums"]["question_type"]
          prompt: string
          explanation?: string | null
          accepted_answers?: string[]
          points?: number
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          quiz_id?: string
          type?: Database["public"]["Enums"]["question_type"]
          prompt?: string
          explanation?: string | null
          accepted_answers?: string[]
          points?: number
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          id: string
          course_id: string
          module_id: string | null
          title: string
          description: string | null
          time_limit_minutes: number | null
          passing_score: number
          max_attempts: number | null
          randomize_questions: boolean
          show_results_immediately: boolean
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          module_id?: string | null
          title: string
          description?: string | null
          time_limit_minutes?: number | null
          passing_score?: number
          max_attempts?: number | null
          randomize_questions?: boolean
          show_results_immediately?: boolean
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          module_id?: string | null
          title?: string
          description?: string | null
          time_limit_minutes?: number | null
          passing_score?: number
          max_attempts?: number | null
          randomize_questions?: boolean
          show_results_immediately?: boolean
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          role: Database["public"]["Enums"]["app_role"]
          permission: string
        }
        Insert: {
          role: Database["public"]["Enums"]["app_role"]
          permission: string
        }
        Update: {
          role?: Database["public"]["Enums"]["app_role"]
          permission?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          key: Database["public"]["Enums"]["app_role"]
          name: string
          description: string | null
          rank: number
          created_at: string
        }
        Insert: {
          id?: string
          key: Database["public"]["Enums"]["app_role"]
          name: string
          description?: string | null
          rank: number
          created_at?: string
        }
        Update: {
          id?: string
          key?: Database["public"]["Enums"]["app_role"]
          name?: string
          description?: string | null
          rank?: number
          created_at?: string
        }
        Relationships: []
      }
      saved_universities: {
        Row: {
          student_id: string
          university_id: string
          created_at: string
        }
        Insert: {
          student_id: string
          university_id: string
          created_at?: string
        }
        Update: {
          student_id?: string
          university_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_universities_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_universities_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          id: string
          university_id: string
          name: string
          amount: number | null
          currency: string
          description: string | null
          eligibility: string | null
          deadline: string | null
          created_at: string
        }
        Insert: {
          id?: string
          university_id: string
          name: string
          amount?: number | null
          currency?: string
          description?: string | null
          eligibility?: string | null
          deadline?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          university_id?: string
          name?: string
          amount?: number | null
          currency?: string
          description?: string | null
          eligibility?: string | null
          deadline?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scholarships_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          id: string
          profile_id: string
          title: string | null
          department: string | null
          bio: string | null
          permissions: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          title?: string | null
          department?: string | null
          bio?: string | null
          permissions?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          title?: string | null
          department?: string | null
          bio?: string | null
          permissions?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          student_id: string
          date_of_birth: string | null
          gender: string | null
          nationality: string | null
          passport_number: string | null
          passport_expiry: string | null
          national_id: string | null
          whatsapp: string | null
          address_line: string | null
          city: string | null
          country: string | null
          emergency_name: string | null
          emergency_relationship: string | null
          emergency_phone: string | null
          emergency_email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          student_id: string
          date_of_birth?: string | null
          gender?: string | null
          nationality?: string | null
          passport_number?: string | null
          passport_expiry?: string | null
          national_id?: string | null
          whatsapp?: string | null
          address_line?: string | null
          city?: string | null
          country?: string | null
          emergency_name?: string | null
          emergency_relationship?: string | null
          emergency_phone?: string | null
          emergency_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          student_id?: string
          date_of_birth?: string | null
          gender?: string | null
          nationality?: string | null
          passport_number?: string | null
          passport_expiry?: string | null
          national_id?: string | null
          whatsapp?: string | null
          address_line?: string | null
          city?: string | null
          country?: string | null
          emergency_name?: string | null
          emergency_relationship?: string | null
          emergency_phone?: string | null
          emergency_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_tasks: {
        Row: {
          id: string
          student_id: string
          title: string
          description: string | null
          link: string | null
          due_at: string | null
          status: string
          completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          title: string
          description?: string | null
          link?: string | null
          due_at?: string | null
          status?: string
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          title?: string
          description?: string | null
          link?: string | null
          due_at?: string | null
          status?: string
          completed_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_tasks_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          id: string
          profile_id: string
          student_number: string
          counselor_id: string | null
          journey_stage: Database["public"]["Enums"]["journey_stage"]
          preferred_destinations: string[]
          preferred_study_level: string | null
          preferred_intake: string | null
          preferred_subjects: string[]
          budget_max: number | null
          application_goals: string | null
          onboarding_step: number
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          student_number?: string
          counselor_id?: string | null
          journey_stage?: Database["public"]["Enums"]["journey_stage"]
          preferred_destinations?: string[]
          preferred_study_level?: string | null
          preferred_intake?: string | null
          preferred_subjects?: string[]
          budget_max?: number | null
          application_goals?: string | null
          onboarding_step?: number
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          student_number?: string
          counselor_id?: string | null
          journey_stage?: Database["public"]["Enums"]["journey_stage"]
          preferred_destinations?: string[]
          preferred_study_level?: string | null
          preferred_intake?: string | null
          preferred_subjects?: string[]
          budget_max?: number | null
          application_goals?: string | null
          onboarding_step?: number
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_counselor_id_fkey"
            columns: ["counselor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          id: string
          reference: string
          student_id: string | null
          created_by: string
          subject: string
          category: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          description: string
          status: Database["public"]["Enums"]["ticket_status"]
          assigned_to: string | null
          attachment_path: string | null
          attachment_name: string | null
          resolved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reference?: string
          student_id?: string | null
          created_by?: string
          subject: string
          category: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          description: string
          status?: Database["public"]["Enums"]["ticket_status"]
          assigned_to?: string | null
          attachment_path?: string | null
          attachment_name?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reference?: string
          student_id?: string | null
          created_by?: string
          subject?: string
          category?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          description?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          assigned_to?: string | null
          attachment_path?: string | null
          attachment_name?: string | null
          resolved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          thread_id: string
          profile_id: string
          last_read_at: string | null
          joined_at: string
        }
        Insert: {
          thread_id: string
          profile_id: string
          last_read_at?: string | null
          joined_at?: string
        }
        Update: {
          thread_id?: string
          profile_id?: string
          last_read_at?: string | null
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_replies: {
        Row: {
          id: string
          ticket_id: string
          author_id: string
          body: string
          is_internal: boolean
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          author_id?: string
          body: string
          is_internal?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          author_id?: string
          body?: string
          is_internal?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_replies_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      universities: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          country: string
          city: string
          website: string | null
          ranking: number | null
          description: string | null
          established: number | null
          student_population: number | null
          is_active: boolean
          external_ref: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          country: string
          city: string
          website?: string | null
          ranking?: number | null
          description?: string | null
          established?: number | null
          student_population?: number | null
          is_active?: boolean
          external_ref?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          country?: string
          city?: string
          website?: string | null
          ranking?: number | null
          description?: string | null
          established?: number | null
          student_population?: number | null
          is_active?: boolean
          external_ref?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          granted_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          granted_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          granted_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      work_experience: {
        Row: {
          id: string
          student_id: string
          company: string
          position: string
          start_date: string | null
          end_date: string | null
          is_current: boolean
          responsibilities: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          student_id: string
          company: string
          position: string
          start_date?: string | null
          end_date?: string | null
          is_current?: boolean
          responsibilities?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          company?: string
          position?: string
          start_date?: string | null
          end_date?: string | null
          is_current?: boolean
          responsibilities?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_experience_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      application_checklist: {
        Row: {
          id: string | null
          application_id: string | null
          student_id: string | null
          document_type_id: string | null
          document_name: string | null
          category: Database["public"]["Enums"]["document_category"] | null
          is_required: boolean | null
          sort_order: number | null
          note: string | null
          document_id: string | null
          document_status: Database["public"]["Enums"]["document_status"] | null
          expiry_date: string | null
          item_state: string | null
        }
        Relationships: []
      }
      application_checklist_summary: {
        Row: {
          application_id: string | null
          student_id: string | null
          required_count: number | null
          completed_count: number | null
          missing_count: number | null
          pending_count: number | null
          rejected_count: number | null
          expired_count: number | null
          completion_percent: number | null
        }
        Relationships: []
      }
      counselor_directory: {
        Row: {
          staff_id: string | null
          profile_id: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          assigned_students: number | null
        }
        Relationships: []
      }
      my_threads: {
        Row: {
          id: string | null
          subject: string | null
          category: Database["public"]["Enums"]["thread_category"] | null
          student_id: string | null
          created_by: string | null
          last_message_at: string | null
          created_at: string | null
          last_read_at: string | null
          unread_count: number | null
          last_message: string | null
        }
        Relationships: []
      }
      student_directory: {
        Row: {
          id: string | null
          student_number: string | null
          profile_id: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          phone: string | null
          country: string | null
          nationality: string | null
          is_active: boolean | null
          last_seen_at: string | null
          counselor_id: string | null
          counselor_name: string | null
          journey_stage: Database["public"]["Enums"]["journey_stage"] | null
          onboarding_completed: boolean | null
          created_at: string | null
          active_applications: number | null
          documents_pending: number | null
          documents_action: number | null
          latest_application_status: Database["public"]["Enums"]["application_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_dashboard_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      application_status_label: {
        Args: { s: Database["public"]["Enums"]["application_status"] }
        Returns: string
      }
      assign_counselor: {
        Args: { p_student_id: string; p_staff_id: string }
        Returns: undefined
      }
      authorize_document_access: {
        Args: { p_document_id: string; p_purpose?: string; p_version?: number }
        Returns: { file_path: string; file_name: string; mime_type: string; version: number }[]
      }
      can_access_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      can_access_thread: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      can_manage_course: {
        Args: { p_course_id: string }
        Returns: boolean
      }
      can_manage_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      can_view_learning: {
        Args: { p_student_id: string; p_course_id: string }
        Returns: boolean
      }
      counselor_dashboard: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      course_is_published: {
        Args: { p_course_id: string }
        Returns: boolean
      }
      course_outline: {
        Args: { p_course_id: string }
        Returns: { module_id: string; module_title: string; module_position: number; lesson_id: string; lesson_title: string; lesson_position: number; content_type: Database["public"]["Enums"]["lesson_content_type"]; duration_seconds: number; is_preview: boolean }[]
      }
      current_app_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_staff_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_student_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      delete_document: {
        Args: { p_document_id: string }
        Returns: string[]
      }
      get_learning_analytics: {
        Args: { p_student_id?: string }
        Returns: Json
      }
      get_quiz_attempt_review: {
        Args: { p_attempt_id: string }
        Returns: Json
      }
      has_any_role: {
        Args: { p_roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_document_grant: {
        Args: { p_path: string }
        Returns: boolean
      }
      has_permission: {
        Args: { perm: string }
        Returns: boolean
      }
      has_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      instructor_teaches_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_assigned_counselor: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      is_enrolled: {
        Args: { p_course_id: string }
        Returns: boolean
      }
      is_referenced_document_object: {
        Args: { p_path: string }
        Returns: boolean
      }
      is_staff: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_staff_profile: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      is_super_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_thread_participant: {
        Args: { p_thread_id: string }
        Returns: boolean
      }
      log_admin_user_created: {
        Args: { p_user_id: string; p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      log_client_event: {
        Args: { p_action: string; p_entity_type?: string; p_entity_id?: string; p_metadata?: Json }
        Returns: undefined
      }
      mark_all_notifications_read: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      mark_thread_read: {
        Args: { p_thread_id: string }
        Returns: undefined
      }
      owns_student: {
        Args: { p_student_id: string }
        Returns: boolean
      }
      profile_completion: {
        Args: { p_student_id?: string }
        Returns: Json
      }
      replace_document: {
        Args: { p_document_id: string; p_file_path: string; p_file_name: string; p_file_size: number; p_mime_type: string; p_expiry_date?: string }
        Returns: Database["public"]["Tables"]["documents"]["Row"]
      }
      request_document: {
        Args: { p_student_id: string; p_document_type_id: string; p_message?: string; p_application_id?: string }
        Returns: undefined
      }
      review_document: {
        Args: { p_document_id: string; p_action: Database["public"]["Enums"]["review_action"]; p_reason?: string; p_comment?: string; p_required_action?: string }
        Returns: Database["public"]["Tables"]["documents"]["Row"]
      }
      save_onboarding_progress: {
        Args: { p_step: number; p_completed?: boolean }
        Returns: undefined
      }
      start_quiz_attempt: {
        Args: { p_quiz_id: string }
        Returns: Json
      }
      start_thread: {
        Args: { p_subject: string; p_category: Database["public"]["Enums"]["thread_category"]; p_body: string; p_recipient_ids?: string[]; p_student_id?: string }
        Returns: string
      }
      student_profile_id: {
        Args: { p_student_id: string }
        Returns: string
      }
      submit_quiz_attempt: {
        Args: { p_attempt_id: string; p_answers: Json }
        Returns: Json
      }
      update_lesson_progress: {
        Args: { p_lesson_id: string; p_watched_seconds?: number; p_position?: number; p_completed?: boolean; p_minutes?: number; p_notes?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "student" | "counselor" | "instructor" | "admin" | "super_admin"
      application_status: "planning" | "application_started" | "documents_required" | "submitted" | "under_university_review" | "conditional_offer" | "unconditional_offer" | "deposit_required" | "deposit_paid" | "cas_pending" | "cas_issued" | "visa_preparation" | "visa_submitted" | "visa_approved" | "visa_refused" | "withdrawn" | "completed"
      calendar_event_type: "assignment_deadline" | "class" | "counselor_meeting" | "university_deadline" | "visa_deadline" | "payment_deadline" | "exam" | "other"
      course_status: "draft" | "published" | "archived"
      document_category: "identity" | "education" | "english_language" | "financial" | "employment" | "university" | "visa" | "other"
      document_status: "uploaded" | "under_review" | "approved" | "rejected" | "resubmission_required" | "expired"
      enrollment_status: "active" | "completed" | "dropped"
      invoice_status: "draft" | "open" | "paid" | "cancelled" | "refunded"
      journey_stage: "register" | "complete_profile" | "select_destination" | "explore_universities" | "select_course" | "start_application" | "upload_documents" | "document_review" | "submit_application" | "receive_offer" | "accept_offer" | "pay_deposit" | "visa_preparation" | "visa_application" | "pre_departure" | "start_studies"
      lesson_content_type: "video" | "article" | "pdf"
      notification_type: "document_approved" | "document_rejected" | "document_required" | "application_status" | "university_offer" | "payment_received" | "payment_due" | "new_course" | "assignment_deadline" | "assignment_graded" | "quiz_result" | "new_message" | "counselor_message" | "support_update" | "system" | "document_uploaded" | "counselor_assigned"
      payment_status: "pending" | "paid" | "failed" | "refunded" | "cancelled"
      question_type: "multiple_choice" | "multiple_answer" | "true_false" | "short_answer" | "matching" | "ordering"
      review_action: "under_review" | "approved" | "rejected" | "resubmission_required"
      submission_status: "not_started" | "in_progress" | "submitted" | "under_review" | "graded" | "resubmission_required"
      thread_category: "counselor" | "admin" | "instructor" | "support"
      ticket_priority: "low" | "medium" | "high" | "urgent"
      ticket_status: "open" | "in_progress" | "waiting_for_student" | "resolved" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])> =
  (PublicSchema["Tables"] & PublicSchema["Views"])[T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
export type Functions<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]

