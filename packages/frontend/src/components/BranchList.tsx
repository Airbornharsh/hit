import { useState, useEffect } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { BranchCard } from './BranchCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, GitBranch } from 'lucide-react'
import { Branch } from '@/types/repo'

interface BranchListProps {
  repoName: string
}

export function BranchList({ repoName }: BranchListProps) {
  const {
    branches,
    isBranchesLoading,
    branchesError,
    branchesPagination,
    fetchBranches,
    setActiveBranch,
    getDefaultBranch,
  } = useRepoStore()

  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  useEffect(() => {
    if (repoName) {
      fetchBranches(repoName, { page: currentPage, limit: itemsPerPage })
    }
  }, [repoName, currentPage, fetchBranches])

  const handleBranchSelect = (branch: Branch) => {
    setActiveBranch(branch)
  }

  const handleRefresh = () => {
    fetchBranches(repoName, { page: currentPage, limit: itemsPerPage })
  }

  const handleNextPage = () => {
    if (branchesPagination?.hasNext) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchBranches(repoName, { page: nextPage, limit: itemsPerPage })
    }
  }

  const handlePrevPage = () => {
    if (branchesPagination?.hasPrev) {
      const prevPage = currentPage - 1
      setCurrentPage(prevPage)
      fetchBranches(repoName, { page: prevPage, limit: itemsPerPage })
    }
  }

  const defaultBranch = getDefaultBranch()

  if (isBranchesLoading && branches.length === 0) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border bg-card rounded-lg border p-6">
            <div className="mb-3 flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="mb-2 h-6 w-32" />
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

  if (branchesError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {branchesError}
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
    <div className="border-border bg-card space-y-4 rounded-lg border">
      <div className="border-border flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Branches</h2>
          <p className="text-muted-foreground text-sm">
            {branchesPagination?.total || 0} branches
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isBranchesLoading}
          className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw
            className={`h-4 w-4 ${isBranchesLoading ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>

      {branches.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-muted-foreground mb-4">
            <GitBranch className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            No branches found
          </h3>
          <p className="text-muted-foreground">
            This repository doesn&apos;t have any branches yet.
          </p>
        </div>
      ) : (
        <>
          <div className="divide-border divide-y">
            {branches.map((branch) => (
              <BranchCard
                key={branch._id}
                branch={branch}
                isDefault={defaultBranch?._id === branch._id}
                onSelect={handleBranchSelect}
              />
            ))}
          </div>

          {branchesPagination &&
            (branchesPagination.hasNext || branchesPagination.hasPrev) && (
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                  Page {branchesPagination.page} of{' '}
                  {branchesPagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePrevPage}
                    disabled={!branchesPagination.hasPrev || isBranchesLoading}
                    className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={!branchesPagination.hasNext || isBranchesLoading}
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
