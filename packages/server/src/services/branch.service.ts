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
    const { branch, repo } = await RemoteService.getBranch(remote, branchName)
    const { commit } = await RemoteService.getHeadCommit(remote, branchName)

    if (!commit || !commit.hash) {
      return {
        files: [],
        path: path,
      }
    }

    try {
      const files = (await HashService.getFiles(commit.hash, path)) as any[]

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
    const { branch, repo } = await RemoteService.getBranch(remote, branchName)
    const { commit } = await RemoteService.getHeadCommit(remote, branchName)

    if (!commit || !commit.hash) {
      throw new Error('No files found in this branch')
    }

    try {
      const content = await HashService.getFile(commit.hash, path)
      const size = new Blob([content]).size

      return {
        content,
        size,
        lastModified:
          commit.timestamp?.toISOString() || new Date().toISOString(),
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
    const { branch, repo } = await RemoteService.getBranch(remote, branchName)
    const { commit } = await RemoteService.getHeadCommit(remote, branchName)

    if (!commit || !commit.hash) {
      return {
        tree: [],
      }
    }

    try {
      const tree = await HashService.getCompleteTreeStructure(commit.hash)

      if (tree.length === 0) {
        const simpleTree = await HashService.getSimpleTreeStructure(commit.hash)
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
        const simpleTree = await HashService.getSimpleTreeStructure(commit.hash)
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
