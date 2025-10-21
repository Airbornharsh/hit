'use client'

import { FileSidebar } from '@/components/FileSidebar'
import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { Button } from '@/components/ui/button'
import { useRepoStore } from '@/stores/repoStore'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { use, useEffect, useMemo } from 'react'

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{
    userName: string
    repoName: string
    branchName: string
    path?: string[]
  }>
}
const Layout = ({ children, params }: LayoutProps) => {
  const {
    userName: localUserName,
    repoName: localRepoName,
    branchName: localBranchName,
    path: localPath = [],
  } = use(params)
  const { setMetadata, fetchCompleteTreeStructure } = useRepoStore()
  const router = useRouter()

  const userName = useMemo(() => localUserName, [localUserName])
  const repoName = useMemo(() => localRepoName, [localRepoName])
  const branchName = useMemo(() => localBranchName, [localBranchName])
  const path = useMemo(() => localPath, [localPath])

  const fullPath = path.join('/')

  useEffect(() => {
    setMetadata({
      username: userName,
      repoName: repoName,
      branchName: branchName,
      commitHash: null,
    })
    if (repoName && branchName) {
      fetchCompleteTreeStructure(repoName, branchName)
    }
  }, [userName, repoName, branchName, setMetadata, fetchCompleteTreeStructure])

  const handlePathChange = (newPath: string) => {
    router.push(`/${userName}/${repoName}/tree/${branchName}/${newPath}`)
  }

  const handleBack = () => {
    if (path.length > 0) {
      const newPath = path.slice(0, -1)
      const newPathString = newPath.join('/')
      router.push(
        `/${userName}/${repoName}/tree/${branchName}${newPathString ? `/${newPathString}` : ''}`,
      )
    } else {
      router.push(`/${userName}/${repoName}`)
    }
  }

  const breadcrumbItems = [
    { label: 'Repositories', href: `/${userName}/repositories` },
    { label: repoName, href: `/${userName}/${repoName}` },
    { label: branchName, href: `/${userName}/${repoName}/tree/${branchName}` },
    ...path.map((segment, index) => ({
      label: segment,
      href: `/${userName}/${repoName}/tree/${branchName}/${path.slice(0, index + 1).join('/')}`,
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
            onPathChange={handlePathChange}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">{children}</div>
      </div>
    </div>
  )
}

export default Layout
