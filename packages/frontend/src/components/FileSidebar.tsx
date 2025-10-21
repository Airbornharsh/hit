'use client'

import { useState, useEffect } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  GitBranch,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface FileSidebarProps {
  currentPath: string
  branchName: string
  repoName: string
  userName: string
  onPathChange?: (path: string) => void
}

interface FileTreeNode {
  name: string
  type: 'file' | 'directory'
  path: string
  lastModified: string
  children?: FileTreeNode[]
  expanded?: boolean
}

export function FileSidebar({
  currentPath,
  branchName,
  repoName,
  userName,
  onPathChange,
}: FileSidebarProps) {
  const { sidebar } = useRepoStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['']))
  const [lastClickTime, setLastClickTime] = useState<number>(0)
  const fileTree = sidebar.tree || []
  useEffect(() => {
    if (currentPath) {
      const pathParts = currentPath.split('/')
      const parentPaths: string[] = []

      for (let i = 1; i < pathParts.length; i++) {
        parentPaths.push(pathParts.slice(0, i).join('/'))
      }

      setExpandedDirs((prev) => {
        const newSet = new Set(prev)
        parentPaths.forEach((path) => newSet.add(path))
        return newSet
      })
    }
  }, [currentPath])

  useEffect(() => {
    if (currentPath) {
      setTimeout(() => {
        const currentElement = document.querySelector(
          `[data-path="${currentPath}"]`,
        )
        if (currentElement) {
          currentElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          })
        }
      }, 100)
    }
  }, [currentPath])

  const toggleDirectory = (path: string) => {
    const now = Date.now()

    if (now - lastClickTime < 300) {
      return
    }
    setLastClickTime(now)

    const newExpanded = new Set(expandedDirs)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedDirs(newExpanded)
  }

  const getItemHref = (item: FileTreeNode) => {
    if (item.type === 'directory') {
      return `/${userName}/${repoName}/tree/${branchName}/${item.path}`
    } else {
      return `/${userName}/${repoName}/blob/${branchName}/${item.path}`
    }
  }

  const getFileIcon = (item: FileTreeNode) => {
    if (item.type === 'directory') {
      return expandedDirs.has(item.path) ? FolderOpen : Folder
    }
    return File
  }

  const renderFileTreeNode = (node: FileTreeNode, depth = 0) => {
    const isExpanded = expandedDirs.has(node.path)
    const isCurrentPath = currentPath === node.path
    const Icon = getFileIcon(node)
    const href = getItemHref(node)

    const handleDirectoryClick = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      toggleDirectory(node.path)
    }

    const handleItemClick = () => {
      if (node.type === 'file' || (node.type === 'directory' && onPathChange)) {
        if (onPathChange) {
          onPathChange(node.path)
        }
      }
    }

    return (
      <div key={node.path}>
        <Link
          href={href}
          data-path={node.path}
          className={cn(
            'hover:bg-muted/50 flex items-center gap-2 rounded-sm py-1.5 text-sm transition-colors',
            isCurrentPath && 'bg-primary/10',
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={handleItemClick}
        >
          {node.type === 'directory' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 flex-shrink-0 p-0 hover:bg-transparent"
              onClick={handleDirectoryClick}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}

          {node.type === 'file' && <div className="w-4 flex-shrink-0"></div>}

          <Icon
            className={cn(
              'h-4 w-4 flex-shrink-0',
              node.type === 'directory' ? 'text-blue-500' : 'text-gray-400',
            )}
          />
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              isCurrentPath && 'text-primary font-semibold',
            )}
          >
            {node.name}
          </span>
        </Link>

        {node.children && isExpanded && (
          <div className="ml-0">
            {node.children.map((child) => renderFileTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const filterTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
    if (!searchQuery) return nodes

    return nodes.filter((node) => {
      const matchesSearch = node.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const hasMatchingChildren = node.children
        ? filterTree(node.children).length > 0
        : false

      if (matchesSearch || hasMatchingChildren) {
        return {
          ...node,
          children: node.children ? filterTree(node.children) : undefined,
        }
      }
      return false
    })
  }

  const filteredTree = filterTree(fileTree)

  return (
    <Card className="border-border bg-card h-full rounded-r-none p-2">
      <CardHeader className="px-2 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="text-muted-foreground h-4 w-4" />
          <CardTitle className="text-foreground text-sm font-medium">
            Files
          </CardTitle>
        </div>

        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">
            Branch: <span className="font-medium">{branchName}</span>
          </div>

          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Go to file"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-2">
        <div className="h-[calc(100vh-15.5rem)] overflow-y-auto">
          {filteredTree.length === 0 ? (
            <div className="text-muted-foreground p-4 text-center text-sm">
              {searchQuery ? 'No files found' : 'No files'}
            </div>
          ) : (
            <div className="py-1">
              {filteredTree.map((node) => renderFileTreeNode(node))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
