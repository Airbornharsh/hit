import ZlibService from './zlib.service'

class HashService {
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

    const result = Array.from(fileMap.values())
    result.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })

    return result
  }

  static async getFiles(hash: string, path: string) {
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

    if (!path) {
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
    } else {
      // Filter entries that start with the given path
      const pathPrefix = path.endsWith('/') ? path : `${path}/`
      for (const name of entries) {
        if (name.startsWith(pathPrefix)) {
          const relativePath = name.substring(pathPrefix.length)
          const parts = relativePath.split('/')
          const fileName = parts[0]

          if (fileName && !fileMap.has(fileName)) {
            const fileType = parts.length > 1 ? 'directory' : 'file'
            fileMap.set(fileName, {
              name: fileName,
              type: fileType,
              lastModified,
            })
          }
        }
      }
    }

    const result = Array.from(fileMap.values())
    result.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })

    return result
  }

  static async getFile(hash: string, path: string) {
    const tree = await ZlibService.decompress(hash)
    const treeData = JSON.parse(tree)

    // Find the file hash for the given path
    const fileHash = treeData.entries[path]

    if (!fileHash) {
      throw new Error(`File not found: ${path}`)
    }

    const file = await ZlibService.decompress(fileHash)

    return file
  }

  static async getCompleteTreeStructure(hash: string): Promise<
    {
      name: string
      type: 'file' | 'directory'
      lastModified: string
      path: string
      children?: any[]
    }[]
  > {
    const tree = await ZlibService.decompress(hash)
    const treeData = JSON.parse(tree)

    const entries = Object.keys(treeData.entries || {})
    const lastModified = treeData.lastModified || new Date().toISOString()

    const nodeMap = new Map<string, any>()
    const rootNodes: any[] = []

    const allPaths = new Set<string>()

    for (const entry of entries) {
      const pathParts = entry.split('/')

      for (let i = 1; i < pathParts.length; i++) {
        const dirPath = pathParts.slice(0, i).join('/')
        allPaths.add(dirPath)
      }

      allPaths.add(entry)
    }

    for (const path of allPaths) {
      const pathParts = path.split('/')
      const name = pathParts[pathParts.length - 1]

      const hasChildren = entries.some((e) => e.startsWith(path + '/'))
      const isDirectory = hasChildren

      const node = {
        name,
        type: isDirectory ? 'directory' : 'file',
        lastModified,
        path: path,
        children: isDirectory ? [] : undefined,
      }

      nodeMap.set(path, node)
    }

    for (const path of allPaths) {
      const pathParts = path.split('/')
      const node = nodeMap.get(path)

      if (pathParts.length === 1) {
        rootNodes.push(node)
      } else {
        const parentPath = pathParts.slice(0, -1).join('/')
        const parentNode = nodeMap.get(parentPath)

        if (parentNode && parentNode.children) {
          parentNode.children.push(node)
        }
      }
    }

    const sortNodes = (nodes: any[]) => {
      nodes.sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      })

      nodes.forEach((node) => {
        if (node.children) {
          sortNodes(node.children)
        }
      })
    }

    sortNodes(rootNodes)

    return rootNodes
  }

  // Alternative simpler implementation
  static async getSimpleTreeStructure(hash: string): Promise<
    {
      name: string
      type: 'file' | 'directory'
      lastModified: string
      path: string
      children?: any[]
    }[]
  > {
    const rootFiles = await this.getRootFiles(hash)
    const treeNodes: any[] = []

    for (const file of rootFiles) {
      const node = {
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        path: file.name,
        children: file.type === 'directory' ? [] : undefined,
      }

      treeNodes.push(node)
    }

    return treeNodes
  }
}

export default HashService
