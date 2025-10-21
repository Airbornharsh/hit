'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Code, GitBranch, GitCommit, History, Settings } from 'lucide-react'

interface RepositoryTabsProps {
  repoName: string
  userName: string
}

export function RepositoryTabs({ repoName, userName }: RepositoryTabsProps) {
  const pathname = usePathname()

  const tabs = [
    {
      name: 'Code',
      href: `/${userName}/${repoName}`,
      icon: Code,
      active:
        pathname === `/${userName}/${repoName}` ||
        pathname.startsWith(`/${userName}/${repoName}/branches`),
    },
    {
      name: 'Issues',
      href: `/${userName}/${repoName}/issues`,
      icon: GitCommit,
      active: pathname.includes('/issues'),
    },
    {
      name: 'Pull Requests',
      href: `/${userName}/${repoName}/pulls`,
      icon: GitBranch,
      active: pathname.includes('/pulls'),
    },
    {
      name: 'Actions',
      href: `/${userName}/${repoName}/actions`,
      icon: History,
      active: pathname.includes('/actions'),
    },
    {
      name: 'Settings',
      href: `/${userName}/${repoName}/settings`,
      icon: Settings,
      active: pathname.includes('/settings'),
    },
  ]

  return (
    <div className="border-border bg-card border-b">
      <div className="px-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                  tab.active
                    ? 'border-primary text-foreground'
                    : 'text-muted-foreground hover:border-border hover:text-foreground border-transparent',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
