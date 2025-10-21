import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useRepoStore } from '@/stores/repoStore'
import { RepositoryCard } from './RepositoryCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

export function RepositoryList() {
  const router = useRouter()
  const {
    repos,
    isReposLoading,
    reposError,
    reposPagination,
    fetchRepos,
    metadata,
  } = useRepoStore()

  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const itemsPerPage = 10

  const handleRefresh = () => {
    fetchRepos({ page: currentPage, limit: itemsPerPage })
  }

  const handleNextPage = () => {
    if (reposPagination?.hasNext) {
      const nextPage = currentPage + 1
      setCurrentPage(nextPage)
      fetchRepos({ page: nextPage, limit: itemsPerPage })
    }
  }

  const handlePrevPage = () => {
    if (reposPagination?.hasPrev) {
      const prevPage = currentPage - 1
      setCurrentPage(prevPage)
      fetchRepos({ page: prevPage, limit: itemsPerPage })
    }
  }

  if (isReposLoading && repos.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border border-b px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="mb-2 h-4 w-64" />
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (reposError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {reposError}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">
            Repositories
          </h1>
          <p className="text-muted-foreground text-sm">
            {reposPagination?.total || 0} repositories
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isReposLoading}
            size="sm"
            className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <RefreshCw
              className={`h-4 w-4 ${isReposLoading ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            size="sm"
            onClick={() =>
              router.push(`/${metadata.username}/repositories/new`)
            }
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Find a repository..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearchQuery(e.target.value)
          }
          className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring pl-10"
        />
      </div>

      {/* Repository List */}
      {repos.length === 0 ? (
        <div className="border-border bg-card rounded-lg border py-12 text-center">
          <div className="text-muted-foreground mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            No repositories found
          </h3>
          <p className="text-muted-foreground mb-4">
            Get started by creating a new repository.
          </p>
          <Button
            onClick={() =>
              router.push(`/${metadata.username}/repositories/new`)
            }
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Repository
          </Button>
        </div>
      ) : (
        <>
          <div>
            {repos.map((repo) => (
              <RepositoryCard key={repo._id} repo={repo} />
            ))}
          </div>

          {/* Pagination */}
          {reposPagination &&
            (reposPagination.hasNext || reposPagination.hasPrev) && (
              <div className="border-border bg-card flex items-center justify-between rounded-lg border px-6 py-4">
                <div className="text-muted-foreground text-sm">
                  Page {reposPagination.page} of {reposPagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePrevPage}
                    disabled={!reposPagination.hasPrev || isReposLoading}
                    size="sm"
                    className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleNextPage}
                    disabled={!reposPagination.hasNext || isReposLoading}
                    size="sm"
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
