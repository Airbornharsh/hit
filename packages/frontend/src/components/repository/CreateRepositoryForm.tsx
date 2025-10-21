'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRepoStore } from '@/stores/repoStore'
import { Lock, Unlock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export function CreateRepositoryForm({ userName }: { userName: string }) {
  const router = useRouter()
  const { createRepo, isReposLoading } = useRepoStore()

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Repository name is required'
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.name)) {
      newErrors.name =
        'Repository name can only contain letters, numbers, dots, hyphens, and underscores'
    } else if (formData.name.length < 3) {
      newErrors.name = 'Repository name must be at least 3 characters long'
    } else if (formData.name.length > 100) {
      newErrors.name = 'Repository name must be less than 100 characters'
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters'

      setErrors(newErrors)
      return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validateForm()) {
        return
      }

      setIsSubmitting(true)

      try {
        await createRepo({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          isPublic: formData.isPublic,
        })

        router.push(`/${userName}/${formData.name}`)
      } catch (error) {
        console.error('Failed to create repository:', error)
        setErrors({ submit: 'Failed to create repository. Please try again.' })
      } finally {
        setIsSubmitting(false)
      }
    }

    const handleInputChange = (field: string, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: '' }))
      }
    }

    return (
      <div className="h-[calc(100vh-10rem)] overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle>Repository Details</CardTitle>
            <CardDescription>
              Choose a name and description for your new repository
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Repository Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Repository name *
                </Label>
                <div className="relative">
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="my-awesome-repo"
                    className={errors.name ? 'border-destructive' : ''}
                    disabled={isSubmitting}
                  />
                  {formData.name && !errors.name && (
                    <CheckCircle className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-500" />
                  )}
                </div>
                {errors.name && (
                  <p className="text-destructive flex items-center gap-1 text-sm">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  This will be the name of your repository. It can be changed
                  later.
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    handleInputChange('description', e.target.value)
                  }
                  placeholder="A brief description of your repository..."
                  className={errors.description ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                  rows={3}
                />
                {errors.description && (
                  <p className="text-destructive flex items-center gap-1 text-sm">
                    <AlertCircle className="h-3 w-3" />
                    {errors.description}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  {formData.description.length}/500 characters
                </p>
              </div>

              {/* Visibility */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Visibility</Label>
                <div className="space-y-3">
                  <div
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      formData.isPublic
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleInputChange('isPublic', true)}
                  >
                    <div className="flex items-center gap-3">
                      <Unlock className="h-5 w-5 text-green-600" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Public</span>
                          <Badge variant="secondary" className="text-xs">
                            Recommended
                          </Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          Anyone on the internet can see this repository. You
                          choose who can commit.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      !formData.isPublic
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => handleInputChange('isPublic', false)}
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="h-5 w-5 text-orange-600" />
                      <div className="flex-1">
                        <span className="font-medium">Private</span>
                        <p className="text-muted-foreground mt-1 text-sm">
                          You choose who can see and commit to this repository.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || isReposLoading}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Repository...
                    </>
                  ) : (
                    'Create Repository'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>

              {errors.submit && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.submit}</AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return validateForm()
}
