import { Request, Response } from 'express'
import { db } from '../db/mongo/init'
import R2CloudflareService from '../services/r2cloudflare.service'
import axios from 'axios'
import RemoteService from '../services/remote.service'
import RepoService from '../services/repo.service'
import { IBranch } from '../db/mongo/models/Branch.schema'

class RepoController {
  static async getSignedUploadUrl(req: Request, res: Response) {
    try {
      const { hash } = req.params

      // const url = `https://media.harshkeshri.com/hit/${hash.slice(0, 2)}/${hash.slice(2)}`

      const path = `hit/${hash.slice(0, 2)}/${hash.slice(2)}`
      // let exists = false
      // try {
      //   const response = await axios.head(url)
      //   if (response.status === 200) {
      //     const publicUrl = R2CloudflareService.getPublicUrl(path)
      //     exists = true
      //     console.log('File found')
      //     res.json({
      //       success: true,
      //       message: 'File found',
      //       data: {
      //         signedUrl: '',
      //         publicUrl: publicUrl,
      //         exists,
      //       },
      //     })
      //     return
      //   }
      // } catch (error) {
      //   exists = false
      //   console.log('File not found')
      // }

      const signedUrl = await R2CloudflareService.generateSignedUploadUrl(path)

      res.json({
        success: true,
        message: 'Signed upload URL fetched successfully',
        data: {
          signedUrl: signedUrl.signedUrl,
          publicUrl: signedUrl.publicUrl,
          // exists,
        },
      })
    } catch (error) {
      console.error('Get signed upload URL error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to get signed upload URL',
      })
      return
    }
  }

  static async confirmSignedUploadUrl(req: Request, res: Response) {
    try {
      const { hash } = req.params
      const { remote } = req.query

      const { repo } = await RemoteService.getRepo(remote as string)

      try {
        await db?.HashModel.create({ hash, repoId: repo._id })
      } catch (error) {}

      res.json({
        success: true,
        message: 'Signed upload URL confirmed successfully',
      })
      return
    } catch (error) {
      console.error('Confirm signed upload URL error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to confirm signed upload URL',
      })
      return
    }
  }

  static async createRepo(req: Request, res: Response) {
    try {
      const { userId, username } = (req as any).user
      const { name, description, isPublic } = req.body

      const repo = await db?.RepoModel.create({
        userId,
        username,
        name,
        description,
        isPublic,
      })

      if (!repo || !repo?._id) {
        res.status(400).json({
          success: false,
          message: 'Failed to create repo',
        })
        return
      }

      res.json({
        success: true,
        message: 'Repo created successfully',
        data: {
          repo,
        },
      })
    } catch (error) {
      console.error('Create repo error:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      })
    }
  }

  static async getRepos(req: Request, res: Response) {
    try {
      const { userId } = (req as any).user
      const { page = 1, limit = 10 } = req.query
      const skip = (Number(page) - 1) * Number(limit)

      const [repos, total] = await Promise.all([
        db?.RepoModel.find({ userId })
          .skip(skip)
          .limit(Number(limit))
          .sort({ createdAt: -1 })
          .lean(),
        db?.RepoModel.countDocuments({ userId }).lean(),
      ])

      if (!repos) {
        res.status(400).json({
          success: false,
          message: 'Failed to fetch repos',
        })
        return
      }

      res.json({
        success: true,
        message: 'Repos fetched successfully',
        data: {
          repos,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: total || 0,
            totalPages: Math.ceil(total || 0 / Number(limit)),
            hasNext: Number(page) < Math.ceil(total || 0 / Number(limit)),
            hasPrev: Number(page) > 1,
          },
        },
      })
    } catch (error) {
      console.error('Get repos error:', error)
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      })
    }
  }

  static async getRepo(req: Request, res: Response) {
    try {
      const { remote, branchName } = req.query

      const repoDetails = await RepoService.getRepoDetails(
        remote as string,
        branchName as string,
      )

      res.json({
        success: true,
        message: 'Repo fetched successfully',
        data: {
          repo: repoDetails.repo,
          totalCommits: repoDetails.totalCommits,
          branches: repoDetails.branches,
          files: repoDetails.files,
        },
      })
    } catch (error) {
      console.error('Get repo error:', error)

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
          message: 'Failed to fetch repo',
        })
      }
      return
    }
  }

  static async cloneRepository(req: Request, res: Response) {
    try {
      const { remote } = req.body

      const { repo, username, repoName } = await RemoteService.getRepo(
        remote as string,
      )

      const branch = await db?.BranchModel.findOne({
        repoId: repo._id,
        _id: repo.defaultBranch,
      }).lean()
      const defaultBranch = branch?.name

      const branches =
        (await db?.BranchModel.find({ repoId: repo._id }).lean()) || []

      if (!defaultBranch || !branches[0]) {
        res.status(400).json({
          success: false,
          message: 'Failed to clone repository',
        })
        return
      }

      const [branchesData, hashes] = await Promise.all([
        Promise.all(
          branches.map(async (branch) => {
            const [commits, headCommit] = await Promise.all([
              db?.CommitModel.find({
                repoId: repo._id,
                branchId: branch._id,
              }).lean(),
              db?.CommitModel.findById(branch.headCommit).lean(),
            ])
            return {
              name: branch.name,
              headCommit: headCommit?.hash || '',
              commits:
                commits?.map((commit) => ({
                  hash: commit.hash,
                  parent: commit.parent,
                  message: commit.message,
                  author: commit.author,
                  timestamp: commit.timestamp.toISOString(),
                })) || [],
            }
          }),
        ),
        (await db?.HashModel.find({ repoId: repo._id }).distinct('hash')) || [],
      ])

      const config = {
        remotes: {
          origin: {
            name: 'origin',
            url: remote,
          },
        },
      }

      const data: {
        username: string
        repoName: string
        repository: string
        hashes: string[]
        branches: {
          name: string
          headCommit: string
          commits: {
            hash: string
            parent: string
            message: string
            author: string
            timestamp: string
          }[]
        }[]
        config: {
          remotes: {
            [key: string]: {
              name: string
              url: string
            }
          }
        }
        headBranch: string
      } = {
        username: username,
        repoName: repoName,
        repository: remote,
        hashes: hashes,
        branches: branchesData,
        config: config,
        headBranch: defaultBranch || branches[0].name,
      }

      res.json({
        success: true,
        message: 'Repository cloned successfully',
        data: data,
      })
      return
    } catch (error) {
      console.error('Clone repository error:', error)
      res.status(500).json({
        success: false,
        message: 'Failed to clone repository',
      })
      return
    }
  }
}

export default RepoController
