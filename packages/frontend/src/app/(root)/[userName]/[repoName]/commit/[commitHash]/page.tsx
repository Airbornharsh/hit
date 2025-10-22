'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  GitCommit,
  Copy,
  Check,
  ChevronLeft,
  FileText,
  Calendar,
  User,
  Hash,
} from 'lucide-react'
import { CodeComparison } from '@/components/ui/code-comparison'
import { FileTree } from '@/components/ui/file-tree'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface CommitPageProps {
  params: Promise<{
    userName: string
    repoName: string
    commitHash: string
  }>
}

export default function CommitPage({ params }: CommitPageProps) {
  const { userName, repoName, commitHash } = use(params)
  const router = useRouter()

  const {
    commitDetails,
    isCommitsLoading,
    commitsError,
    fetchCommitDetails,
    setMetadata,
  } = useRepoStore()

  const [copiedHash, setCopiedHash] = useState<string | null>(null)
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0)
  const callOnce = useRef(false)

  // Set metadata and fetch data
  useEffect(() => {
    setMetadata({
      username: userName,
      repoName,
      branchName: null,
      commitHash,
    })
  }, [userName, repoName, commitHash, setMetadata])

  useEffect(() => {
    if (repoName && commitHash && !callOnce.current) {
      callOnce.current = true
      fetchCommitDetails(repoName, commitHash)
    }
  }, [repoName, commitHash, fetchCommitDetails])

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

  const getFileLanguage = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'ts':
      case 'tsx':
        return 'typescript'
      case 'js':
      case 'jsx':
        return 'javascript'
      case 'py':
        return 'python'
      case 'go':
        return 'go'
      case 'rs':
        return 'rust'
      case 'java':
        return 'java'
      case 'cpp':
      case 'cc':
        return 'cpp'
      case 'c':
        return 'c'
      case 'cs':
        return 'csharp'
      case 'php':
        return 'php'
      case 'rb':
        return 'ruby'
      case 'swift':
        return 'swift'
      case 'kt':
        return 'kotlin'
      case 'scala':
        return 'scala'
      case 'html':
        return 'html'
      case 'css':
        return 'css'
      case 'scss':
      case 'sass':
        return 'scss'
      case 'json':
        return 'json'
      case 'xml':
        return 'xml'
      case 'yaml':
      case 'yml':
        return 'yaml'
      case 'md':
        return 'markdown'
      case 'sh':
        return 'bash'
      case 'sql':
        return 'sql'
      default:
        return 'text'
    }
  }

  const selectFile = (index: number) => {
    setSelectedFileIndex(index)
  }

  if (isCommitsLoading && !commitDetails) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>

          {/* Stats skeleton */}
          <div className="flex gap-4">
            <Skeleton className="h-16 w-32" />
            <Skeleton className="h-16 w-32" />
            <Skeleton className="h-16 w-32" />
          </div>

          {/* Files skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="border-border bg-card rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-16" />
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
              onClick={() => fetchCommitDetails(repoName, commitHash)}
              className="ml-2"
            >
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!commitDetails) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="py-12 text-center">
          <div className="text-muted-foreground mb-4">
            <GitCommit className="mx-auto h-12 w-12" />
          </div>
          <h3 className="text-foreground mb-2 text-lg font-medium">
            Commit not found
          </h3>
          <p className="text-muted-foreground">
            The commit you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  const { commit, files, stats } = commitDetails

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border bg-card border-b p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Link
              href={`/${userName}/${repoName}`}
              className="border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Link>
            <div className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              <span className="text-foreground text-lg font-semibold">
                {commit.hash.slice(0, 7)}
              </span>
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
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-foreground text-2xl font-bold">
              {commit.message}
            </h1>
            <div className="text-muted-foreground flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{commit.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatCommitTime(commit.timestamp)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                <span className="font-mono text-xs">{commit.hash}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="border-border bg-card w-80">
          <div className="border-border flex items-center justify-between border-b p-4">
            <h2 className="text-foreground text-lg font-semibold">
              Files ({files.length})
            </h2>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span className="text-green-600">+{stats.additions}</span>
              <span className="text-red-600">-{stats.deletions}</span>
            </div>
          </div>

          <div className="h-[calc(100vh-15.8rem)]">
            <FileTree
              files={files}
              selectedFileIndex={selectedFileIndex}
              onFileSelect={selectFile}
            />
          </div>
        </div>

        <div className="h-[calc(100vh-12.2rem)] flex-1 overflow-y-auto">
          {files[selectedFileIndex] &&
          (files[selectedFileIndex].beforeCode ||
            files[selectedFileIndex].afterCode) ? (
            <CodeComparison
              beforeCode={files[selectedFileIndex].beforeCode || ''}
              afterCode={files[selectedFileIndex].afterCode || ''}
              language={getFileLanguage(files[selectedFileIndex].name)}
              filename={files[selectedFileIndex].name}
              lightTheme="github-light"
              darkTheme="github-dark"
              className="h-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <FileText className="text-muted-foreground mx-auto h-12 w-12" />
                <h3 className="text-foreground mt-4 text-lg font-medium">
                  No changes to display
                </h3>
                <p className="text-muted-foreground mt-2">
                  This file has no content changes to show.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
