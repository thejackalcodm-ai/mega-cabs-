import { supabase } from '@/lib/supabase'
import { reportError } from '@/lib/errors'

type ClientEvent =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_changed'
  | 'document.downloaded'
  | 'document.viewed'
  | 'report.exported'

/** Best-effort audit of client-originated events. Never blocks or fails the user action. */
export async function logClientEvent(action: ClientEvent, entity?: { type: string; id: string }) {
  const { error } = await supabase.rpc('log_client_event', {
    p_action: action,
    p_entity_type: entity?.type,
    p_entity_id: entity?.id,
    p_metadata: { platform: navigator.platform, language: navigator.language },
  })
  if (error) reportError(error, 'audit')
}
