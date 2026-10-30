import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/app/providers/AuthProvider'
import { QueryProvider } from '@/app/providers/QueryProvider'
import { router } from '@/app/router'
import { ConfigMissingPage } from '@/features/system/ConfigMissingPage'
import { env } from '@/lib/env'

export function App() {
  if (!env) return <ConfigMissingPage />
  return (
    <QueryProvider>
      <AuthProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
      </AuthProvider>
    </QueryProvider>
  )
}
