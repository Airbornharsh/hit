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

      const { userName, repoName } = await RemoteService.remoteBreakdown(
        remote as string,
      )

      const userId = await db?.UserModel.findOne({
        username: userName,
      }).lean()

      if (!userId || !userId?._id) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch user',
        })
        return
      }

      const repo = await db?.RepoModel.findOne({
        userId: userId._id,
        name: repoName,
      }).lean()

      if (!repo || !repo?._id) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch repo',
        })
        return
      }

      const skip = (Number(page) - 1) * Number(limit)

      const [branches, total] = await Promise.all([
        db?.BranchModel.find({ repoId: repo._id })
          .skip(skip)
          .limit(Number(limit))
          .sort({ createdAt: -1 })
          .lean(),
        db?.BranchModel.countDocuments({ repoId: repo._id }).lean(),
      ])

      if (!branches) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch branches',
        })
        return
      }

      res.json({
        success: true,
        message: 'Branches fetched successfully',
        data: {
          branches,
          total: total || 0,
          page: Number(page),
          limit: Number(limit),
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

      const { userName, repoName } = await RemoteService.remoteBreakdown(
        remote as string,
      )

      const user = await db?.UserModel.findOne({
        username: userName,
      }).lean()

      if (!user || !user?._id) {
        console.log('User not found')
        res.status(400).json({
          success: false,
          message: 'Failed to fetch user',
        })
        return
      }

      const repo = await db?.RepoModel.findOne({
        userId: user._id,
        name: repoName,
      }).lean()

      if (!repo || !repo?._id) {
        console.log('Repo not found')
        res.status(400).json({
          success: false,
          message: 'Failed to fetch repo',
        })
        return
      }

      const branch = await db?.BranchModel.findOne({
        repoId: repo._id,
        name: branchName,
      }).lean()

      if (!branch || !branch?._id) {
        console.log('Branch not found')
        res.status(400).json({
          success: false,
          message: 'Failed to fetch branch',
        })
        return
      }

      const headCommit = await db?.CommitModel.findById(
        branch.headCommit,
      ).lean()

      res.json({
        success: true,
        message: 'Head commit fetched successfully',
        data: {
          exists: headCommit ? true : false,
          headCommit: {
            _id: headCommit?._id || null,
            message: headCommit?.message || null,
            author: headCommit?.author || null,
            timestamp: headCommit?.timestamp || null,
            hash: headCommit?.hash || null,
            parent: headCommit?.parent || null,
          },
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

      const { remote } = req.query

      const { userName, repoName } = await RemoteService.remoteBreakdown(
        remote as string,
      )

      const userId = await db?.UserModel.findOne({
        username: userName,
      }).lean()

      if (!userId || !userId?._id) {
        res
          .status(400)
          .json({ success: false, message: 'Failed to fetch user' })
        return
      }

      const repo = await db?.RepoModel.findOne({
        userId: userId._id,
        name: repoName,
      }).lean()

      if (!repo || !repo?._id) {
        res
          .status(400)
          .json({ success: false, message: 'Failed to fetch repo' })
        return
      }

      const branch = await db?.BranchModel.findOne({
        name: branchName,
        repoId: repo._id,
      }).lean()

      if (!branch || !branch?._id) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch branch',
        })
        return
      }

      if (commits.length) {
        await CommitService.createCommits(
          repo._id.toString(),
          branch._id.toString(),
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

  static async getCommit(req: Request, res: Response) {
    try {
      const { branchName, commitHash } = req.params
      const branch = await db?.BranchModel.findOne({
        name: branchName,
      }).lean()

      if (!branch || !branch?._id) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch branch',
        })
        return
      }

      const commit = await db?.CommitModel.findOne({
        branchId: branch._id,
        hash: commitHash,
      }).lean()

      if (!commit || !commit?._id) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch commit',
        })
        return
      }

      res.json({
        success: true,
        message: 'Commit fetched successfully',
        data: {
          commit,
        },
      })
    } catch (error) {
      console.error('Get commit error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to fetch commit',
      })
      return
    }
  }

  static async getFiles(req: Request, res: Response) {
    try {
      const { branchName } = req.params
      const { remote, path } = req.query

      const result = await BranchService.getFiles(
        remote as string,
        branchName,
        (path as string) || '',
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

      const file = await BranchService.getFile(
        remote as string,
        branchName,
        path as string,
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
