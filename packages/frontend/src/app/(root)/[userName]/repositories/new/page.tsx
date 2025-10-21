'use client'

import { Breadcrumbs } from '@/components/layout/Breadcrumbs'
import { CreateRepositoryForm } from '@/components/repository/CreateRepositoryForm'
import { useRepoStore } from '@/stores/repoStore'
import { use, useEffect } from 'react'

interface CreateRepositoryPageProps {
  params: Promise<{
    userName: string
  }>
}

export default function CreateRepositoryPage({
  params,
}: CreateRepositoryPageProps) {
  const { userName } = use(params)
  const { setMetadata } = useRepoStore()

  useEffect(() => {
    setMetadata({
      username: userName,
      repoName: null,
      branchName: null,
      commitHash: null,
    })
  }, [userName, setMetadata])

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Repositories', href: `/${userName}/repositories` },
          { label: 'New Repository' },
        ]}
      />

      <div className="flex justify-center">
        <div className="max-w-4xl">
          <div className="mb-8">
            <h1 className="text-foreground text-3xl font-bold">
              Create a new repository
            </h1>
            <p className="text-muted-foreground mt-2">
              A repository contains all project files, including the revision
              history. Choose a repository name and description to get started.
            </p>
          </div>

          <CreateRepositoryForm userName={userName} />
        </div>
      </div>
    </div>
  )
}
