import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'

/** Courses the signed-in instructor teaches or created. */
export async function fetchMyTaughtCourses(userId: string) {
  return unwrap(
    await supabase
      .from('courses')
      .select('id, title, status, updated_at, enrollments(count)')
      .or(`instructor_id.eq.${userId},created_by.eq.${userId}`)
      .order('updated_at', { ascending: false }),
    'courses.taught',
  )
}
