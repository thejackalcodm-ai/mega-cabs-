import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  LogOut,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  UserRound,
} from 'lucide-react'
import { useAuth, useCurrentUser } from '@/app/providers/auth-context'
import { navForRoles, type NavGroup, type NavItem } from '@/app/navigation'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTitle, SheetContent } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/shared/Logo'
import { toast } from '@/components/shared/toast'
import { useHeaderCounts } from '@/hooks/useHeaderCounts'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { initials } from '@/lib/format'
import { ROLE_LABEL } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { signOut } from '@/services/auth'

interface AppShellProps {
  base: string
  portalLabel: string
  nav: NavGroup[]
  /** Paths shown in the mobile bottom bar; when omitted the portal uses a drawer only. */
  bottomNav?: string[]
  variant: 'student' | 'admin'
}

const href = (base: string, item: NavItem) => (item.path ? `${base}/${item.path}` : base)

function SidebarNav({
  base,
  groups,
  collapsed,
  onNavigate,
}: {
  base: string
  groups: NavGroup[]
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map((group, gi) => (
        <div key={group.label ?? gi}>
          {group.label && !collapsed && (
            <p className="mb-1.5 px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={href(base, item)}
                  end={item.path === ''}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brass))]',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-white/10 text-sidebar-foreground shadow-[inset_2px_0_0_hsl(var(--brass))]'
                        : 'text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground',
                    )
                  }
                >
                  <item.icon className="size-[1.1rem] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="absolute -right-0.5 -top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-[hsl(var(--brass))] px-1 text-[0.65rem] font-semibold leading-[1.1rem] text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function AppShell({ base, portalLabel, nav, bottomNav, variant }: AppShellProps) {
  const user = useCurrentUser()
  const { refetchUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const groups = navForRoles(nav, user.roles)
  const allItems = groups.flatMap((g) => g.items)
  const counts = useHeaderCounts()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [collapsePref, setCollapsePref] = useLocalStorage<'expanded' | 'collapsed' | null>(
    `sidebar:${variant}`,
    null,
  )
  const collapsed = collapsePref ? collapsePref === 'collapsed' : !isDesktop

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
      toast.success('You have been signed out')
    } catch (e) {
      toast.error(e, "Couldn't sign out")
      refetchUser()
    }
  }

  function onSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')?.toString().trim()
    navigate(`${base}/search${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  }

  const bottomItems = bottomNav
    ?.map((p) => allItems.find((i) => i.path === p))
    .filter((i): i is NavItem => !!i)

  return (
    <div className="flex min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-raised"
      >
        Skip to content
      </a>

      {/* Sidebar: rail on tablet, full on desktop, hidden on mobile */}
      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex',
          collapsed ? 'w-[4.25rem]' : 'w-64',
        )}
      >
        <div
          className={cn(
            'flex h-16 items-center border-b border-white/10',
            collapsed ? 'justify-center' : 'px-5',
          )}
        >
          <Link
            to={base}
            aria-label="Dashboard"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brass))]"
          >
            <Logo inverted compact={collapsed} className="text-sidebar-foreground" />
          </Link>
        </div>
        {!collapsed && <p className="px-5 pt-3 text-xs text-sidebar-muted">{portalLabel}</p>}
        <SidebarNav base={base} groups={groups} collapsed={collapsed} />
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setCollapsePref(collapsed ? 'expanded' : 'collapsed')}
            className={cn(
              'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brass))]',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="bg-sidebar text-sidebar-foreground" aria-describedby={undefined}>
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <div className="flex h-16 items-center border-b border-white/10 px-5">
            <Logo inverted />
          </div>
          <SidebarNav base={base} groups={groups} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-surface/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/75 sm:px-5">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </Button>
          <Link to={base} className="md:hidden" aria-label="Dashboard">
            <Logo compact />
          </Link>
          <form onSubmit={onSearch} role="search" className="relative ml-1 hidden max-w-md flex-1 sm:block">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              name="q"
              key={location.pathname}
              placeholder={
                variant === 'admin'
                  ? 'Search students, applications, documents…'
                  : 'Search universities, courses, documents…'
              }
              aria-label="Search"
              className="h-9 bg-background pl-9"
            />
          </form>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <Button variant="ghost" size="icon" className="sm:hidden" asChild>
              <Link to={`${base}/search`} aria-label="Search">
                <Search />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link
                to={`${base}/notifications`}
                aria-label={`Notifications${counts.notifications ? `, ${counts.notifications} unread` : ''}`}
              >
                <Bell />
                <CountBadge count={counts.notifications} />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link
                to={`${base}/messages`}
                aria-label={`Messages${counts.messages ? `, ${counts.messages} unread` : ''}`}
              >
                <MessagesSquare />
                <CountBadge count={counts.messages} />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" asChild>
              <Link to={`${base}/settings`} aria-label="Settings">
                <Settings />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="Account menu"
                >
                  <Avatar className="size-8">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                    <AvatarFallback className="text-xs">{initials(user.fullName)}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate font-medium">{user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  <p className="mt-1 text-xs text-primary">
                    {user.primaryRole && ROLE_LABEL[user.primaryRole]}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {variant === 'student' && (
                  <DropdownMenuItem onSelect={() => navigate(`${base}/profile`)}>
                    <UserRound /> My profile
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => navigate(`${base}/settings`)}>
                  <Settings /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          id="main"
          className={cn('flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8', bottomItems && 'pb-24 md:pb-8')}
        >
          <div className="mx-auto w-full max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {bottomItems && (
        <nav
          aria-label="Quick navigation"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {bottomItems.map((item) => (
            <NavLink
              key={item.path}
              to={href(base, item)}
              end={item.path === ''}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <item.icon className="size-5" aria-hidden />
              <span className="truncate">{item.label.replace('My ', '')}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium text-muted-foreground"
          >
            <Menu className="size-5" aria-hidden />
            More
          </button>
        </nav>
      )}
    </div>
  )
}
