'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'
import { GitBranch, Settings, HelpCircle, Plus, User } from 'lucide-react'
import { useMemo } from 'react'
import { useClerk } from '@clerk/nextjs'
import { LogOut } from 'lucide-react'

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { signOut } = useClerk()
  const handleLogout = async () => {
    try {
      logout()
      await signOut({ redirectUrl: '/auth' })
    } catch (error) {
      console.error('Error during sign out:', error)
      router.push('/auth')
    }
  }

  const navigation = useMemo(
    () => [
      // { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      ...(user
        ? [
            {
              name: 'Repositories',
              href: `/${user.username}/repositories`,
              icon: GitBranch,
            },
            { name: 'Settings', href: '/settings', icon: Settings },
          ]
        : [{ name: 'Login/Signup', href: '/auth', icon: User }]),
      { name: 'Help', href: '/help', icon: HelpCircle },
    ],
    [user],
  )

  return (
    <aside className="bg-sidebar border-sidebar-border flex h-screen w-64 flex-col border-r">
      {/* Header */}
      <div className="border-sidebar-border border-b p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
            <span className="text-primary-foreground text-sm font-bold">H</span>
          </div>
          <span className="text-sidebar-foreground text-lg font-semibold">
            Hit
          </span>
        </div>

        {/* Action Buttons */}
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (user?.username) {
                router.push(`/${user?.username}/repositories/new`)
              } else {
                router.push('/auth')
              }
            }}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex-1"
          >
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>

        {user && (
          <div className="flex items-center gap-2">
            <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
              <User className="text-muted-foreground h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sidebar-foreground truncate text-sm font-medium">
                {user?.name || 'User'}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                {user?.email || 'user@example.com'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground border-sidebar-border border'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-sidebar-border text-muted-foreground space-y-4 border-t p-4 text-sm">
        {user && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start gap-2"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        )}
        <a
          href="https://twitter.com/airbornharsh"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-sidebar-foreground block transition-colors"
        >
          Twitter · @airbornharsh
        </a>
        <a
          href="https://github.com/airbornharsh"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-sidebar-foreground block transition-colors"
        >
          GitHub · airbornharsh
        </a>
        <a
          href="https://harshkeshri.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-sidebar-foreground block transition-colors"
        >
          Portfolio · harshkeshri.com
        </a>
      </div>
    </aside>
  )
}
