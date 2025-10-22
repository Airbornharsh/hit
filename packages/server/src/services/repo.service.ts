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
    const { userName, repoName } = await RemoteService.remoteBreakdown(remote)

    const repoData = await db?.RepoModel.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $match: { 'user.username': userName, name: repoName } },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: 'repoId',
          as: 'branches',
        },
      },
      {
        $lookup: {
          from: 'commits',
          localField: 'branches.headCommit',
          foreignField: '_id',
          as: 'commits',
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          description: 1,
          isPublic: 1,
          defaultBranch: 1,
          createdAt: 1,
          updatedAt: 1,
          branches: {
            $map: {
              input: '$branches',
              as: 'branch',
              in: {
                _id: '$$branch._id',
                name: '$$branch.name',
                headCommit: '$$branch.headCommit',
              },
            },
          },
          defaultBranchCommit: { $arrayElemAt: ['$commits', 0] },
        },
      },
    ])

    if (!repoData || repoData.length === 0) {
      throw new Error('Repo not found')
    }

    const repo = repoData[0]
    const defaultBranchCommit = repo.defaultBranchCommit

    let files: {
      name: string
      type: 'file' | 'directory'
      lastModified: string
    }[] = []
    let totalCommits = 0
    if (branchName) {
      const branch = repoData[0].branches.find(
        (branch: any) => branch.name === branchName,
      )
      if (!branch) {
        throw new Error(`Branch '${branchName}' not found`)
      }

      const latestCommit = await db?.CommitModel.findById(
        branch.headCommit,
      ).lean()
      if (!latestCommit) {
        throw new Error(`Commit '${branch.headCommit}' not found`)
      }

      files = await HashService.getRootFiles(latestCommit.hash)

      totalCommits =
        (await db?.CommitModel.countDocuments({
          repoId: repo._id,
          branchId: branch._id,
        })) || 0
    } else {
      if (defaultBranchCommit && defaultBranchCommit.hash) {
        files = await HashService.getRootFiles(defaultBranchCommit.hash)
        totalCommits =
          (await db?.CommitModel.countDocuments({
            repoId: repo._id,
            branchId: repo.defaultBranch,
          })) || 0
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
      branches: repo.branches || [],
      files,
    }
  }
}

export default RepoService
