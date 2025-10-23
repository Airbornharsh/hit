import { db } from '../db/mongo/init'
import { IRepo } from '../db/mongo/models/Repo.schema'
import HashService from './hash.service'
import RemoteService from './remote.service'

class RepoService {
  static async getRepoDetails(
    remote: string,
    branchName?: string,
  ): Promise<{
    repo: Partial<IRepo>
    totalCommits: number
    branches: string[]
    files: {
      name: string
      type: 'file' | 'directory'
      lastModified: string
    }[]
  }> {
    const { repo } = await RemoteService.getRepo(remote)
    const { branches } = await RemoteService.getBranches(remote, {
      limit: 1000,
    })

    let files: {
      name: string
      type: 'file' | 'directory'
      lastModified: string
    }[] = []
    let totalCommits = 0

    if (branchName) {
      const { commit } = await RemoteService.getHeadCommit(remote, branchName)
      if (!commit) {
        throw new Error(`Branch '${branchName}' not found`)
      }

      files = await HashService.getRootFiles(commit.hash)
      totalCommits =
        (await db?.CommitModel.countDocuments({
          repoId: repo._id,
          branchId: commit.branchId,
        })) || 0
    } else {
      const { branch } = await RemoteService.getDefaultBranch(remote)
      if (branch.headCommit) {
        const headCommit = await db?.CommitModel.findById(
          branch.headCommit,
        ).lean()
        if (headCommit) {
          files = await HashService.getRootFiles(headCommit.hash)
          totalCommits =
            (await db?.CommitModel.countDocuments({
              repoId: repo._id,
              branchId: branch._id,
            })) || 0
        }
      }
    }

    return {
      repo: {
        _id: repo._id,
        name: repo.name,
        description: repo.description,
        isPublic: repo.isPublic,
        defaultBranch: repo.defaultBranch,
        createdAt: repo.createdAt,
        updatedAt: repo.updatedAt,
      },
      totalCommits,
      branches: branches.map((b) => b.name),
      files,
    }
  }
}

export default RepoService
