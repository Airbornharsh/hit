import * as diff from 'diff'
import { db } from '../db/mongo/init'
import { PaginationMeta, PaginationParams } from '../types/common'
import HashService from './hash.service'
import RemoteService from './remote.service'
import ZlibService from './zlib.service'

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

    const repo = await db?.RepoModel.findOne({
      username: userName,
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
          branchName: branch.name,
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

  static async getCommitDetails(
    remote: string,
    commitHash: string,
  ): Promise<{
    commit: any
    files: {
      name: string
      status: 'added' | 'modified' | 'deleted'
      additions: number
      deletions: number
      changes: number
      beforeCode?: string
      afterCode?: string
    }[]
    stats: {
      total: number
      additions: number
      deletions: number
    }
  }> {
    const { userName, repoName } = await RemoteService.remoteBreakdown(remote)

    const repo = await db?.RepoModel.findOne({
      username: userName,
      name: repoName,
    }).lean()

    if (!repo || !repo?._id) {
      throw new Error('Repo not found')
    }

    const commit = await db?.CommitModel.findOne({
      hash: commitHash,
      repoId: repo._id,
    }).lean()

    if (!commit || !commit?._id || commit.hash !== commitHash) {
      throw new Error('Commit not found')
    }

    const parentCommit = await db?.CommitModel.findOne({
      repoId: repo._id,
      hash: commit.parent,
    }).lean()

    if (
      commit.parent !== '0000000000000000000000000000000000000000' &&
      (!parentCommit || !parentCommit?._id)
    ) {
      throw new Error('Parent commit not found')
    }

    const branch = await db?.BranchModel.findOne({
      _id: commit.branchId,
    }).lean()

    if (!branch || !branch?._id) {
      throw new Error('Branch not found')
    }

    let files: Map<
      string,
      {
        name: string
        hash: string
        status: 'added' | 'modified' | 'deleted'
        additions: number
        deletions: number
        changes: number
        beforeCode?: string | null
        afterCode?: string | null
      }
    > = new Map()

    const [beforeFiles, afterFiles] = await Promise.all([
      parentCommit
        ? HashService.getFilesMap(parentCommit.hash)
        : Promise.resolve(
            new Map<
              string,
              { name: string; hash: string; lastModified: string }
            >(),
          ),
      HashService.getFilesMap(commit.hash),
    ])

    for (const file of beforeFiles.values()) {
      if (!afterFiles.has(file.name)) {
        files.set(file.name, {
          name: file.name,
          hash: file.hash,
          status: 'deleted',
          additions: 0,
          deletions: 1,
          changes: 0,
          beforeCode: null,
          afterCode: null,
        })
      } else {
        if (afterFiles.get(file.name)?.hash !== file.hash) {
          files.set(file.name, {
            name: file.name,
            hash: file.hash,
            status: 'modified',
            additions: 0,
            deletions: 0,
            changes: 1,
            beforeCode: null,
            afterCode: null,
          })
        }
      }
    }

    for (const file of afterFiles.values()) {
      if (!beforeFiles.has(file.name)) {
        files.set(file.name, {
          name: file.name,
          hash: file.hash,
          status: 'added',
          additions: 1,
          deletions: 0,
          changes: 0,
          beforeCode: null,
          afterCode: null,
        })
      }
    }

    const chunks = []
    const chunkSize = 30
    for (let i = 0; i < files.size; i += chunkSize) {
      const chunk = Array.from(files.values()).slice(i, i + chunkSize)
      chunks.push(chunk)
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (file) => {
          let beforeCode = ''
          let afterCode = ''

          if (file.status === 'deleted') {
            beforeCode = await ZlibService.decompress(file.hash).catch(() => '')
          } else if (file.status === 'added') {
            afterCode = await ZlibService.decompress(file.hash).catch(() => '')
          } else if (file.status === 'modified') {
            const beforeFile = beforeFiles.get(file.name)
            const afterFile = afterFiles.get(file.name)

            if (beforeFile) {
              beforeCode = await ZlibService.decompress(beforeFile.hash).catch(
                () => '',
              )
            }
            if (afterFile) {
              afterCode = await ZlibService.decompress(afterFile.hash).catch(
                () => '',
              )
            }
          }

          const diffs = diff.diffLines(beforeCode, afterCode)

          let additions = 0
          let deletions = 0

          for (const change of diffs) {
            if (change.added) {
              additions += change.count || 0
            } else if (change.removed) {
              deletions += change.count || 0
            }
          }

          file.additions = additions
          file.deletions = deletions
          file.changes = additions + deletions
          file.beforeCode = beforeCode || undefined
          file.afterCode = afterCode || undefined
        }),
      )
    }

    const stats = {
      total: files.size,
      additions: Array.from(files.values()).reduce(
        (sum, file) => sum + file.additions,
        0,
      ),
      deletions: Array.from(files.values()).reduce(
        (sum, file) => sum + file.deletions,
        0,
      ),
    }

    return {
      commit: {
        _id: commit._id.toString(),
        repoId: commit.repoId.toString(),
        branchId: commit.branchId.toString(),
        branchName: branch.name,
        hash: commit.hash,
        parent: commit.parent,
        message: commit.message,
        author: commit.author,
        timestamp: commit.timestamp,
        createdAt: commit.createdAt,
        updatedAt: commit.updatedAt,
      },
      files: Array.from(files.values()).map((file) => ({
        name: file.name,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        beforeCode: file.beforeCode || undefined,
        afterCode: file.afterCode || undefined,
      })),
      stats,
    }
  }
}

export default CommitService
