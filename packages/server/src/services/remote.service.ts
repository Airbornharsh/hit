import { db } from '../db/mongo/init'
import { IUser } from '../db/mongo/models/User.schema'
import { IRepo } from '../db/mongo/models/Repo.schema'
import { IBranch } from '../db/mongo/models/Branch.schema'
import { ICommit } from '../db/mongo/models/Commit.schema'

interface RemoteBreakdown {
  userName: string
  repoName: string
}

interface CommitWithRepo extends ICommit {
  repo?: IRepo
  branch?: IBranch
}

class RemoteService {
  static async remoteBreakdown(remote: string): Promise<RemoteBreakdown> {
    try {
      const parts = remote.split('hit@hithub.com:')
      if (parts.length !== 2) {
        throw new Error('Invalid remote format')
      }

      const pathParts = parts[1].split('/')
      if (pathParts.length !== 2) {
        throw new Error('Invalid remote path format')
      }

      const userName = pathParts[0]
      const repoName = pathParts[1].split('.hit')[0]

      if (!userName || !repoName) {
        throw new Error('Username and repository name are required')
      }

      return { userName, repoName }
    } catch (error) {
      throw new Error(
        `Failed to parse remote URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  static async getRepo(
    remote: string,
  ): Promise<{ repo: IRepo; username: string; repoName: string }> {
    const { userName, repoName } = await this.remoteBreakdown(remote)
    const repo = (await db?.RepoModel.findOne({
      username: userName,
      name: repoName,
    }).lean()) as IRepo | null

    if (!repo || !repo?._id) {
      throw new Error(`Repository '${userName}/${repoName}' not found`)
    }

    return { repo, username: userName, repoName: repoName }
  }

  static async getRepoWithUser(
    remote: string,
  ): Promise<{ repo: IRepo; user: IUser; username: string; repoName: string }> {
    const { userName, repoName } = await this.remoteBreakdown(remote)
    const { user } = await this.getUserByUsername(userName)

    if (!user || !user?._id) {
      throw new Error(`Repository '${userName}/${repoName}' not found`)
    }

    const repo = (await db?.RepoModel.findOne({
      userId: user._id,
      name: repoName,
    })
      .populate('defaultBranch')
      .lean()) as IRepo | null

    if (!repo || !repo?._id) {
      throw new Error(`Repository '${userName}/${repoName}' not found`)
    }

    return { repo, user, username: userName, repoName: repoName }
  }

  static async getDefaultBranch(
    remote: string,
  ): Promise<{ branch: IBranch; repo: IRepo }> {
    const { repo } = await this.getRepo(remote)

    if (!repo.defaultBranch) {
      throw new Error('No default branch set for this repository')
    }

    const defaultBranch = (await db?.BranchModel.findOne({
      repoId: repo._id,
      _id: repo.defaultBranch,
    }).lean()) as IBranch | null

    if (!defaultBranch || !defaultBranch?._id) {
      throw new Error('Default branch not found')
    }

    return { branch: defaultBranch, repo }
  }

  static async getBranch(
    remote: string,
    branchName: string,
  ): Promise<{ branch: IBranch; repo: IRepo }> {
    const { repo } = await this.getRepo(remote)
    const branch = (await db?.BranchModel.findOne({
      repoId: repo._id,
      name: branchName,
    }).lean()) as IBranch | null

    if (!branch || !branch?._id) {
      throw new Error(`Branch '${branchName}' not found`)
    }

    return { branch, repo }
  }

  static async getCommit(
    remote: string,
    commitHash: string,
  ): Promise<{ commit: ICommit; repo: IRepo }> {
    const { repo } = await this.getRepo(remote)
    const commit = (await db?.CommitModel.findOne({
      repoId: repo._id,
      hash: commitHash,
    }).lean()) as ICommit | null

    if (!commit || !commit?._id) {
      throw new Error(`Commit '${commitHash}' not found`)
    }

    return { commit, repo }
  }

  static async getCommitWithBranch(
    remote: string,
    commitHash: string,
  ): Promise<{ commit: CommitWithRepo; repo: IRepo; branch: IBranch }> {
    const { commit, repo } = await this.getCommit(remote, commitHash)

    const branch = (await db?.BranchModel.findById(
      commit.branchId,
    ).lean()) as IBranch | null
    if (!branch || !branch?._id) {
      throw new Error('Branch not found for commit')
    }

    return {
      commit: { ...commit, repo, branch } as CommitWithRepo,
      repo,
      branch,
    }
  }

  static async getBranches(
    remote: string,
    options: {
      page?: number
      limit?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    } = {},
  ): Promise<{ branches: IBranch[]; total: number; pagination: any }> {
    const { repo } = await this.getRepo(remote)
    const {
      page = 1,
      limit = 100,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options

    const skip = (page - 1) * limit
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }

    const [branches, total] = await Promise.all([
      db?.BranchModel.find({ repoId: repo._id })
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .lean(),
      db?.BranchModel.countDocuments({ repoId: repo._id }),
    ])

    return {
      branches: (branches as unknown as IBranch[]) || [],
      total: total || 0,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
        hasNext: page < Math.ceil((total || 0) / limit),
        hasPrev: page > 1,
      },
    }
  }

  static async getCommits(
    remote: string,
    branchName: string,
    options: {
      page?: number
      limit?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      author?: string
      startDate?: string
      endDate?: string
    } = {},
  ): Promise<{ commits: ICommit[]; total: number; pagination: any }> {
    const { branch, repo } = await this.getBranch(remote, branchName)
    const {
      page = 1,
      limit = 20,
      sortBy = 'timestamp',
      sortOrder = 'desc',
      author,
      startDate,
      endDate,
    } = options

    const skip = (page - 1) * limit
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }

    const filterQuery: any = { branchId: branch._id }

    if (author && author !== 'all') {
      filterQuery.author = author
    }

    if (startDate || endDate) {
      filterQuery.timestamp = {}
      if (startDate) {
        filterQuery.timestamp.$gte = new Date(startDate)
      }
      if (endDate) {
        filterQuery.timestamp.$lte = new Date(endDate)
      }
    }

    const [commits, total] = await Promise.all([
      db?.CommitModel.find(filterQuery)
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .lean(),
      db?.CommitModel.countDocuments(filterQuery),
    ])

    return {
      commits: (commits as unknown as ICommit[]) || [],
      total: total || 0,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
        hasNext: page < Math.ceil((total || 0) / limit),
        hasPrev: page > 1,
      },
    }
  }

  static async getHeadCommit(
    remote: string,
    branchName: string,
  ): Promise<{
    commit: ICommit | null
    branch: IBranch | null
    repo: IRepo | null
  }> {
    try {
      const { branch, repo } = await this.getBranch(remote, branchName)

      if (!branch.headCommit) {
        return { commit: null, branch, repo }
      }

      const commit = (await db?.CommitModel.findById(
        branch.headCommit,
      ).lean()) as ICommit | null
      return { commit: commit || null, branch, repo }
    } catch (error) {
      return { commit: null, branch: null, repo: null }
    }
  }

  static async getUserByUsername(username: string): Promise<{ user: IUser }> {
    const user = (await db?.UserModel.findOne({
      username,
    }).lean()) as IUser | null

    if (!user || !user?._id) {
      throw new Error(`User '${username}' not found`)
    }

    return { user }
  }

  static async getUserByEmail(email: string): Promise<{ user: IUser }> {
    const user = (await db?.UserModel.findOne({ email }).lean()) as IUser | null

    if (!user || !user?._id) {
      throw new Error(`User with email '${email}' not found`)
    }

    return { user }
  }

  static async getUserRepos(
    username: string,
    options: {
      page?: number
      limit?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
    } = {},
  ): Promise<{ repos: IRepo[]; total: number; pagination: any }> {
    const { user } = await this.getUserByUsername(username)
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options

    const skip = (page - 1) * limit
    const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 }

    const [repos, total] = await Promise.all([
      db?.RepoModel.find({ userId: user._id })
        .skip(skip)
        .limit(limit)
        .sort(sort)
        .lean(),
      db?.RepoModel.countDocuments({ userId: user._id }),
    ])

    return {
      repos: (repos as unknown as IRepo[]) || [],
      total: total || 0,
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil((total || 0) / limit),
        hasNext: page < Math.ceil((total || 0) / limit),
        hasPrev: page > 1,
      },
    }
  }

  static async repoExists(remote: string): Promise<boolean> {
    try {
      await this.getRepo(remote)
      return true
    } catch {
      return false
    }
  }

  static async branchExists(
    repoId: string,
    branchName: string,
  ): Promise<boolean> {
    try {
      const exists = await db?.BranchModel.exists({
        repoId: repoId,
        name: branchName,
      })
      return exists ? true : false
    } catch {
      return false
    }
  }

  static async commitExists(
    remote: string,
    commitHash: string,
  ): Promise<boolean> {
    try {
      await this.getCommit(remote, commitHash)
      return true
    } catch {
      return false
    }
  }

  static async getRepoStats(remote: string): Promise<{
    totalBranches: number
    totalCommits: number
    latestCommit?: ICommit
    defaultBranch?: IBranch
  }> {
    const { repo } = await this.getRepo(remote)

    const [totalBranches, totalCommits, latestCommit, defaultBranch] =
      await Promise.all([
        db?.BranchModel.countDocuments({ repoId: repo._id }),
        db?.CommitModel.countDocuments({ repoId: repo._id }),
        db?.CommitModel.findOne({ repoId: repo._id })
          .sort({ timestamp: -1 })
          .lean(),
        repo.defaultBranch
          ? db?.BranchModel.findById(repo.defaultBranch).lean()
          : null,
      ])

    return {
      totalBranches: totalBranches || 0,
      totalCommits: totalCommits || 0,
      latestCommit: (latestCommit as unknown as ICommit) || undefined,
      defaultBranch: (defaultBranch as unknown as IBranch) || undefined,
    }
  }

  static parsePath(path: string | undefined): string {
    if (!path) return ''

    try {
      return decodeURIComponent(path)
    } catch (error) {
      console.warn('Failed to decode path, using original:', error)
      return path
    }
  }

  static normalizePath(path: string): string {
    if (!path) return ''

    return path
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '')
  }

  static parseAndNormalizePath(path: string | undefined): string {
    const parsed = this.parsePath(path)
    return this.normalizePath(parsed)
  }

  static isValidPath(path: string): boolean {
    if (!path) return true

    const normalized = this.normalizePath(path)

    if (normalized.includes('..')) return false
    if (normalized.includes('//')) return false
    if (normalized.startsWith('/')) return false

    return true
  }
}

export default RemoteService
