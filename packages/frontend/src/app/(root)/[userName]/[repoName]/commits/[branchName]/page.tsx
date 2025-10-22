'use client'

import { useEffect, useState, use, useRef, useCallback } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { BranchSelector } from '@/components/repository/BranchSelector'
import { CommitsFilter } from '@/components/CommitsFilter'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { GitCommit, Copy, Check, ChevronRight } from 'lucide-react'
import { Commit, Branch } from '@/types/repo'
import { cn } from '@/lib/utils'

interface CommitsPageProps {
  params: Promise<{
    userName: string
    repoName: string
    branchName: string
  }>
}

interface CommitWithAuthor extends Commit {
  authorName?: string
  authorEmail?: string
  authorAvatar?: string
}

interface CommitsByDate {
  [date: string]: CommitWithAuthor[]
}

export default function CommitsPage({ params }: CommitsPageProps) {
  const { userName, repoName, branchName } = use(params)

  const {
    commits,
    isCommitsLoading,
    commitsError,
    commitsPagination,
    fetchCommits,
    fetchBranches,
    setActiveBranch,
    setMetadata,
  } = useRepoStore()

  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [commitsByDate, setCommitsByDate] = useState<CommitsByDate>({})
  const [userFilter, setUserFilter] = useState<string>('all')
  const [timeFilter, setTimeFilter] = useState<string>('all')
  const callOnce = useRef(false)

  // Set metadata and fetch data
  useEffect(() => {
    setMetadata({
      username: userName,
      repoName,
      branchName,
      commitHash: null,
    })
  }, [userName, repoName, branchName, setMetadata])

  const fetchCommitsWithFilters = useCallback(() => {
    const params: {
      page: number
      limit: number
      sortBy: string
      sortOrder: 'asc' | 'desc'
      author?: string
      startDate?: string
      endDate?: string
    } = {
      page: 1,
      limit: 50,
      sortBy: 'timestamp',
      sortOrder: 'desc',
    }

    // Add author filter
    if (userFilter !== 'all') {
      params.author = userFilter
    }

    // Add date range filter based on time filter
    if (timeFilter !== 'all') {
      const now = new Date()
      let startDate: Date
      const endDate: Date = now

      switch (timeFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
          break
        default:
          startDate = new Date(0) // All time
      }

      params.startDate = startDate.toISOString()
      params.endDate = endDate.toISOString()
    }

    fetchCommits(repoName, branchName, params)
  }, [repoName, branchName, userFilter, timeFilter, fetchCommits])

  useEffect(() => {
    if (repoName && branchName && !callOnce.current) {
      callOnce.current = true
      fetchCommitsWithFilters()
    }
  }, [repoName, branchName, fetchCommitsWithFilters])

  useEffect(() => {
    if (repoName) {
      fetchBranches(repoName, { page: 1, limit: 50 })
    }
  }, [repoName, fetchBranches])

  // Group commits by date (now using server-filtered commits)
  useEffect(() => {
    if (commits.length > 0) {
      const grouped: CommitsByDate = {}

      commits.forEach((commit) => {
        const commitDate = new Date(commit.timestamp)
        const dateKey = commitDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })

        if (!grouped[dateKey]) {
          grouped[dateKey] = []
        }

        grouped[dateKey].push(commit as CommitWithAuthor)
      })

      setCommitsByDate(grouped)
    } else {
      setCommitsByDate({})
    }
  }, [commits])

  const handleBranchSelect = (branch: Branch) => {
    setActiveBranch(branch)
    window.location.href = `/${userName}/${repoName}/commits/${branch.name}`
  }

  const handleCopyHash = async (hash: string) => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopiedHash(hash)
      setTimeout(() => setCopiedHash(null), 2000)
    } catch (err) {
      console.error('Failed to copy hash:', err)
    }
  }

  const formatCommitTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    )

    if (diffInDays === 0) return 'committed today'
    if (diffInDays === 1) return 'committed yesterday'
    if (diffInDays < 7) return 'committed this week'
    if (diffInDays < 30) return 'committed last week'
    if (diffInDays < 365) return 'committed last month'
    return 'committed last year'
  }

  const getUniqueAuthors = () => {
    const authors = new Set<string>()
    commits.forEach((commit) => {
      if (commit.author) {
        authors.add(commit.author)
      }
    })
    return Array.from(authors)
  }

  const handleUserFilter = (user: string) => {
    setUserFilter(user)
    fetchCommitsWithFilters()
  }

  const handleTimeFilter = (time: string) => {
    setTimeFilter(time)
    fetchCommitsWithFilters()
  }

  if (isCommitsLoading && commits.length === 0) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <div className="flex items-center gap-4">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>

          {/* Commits skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-card rounded-lg border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Skeleton className="mb-2 h-6 w-96" />
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (commitsError) {
    return (
      <div className="h-full overflow-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            {commitsError}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchCommits(repoName, branchName)}
              className="ml-2"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-foreground text-3xl font-bold">Commits</h1>
            <div className="flex items-center gap-4">
              <BranchSelector
                repoName={repoName}
                activeBranch={branchName}
                onBranchSelect={handleBranchSelect}
              />
              <CommitsFilter
                onUserFilter={handleUserFilter}
                onTimeFilter={handleTimeFilter}
                availableUsers={getUniqueAuthors()}
              />
            </div>
          </div>
        </div>

        {/* Commits by date */}
        {Object.keys(commitsByDate).length === 0 ? (
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
          <div className="space-y-8">
            {Object.entries(commitsByDate).map(([date, dateCommits]) => (
              <div key={date} className="space-y-4">
                {/* Date header */}
                <div className="flex items-center gap-3">
                  <h2 className="text-foreground text-lg font-semibold">
                    Commits on {date}
                  </h2>
                </div>

                {/* Commits for this date */}
                <div className="ml-4 space-y-1">
                  {dateCommits.map((commit, index) => (
                    <div
                      key={commit._id}
                      className={cn(
                        'border-border bg-card hover:bg-accent/50 flex items-center justify-between rounded-lg border p-4 transition-colors',
                        index < dateCommits.length - 1 && 'border-b',
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-foreground font-semibold">
                              {commit.message}
                            </h3>
                            <div className="text-muted-foreground mt-2 flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2">
                                {/* <div className="bg-muted h-6 w-6 rounded-full"></div> */}
                                <span>{commit.author}</span>
                              </div>
                              <span>{formatCommitTime(commit.timestamp)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {commit.hash.slice(0, 7)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyHash(commit.hash)}
                          className="h-8 w-8 p-0"
                        >
                          {copiedHash === commit.hash ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {commitsPagination &&
          (commitsPagination.hasNext || commitsPagination.hasPrev) && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                onClick={() =>
                  fetchCommits(repoName, branchName, {
                    page: (commitsPagination.page || 1) - 1,
                    limit: 50,
                  })
                }
                disabled={!commitsPagination.hasPrev || isCommitsLoading}
                className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {commitsPagination.page} of {commitsPagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() =>
                  fetchCommits(repoName, branchName, {
                    page: (commitsPagination.page || 1) + 1,
                    limit: 50,
                  })
                }
                disabled={!commitsPagination.hasNext || isCommitsLoading}
                className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                Next
              </Button>
            </div>
          )}
      </div>
    </div>
  )
}
