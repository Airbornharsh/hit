'use client'

import { useEffect } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { File, Folder, FolderOpen } from 'lucide-react'
import Link from 'next/link'

interface DirectoryViewerProps {
  directoryPath: string
  branchName: string
  repoName: string
  userName: string
}

interface DirectoryItem {
  name: string
  type: 'file' | 'directory'
  lastModified: string
  size?: string
  commitMessage?: string
  commitHash?: string
}

export function DirectoryViewer({
  directoryPath,
  branchName,
  repoName,
  userName,
}: DirectoryViewerProps) {
  const { files, fetchFiles, isReposLoading, reposError } = useRepoStore()
  const items = files.current || []
  const isLoading = isReposLoading
  const error = reposError

  useEffect(() => {
    if (branchName && repoName) {
      fetchFiles(repoName, branchName, directoryPath)
    }
  }, [directoryPath, branchName, repoName, fetchFiles])

  const getFileIcon = (item: DirectoryItem) => {
    if (item.type === 'directory') {
      return item.name === '..' ? Folder : FolderOpen
    }
    return File
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getItemHref = (item: DirectoryItem) => {
    if (item.name === '..') {
      const pathParts = directoryPath.split('/').filter(Boolean)
      pathParts.pop()
      const newPath = pathParts.join('/')
      return `/${userName}/${repoName}/tree/${branchName}${newPath ? `/${newPath}` : ''}`
    }

    const newPath = directoryPath ? `${directoryPath}/${item.name}` : item.name

    if (item.type === 'directory') {
      return `/${userName}/${repoName}/tree/${branchName}/${newPath}`
    } else {
      return `/${userName}/${repoName}/blob/${branchName}/${newPath}`
    }
  }

  if (isLoading) {
    return (
      <Card className="border-border bg-card rounded-l-none border-l-0">
        <CardContent className="py-8 text-center">
          <div className="text-muted-foreground mb-2">
            <Folder className="mx-auto h-12 w-12 animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading directory...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-border bg-card rounded-l-none border-l-0">
        <CardContent className="py-8 text-center">
          <div className="text-destructive mb-2">
            <Folder className="mx-auto h-12 w-12" />
          </div>
          <p className="text-destructive">Failed to load directory</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card rounded-l-none border-l-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="text-muted-foreground h-6 w-6" />
            <div>
              <CardTitle className="text-foreground text-lg">
                {directoryPath || 'Root Directory'}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {items.length} items
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-border border-b">
          <div className="text-muted-foreground flex items-center px-4 py-2 text-sm font-medium">
            <div className="w-8"></div>
            <div className="flex-1">Name</div>
            <div className="w-32">Last commit message</div>
            <div className="w-24 text-right">Last commit date</div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.map((item, index) => {
            const Icon = getFileIcon(item)
            const href = getItemHref(item)

            return (
              <Link
                key={`${item.name}-${index}`}
                href={href}
                className="hover:bg-muted/50 flex items-center px-4 py-2 text-sm transition-colors"
              >
                <div className="flex min-w-0 flex-1 items-center">
                  <div className="flex w-8 justify-center">
                    <Icon className="text-muted-foreground h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="truncate font-medium">{item.name}</span>
                  </div>
                </div>

                <div className="w-32 min-w-0">
                  <span className="text-muted-foreground truncate text-xs">
                    {'No commits'}
                  </span>
                </div>

                <div className="text-muted-foreground w-24 text-right text-xs">
                  {formatDate(item.lastModified)}
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
