import { db } from '../db/mongo/init'

class RemoteService {
  static async remoteBreakdown(remote: string) {
    const parts = remote.split('hit@hithub.com:')
    const parts1 = parts[1].split('/')
    const userName = parts1[0]
    const repoName = parts1[1].split('.')[0]
    return { userName, repoName }
  }

  static async getRepo(remote: string) {
    const { userName, repoName } = await this.remoteBreakdown(remote)
    const repo = await db?.RepoModel.findOne({
      username: userName,
      name: repoName,
    }).lean()
    if (!repo || !repo?._id) {
      throw new Error('Repo not found')
    }
    return repo
  }

  static async getDefaultBranch(remote: string) {
    const repo = await this.getRepo(remote)
    const defaultBranch = await db?.BranchModel.findOne({
      repoId: repo._id,
      name: repo.defaultBranch,
    }).lean()
    if (!defaultBranch || !defaultBranch?._id) {
      throw new Error('Default branch not found')
    }
    return defaultBranch
  }

  static async getBranch(remote: string, branchName: string) {
    const repo = await this.getRepo(remote)
    const branch = await db?.BranchModel.findOne({
      repoId: repo._id,
      name: branchName,
    }).lean()
    if (!branch || !branch?._id) {
      throw new Error('Branch not found')
    }
    return branch
  }

  static async getCommit(remote: string, commitHash: string) {
    const repo = await this.getRepo(remote)
    const commit = await db?.CommitModel.findOne({
      repoId: repo._id,
      hash: commitHash,
    }).lean()
    if (!commit || !commit?._id) {
      throw new Error('Commit not found')
    }
    return commit
  }
}

export default RemoteService
