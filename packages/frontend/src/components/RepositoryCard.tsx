import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Repo } from '@/types/repo'
import { Calendar, GitBranch, Lock, Unlock } from 'lucide-react'
import { useRepoStore } from '@/stores/repoStore'

interface RepositoryCardProps {
  repo: Repo
}

export function RepositoryCard({ repo }: RepositoryCardProps) {
  const { metadata } = useRepoStore()
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="border-border bg-card hover:bg-accent overflow-hidden rounded-lg p-4 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Link
            href={`/${metadata.username}/${repo.name}`}
            className="text-primary hover:text-primary/80 text-lg font-semibold"
          >
            {repo.name}
          </Link>
          <Badge
            variant={repo.isPublic ? 'default' : 'secondary'}
            className="border-border bg-muted text-muted-foreground text-xs"
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
          <p className="text-muted-foreground mb-2 line-clamp-2 text-sm">
            {repo.description}
          </p>
        )}

        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            <span>{repo.defaultBranch}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Updated {formatDate(repo.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
