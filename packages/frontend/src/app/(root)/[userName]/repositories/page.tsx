'use client'

import { useEffect, useRef } from 'react'
import { useRepoStore } from '@/stores/repoStore'
import { RepositoryList } from '@/components/RepositoryList'
import { use } from 'react'

interface RepositoriesPageProps {
  params: Promise<{
    userName: string
  }>
}

export default function RepositoriesPage({ params }: RepositoriesPageProps) {
  const { userName } = use(params)
  const { fetchRepos, setMetadata } = useRepoStore()
  const callOnce = useRef(false)

  useEffect(() => {
    setMetadata({
      username: userName,
      repoName: null,
      branchName: null,
      commitHash: null,
    })
    if (!callOnce.current) {
      callOnce.current = true
      fetchRepos({ page: 1, limit: 10 })
    }
  }, [fetchRepos, setMetadata, userName])

  return (
    <div className="container mx-auto px-4 py-8">
      <RepositoryList />
    </div>
  )
}
