import { useState, useEffect } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { CommitCard } from './CommitCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, GitCommit } from 'lucide-react'
import { Commit } from '@/types/repo'

interface CommitListProps {
  repoName: string
  branchName: string
}

export function CommitList({ repoName, branchName }: CommitListProps) {
  const {
    commits,
    isCommitsLoading,
    commitsError,
    commitsPagination,
    fetchCommits,
    setActiveCommit,
  } = useRepoStore()

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    if (repoName && branchName) {
      fetchCommits(repoName, branchName, {
        page: currentPage,
        limit: itemsPerPage,
      })
    }
  }, [repoName, branchName, currentPage, fetchCommits])

  const handleCommitSelect = (commit: Commit) => {
    setActiveCommit(commit)
  }

  const handleRefresh = () => {
    fetchCommits(repoName, branchName, {
      page: currentPage,
      limit: itemsPerPage,
    })
  }

  const handleNextPage = () => {
    if (commitsPagination?.hasNext) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchCommits(repoName, branchName, {
        page: nextPage,
        limit: itemsPerPage,
      })
    }
  }

  const handlePrevPage = () => {
    if (commitsPagination?.hasPrev) {
      const prevPage = currentPage - 1
      setCurrentPage(prevPage)
      fetchCommits(repoName, branchName, {
        page: prevPage,
        limit: itemsPerPage,
      })
    }
  }

  if (isCommitsLoading && commits.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-lg border p-6">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="mb-2 h-6 w-96" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (commitsError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {commitsError}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="ml-2"
          >
            Try Again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold">
            <GitCommit className="h-6 w-6" />
            Commits
          </h1>
          <p className="text-muted-foreground">
            {commitsPagination?.total || 0} commits in {branchName}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isCommitsLoading}
          className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw
            className={`h-4 w-4 ${isCommitsLoading ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      {commits.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-muted-foreground mb-4">
            <GitCommit className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            No commits found
          </h3>
          <p className="text-muted-foreground">
            This branch doesn&apos;t have any commits yet.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {commits.map((commit) => (
              <CommitCard
                key={commit._id}
                commit={commit}
                onSelect={handleCommitSelect}
              />
            ))}
          </div>

          {commitsPagination &&
            (commitsPagination.hasNext || commitsPagination.hasPrev) && (
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  Page {commitsPagination.page} of{' '}
                  {commitsPagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePrevPage}
                    disabled={!commitsPagination.hasPrev || isCommitsLoading}
                    className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={!commitsPagination.hasNext || isCommitsLoading}
                    className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
        </>
      )}
    </div>
  )
}
