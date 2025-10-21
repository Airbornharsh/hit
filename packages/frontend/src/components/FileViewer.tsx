'use client'

import { useState, useEffect } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { File, Copy, Download, Eye, EyeOff, ChevronDown } from 'lucide-react'

interface FileViewerProps {
  filePath: string
  branchName: string
  repoName: string
}

export function FileViewer({
  filePath,
  branchName,
  repoName,
}: FileViewerProps) {
  const { files, fetchFile, isReposLoading, reposError } = useRepoStore()
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [copied, setCopied] = useState(false)

  const fileName = filePath.split('/').pop() || ''
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || ''
  const currentFile = files.currentFile
  const fileContent = currentFile?.content || ''
  const isLoading = isReposLoading
  const error = reposError

  useEffect(() => {
    // Fetch file content from API
    if (filePath && branchName && repoName) {
      fetchFile(repoName, branchName, filePath)
    }
  }, [filePath, branchName, repoName, fetchFile])

  const getFileIcon = (extension: string) => {
    switch (extension) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return '📄'
      case 'py':
        return '🐍'
      case 'go':
        return '🐹'
      case 'md':
        return '📝'
      case 'json':
        return '📋'
      case 'css':
        return '🎨'
      case 'html':
        return '🌐'
      default:
        return '📄'
    }
  }

  const getLanguage = (extension: string) => {
    switch (extension) {
      case 'js':
        return 'JavaScript'
      case 'ts':
        return 'TypeScript'
      case 'jsx':
        return 'JavaScript'
      case 'tsx':
        return 'TypeScript'
      case 'py':
        return 'Python'
      case 'go':
        return 'Go'
      case 'md':
        return 'Markdown'
      case 'json':
        return 'JSON'
      case 'css':
        return 'CSS'
      case 'html':
        return 'HTML'
      default:
        return 'Text'
    }
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fileContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const downloadFile = () => {
    const blob = new Blob([fileContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatFileSize = (content: string) => {
    const bytes = new Blob([content]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (isLoading) {
    return (
      <Card className="border-border bg-card rounded-l-none border-l-0">
        <CardContent className="py-8 text-center">
          <div className="text-muted-foreground mb-2">
            <File className="mx-auto h-12 w-12 animate-pulse" />
          </div>
          <p className="text-muted-foreground">Loading file...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-border bg-card rounded-l-none border-l-0">
        <CardContent className="py-8 text-center">
          <div className="text-destructive mb-2">
            <File className="mx-auto h-12 w-12" />
          </div>
          <p className="text-destructive">Failed to load file</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const lines = fileContent.split('\n')
  const lineCount = lines.length

  return (
    <Card className="border-border bg-card rounded-l-none border-l-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getFileIcon(fileExtension)}</span>
            <div>
              <CardTitle className="text-foreground text-lg">
                {fileName}
              </CardTitle>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Badge variant="secondary">{getLanguage(fileExtension)}</Badge>
                <span>{lineCount} lines</span>
                <span>•</span>
                <span>{formatFileSize(fileContent)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLineNumbers(!showLineNumbers)}
            >
              {showLineNumbers ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {showLineNumbers ? 'Hide' : 'Show'} line numbers
            </Button>

            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              {copied ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? 'Copied!' : 'Copy'}
            </Button>

            <Button variant="outline" size="sm" onClick={downloadFile}>
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="border-border border-t">
          <div className="bg-muted/30 text-muted-foreground px-4 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Code</span>
              <div className="flex items-center gap-4">
                <span>{lineCount} lines</span>
                <span>•</span>
                <span>{formatFileSize(fileContent)}</span>
              </div>
            </div>
          </div>

          <div className="h-[calc(100vh-14rem)] overflow-x-auto">
            <div className="flex">
              {showLineNumbers && (
                <div className="bg-muted/50 border-border text-muted-foreground border-r px-4 py-2 text-right text-sm">
                  {lines.map((_, index) => (
                    <div key={index} className="leading-6">
                      {index + 1}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex-1">
                <pre className="px-4 py-2 text-sm">
                  <code className="text-foreground">
                    {lines.map((line, index) => (
                      <div key={index} className="leading-6">
                        {line || ' '}
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
