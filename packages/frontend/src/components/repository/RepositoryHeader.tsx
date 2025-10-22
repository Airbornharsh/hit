'use client'

import { Badge } from '@/components/ui/badge'
import { Lock, Unlock } from 'lucide-react'
import { Branch, Repo } from '@/types/repo'
import { BranchSelector } from './BranchSelector'
import { useRepoStore } from '@/stores/repoStore'
import Link from 'next/link'

interface RepositoryHeaderProps {
  repo: Repo
  onBranchSelect: (branch: Branch) => void
  activeBranch: string | null
}

export function RepositoryHeader({
  repo,
  onBranchSelect,
  activeBranch,
}: RepositoryHeaderProps) {
  const { totalCommits, metadata } = useRepoStore()

  return (
    <div className="bg-card border-border flex items-center justify-between border-b px-6 py-4">
      <div>
        <div className="flex items-center gap-2">
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
        <Link
          href={`/${metadata.username}/${repo.name}/commits/${activeBranch}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          {totalCommits} commits
        </Link>
      </div>
      <BranchSelector
        repoName={repo.name}
        activeBranch={activeBranch}
        onBranchSelect={onBranchSelect}
      />
    </div>
  )
}
