import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/Logo'
import { NotFoundPage } from '@/features/system/NotFoundPage'
import { reportError } from '@/lib/errors'

/** Router error boundary: failed chunk loads (e.g. after a new deploy) and unexpected render errors. */
export function RouteErrorPage() {
  const error = useRouteError()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />
  reportError(error, 'route')
  const chunk =
    error instanceof Error &&
    /dynamically imported module|Loading chunk|Importing a module script/i.test(error.message)
  return (
    <div role="alert" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div className="max-w-md space-y-2">
        <h1 className="font-display text-3xl font-semibold">
          {chunk ? 'A new version is available' : 'Something went wrong'}
        </h1>
        <p className="text-muted-foreground">
          {chunk
            ? 'Part of the app could not be loaded, usually because it was just updated. Reloading fixes this.'
            : 'An unexpected error occurred. Reload the page to try again. If it keeps happening, contact support.'}
        </p>
      </div>
      <Button onClick={() => window.location.reload()}>
        <RotateCw /> Reload
      </Button>
    </div>
  )
}
