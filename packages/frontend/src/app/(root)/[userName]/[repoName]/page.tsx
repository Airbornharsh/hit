'use client'

import { useEffect, useRef, useState, use } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { RepositoryHeader } from '@/components/repository/RepositoryHeader'
import { RepositoryTabs } from '@/components/repository/RepositoryTabs'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { FileTree } from '@/components/FileTree'
import { Branch } from '@/types/repo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch, Copy, Check } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useRouter, useSearchParams } from 'next/navigation'

interface RepositoryPageProps {
  params: Promise<{
    userName: string
    repoName: string
  }>
}

export default function RepositoryPage({ params }: RepositoryPageProps) {
  const { userName, repoName } = use(params)
  const searchParams = useSearchParams()
  const branchName = searchParams.get('branchName')
  const { user } = useAuthStore()
  const {
    activeRepo,
    fetchRepo,
    activeBranch,
    branches,
    isBranchesLoading,
    setMetadata,
    files,
  } = useRepoStore()
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const callOnce = useRef(false)
  const router = useRouter()
  console.log(selectedBranch)

  useEffect(() => {
    setMetadata({
      username: userName,
      repoName: repoName,
      branchName: branchName,
      commitHash: null,
    })
    if (userName && repoName && !callOnce.current) {
      callOnce.current = true
      fetchRepo()
    }
  }, [userName, repoName, fetchRepo, setMetadata, branchName])

  const handleBranchSelect = (branch: Branch) => {
    setMetadata({
      username: userName,
      repoName: repoName,
      branchName: branch.name,
      commitHash: null,
    })
    fetchRepo()
    setSelectedBranch(branch)
    const currentQueryParams = new URLSearchParams(window.location.search)
    currentQueryParams.set('branchName', branch.name)
    router.push(`/${userName}/${repoName}?${currentQueryParams.toString()}`)
  }

  const copyToClipboard = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommand(command)
      setTimeout(() => setCopiedCommand(null), 2000)
    } catch (err) {
      console.error('Failed to copy command:', err)
    }
  }

  if (!activeRepo) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Repositories', href: `/${userName}/repositories` },
            { label: repoName },
          ]}
        />
        <div className="border-border bg-card rounded-lg border py-12 text-center">
          <div className="text-muted-foreground mb-4">
            <div className="border-border border-t-primary mx-auto h-12 w-12 animate-spin rounded-full border-4"></div>
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            Loading repository...
          </h3>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Repositories', href: `/${userName}/repositories` },
          { label: repoName },
        ]}
        className="mb-4"
      />

      <RepositoryHeader
        repo={activeRepo}
        activeBranch={branchName}
        onBranchSelect={handleBranchSelect}
      />
      {/* <RepositoryTabs repoName={repoName} userName={userName} /> */}

      {!isBranchesLoading && branches.length === 0 ? (
        <Card className="border-border bg-card rounded-none">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Get started with your repository
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This repository is empty. Use the following commands to push your
              first commit:
            </p>

            <div className="space-y-3">
              <div className="border-border bg-muted rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <code className="text-foreground font-mono text-sm">
                    hit remote add origin hit@hithub.com:{user?.username}/
                    {activeRepo?.name}.hit
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        `hit remote add origin hit@hithub.com:${user?.username}/${activeRepo?.name}.hit`,
                      )
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedCommand ===
                    `hit remote add origin hit@hithub.com:${user?.username}/${activeRepo?.name}.hit` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="border-border bg-muted rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <code className="text-foreground font-mono text-sm">
                    hit push -u origin {activeRepo?.defaultBranch || 'main'}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        `hit push -u origin ${activeRepo?.defaultBranch || 'main'}`,
                      )
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedCommand ===
                    `hit push -u origin ${activeRepo?.defaultBranch || 'main'}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-muted-foreground text-sm">
              <p className="text-foreground mb-2 font-medium">
                Steps to get started:
              </p>
              <ol className="list-inside list-decimal space-y-1">
                <li>
                  Initialize your local repository with{' '}
                  <code className="bg-muted rounded px-1">hit init</code>
                </li>
                <li>
                  Add your files with{' '}
                  <code className="bg-muted rounded px-1">hit add .</code>
                </li>
                <li>
                  Commit your changes with{' '}
                  <code className="bg-muted rounded px-1">
                    hit commit -m &quot;Initial commit&quot;
                  </code>
                </li>
                <li>
                  Replace{' '}
                  <code className="bg-muted rounded px-1">username</code> in the
                  remote command with your actual username (e.g., Airbornharsh)
                </li>
                <li>
                  Run the commands above to connect and push to this repository
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      ) : (
        <FileTree
          files={files.current || []}
          currentPath={files.path || ''}
          userName={userName}
          repoName={repoName}
          branchName={activeBranch?.name || 'main'}
          root={true}
          onFileSelect={(file) => {
            console.log('Selected file:', file)
          }}
          onDirectorySelect={(path) => {
            console.log('Selected directory:', path)
          }}
        />
      )}
    </div>
  )
}
