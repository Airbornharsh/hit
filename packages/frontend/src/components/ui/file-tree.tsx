'use client'

import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CommitFile } from '@/types/repo'

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  file?: CommitFile
  expanded?: boolean
}

interface FileTreeProps {
  files: CommitFile[]
  selectedFileIndex: number
  onFileSelect: (index: number) => void
}

export function FileTree({
  files,
  selectedFileIndex,
  onFileSelect,
}: FileTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Build tree structure from files
  const buildTree = (files: CommitFile[]): FileTreeNode[] => {
    const tree: FileTreeNode[] = []
    const pathMap = new Map<string, FileTreeNode>()

    files.forEach((file) => {
      const pathParts = file.name.split('/')
      let currentPath = ''
      let parentNode: FileTreeNode | null = null

      pathParts.forEach((part, partIndex) => {
        const isLast = partIndex === pathParts.length - 1
        currentPath = currentPath ? `${currentPath}/${part}` : part

        if (!pathMap.has(currentPath)) {
          const node: FileTreeNode = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'folder',
            children: [],
            expanded: false,
          }

          if (isLast) {
            node.file = file
          }

          pathMap.set(currentPath, node)

          if (parentNode) {
            parentNode.children!.push(node)
          } else {
            tree.push(node)
          }
        }

        parentNode = pathMap.get(currentPath)!
      })
    })

    return tree
  }

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  const getFileIndex = (file: CommitFile): number => {
    return files.findIndex((f) => f.name === file.name)
  }

  const renderNode = (node: FileTreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path)
    const isSelected =
      node.file && getFileIndex(node.file) === selectedFileIndex

    return (
      <div key={node.path}>
        <div
          className={cn(
            'hover:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1',
            isSelected && 'bg-accent',
          )}
          style={{ paddingLeft: `${depth * 16}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              toggleFolder(node.path)
            } else if (node.file) {
              onFileSelect(getFileIndex(node.file))
            }
          }}
        >
          {node.type === 'folder' ? (
            <>
              {isExpanded ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-blue-500" />
              )}
            </>
          ) : (
            <>
              <div className="w-4" /> {/* Spacer for alignment */}
              <File className="text-muted-foreground h-4 w-4" />
            </>
          )}

          <span className="truncate text-sm font-medium">{node.name}</span>

          {node.file && (
            <div className="ml-auto flex items-center gap-1">
              {node.file.additions > 0 && (
                <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600">
                  +{node.file.additions}
                </span>
              )}
              {node.file.deletions > 0 && (
                <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600">
                  -{node.file.deletions}
                </span>
              )}
            </div>
          )}
        </div>

        {node.type === 'folder' && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const tree = buildTree(files)

  return (
    <div className="h-full overflow-y-auto">
      {tree.map((node) => renderNode(node))}
    </div>
  )
}
