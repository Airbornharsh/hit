import { AxiosClient } from '@/utils/axios'
import {
  Repo,
  Branch,
  Commit,
  CreateRepoData,
  PaginationParams,
  PaginationMeta,
} from '@/types/repo'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { constructRemote } from '@/utils/remote'

interface ApiError {
  response?: {
    data?: {
      message?: string
    }
  }
}

interface FileTreeNode {
  name: string
  type: 'file' | 'directory'
  path: string
  lastModified: string
  children?: FileTreeNode[]
}

interface RepoState {
  metadata: {
    username: string | null
    repoName: string | null
    branchName: string | null
    commitHash: string | null
  }

  // Repositories
  repos: Repo[]
  activeRepo: Repo | null
  isReposLoading: boolean
  reposError: string | null
  reposPagination: PaginationMeta | null
  // File system state
  files: {
    path: string
    current: {
      name: string
      type: 'file' | 'directory'
      lastModified: string
    }[]
    currentFile?: {
      path: string
      content: string
      size: number
      lastModified: string
    }
  }
  sidebar: {
    tree: FileTreeNode[]
    isLoading: boolean
    error: string | null
  }

  // Branches
  branches: Branch[]
  activeBranch: Branch | null
  isBranchesLoading: boolean
  branchesError: string | null
  branchesPagination: PaginationMeta | null

  // Commits
  commits: Commit[]
  activeCommit: Commit | null
  isCommitsLoading: boolean
  commitsError: string | null
  commitsPagination: PaginationMeta | null

  setMetadata: (metadata: {
    username: string | null
    repoName: string | null
    branchName: string | null
    commitHash: string | null
  }) => void

  // Actions for Repositories
  setRepos: (repos: Repo[]) => void
  setActiveRepo: (repo: Repo | null) => void
  fetchRepos: (params?: PaginationParams) => Promise<void>
  fetchRepo: () => Promise<void>
  createRepo: (repoData: CreateRepoData) => Promise<void>
  setReposLoading: (loading: boolean) => void
  setReposError: (error: string | null) => void
  setReposPagination: (pagination: PaginationMeta | null) => void

  // Actions for Branches
  setBranches: (branches: Branch[]) => void
  setActiveBranch: (branch: Branch | null) => void
  fetchBranches: (repoName: string, params?: PaginationParams) => Promise<void>
  setBranchesLoading: (loading: boolean) => void
  setBranchesError: (error: string | null) => void
  setBranchesPagination: (pagination: PaginationMeta | null) => void

  // Actions for Commits
  setCommits: (commits: Commit[]) => void
  setActiveCommit: (commit: Commit | null) => void
  fetchCommits: (
    repoName: string,
    branchName: string,
    params?: PaginationParams,
  ) => Promise<void>
  fetchCommit: (
    repoName: string,
    branchName: string,
    commitHash: string,
  ) => Promise<void>
  setCommitsLoading: (loading: boolean) => void
  setCommitsError: (error: string | null) => void
  setCommitsPagination: (pagination: PaginationMeta | null) => void

  // File system actions
  fetchFiles: (
    repoName: string,
    branchName: string,
    path?: string,
    forSidebar?: boolean,
  ) => Promise<void>
  fetchFile: (
    repoName: string,
    branchName: string,
    path: string,
  ) => Promise<void>
  fetchCompleteTreeStructure: (
    repoName: string,
    branchName: string,
  ) => Promise<void>
  setCurrentPath: (path: string) => void
  setSidebarLoading: (loading: boolean) => void
  setSidebarError: (error: string | null) => void

  // Utility actions
  clearErrors: () => void
  reset: () => void
  getDefaultBranch: () => Branch | null
  setDefaultBranch: (repoName: string, branchName: string) => Promise<void>
}

export const useRepoStore = create<RepoState>()(
  persist(
    (set, get) => ({
      metadata: {
        username: null,
        repoName: null,
        branchName: null,
        commitHash: null,
      },

      // Initial state
      repos: [],
      activeRepo: null,
      isReposLoading: false,
      reposError: null,
      reposPagination: null,
      files: {
        path: '',
        current: [],
        currentFile: undefined,
      },
      sidebar: {
        tree: [],
        isLoading: false,
        error: null,
      },
      branches: [],
      activeBranch: null,
      isBranchesLoading: false,
      branchesError: null,
      branchesPagination: null,

      commits: [],
      activeCommit: null,
      isCommitsLoading: false,
      commitsError: null,
      commitsPagination: null,

      setMetadata: (metadata: {
        username: string | null
        repoName: string | null
        branchName: string | null
        commitHash: string | null
      }) => {
        set({ metadata })
      },

      // Repository actions
      setRepos: (repos: Repo[]) => {
        set({ repos })
      },

      setActiveRepo: (repo: Repo | null) => {
        set({ activeRepo: repo })
        // Clear branches and commits when switching repos
        if (!repo) {
          set({
            branches: [],
            activeBranch: null,
            commits: [],
            activeCommit: null,
          })
        }
      },

      fetchRepos: async (params?: PaginationParams) => {
        set({ isReposLoading: true, reposError: null })
        try {
          const queryParams = new URLSearchParams()
          if (params?.page) queryParams.append('page', params.page.toString())
          if (params?.limit)
            queryParams.append('limit', params.limit.toString())
          if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
          if (params?.sortOrder)
            queryParams.append('sortOrder', params.sortOrder)

          const url = `/api/v1/repo${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
          const response = await AxiosClient.get(url)

          set({
            repos: response.data.data.repos,
            reposPagination: response.data.meta || null,
          })
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to fetch repositories'
          set({ reposError: errorMessage })
        } finally {
          set({ isReposLoading: false })
        }
      },

      fetchRepo: async () => {
        const { username, repoName } = get().metadata
        if (!username || !repoName) return
        set({ isReposLoading: true, reposError: null })
        try {
          const remote = `hit@hithub.com:${username}/${repoName}.hit`
          const response = await AxiosClient.get(
            `/api/v1/repo/individual?remote=${remote}`,
          )
          const repo = response.data.data.repo
          const branches = response.data.data.branches
          const files = response.data.data.files as {
            name: string
            type: 'file' | 'directory'
            lastModified: string
          }[]
          set({
            activeRepo: repo,
            branches,
            files: {
              path: '',
              current: files,
            },
          })
        } catch (error) {
          console.error('Fetch repo error:', error)
          set({ reposError: 'Failed to fetch repository' })
        } finally {
          set({ isReposLoading: false })
        }
      },

      createRepo: async (repoData: CreateRepoData) => {
        set({ isReposLoading: true, reposError: null })
        try {
          const response = await AxiosClient.post('/api/v1/repo', repoData)
          const newRepo = response.data.data.repo
          set({
            repos: [...get().repos, newRepo],
            activeRepo: newRepo,
          })
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error && 'response' in error
              ? (error as ApiError)?.response?.data?.message ||
                'Failed to create repository'
              : 'Failed to create repository'
          set({ reposError: errorMessage })
        } finally {
          set({ isReposLoading: false })
        }
      },

      setReposLoading: (loading: boolean) => {
        set({ isReposLoading: loading })
      },

      setReposError: (error: string | null) => {
        set({ reposError: error })
      },

      setReposPagination: (pagination: PaginationMeta | null) => {
        set({ reposPagination: pagination })
      },

      // Branch actions
      setBranches: (branches: Branch[]) => {
        set({ branches })
      },

      setActiveBranch: (branch: Branch | null) => {
        set({ activeBranch: branch })
        // Clear commits when switching branches
        if (!branch) {
          set({ commits: [], activeCommit: null })
        }
      },

      fetchBranches: async (repoName: string, params?: PaginationParams) => {
        set({ isBranchesLoading: true, branchesError: null })
        try {
          const { username } = get().metadata
          if (!username || !repoName) return
          const queryParams = new URLSearchParams()
          const remote = constructRemote(username, repoName)
          queryParams.append('remote', remote)
          if (params?.page) queryParams.append('page', params.page.toString())
          if (params?.limit)
            queryParams.append('limit', params.limit.toString())
          if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
          if (params?.sortOrder)
            queryParams.append('sortOrder', params.sortOrder)

          const url = `/api/v1/branch${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
          const response = await AxiosClient.get(url)

          set({
            branches: response.data.data.branches,
            branchesPagination: response.data.meta || null,
          })
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to fetch branches'
          set({ branchesError: errorMessage })
        } finally {
          set({ isBranchesLoading: false })
        }
      },

      setBranchesLoading: (loading: boolean) => {
        set({ isBranchesLoading: loading })
      },

      setBranchesError: (error: string | null) => {
        set({ branchesError: error })
      },

      setBranchesPagination: (pagination: PaginationMeta | null) => {
        set({ branchesPagination: pagination })
      },

      // Commit actions
      setCommits: (commits: Commit[]) => {
        set({ commits })
      },

      setActiveCommit: (commit: Commit | null) => {
        set({ activeCommit: commit })
      },

      fetchCommits: async (
        repoName: string,
        branchName: string,
        params?: PaginationParams,
      ) => {
        set({ isCommitsLoading: true, commitsError: null })
        try {
          const { username } = get().metadata
          if (!username || !repoName || !branchName) return
          const remote = constructRemote(username, repoName)
          const queryParams = new URLSearchParams()
          queryParams.append('remote', remote)
          if (params?.page) queryParams.append('page', params.page.toString())
          if (params?.limit)
            queryParams.append('limit', params.limit.toString())
          if (params?.sortBy) queryParams.append('sortBy', params.sortBy)
          if (params?.sortOrder)
            queryParams.append('sortOrder', params.sortOrder)

          const url = `/api/v1/branch/${branchName}/commits${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
          const response = await AxiosClient.get(url)

          set({
            commits: response.data.data.commits,
            commitsPagination: response.data.meta || null,
          })
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to fetch commits'
          set({ commitsError: errorMessage })
        } finally {
          set({ isCommitsLoading: false })
        }
      },

      fetchCommit: async (
        repoName: string,
        branchName: string,
        commitHash: string,
      ) => {
        set({ isCommitsLoading: true, commitsError: null })
        try {
          const { username } = get().metadata
          if (!username || !repoName || !branchName) return
          const remote = constructRemote(username, repoName)
          const queryParams = new URLSearchParams()
          queryParams.append('remote', remote)
          const response = await AxiosClient.get(
            `/api/v1/branch/${branchName}/commits/${commitHash}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
          )
          const commit = response.data.data.commit
          set({ activeCommit: commit })
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to fetch commit'
          set({ commitsError: errorMessage })
        } finally {
          set({ isCommitsLoading: false })
        }
      },

      setCommitsLoading: (loading: boolean) => {
        set({ isCommitsLoading: loading })
      },

      setCommitsError: (error: string | null) => {
        set({ commitsError: error })
      },

      setCommitsPagination: (pagination: PaginationMeta | null) => {
        set({ commitsPagination: pagination })
      },

      // Utility actions
      clearErrors: () => {
        set({
          reposError: null,
          branchesError: null,
          commitsError: null,
        })
      },

      reset: () => {
        set({
          repos: [],
          activeRepo: null,
          isReposLoading: false,
          reposError: null,
          reposPagination: null,
          branches: [],
          activeBranch: null,
          isBranchesLoading: false,
          branchesError: null,
          branchesPagination: null,
          commits: [],
          activeCommit: null,
          isCommitsLoading: false,
          commitsError: null,
          commitsPagination: null,
        })
      },

      getDefaultBranch: () => {
        const { activeRepo, branches } = get()
        if (!activeRepo) return null
        return (
          branches.find((branch) => branch._id === activeRepo.defaultBranch) ||
          null
        )
      },

      setDefaultBranch: async (repoName: string, branchName: string) => {
        set({ isReposLoading: true, reposError: null })
        try {
          const { username } = get().metadata
          if (!username || !repoName) return
          const remote = constructRemote(username, repoName)
          const queryParams = new URLSearchParams()
          queryParams.append('remote', remote)
          await AxiosClient.patch(
            `/api/v1/repo/${repoName}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
            {
              defaultBranch: branchName,
            },
          )
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to update default branch'
          set({ reposError: errorMessage })
        } finally {
          set({ isReposLoading: false })
        }
      },

      // File system actions
      fetchFiles: async (
        repoName: string,
        branchName: string,
        path?: string,
        forSidebar: boolean = false,
      ) => {
        if (forSidebar) {
          set({ sidebar: { ...get().sidebar, isLoading: true, error: null } })
        } else {
          set({ isReposLoading: true, reposError: null })
        }

        try {
          const { username } = get().metadata
          if (!username || !repoName || !branchName) return

          const remote = constructRemote(username, repoName)
          const queryParams = new URLSearchParams()
          queryParams.append('remote', remote)
          if (path) queryParams.append('path', path)

          const url = `/api/v1/branch/${branchName}/files${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
          const response = await AxiosClient.get(url)

          if (forSidebar) {
            set({
              sidebar: {
                tree: response.data.data.files || [],
                isLoading: false,
                error: null,
              },
            })
          } else {
            set({
              files: {
                path: response.data.data.path || '',
                current: response.data.data.files || [],
              },
            })
          }
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to fetch files'

          if (forSidebar) {
            set({
              sidebar: {
                ...get().sidebar,
                isLoading: false,
                error: errorMessage,
              },
            })
          } else {
            set({ reposError: errorMessage })
          }
        } finally {
          if (forSidebar) {
            set({ sidebar: { ...get().sidebar, isLoading: false } })
          } else {
            set({ isReposLoading: false })
          }
        }
      },

      fetchFile: async (repoName: string, branchName: string, path: string) => {
        set({ isReposLoading: true, reposError: null })
        try {
          const { username } = get().metadata
          if (!username || !repoName || !branchName) return

          const remote = constructRemote(username, repoName)
          const queryParams = new URLSearchParams()
          queryParams.append('remote', remote)
          queryParams.append('path', path)

          const url = `/api/v1/branch/${branchName}/file${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
          const response = await AxiosClient.get(url)

          // Store file content in a new state property
          set({
            files: {
              ...get().files,
              currentFile: {
                path: path,
                content: response.data.data.file.content,
                size: response.data.data.file.size,
                lastModified: response.data.data.file.lastModified,
              },
            },
          })
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to fetch file'
          set({ reposError: errorMessage })
        } finally {
          set({ isReposLoading: false })
        }
      },

      fetchCompleteTreeStructure: async (
        repoName: string,
        branchName: string,
      ) => {
        set({ sidebar: { ...get().sidebar, isLoading: true, error: null } })
        try {
          const { username } = get().metadata
          if (!username || !repoName || !branchName) return

          const remote = constructRemote(username, repoName)
          const queryParams = new URLSearchParams()
          queryParams.append('remote', remote)

          const url = `/api/v1/branch/${branchName}/complete-tree${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
          const response = await AxiosClient.get(url)

          set({
            sidebar: {
              tree: response.data.data.tree || [],
              isLoading: false,
              error: null,
            },
          })
        } catch (error: unknown) {
          const errorMessage =
            (error as ApiError)?.response?.data?.message ||
            'Failed to fetch complete tree structure'
          set({
            sidebar: {
              ...get().sidebar,
              isLoading: false,
              error: errorMessage,
            },
          })
        }
      },

      setCurrentPath: (path: string) => {
        set({
          files: {
            ...get().files,
            path: path,
          },
        })
      },

      setSidebarLoading: (loading: boolean) => {
        set({
          sidebar: {
            ...get().sidebar,
            isLoading: loading,
          },
        })
      },

      setSidebarError: (error: string | null) => {
        set({
          sidebar: {
            ...get().sidebar,
            error: error,
          },
        })
      },
    }),
    {
      name: 'repo-storage',
      partialize: (state) => ({
        repos: state.repos,
        activeRepo: state.activeRepo,
        branches: state.branches,
        activeBranch: state.activeBranch,
        commits: state.commits,
        activeCommit: state.activeCommit,
      }),
    },
  ),
)
