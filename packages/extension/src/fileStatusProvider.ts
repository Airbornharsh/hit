import * as vscode from 'vscode'
import * as path from 'path'

export interface FileStatus {
  path: string
  relativePath: string
  status: 'M' | 'A' | 'D' // Modified, Added, Deleted
  staged: boolean
  workspacePath: string
}

export class FileStatusProvider {
  private fileStatuses: FileStatus[] = []
  private workspaceRoot: string

  constructor() {
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
  }

  getFileStatuses(): FileStatus[] {
    return this.fileStatuses
  }

  getStagedFiles(): FileStatus[] {
    return this.fileStatuses.filter((fs) => fs.staged)
  }

  getUncommittedFiles(): FileStatus[] {
    return this.fileStatuses.filter((fs) => !fs.staged)
  }

  stageFile(filePath: string): void {
    const fileStatus = this.fileStatuses.find((fs) => fs.path === filePath)
    if (fileStatus) {
      fileStatus.staged = true
    }
  }

  unstageFile(filePath: string): void {
    const fileStatus = this.fileStatuses.find((fs) => fs.path === filePath)
    if (fileStatus) {
      fileStatus.staged = false
    }
  }

  stageAllFiles(): void {
    this.fileStatuses.forEach((fs) => {
      if (!fs.staged) {
        fs.staged = true
      }
    })
  }

  unstageAllFiles(): void {
    this.fileStatuses.forEach((fs) => {
      if (fs.staged) {
        fs.staged = false
      }
    })
  }

  removeFile(filePath: string): void {
    this.fileStatuses = this.fileStatuses.filter((fs) => fs.path !== filePath)
  }

  getFileIcon(filePath: string): vscode.ThemeIcon | string {
    const ext = path.extname(filePath).toLowerCase()

    switch (ext) {
      case '.go':
        return 'go'
      case '.ts':
        return 'typescript'
      case '.js':
        return 'javascript'
      case '.tsx':
        return 'typescript'
      case '.jsx':
        return 'javascript'
      case '.py':
        return 'python'
      case '.java':
        return 'java'
      case '.cpp':
      case '.cc':
      case '.cxx':
        return 'cpp'
      case '.c':
        return 'c'
      case '.cs':
        return 'csharp'
      case '.php':
        return 'php'
      case '.rb':
        return 'ruby'
      case '.rs':
        return 'rust'
      case '.swift':
        return 'swift'
      case '.kt':
        return 'kotlin'
      case '.scala':
        return 'scala'
      case '.html':
        return 'html'
      case '.css':
        return 'css'
      case '.scss':
      case '.sass':
        return 'scss'
      case '.json':
        return 'json'
      case '.xml':
        return 'xml'
      case '.yaml':
      case '.yml':
        return 'yaml'
      case '.md':
        return 'markdown'
      case '.txt':
        return 'text'
      case '.sh':
      case '.bash':
        return 'bash'
      case '.ps1':
        return 'powershell'
      case '.dockerfile':
        return 'docker'
      default:
        return new vscode.ThemeIcon('file')
    }
  }

  getStatusColor(status: string): vscode.ThemeColor | undefined {
    switch (status) {
      case 'M':
        return new vscode.ThemeColor('gitDecoration.modifiedResourceForeground')
      case 'A':
        return new vscode.ThemeColor('gitDecoration.addedResourceForeground')
      case 'D':
        return new vscode.ThemeColor('gitDecoration.deletedResourceForeground')
      case 'R':
        return new vscode.ThemeColor('gitDecoration.renamedResourceForeground')
      case 'C':
        return new vscode.ThemeColor('gitDecoration.conflictResourceForeground')
      default:
        return undefined
    }
  }

  getStatusDescription(status: string): string {
    switch (status) {
      case 'M':
        return 'Modified'
      case 'A':
        return 'Added'
      case 'D':
        return 'Deleted'
      case 'R':
        return 'Renamed'
      case 'C':
        return 'Conflict'
      default:
        return status
    }
  }

  addFile(
    filePath: string,
    status: 'M' | 'A' | 'D' = 'M',
    staged: boolean = false,
  ): void {
    const relativePath = path.relative(this.workspaceRoot, filePath)
    const existingIndex = this.fileStatuses.findIndex(
      (fs) => fs.relativePath === relativePath,
    )
    const newFileStatus: FileStatus = {
      path: filePath,
      relativePath,
      status,
      staged,
      workspacePath: path.join(this.workspaceRoot, filePath),
    }

    if (existingIndex >= 0) {
      this.fileStatuses[existingIndex] = newFileStatus
    } else {
      this.fileStatuses.push(newFileStatus)
    }
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot
  }
}
