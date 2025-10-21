'use client'

import { useEffect, use } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { CommitList } from '@/components/CommitList'
import { Button } from '@/components/ui/button'
import { ArrowLeft, GitCommit } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface BranchPageProps {
  params: Promise<{
    userName: string
    repoName: string
    branchName: string
  }>
}

export default function BranchPage({ params }: BranchPageProps) {
  const { userName, repoName, branchName } = use(params)
  const { activeBranch, fetchBranch, setMetadata } = useRepoStore()
  const router = useRouter()

  useEffect(() => {
    setMetadata({
      username: userName,
      repoName: repoName,
      branchName: branchName,
      commitHash: null,
    })

    if (repoName && branchName) {
      fetchBranch(repoName, branchName)
    }
  }, [repoName, branchName, fetchBranch, setMetadata, userName])

  const handleBack = () => {
    router.push(`/${userName}/${repoName}`)
  }

  if (!activeBranch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Repository
          </Button>
        </div>
        <div className="py-12 text-center">
          <div className="text-muted-foreground mb-4">
            <GitCommit className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            Loading branch...
          </h3>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Repository
        </Button>
      </div>

      <div className="mb-8">
        <h1 className="text-foreground mb-2 text-3xl font-bold">
          {branchName}
        </h1>
        <p className="text-muted-foreground mb-4">Branch in {repoName}</p>
        <div className="text-muted-foreground flex items-center gap-4 text-sm">
          <span>Head commit: {activeBranch.headCommit.slice(0, 8)}</span>
          <span>•</span>
          <span>
            Updated {new Date(activeBranch.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <CommitList repoName={repoName} branchName={branchName} />
    </div>
  )
}
