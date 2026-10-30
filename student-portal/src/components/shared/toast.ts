import { toast as sonner } from 'sonner'
import { reportError, toFriendlyMessage } from '@/lib/errors'

/** App-wide toasts. Errors are always converted to friendly messages. */
export const toast = {
  success: (message: string, description?: string) => sonner.success(message, { description }),
  info: (message: string, description?: string) => sonner.info(message, { description }),
  error: (error: unknown, fallbackTitle = 'Something went wrong') => {
    reportError(error, 'toast')
    sonner.error(fallbackTitle, { description: toFriendlyMessage(error) })
  },
}
