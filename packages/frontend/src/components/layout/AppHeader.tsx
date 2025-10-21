'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Bell, Plus, ChevronDown, User } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'

export function AppHeader() {
  const { user } = useAuthStore()
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <header className="bg-card border-border sticky top-0 z-50 w-full border-b">
      <div className="flex h-16 items-center justify-between px-4">
        {/* Left side - Logo and Search */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
              <span className="text-primary-foreground text-sm font-bold">
                H
              </span>
            </div>
            <span className="text-foreground text-lg font-semibold">Hit</span>
          </div>

          <div className="relative hidden md:block">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search or jump to..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
              className="bg-input border-border text-foreground w-80 pr-4 pl-10"
            />
          </div>
        </div>

        {/* Right side - Navigation and User */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground hidden md:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <Bell className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-muted flex h-8 w-8 items-center justify-center rounded-full">
                <User className="text-muted-foreground h-4 w-4" />
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-sm font-medium">
                    {user?.name || 'User'}
                  </span>
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
