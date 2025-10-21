'use client'

import { use, useEffect } from 'react'
import { FileViewer } from '@/components/FileViewer'
import { DirectoryViewer } from '@/components/DirectoryViewer'
import { useRouter } from 'next/navigation'

interface PageProps {
  params: Promise<{
    userName: string
    repoName: string
    branchName: string
    path?: string[]
  }>
}

export default function TreePage({ params }: PageProps) {
  const { userName, repoName, branchName, path = [] } = use(params)
  const router = useRouter()

  const fullPath = path.join('/')
  const isFile = path.length > 0 && path[path.length - 1].includes('.')

  useEffect(() => {
    if (path.length === 0) {
      router.push(`/${userName}/${repoName}`)
    }
  }, [path.length, router, userName, repoName])

  return (
    <>
      {isFile ? (
        <FileViewer
          filePath={fullPath}
          branchName={branchName}
          repoName={repoName}
        />
      ) : (
        <DirectoryViewer
          directoryPath={fullPath}
          branchName={branchName}
          repoName={repoName}
          userName={userName}
        />
      )}
    </>
  )
}
