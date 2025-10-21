import { db } from '../db/mongo/init'
import { IRepo } from '../db/mongo/models/Repo.schema'
import RemoteService from './remote.service'
import ZlibService from './zlib.service'

class RepoService {
  static async getRepoDetails(remote: string): Promise<{
    repo: Partial<IRepo>
    branches: string[]
    files: {
      name: string
      type: 'file' | 'directory'
      lastModified: string
    }[]
  }> {
    const { userName, repoName } = await RemoteService.remoteBreakdown(remote)

    // Use aggregation pipeline for better performance
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
    if (defaultBranchCommit && defaultBranchCommit.hash) {
      files = await this.getRootFiles(defaultBranchCommit.hash)
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
      branches: repo.branches || [],
      files,
    }
  }

  static async getRootFiles(hash: string) {
    const tree = await ZlibService.decompress(hash)
    const treeData = JSON.parse(tree)

    const fileMap = new Map<
      string,
      {
        name: string
        type: 'file' | 'directory'
        lastModified: string
      }
    >()

    const entries = Object.keys(treeData.entries || {})
    const lastModified = treeData.lastModified || new Date().toISOString()

    for (const name of entries) {
      const parts = name.split('/')
      const fileName = parts[0]
      const fileType = parts.length > 1 ? 'directory' : 'file'

      if (!fileMap.has(fileName)) {
        fileMap.set(fileName, {
          name: fileName,
          type: fileType,
          lastModified,
        })
      }
    }

    return Array.from(fileMap.values())
  }
}

export default RepoService
