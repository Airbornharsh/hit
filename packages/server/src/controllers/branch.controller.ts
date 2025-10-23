import { Request, Response } from 'express'
import { db } from '../db/mongo/init'
import RemoteService from '../services/remote.service'
import CommitService from '../services/commit.service'
import BranchService from '../services/branch.service'

class BranchController {
  static async createBranch(req: Request, res: Response) {
    try {
      const { userId } = (req as any).user
      const { name } = req.body

      const branch = await db?.BranchModel.create({
        userId,
        name,
      })

      if (!branch || !branch?._id) {
        res.status(400).json({
          success: false,
          message: 'Failed to create branch',
        })
        return
      }

      res.json({
        success: true,
        message: 'Branch created successfully',
        data: {
          branch,
        },
      })
    } catch (error) {
      console.error('Create branch error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to create branch',
      })
      return
    }
  }

  static async getBranches(req: Request, res: Response) {
    try {
      const { page = 1, limit = 100, remote } = req.query

      const result = await RemoteService.getBranches(remote as string, {
        page: Number(page),
        limit: Number(limit),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })

      res.json({
        success: true,
        message: 'Branches fetched successfully',
        data: {
          branches: result.branches,
          pagination: result.pagination,
        },
      })
    } catch (error) {
      console.error('Get branches error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch branches',
      })
      return
    }
  }

  static async getHeadCommit(req: Request, res: Response) {
    try {
      const { branchName } = req.params
      const { remote } = req.query

      const { commit, branch, repo } = await RemoteService.getHeadCommit(
        remote as string,
        branchName,
      )

      res.json({
        success: true,
        message: 'Head commit fetched successfully',
        data: {
          exists: commit ? true : false,
          headCommit: commit
            ? {
                _id: commit._id,
                message: commit.message,
                author: commit.author,
                timestamp: commit.timestamp,
                hash: commit.hash,
                parent: commit.parent,
              }
            : null,
        },
      })
    } catch (error) {
      console.error('Get head commit error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch head commit',
      })
      return
    }
  }

  static async createCommit(req: Request, res: Response) {
    try {
      const { branchName } = req.params
      const { remote } = req.query
      const commits = (req.body.commits || []) as {
        tree: string
        parent: string
        author: string
        timestamp: string
        message: string
      }[]

      for (const commit of commits) {
        if (
          !commit.tree ||
          !commit.parent ||
          !commit.author ||
          !commit.timestamp ||
          !commit.message
        ) {
          res.status(400).json({ success: false, message: 'Invalid commit' })
          return
        }
      }

      const { repo } = await RemoteService.getRepo(remote as string)

      const branchExists = await RemoteService.branchExists(
        remote as string,
        branchName,
      )
      let branchId: string

      if (branchExists) {
        const { branch } = await RemoteService.getBranch(
          remote as string,
          branchName,
        )
        branchId = (branch._id as any).toString()
      } else {
        const newBranch = await db?.BranchModel.create({
          repoId: repo._id as any,
          name: branchName,
        })
        if (!newBranch || !newBranch?._id) {
          res.status(400).json({
            success: false,
            message: 'Failed to create branch',
          })
          return
        }
        branchId = newBranch._id.toString()
      }

      if (commits.length) {
        await CommitService.createCommits(
          (repo._id as any).toString(),
          branchId,
          commits,
        )
      }

      res.status(201).json({
        success: true,
        message: 'Commits created successfully',
      })
      return
    } catch (error) {
      console.error('Create commit error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to create commit',
      })
      return
    }
  }

  static async getCommits(req: Request, res: Response) {
    try {
      const { branchName } = req.params
      const {
        remote,
        page,
        limit,
        sortBy,
        sortOrder,
        author,
        startDate,
        endDate,
      } = req.query

      const result = await RemoteService.getCommits(
        remote as string,
        branchName,
        {
          page: page ? parseInt(page as string) : undefined,
          limit: limit ? parseInt(limit as string) : undefined,
          sortBy: sortBy as string,
          sortOrder: sortOrder as 'asc' | 'desc',
          author: author as string,
          startDate: startDate as string,
          endDate: endDate as string,
        },
      )

      res.json({
        success: true,
        message: 'Commits fetched successfully',
        data: {
          commits: result.commits,
          pagination: result.pagination,
        },
      })
    } catch (error) {
      console.error('Get commits error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch commits',
      })
      return
    }
  }

  static async getCommit(req: Request, res: Response) {
    try {
      const { commitHash } = req.params
      const { remote } = req.query

      const { commit, repo, branch } = await RemoteService.getCommitWithBranch(
        remote as string,
        commitHash,
      )

      const commitDetails = await CommitService.getCommitDetails(
        remote as string,
        commitHash,
      )

      res.json({
        success: true,
        message: 'Commit fetched successfully',
        data: {
          commit: commitDetails.commit,
          files: commitDetails.files,
          stats: commitDetails.stats,
        },
      })
    } catch (error) {
      console.error('Get commit error:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('not found')) {
        res.status(404).json({
          success: false,
          message: errorMessage,
        })
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch commit',
        })
      }
      return
    }
  }

  static async getFiles(req: Request, res: Response) {
    try {
      const { branchName } = req.params
      const { remote, path } = req.query

      const normalizedPath = RemoteService.parseAndNormalizePath(path as string)

      if (!RemoteService.isValidPath(normalizedPath)) {
        res.status(400).json({
          success: false,
          message: 'Invalid path provided',
        })
        return
      }

      const result = await BranchService.getFiles(
        remote as string,
        branchName,
        normalizedPath,
      )

      res.json({
        success: true,
        message: 'Files fetched successfully',
        data: result,
      })
    } catch (error) {
      console.error('Get files error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch files',
      })
      return
    }
  }

  static async getFile(req: Request, res: Response) {
    try {
      const { branchName } = req.params
      const { remote, path } = req.query

      if (!path) {
        res.status(400).json({
          success: false,
          message: 'Path parameter is required',
        })
        return
      }

      const normalizedPath = RemoteService.parseAndNormalizePath(path as string)

      if (!RemoteService.isValidPath(normalizedPath)) {
        res.status(400).json({
          success: false,
          message: 'Invalid path provided',
        })
        return
      }

      const file = await BranchService.getFile(
        remote as string,
        branchName,
        normalizedPath,
      )

      res.json({
        success: true,
        message: 'File fetched successfully',
        data: { file },
      })
    } catch (error) {
      console.error('Get file error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch file',
      })
      return
    }
  }

  static async getCompleteTreeStructure(req: Request, res: Response) {
    try {
      const { branchName } = req.params
      const { remote } = req.query

      const result = await BranchService.getCompleteTreeStructure(
        remote as string,
        branchName,
      )

      res.json({
        success: true,
        message: 'Complete tree structure fetched successfully',
        data: result,
      })
    } catch (error) {
      console.error('Get complete tree structure error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch complete tree structure',
      })
      return
    }
  }
}

export default BranchController
