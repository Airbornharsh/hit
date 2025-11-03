'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2, User as UserIcon } from 'lucide-react'

interface UsernameGateProps {
  isOpen: boolean
}

export default function UsernameGate({ isOpen }: UsernameGateProps) {
  const { user, isUserLoaded, isLoading, error, clearError, updateUsername } =
    useAuthStore()
  const [localUsername, setLocalUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')

  useEffect(() => {
    if (user?.username && localUsername === '') {
      setLocalUsername(user.username)
    }
  }, [user?.username, localUsername])

  const shouldShow = useMemo(() => {
    const missing = !user?.username || user.username.trim() === ''
    return isOpen && isUserLoaded && missing
  }, [isOpen, isUserLoaded, user?.username])

  const validateUsername = (value: string) => {
    if (!value.trim()) return 'Username is required.'
    if (!/^[a-zA-Z0-9_-]+$/.test(value))
      return 'Only letters, numbers, underscores, and hyphens allowed.'
    if (value.length < 3) return 'Must be at least 3 characters.'
    if (value.length > 20) return 'Must be less than 20 characters.'
    return ''
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    const err = validateUsername(localUsername)
    setUsernameError(err)
    if (err) return
    await updateUsername(localUsername)
  }

  if (!shouldShow) return null

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-card border-border w-full max-w-md rounded-lg border p-6 shadow-lg">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <UserIcon className="h-5 w-5" />
            Set your username
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Choose a unique username to continue. This will be used in your
            repository URLs and profile.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={localUsername}
              onChange={(e) => {
                setLocalUsername(e.target.value)
                if (usernameError) setUsernameError('')
              }}
              placeholder="e.g. harshkeshri"
              className="bg-input border-border text-foreground"
            />
            {(usernameError || error) && (
              <p className="text-destructive text-sm">
                {usernameError || error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save username
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
