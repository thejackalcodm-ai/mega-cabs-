import { supabase } from '@/lib/supabase'
import { assertOk, unwrap } from '@/lib/errors'

export async function fetchUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
  assertOk({ error }, 'notifications.count')
  return count ?? 0
}

export async function fetchRecentNotifications(limit = 5) {
  return unwrap(
    await supabase
      .from('notifications')
      .select('id, type, title, body, link, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(limit),
    'notifications.recent',
  )
}
