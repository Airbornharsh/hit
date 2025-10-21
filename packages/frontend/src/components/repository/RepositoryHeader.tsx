'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Star,
  GitFork,
  Eye,
  Code,
  GitBranch,
  Lock,
  Unlock,
  Calendar,
} from 'lucide-react'
import { Repo } from '@/types/repo'

interface RepositoryHeaderProps {
  repo: Repo
  onStar?: () => void
  onFork?: () => void
  onWatch?: () => void
}

export function RepositoryHeader({
  repo,
  onStar,
  onFork,
  onWatch,
}: RepositoryHeaderProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="bg-card border-border border-b">
      <div className="px-6 py-4">
        {/* Repository Title and Description */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <h1 className="text-foreground text-2xl font-semibold">
              {repo.name}
            </h1>
            <Badge
              variant={repo.isPublic ? 'default' : 'secondary'}
              className="bg-muted text-muted-foreground border-border text-xs"
            >
              {repo.isPublic ? (
                <>
                  <Unlock className="mr-1 h-3 w-3" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="mr-1 h-3 w-3" />
                  Private
                </>
              )}
            </Badge>
          </div>
          {repo.description && (
            <p className="text-muted-foreground text-sm">{repo.description}</p>
          )}
        </div>

        {/* Repository Stats and Actions */}
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              <span>Default: {repo.defaultBranch}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>Updated {formatDate(repo.updatedAt)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onWatch}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Eye className="mr-1 h-4 w-4" />
              Watch
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onFork}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <GitFork className="mr-1 h-4 w-4" />
              Fork
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onStar}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <Star className="mr-1 h-4 w-4" />
              Star
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
