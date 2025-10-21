'use client'

import { use, useEffect } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { FileViewer } from '@/components/FileViewer'
import { FileSidebar } from '@/components/FileSidebar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface PageProps {
  params: Promise<{
    userName: string
    repoName: string
    branchName: string
    path: string[]
  }>
}

export default function BlobPage({ params }: PageProps) {
  const { userName, repoName, branchName, path } = use(params)
  const { setMetadata } = useRepoStore()
  const router = useRouter()

  const fullPath = path.join('/')

  useEffect(() => {
    setMetadata({
      username: userName,
      repoName: repoName,
      branchName: branchName,
      commitHash: null,
    })
  }, [userName, repoName, branchName, setMetadata])

  const handleBack = () => {
    if (path.length > 1) {
      // Go to parent directory
      const newPath = path.slice(0, -1)
      const newPathString = newPath.join('/')
      router.push(
        `/${userName}/${repoName}/tree/${branchName}/${newPathString}`,
      )
    } else {
      router.push(`/${userName}/${repoName}/tree/${branchName}`)
    }
  }

  const breadcrumbItems = [
    { label: 'Repositories', href: `/${userName}/repositories` },
    { label: repoName, href: `/${userName}/${repoName}` },
    { label: branchName, href: `/${userName}/${repoName}/tree/${branchName}` },
    ...path.map((segment, index) => ({
      label: segment,
      href:
        index === path.length - 1
          ? `/${userName}/${repoName}/blob/${branchName}/${path.slice(0, index + 1).join('/')}`
          : `/${userName}/${repoName}/tree/${branchName}/${path.slice(0, index + 1).join('/')}`,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-[18rem]">
          <FileSidebar
            currentPath={fullPath}
            branchName={branchName}
            repoName={repoName}
            userName={userName}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <FileViewer
            filePath={fullPath}
            branchName={branchName}
            repoName={repoName}
          />
        </div>
      </div>
    </div>
  )
}
