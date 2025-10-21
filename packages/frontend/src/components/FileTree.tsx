'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  FileText,
  Image,
  Code,
  Archive,
  FileCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  lastModified: string
  path?: string
}

interface FileTreeProps {
  files: FileItem[]
  currentPath?: string
  onFileSelect?: (file: FileItem) => void
  onDirectorySelect?: (path: string) => void
  userName?: string
  repoName?: string
  branchName?: string
  root?: boolean
}

export function FileTree({
  files,
  onFileSelect,
  onDirectorySelect,
  userName,
  repoName,
  branchName,
  root = false,
}: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']))
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const getFileIcon = (fileName: string, type: 'file' | 'directory') => {
    if (type === 'directory') {
      return expandedDirs.has(fileName) ? FolderOpen : Folder
    }

    const extension = fileName.split('.').pop()?.toLowerCase()

    switch (extension) {
      case 'md':
      case 'txt':
      case 'rtf':
        return FileText
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return Image
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
      case 'py':
      case 'java':
      case 'cpp':
      case 'c':
      case 'cs':
      case 'php':
      case 'rb':
      case 'go':
      case 'rs':
      case 'swift':
      case 'kt':
        return Code
      case 'zip':
      case 'rar':
      case '7z':
      case 'tar':
      case 'gz':
        return Archive
      case 'json':
      case 'xml':
      case 'yaml':
      case 'yml':
      case 'toml':
        return FileCode
      default:
        return File
    }
  }

  const toggleDirectory = (dirName: string) => {
    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(dirName)) {
      newExpanded.delete(dirName)
    } else {
      newExpanded.add(dirName)
    }
    setExpandedDirs(newExpanded)

    if (onDirectorySelect) {
      onDirectorySelect(dirName)
    }
  }

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file.name)
    if (onFileSelect) {
      onFileSelect(file)
    }
  }

  const getItemHref = (file: FileItem) => {
    if (!userName || !repoName || !branchName) return '#'

    const filePath = file.path || file.name
    if (file.type === 'directory') {
      return `/${userName}/${repoName}/tree/${branchName}/${filePath}`
    } else {
      return `/${userName}/${repoName}/blob/${branchName}/${filePath}`
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (!files || files.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-8 text-center">
          <div className="text-muted-foreground mb-2">
            <File className="mx-auto h-12 w-12" />
          </div>
          <p className="text-muted-foreground">No files found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'border-border bg-card',
        root && 'rounded-none border-none',
      )}
    >
      <CardContent className="p-0 pt-3">
        <div className="border-border border-b">
          <div className="text-muted-foreground flex items-center px-4 py-2 text-sm font-medium">
            <div className="w-8"></div>
            <div className="flex-1">Name</div>
            <div className="w-24 text-right">Last modified</div>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {files.map((file, index) => {
            const Icon = getFileIcon(file.name, file.type)
            const isExpanded = expandedDirs.has(file.name)
            const isSelected = selectedFile === file.name

            const href = getItemHref(file)

            return (
              <Link
                key={`${file.name}-${index}`}
                href={href}
                className={cn(
                  'hover:bg-muted/50 flex cursor-pointer items-center px-4 py-2 text-sm transition-colors',
                  isSelected && 'bg-muted',
                )}
                onClick={() => handleFileClick(file)}
              >
                <div className="flex min-w-0 flex-1 items-center">
                  {file.type === 'directory' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mr-1 h-4 w-4 p-0 hover:bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleDirectory(file.name)
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </Button>
                  ) : (
                    <div className="mr-1 w-4"></div>
                  )}

                  <Icon className="mr-2 h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>

                <div className="text-muted-foreground ml-4 text-xs">
                  {formatDate(file.lastModified)} at{' '}
                  {formatTime(file.lastModified)}
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
