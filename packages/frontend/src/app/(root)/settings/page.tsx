'use client'

import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { XCircle, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, updateUsername, isLoading, error, clearError } = useAuthStore()
  const [username, setUsername] = useState(user?.username || '')
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({})

  const validateUsername = (value: string) => {
    const errors: { [key: string]: string } = {}

    if (!value.trim()) {
      errors.username = 'Username is required.'
    } else if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      errors.username =
        'Username can only contain letters, numbers, underscores, and hyphens.'
    } else if (value.length < 3) {
      errors.username = 'Username must be at least 3 characters long.'
    } else if (value.length > 20) {
      errors.username = 'Username must be less than 20 characters long.'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!validateUsername(username)) {
      return
    }

    const success = await updateUsername(username)
    if (success) {
      toast.success('Username updated successfully!')
      setFormErrors({})
    }
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUsername(value)
    setFormErrors((prev) => ({ ...prev, username: '' }))
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Settings' }]} />

      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-foreground text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences.
          </p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Update your account details and username.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={user?.name || ''}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-muted-foreground text-xs">
                  Your full name is managed by your authentication provider.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-muted-foreground text-xs">
                  Your email is managed by your authentication provider.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Enter your username"
                  className="bg-input border-border text-foreground"
                />
                {formErrors.username && (
                  <p className="text-destructive text-sm">
                    {formErrors.username}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  This will be used in your repository URLs and profile.
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading || username === user?.username}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <User className="mr-2 h-4 w-4" />
                  )}
                  Update Username
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
