import { supabase } from '@/lib/supabase'
import { unwrap } from '@/lib/errors'

/** Total unread messages across the user's conversations (from the my_threads view). */
export async function fetchUnreadMessageCount(): Promise<number> {
  const rows = unwrap(
    await supabase.from('my_threads').select('unread_count').gt('unread_count', 0),
    'messages.unread',
  )
  return rows.reduce((sum, r) => sum + (r.unread_count ?? 0), 0)
}
