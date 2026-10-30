import { QueryClient } from '@tanstack/react-query'
import { AppError } from '@/lib/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // don't retry permission / validation errors, only transient ones
      retry: (count, error) =>
        count < 2 && !(error instanceof AppError && error.code && /^(42|22|23|PGRST)/.test(error.code)),
    },
  },
})
