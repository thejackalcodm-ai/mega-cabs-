/**
 * Outbound channels (email, SMS, WhatsApp). Messages are NOT sent from the browser: the
 * database writes public.notification_outbox in the same transaction as each change, and a
 * worker drains the outbox through one of these senders, honouring notification_preferences.
 */
export type Channel = 'email' | 'sms' | 'whatsapp'

export interface OutboundMessage {
  to: string
  template: string
  variables: Record<string, string | number>
}

export interface ChannelSender {
  readonly channel: Channel
  send(message: OutboundMessage): Promise<{ providerMessageId: string }>
}

// STUB — no sender is implemented yet (see KNOWN_GAPS.md). Candidates: Resend/Postmark (email),
// Twilio / Meta Cloud API (SMS, WhatsApp). They run server-side with their own secrets.
export const SENDERS: Partial<Record<Channel, ChannelSender>> = {}
