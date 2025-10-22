import { db } from '../db/mongo/init'
import { ICommit } from '../db/mongo/models/Commit.schema'
import { PaginationMeta, PaginationParams } from '../types/common'
import RemoteService from './remote.service'

class CommitService {
  static async createCommits(
    repoId: string,
    branchId: string,
    commits: {
      tree: string
      parent: string
      author: string
      timestamp: string
      message: string
    }[],
  ) {
    let headCommit = null
    for (const commit of commits) {
      try {
        const newCommit = await db?.CommitModel.create({
          repoId,
          branchId,
          hash: commit.tree,
          parent: commit.parent,
          author: commit.author,
          timestamp: commit.timestamp,
          message: commit.message,
        })
        if (!newCommit || !newCommit._id) {
          continue
        }
        headCommit = newCommit._id.toString()
      } catch (e) {
        console.error('Create commit error:', e)
      }
    }

    if (headCommit) {
      try {
        await db?.BranchModel.findByIdAndUpdate(branchId, {
          $set: { headCommit: headCommit },
        })
      } catch (e) {
        console.error('Update branch head commit error:', e)
      }
    }

    try {
      await db?.RepoModel.findOneAndUpdate(
        { _id: repoId, defaultBranch: null },
        { $set: { defaultBranch: branchId } },
        { new: true },
      )
    } catch (e) {
      console.error('Update repo default branch error:', e)
    }

    return headCommit
  }

  static async getCommits(
    remote: string,
    branchName: string,
    params?: PaginationParams & {
      author?: string
      startDate?: string
      endDate?: string
    },
  ): Promise<{
    commits: any[]
    users: {
      _id: string
      username: string
      name: string
      email: string
    }[]
    pagination: PaginationMeta
  }> {
    const page = params?.page || 1
    const limit = params?.limit || 20
    const sortBy = params?.sortBy || 'timestamp'
    const sortOrder = params?.sortOrder || 'desc'
    const { userName, repoName } = await RemoteService.remoteBreakdown(remote)

    const userId = await db?.UserModel.findOne({
      username: userName,
    }).lean()

    if (!userId || !userId?._id) {
      throw new Error('User not found')
    }

    const repo = await db?.RepoModel.findOne({
      userId: userId._id,
      name: repoName,
    }).lean()

    if (!repo || !repo?._id) {
      throw new Error('Repo not found')
    }

    const branch = await db?.BranchModel.findOne({
      name: branchName,
      repoId: repo._id,
    }).lean()

    if (!branch || !branch?._id) {
      throw new Error('Branch not found')
    }

    const filterQuery: any = { branchId: branch._id }

    if (params?.author && params.author !== 'all') {
      filterQuery.author = params.author
    }

    if (params?.startDate || params?.endDate) {
      filterQuery.timestamp = {}
      if (params.startDate) {
        filterQuery.timestamp.$gte = new Date(params.startDate)
      }
      if (params.endDate) {
        filterQuery.timestamp.$lte = new Date(params.endDate)
      }
    }

    const [commits, total, authors] = await Promise.all([
      db?.CommitModel.find(filterQuery)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      db?.CommitModel.countDocuments(filterQuery).lean(),
      await db?.CommitModel.aggregate([
        {
          $match: {
            branchId: branch._id,
          },
        },
        {
          $group: {
            _id: '$author',
          },
        },
        {
          $project: {
            _id: 0,
            author: '$_id',
          },
        },
      ]),
    ])

    const users = await db?.UserModel.find({
      username: { $in: authors?.map((author) => author.author) },
    }).lean()

    return {
      commits:
        commits?.map((commit) => ({
          _id: commit._id.toString(),
          repoId: commit.repoId.toString(),
          branchId: commit.branchId.toString(),
          hash: commit.hash,
          parent: commit.parent,
          message: commit.message,
          timestamp: commit.timestamp,
          author: commit.author,
        })) || [],
      users: (
        users?.map((user) => ({
          _id: user._id.toString(),
          username: user.username || '',
          name: user.name,
          email: user.email,
        })) || []
      ).filter((user) => user.username),
      pagination: {
        page,
        limit,
        total: total || 0,
        totalPages: Math.ceil(total || 0 / limit),
        hasNext: page < Math.ceil(total || 0 / limit),
        hasPrev: page > 1,
      },
    }
  }
}

export default CommitService
