import { useQuery } from '@tanstack/react-query'
import { fetchUnreadMessageCount } from '@/services/messages'
import { fetchUnreadNotificationCount } from '@/services/notifications'

export const headerCountKeys = {
  notifications: ['notifications', 'unread-count'] as const,
  messages: ['messages', 'unread-count'] as const,
}

export function useHeaderCounts() {
  const notifications = useQuery({
    queryKey: headerCountKeys.notifications,
    queryFn: fetchUnreadNotificationCount,
    refetchInterval: 60_000,
  })
  const messages = useQuery({
    queryKey: headerCountKeys.messages,
    queryFn: fetchUnreadMessageCount,
    refetchInterval: 60_000,
  })
  return { notifications: notifications.data ?? 0, messages: messages.data ?? 0 }
}
