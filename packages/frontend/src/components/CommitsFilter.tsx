'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Calendar, ChevronDown } from 'lucide-react'

interface CommitsFilterProps {
  onUserFilter?: (user: string) => void
  onTimeFilter?: (time: string) => void
  availableUsers?: string[]
}

export function CommitsFilter({
  onUserFilter,
  onTimeFilter,
  availableUsers = [],
}: CommitsFilterProps) {
  const [selectedUser, setSelectedUser] = useState('all')
  const [selectedTime, setSelectedTime] = useState('all')
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false)

  const timeOptions = [
    { value: 'all', label: 'All time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
    { value: 'year', label: 'This year' },
  ]

  const handleUserSelect = (user: string) => {
    setSelectedUser(user)
    setIsUserDropdownOpen(false)
    onUserFilter?.(user)
  }

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time)
    setIsTimeDropdownOpen(false)
    onTimeFilter?.(time)
  }

  return (
    <div className="flex items-center gap-2">
      {/* User Filter */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
          className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Users className="mr-2 h-4 w-4" />
          {selectedUser === 'all' ? 'All users' : selectedUser}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>

        {isUserDropdownOpen && (
          <div className="border-border bg-card absolute top-full left-0 z-50 mt-1 w-48 rounded-md border shadow-lg">
            <div className="p-2">
              <button
                onClick={() => handleUserSelect('all')}
                className="hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors"
              >
                <span>All users</span>
                {selectedUser === 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    {availableUsers.length}
                  </Badge>
                )}
              </button>
              {availableUsers.map((user) => (
                <button
                  key={user}
                  onClick={() => handleUserSelect(user)}
                  className="hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors"
                >
                  <span>{user}</span>
                  {selectedUser === user && (
                    <Badge variant="secondary" className="text-xs">
                      selected
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Time Filter */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
          className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <Calendar className="mr-2 h-4 w-4" />
          {timeOptions.find((opt) => opt.value === selectedTime)?.label ||
            'All time'}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>

        {isTimeDropdownOpen && (
          <div className="border-border bg-card absolute top-full left-0 z-50 mt-1 w-40 rounded-md border shadow-lg">
            <div className="p-2">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleTimeSelect(option.value)}
                  className="hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors"
                >
                  <span>{option.label}</span>
                  {selectedTime === option.value && (
                    <Badge variant="secondary" className="text-xs">
                      selected
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Backdrop to close dropdowns */}
      {(isUserDropdownOpen || isTimeDropdownOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsUserDropdownOpen(false)
            setIsTimeDropdownOpen(false)
          }}
        />
      )}
    </div>
  )
}
