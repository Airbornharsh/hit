import { db } from '../db/mongo/init'
import RemoteService from './remote.service'
import HashService from './hash.service'

interface FileItem {
  name: string
  type: 'file' | 'directory'
  lastModified: string
  path?: string
  size?: number
}

interface FileContent {
  content: string
  size: number
  lastModified: string
}

class BranchService {
  static async getFiles(
    remote: string,
    branchName: string,
    path: string = '',
  ): Promise<{
    files: FileItem[]
    path: string
  }> {
    const { userName, repoName } = await RemoteService.remoteBreakdown(remote)

    const user = await db?.UserModel.findOne({
      username: userName,
    }).lean()

    if (!user || !user?._id) {
      throw new Error('Failed to fetch user')
    }

    const repo = await db?.RepoModel.findOne({
      userId: user._id,
      name: repoName,
    }).lean()

    if (!repo || !repo?._id) {
      throw new Error('Failed to fetch repo')
    }

    const branch = await db?.BranchModel.findOne({
      name: branchName,
      repoId: repo._id,
    }).lean()

    if (!branch || !branch?._id) {
      throw new Error('Failed to fetch branch')
    }

    const headCommit = await db?.CommitModel.findById(branch.headCommit).lean()

    if (!headCommit || !headCommit.hash) {
      return {
        files: [],
        path: path,
      }
    }

    try {
      const files = (await HashService.getFiles(headCommit.hash, path)) as any[]

      return {
        files: files.map((file) => ({
          ...file,
          path: path ? `${path}/${file.name}` : file.name,
        })),
        path: path,
      }
    } catch (error) {
      console.error('Error getting files:', error)
      return {
        files: [],
        path: path,
      }
    }
  }

  static async getFile(
    remote: string,
    branchName: string,
    path: string,
  ): Promise<FileContent> {
    const { userName, repoName } = await RemoteService.remoteBreakdown(remote)

    const user = await db?.UserModel.findOne({
      username: userName,
    }).lean()

    if (!user || !user?._id) {
      throw new Error('Failed to fetch user')
    }

    const repo = await db?.RepoModel.findOne({
      userId: user._id,
      name: repoName,
    }).lean()

    if (!repo || !repo?._id) {
      throw new Error('Failed to fetch repo')
    }

    const branch = await db?.BranchModel.findOne({
      name: branchName,
      repoId: repo._id,
    }).lean()

    if (!branch || !branch?._id) {
      throw new Error('Failed to fetch branch')
    }

    const headCommit = await db?.CommitModel.findById(branch.headCommit).lean()

    if (!headCommit || !headCommit.hash) {
      throw new Error('No files found in this branch')
    }

    try {
      const content = await HashService.getFile(headCommit.hash, path)
      const size = new Blob([content]).size

      return {
        content,
        size,
        lastModified:
          headCommit.timestamp?.toISOString() || new Date().toISOString(),
      }
    } catch (error) {
      console.error('Error getting file:', error)
      throw new Error('Failed to fetch file content')
    }
  }

  static async getCompleteTreeStructure(
    remote: string,
    branchName: string,
  ): Promise<{
    tree: {
      name: string
      type: 'file' | 'directory'
      lastModified: string
      path: string
      children?: any[]
    }[]
  }> {
    const { userName, repoName } = await RemoteService.remoteBreakdown(remote)

    const user = await db?.UserModel.findOne({
      username: userName,
    }).lean()

    if (!user || !user?._id) {
      throw new Error('Failed to fetch user')
    }

    const repo = await db?.RepoModel.findOne({
      userId: user._id,
      name: repoName,
    }).lean()

    if (!repo || !repo?._id) {
      throw new Error('Failed to fetch repo')
    }

    const branch = await db?.BranchModel.findOne({
      name: branchName,
      repoId: repo._id,
    }).lean()

    if (!branch || !branch?._id) {
      throw new Error('Failed to fetch branch')
    }

    const headCommit = await db?.CommitModel.findById(branch.headCommit).lean()

    if (!headCommit || !headCommit.hash) {
      return {
        tree: [],
      }
    }

    try {
      const tree = await HashService.getCompleteTreeStructure(headCommit.hash)

      if (tree.length === 0) {
        const simpleTree = await HashService.getSimpleTreeStructure(
          headCommit.hash,
        )
        return {
          tree: simpleTree,
        }
      }

      return {
        tree: tree,
      }
    } catch (error) {
      console.error('Error getting complete tree structure:', error)

      try {
        const simpleTree = await HashService.getSimpleTreeStructure(
          headCommit.hash,
        )
        return {
          tree: simpleTree,
        }
      } catch (fallbackError) {
        console.error('Error getting simple tree structure:', fallbackError)
        return {
          tree: [],
        }
      }
    }
  }
}

export default BranchService
