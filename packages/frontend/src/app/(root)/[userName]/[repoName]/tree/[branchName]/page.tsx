'use client'

import { useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

interface BranchPageProps {
  params: Promise<{
    userName: string
    repoName: string
    branchName: string
  }>
}

export default function BranchPage({ params }: BranchPageProps) {
  const { userName, repoName, branchName } = use(params)
  const router = useRouter()

  useEffect(() => {
    router.push(`/${userName}/${repoName}`)
  }, [repoName, branchName, router, userName])

  return null
}
