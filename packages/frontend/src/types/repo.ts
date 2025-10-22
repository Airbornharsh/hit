export interface Repo {
  _id: string
  userId: string
  name: string
  description: string
  isPublic: boolean
  defaultBranch: string
  createdAt: string
  updatedAt: string
}

export interface Branch {
  _id: string
  repoId: string
  name: string
  headCommit: string
  createdAt: string
  updatedAt: string
}

export interface Commit {
  _id: string
  repoId: string
  branchId: string
  hash: string
  parent: string
  message: string
  author: string
  timestamp: string
  createdAt: string
  updatedAt: string
}

export interface CreateRepoData {
  name: string
  description?: string
  isPublic?: boolean
  defaultBranch?: string
}

export interface CreateBranchData {
  name: string
  headCommit: string
}

export interface CreateCommitData {
  message: string
  author: string
  parent: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}
