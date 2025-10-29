import * as vscode from 'vscode'
import * as path from 'path'
import { FileStatusProvider, FileStatus } from './fileStatusProvider'
import Log from './util/log'
import Session from './util/session'
import { exec } from 'child_process'
import * as fs from 'fs'
import {
  cmdRun,
  cmdRunExec,
  CommandInput,
  CommandOutput,
  CommitTreeData,
} from './util/cmdRun'

export interface Repository {
  name: string
  path: string
  branch: string
  hasUncommittedChanges: boolean
  hasStagedChanges: boolean
  isMain: boolean
  stagedFileStatuses: Map<string, FileStatus>
  uncommittedFileStatuses: Map<string, FileStatus>
}

export class HitTreeItem extends vscode.TreeItem {
  public children?: HitTreeItem[]

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly iconPath?: vscode.ThemeIcon | string,
    public readonly contextValue?: string,
    public readonly resourceUri?: vscode.Uri,
    public readonly description?: string,
    public readonly tooltip?: string,
    public readonly path?: string,
    public readonly isFolder?: boolean,
    public readonly repositoryName?: string,
  ) {
    super(label, collapsibleState)
    this.resourceUri = resourceUri
    this.description = description
    this.tooltip = tooltip
    this.path = path
    this.isFolder = isFolder
    this.repositoryName = repositoryName
  }
}

export class HitSourceControlProvider
  implements vscode.TreeDataProvider<HitTreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    HitTreeItem | undefined | null | void
  > = new vscode.EventEmitter<HitTreeItem | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<
    HitTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event

  // Repository data
  private mainRepository: Repository | null = null
  private workspaceRoot: string
  private commitMessage: string = ''
  private currentRepository: string | null = null
  private folderHierarchySwitch: boolean = true

  constructor() {
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''

    this.setupFileChangeListener()
  }

  private setupFileChangeListener(): void {
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.scheme === 'file') {
        const filePath = event.document.uri.fsPath
        if (filePath.startsWith(this.workspaceRoot)) {
          this.debouncedRefresh()
        }
      }
    })

    vscode.workspace.onDidCreateFiles((event) => {
      this.debouncedRefresh()
    })

    vscode.workspace.onDidDeleteFiles((event) => {
      this.debouncedRefresh()
    })

    vscode.workspace.onDidRenameFiles((event) => {
      this.debouncedRefresh()
    })
  }

  private debounceTimer: NodeJS.Timeout | null = null

  private debouncedRefresh(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      this.refresh()
    }, 2000)
  }

  getTreeItem(element: HitTreeItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: HitTreeItem): Thenable<HitTreeItem[]> {
    const session = Session.getSession()

    if (!session) {
      vscode.window.showInformationMessage('Please login to continue')
      return this.getSignInChildren()
    }

    if (!element) {
      return this.getSingleRepositoryChildren()
    }

    if (element.contextValue === 'staged-section') {
      return this.getRepositorySectionChildren(
        element.repositoryName!,
        'staged',
      )
    } else if (element.contextValue === 'uncommitted-section') {
      return this.getRepositorySectionChildren(
        element.repositoryName!,
        'uncommitted',
      )
    } else if (
      element.contextValue === 'folder' ||
      element.contextValue === 'staged-folder' ||
      element.contextValue === 'uncommitted-folder'
    ) {
      return this.getFolderChildren(element)
    } else if (element.contextValue === 'sign-in') {
      return this.getSignInChildren()
    }

    return Promise.resolve([])
  }

  async initializeRepository(): Promise<void> {
    const files = await vscode.workspace.findFiles(
      '**/.hit/HEAD',
      '**/node_modules/**',
    )
    if (files.length > 0) {
      const file = files[0]
      const repoPath = file.fsPath.split('/.hit/HEAD')[0]
      const repoName = repoPath.split('/').pop() || ''
      const headFile = fs.readFileSync(file.path, 'utf8')
      const branch = headFile.split('ref: refs/heads/')[1].trim()

      this.mainRepository = await this.createRepository(
        repoName,
        repoPath,
        branch,
        true,
      )
    }
  }

  private async createRepository(
    name: string,
    repoPath: string,
    branch: string,
    isMain: boolean = false,
  ): Promise<Repository> {
    const indexFile = path.join(repoPath, '.hit', 'index.json')
    let index = null
    try {
      const indexData = fs.readFileSync(indexFile, 'utf8')
      index = JSON.parse(indexData)
    } catch (error) {
      Log.error('Error parsing index file:', error)
      index = null
    }

    const branchFile = path.join(repoPath, '.hit', 'refs', 'heads', branch)
    const branchFileContent = fs.readFileSync(branchFile, 'utf8')
    const branchHash = branchFileContent.trim()

    const commitTree = await cmdRun<CommandInput, CommandOutput>({
      command: 'commit-tree' + ' ' + branchHash,
      workspaceDir: repoPath,
    })

    if (!commitTree.success) {
      Log.log('Commit tree command failed:', commitTree)
      throw new Error(commitTree.message || 'Commit tree command failed')
    }
    // Log.log('Commit tree:', commitTree);

    const treeData = commitTree.data as CommitTreeData

    const stagedFileStatuses = new Map<string, FileStatus>()
    const uncommittedFileStatuses = new Map<string, FileStatus>()

    // Convert staged objects to Map
    Object.entries(treeData.staged).forEach(([relativePath, fileStatus]) => {
      stagedFileStatuses.set(relativePath, {
        path: fileStatus.path,
        relativePath: fileStatus.relativePath,
        status: fileStatus.status,
        staged: true,
        workspacePath: fileStatus.workspacePath,
      })
    })

    // Convert unstaged objects to Map
    Object.entries(treeData.unstaged).forEach(([relativePath, fileStatus]) => {
      uncommittedFileStatuses.set(relativePath, {
        path: fileStatus.path,
        relativePath: fileStatus.relativePath,
        status: fileStatus.status,
        staged: false,
        workspacePath: fileStatus.workspacePath,
      })
    })

    return {
      name,
      path: repoPath,
      branch,
      hasUncommittedChanges: true,
      hasStagedChanges: true,
      isMain,
      stagedFileStatuses,
      uncommittedFileStatuses,
    }
  }

  getRepository(): Repository | null {
    return this.mainRepository || null
  }

  // Commit Message Management
  getCommitMessage(): string {
    return this.commitMessage
  }

  setCommitMessage(message: string): void {
    this.commitMessage = message
  }

  // Tree View Methods
  private getSignInChildren(): Thenable<HitTreeItem[]> {
    const rootItems: HitTreeItem[] = []
    rootItems.push(
      new HitTreeItem(
        'Sign In',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'hit.signIn',
          title: 'Sign In',
          arguments: [],
          tooltip: 'Sign in to your hit account',
        },
        new vscode.ThemeIcon('account'),
        'sign-in',
        undefined,
        'Sign in to your hit account',
      ),
    )
    return Promise.resolve(rootItems)
  }

  private getSingleRepositoryChildren(): Thenable<HitTreeItem[]> {
    const mainRepo = this.getRepository()
    if (!mainRepo) {
      return Promise.resolve([])
    }

    this.currentRepository = mainRepo.name
    const rootItems: HitTreeItem[] = []

    rootItems.push(
      new HitTreeItem(
        '📝 Input Area',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'hit.showCommitMessageInput',
          title: 'Commit Message',
          arguments: [],
        },
        new vscode.ThemeIcon('edit'),
        'input-area',
        undefined,
        this.getCommitMessage() || 'Click to open commit message input dialog',
        'Enter your text here',
        undefined,
        undefined,
        mainRepo.name,
      ),
    )

    rootItems.push(
      new HitTreeItem(
        '🚀 Commit Button',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'hit.actionButton',
          title: 'Commit Changes',
          arguments: [],
        },
        new vscode.ThemeIcon('play'),
        'action-button',
        undefined,
        'Click to commit changes',
        'Commit changes to the repository',
        undefined,
        undefined,
        mainRepo.name,
      ),
    )

    // Staged Changes section
    if (mainRepo.stagedFileStatuses.size > 0) {
      rootItems.push(
        new HitTreeItem(
          'Staged Changes',
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          new vscode.ThemeIcon('check'),
          'staged-section',
          undefined,
          `${mainRepo.stagedFileStatuses.size}`,
          undefined,
          undefined,
          undefined,
          mainRepo.name,
        ),
      )
    }

    // Changes section
    if (mainRepo.uncommittedFileStatuses.size > 0) {
      rootItems.push(
        new HitTreeItem(
          'Changes',
          vscode.TreeItemCollapsibleState.Expanded,
          undefined,
          new vscode.ThemeIcon('diff'),
          'uncommitted-section',
          undefined,
          `${mainRepo.uncommittedFileStatuses.size}`,
          undefined,
          undefined,
          undefined,
          mainRepo.name,
        ),
      )
    }

    return Promise.resolve(rootItems)
  }

  private getRepositorySectionChildren(
    repoName: string,
    type: 'staged' | 'uncommitted',
  ): Thenable<HitTreeItem[]> {
    const repo = this.getRepository()
    if (!repo) {
      return Promise.resolve([])
    }

    const fileMap =
      type === 'staged' ? repo.stagedFileStatuses : repo.uncommittedFileStatuses

    const files = Array.from(fileMap.values())

    return Promise.resolve(this.buildHierarchicalTree(files, type, repoName))
  }

  private getFolderChildren(element: HitTreeItem): Thenable<HitTreeItem[]> {
    if (!element.repositoryName || !this.folderHierarchySwitch) {
      return Promise.resolve([])
    }

    const repo = this.getRepository()
    if (!repo) {
      return Promise.resolve([])
    }

    const fileMap =
      element.contextValue === 'staged-folder'
        ? repo.stagedFileStatuses
        : repo.uncommittedFileStatuses

    const currentFolderPath = element.path || ''

    const childFiles: FileStatus[] = []
    const childFolders = new Map<string, HitTreeItem>()

    for (const [relativePath, fileStatus] of fileMap) {
      if (relativePath.startsWith(currentFolderPath + '/')) {
        const remainingPath = relativePath.substring(
          currentFolderPath.length + 1,
        )
        const pathParts = remainingPath.split('/')

        if (pathParts.length === 1) {
          childFiles.push(fileStatus)
        } else if (pathParts.length > 1) {
          const subfolderName = pathParts[0]
          const subfolderPath = currentFolderPath
            ? `${currentFolderPath}/${subfolderName}`
            : subfolderName

          if (!childFolders.has(subfolderPath)) {
            const subfolderItem = new HitTreeItem(
              subfolderName,
              vscode.TreeItemCollapsibleState.Collapsed,
              undefined,
              new vscode.ThemeIcon('folder'),
              element.contextValue,
              undefined,
              undefined,
              undefined,
              subfolderPath,
              true,
              element.repositoryName,
            )
            childFolders.set(subfolderPath, subfolderItem)
          }
        }
      }
    }

    const type =
      element.contextValue === 'staged-folder' ? 'staged' : 'uncommitted'
    const fileItems = childFiles.map((fileStatus) =>
      this.createFileTreeItem(fileStatus, type, element.repositoryName!),
    )

    const allItems = [...fileItems, ...Array.from(childFolders.values())]

    allItems.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.label.localeCompare(b.label)
    })

    return Promise.resolve(allItems)
  }

  private buildHierarchicalTree(
    files: FileStatus[],
    type: 'staged' | 'uncommitted',
    repoName: string,
  ): HitTreeItem[] {
    if (!this.folderHierarchySwitch) {
      return files.map((fileStatus) =>
        this.createFileTreeItem(fileStatus, type, repoName),
      )
    }

    const tree: HitTreeItem[] = []
    const folderMap = new Map<string, HitTreeItem>()

    files.forEach((fileStatus) => {
      const filePath = fileStatus.relativePath
      const pathParts = filePath.split('/')
      const fileName = pathParts.pop() || ''

      let currentPath = ''
      let parentFolder: HitTreeItem | undefined

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]
        currentPath = currentPath ? `${currentPath}/${part}` : part

        if (!folderMap.has(currentPath)) {
          const folderItem = new HitTreeItem(
            part,
            vscode.TreeItemCollapsibleState.Collapsed,
            undefined,
            new vscode.ThemeIcon('folder'),
            type === 'staged' ? 'staged-folder' : 'uncommitted-folder',
            undefined,
            undefined,
            undefined,
            currentPath,
            true,
            repoName,
          )

          folderMap.set(currentPath, folderItem)

          if (parentFolder) {
            if (!parentFolder.children) {
              parentFolder.children = []
            }
            parentFolder.children.push(folderItem)
          } else {
            tree.push(folderItem)
          }
        }

        parentFolder = folderMap.get(currentPath)
      }

      const fileItem = this.createFileTreeItem(fileStatus, type, repoName)

      if (parentFolder) {
        if (!parentFolder.children) {
          parentFolder.children = []
        }
        parentFolder.children.push(fileItem)
      } else {
        tree.push(fileItem)
      }
    })

    this.sortTreeItems(tree)

    folderMap.forEach((folder) => {
      if (folder.children) {
        this.sortTreeItems(folder.children)
      }
    })

    return tree
  }

  private toRelativePath(absPath: string, repoPath: string): string {
    const rel = path.relative(repoPath, absPath)
    return rel.split(path.sep).join('/')
  }

  private sortTreeItems(items: HitTreeItem[]): void {
    items.sort((a, b) => {
      if (a.isFolder && !b.isFolder) {
        return -1
      }
      if (!a.isFolder && b.isFolder) {
        return 1
      }
      return a.label.localeCompare(b.label)
    })
  }

  private createFileTreeItem(
    fileStatus: FileStatus,
    type: 'staged' | 'uncommitted',
    repoName: string,
  ): HitTreeItem {
    const fileStatusProvider = new FileStatusProvider()
    const icon = fileStatusProvider.getFileIcon(fileStatus.path)
    const statusDescription = fileStatusProvider.getStatusDescription(
      fileStatus.status,
    )

    // Use specific context values for buttons like Git extension
    const contextValue = type === 'staged' ? 'staged-file' : 'uncommitted-file'

    const fileLabel = `${path.basename(fileStatus.path)} (${fileStatus.status})`

    const item = new HitTreeItem(
      fileLabel,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'hit.openFile',
        title: 'Open File',
        arguments: [fileStatus.path],
      },
      icon,
      contextValue,
      vscode.Uri.file(fileStatus.path),
      fileStatus.relativePath,
      `${fileStatus.path} (${statusDescription})`,
      fileStatus.path,
      false,
      repoName,
    )

    return item
  }

  // Git Operations
  stage(item: HitTreeItem): void {
    if (
      (item.contextValue === 'uncommitted-file' ||
        item.contextValue === 'uncommitted-folder') &&
      item.path &&
      item.repositoryName
    ) {
      if (item.isFolder) {
        this.stageFolder(item)
      } else {
        this.stageFileInRepository(item.path)
        this._onDidChangeTreeData.fire()
        vscode.window.showInformationMessage(`Staged: ${item.label}`)
      }
    } else if (item.contextValue === 'uncommitted-section') {
      this.stageAllInRepository()
      this._onDidChangeTreeData.fire()
      vscode.window.showInformationMessage('Staged all changes')
    }
  }

  unstage(item: HitTreeItem): void {
    if (
      (item.contextValue === 'staged-file' ||
        item.contextValue === 'staged-folder') &&
      item.path &&
      item.repositoryName
    ) {
      if (item.isFolder) {
        this.unstageFolder(item)
      } else {
        this.unstageFileInRepository(item.path)
        this._onDidChangeTreeData.fire()
        vscode.window.showInformationMessage(`Unstaged: ${item.label}`)
      }
    } else if (item.contextValue === 'staged-section') {
      this.unstageAllInRepository()
      this._onDidChangeTreeData.fire()
      vscode.window.showInformationMessage('Unstaged all changes')
    }
  }

  stageAll(): void {
    if (this.currentRepository) {
      this.stageAllInRepository()
      this._onDidChangeTreeData.fire()
    }
  }

  unstageAll(): void {
    if (this.currentRepository) {
      this.unstageAllInRepository()
      this._onDidChangeTreeData.fire()
    }
  }

  async commit(message: string): Promise<void> {
    if (this.currentRepository) {
      vscode.window.showInformationMessage(`Commit: ${message}`)
      this._onDidChangeTreeData.fire()
    }
  }

  discard(item: HitTreeItem): void {
    if (item.path && item.repositoryName) {
      if (item.isFolder) {
        this.revertFolder(item)
      } else {
        this.revertFile(item)
      }
    } else if (item.contextValue === 'uncommitted-section') {
      this.revertAllInRepository()
      this._onDidChangeTreeData.fire()
      vscode.window.showInformationMessage('Reverted all uncommitted changes')
    }
  }

  // File Operations
  openFile(fileName: string): void {
    const uri = vscode.Uri.file(fileName)
    vscode.workspace.openTextDocument(uri).then((doc) => {
      vscode.window.showTextDocument(doc)
    })
  }

  getCurrentBranch(): string {
    if (this.currentRepository) {
      return this.getRepositoryCurrentBranch()
    }
    return 'main'
  }

  checkout(branch: string): void {
    if (this.currentRepository) {
      this.checkoutRepositoryBranch(branch)
      this._onDidChangeTreeData.fire()
    }
  }

  async commitStaged(): Promise<void> {
    if (this.currentRepository) {
      const message = await vscode.window.showInputBox({
        prompt: 'Commit message',
        placeHolder: `Message (⌘⏎ to commit on "${this.getCurrentBranch()}")`,
      })
      if (message) {
        vscode.window.showInformationMessage(
          `Committed staged changes: ${message}`,
        )
        this._onDidChangeTreeData.fire()
      }
    }
  }

  async commitAll(): Promise<void> {
    if (this.currentRepository) {
      const message = await vscode.window.showInputBox({
        prompt: 'Commit all changes',
        placeHolder: `Message (⌘⏎ to commit on "${this.getCurrentBranch()}")`,
      })
      if (message) {
        // TODO: Implementcommit functionality
        vscode.window.showInformationMessage(
          `Committed all changes: ${message}`,
        )
        this._onDidChangeTreeData.fire()
      }
    }
  }

  stageFileInRepository(filePath: string): void {
    const repo = this.getRepository()
    if (repo) {
      const relativePath = this.toRelativePath(filePath, repo.path)
      const fileStatus = repo.uncommittedFileStatuses.get(relativePath)
      if (fileStatus) {
        cmdRunExec(`hit add "${relativePath}"`, repo.path)
          .then(() => {
            this.refresh()
          })
          .catch((error) => {
            Log.error('Error staging file:', error)
            vscode.window.showErrorMessage(
              `Failed to stage ${relativePath}: ${error.message}`,
            )
          })
      }
    }
  }

  unstageFileInRepository(filePath: string): void {
    const repo = this.getRepository()
    if (repo) {
      const relativePath = this.toRelativePath(filePath, repo.path)
      const fileStatus = repo.stagedFileStatuses.get(relativePath)
      if (fileStatus) {
        cmdRunExec(`hit reset "${relativePath}"`, repo.path)
          .then(() => {
            this.refresh()
          })
          .catch((error) => {
            Log.error('Error unstaging file:', error)
            vscode.window.showErrorMessage(
              `Failed to unstage ${relativePath}: ${error.message}`,
            )
          })
      }
    }
  }

  stageAllInRepository(): void {
    const repo = this.getRepository()
    if (repo) {
      cmdRunExec('hit add .', repo.path)
        .then(() => {
          this.refresh()
        })
        .catch((error) => {
          Log.error('Error staging all files:', error)
          vscode.window.showErrorMessage(
            `Failed to stage all files: ${error.message}`,
          )
        })
    }
  }

  unstageAllInRepository(): void {
    const repo = this.getRepository()
    if (repo) {
      cmdRunExec('hit reset .', repo.path)
        .then(() => {
          this.refresh()
        })
        .catch((error) => {
          Log.error('Error unstaging all files:', error)
          vscode.window.showErrorMessage(
            `Failed to unstage all files: ${error.message}`,
          )
        })
    }
  }

  getRepositoryCurrentBranch(): string {
    return this.mainRepository ? this.mainRepository.branch : 'main'
  }

  checkoutRepositoryBranch(branch: string): void {
    if (this.mainRepository) {
      this.mainRepository.branch = branch
    }
  }

  revertAllInRepository(): void {
    const repo = this.getRepository()
    if (repo) {
      cmdRunExec('hit revert .', repo.path)
        .then(() => {
          this.refresh()
          vscode.window.showInformationMessage('Reverted all changes')
        })
        .catch((error) => {
          Log.error('Error reverting all files:', error)
          vscode.window.showErrorMessage(
            `Failed to revert all files: ${error.message}`,
          )
        })
    }
  }

  // Sign In
  async signIn(): Promise<void> {
    await new Promise((resolve, reject) => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Signing in...',
          cancellable: false,
        },
        async (progress) => {
          progress.report({
            message: 'Opening browser...',
          })
          exec('hit login', (error, stdout, stderr) => {
            Log.log('Signed in error:', stderr)
            if (error) {
              Log.error('Error signing in:', error)
              reject(error)
            } else {
              vscode.window.showInformationMessage('Signed in successfully')
              Log.log('Signed in successfully:', stdout)
              resolve(void 0)
            }
          })
        },
      )
    })
  }

  async refresh(): Promise<void> {
    try {
      await this.initializeRepository()
      this._onDidChangeTreeData.fire()
    } catch (error) {
      Log.error('Error refreshing repository:', error)
      vscode.window.showErrorMessage('Failed to refresh repository data')
    }
  }

  toggleFolderHierarchy(): void {
    this.folderHierarchySwitch = !this.folderHierarchySwitch
    this._onDidChangeTreeData.fire()
  }

  getFolderHierarchyMode(): boolean {
    return this.folderHierarchySwitch
  }

  private stageFolder(item: HitTreeItem): void {
    const repo = this.getRepository()
    if (repo && item.path) {
      cmdRunExec(`hit add "${item.path}"`, repo.path)
        .then(() => {
          this.refresh()
          vscode.window.showInformationMessage(`Staged folder: ${item.label}`)
        })
        .catch((error) => {
          Log.error('Error staging folder:', error)
          vscode.window.showErrorMessage(
            `Failed to stage folder ${item.path}: ${error.message}`,
          )
        })
    }
  }

  private unstageFolder(item: HitTreeItem): void {
    const repo = this.getRepository()
    if (repo && item.path) {
      cmdRunExec(`hit reset "${item.path}"`, repo.path)
        .then(() => {
          this.refresh()
          vscode.window.showInformationMessage(`Unstaged folder: ${item.label}`)
        })
        .catch((error) => {
          Log.error('Error unstaging folder:', error)
          vscode.window.showErrorMessage(
            `Failed to unstage folder ${item.path}: ${error.message}`,
          )
        })
    }
  }

  private revertFile(item: HitTreeItem): void {
    const repo = this.getRepository()
    if (repo && item.path) {
      const relativePath = this.toRelativePath(item.path, repo.path)

      cmdRunExec(`hit revert "${relativePath}"`, repo.path)
        .then(() => {
          this.refresh()
          vscode.window.showInformationMessage(`Reverted: ${item.label}`)
        })
        .catch((error) => {
          Log.error('Error reverting file:', error)
          vscode.window.showErrorMessage(
            `Failed to revert ${relativePath}: ${error.message}`,
          )
        })
    }
  }

  private revertFolder(item: HitTreeItem): void {
    const repo = this.getRepository()
    if (repo && item.path) {
      cmdRunExec(`hit revert "${item.path}"`, repo.path)
        .then(() => {
          this.refresh()
          vscode.window.showInformationMessage(`Reverted folder: ${item.label}`)
        })
        .catch((error) => {
          Log.error('Error reverting folder:', error)
          vscode.window.showErrorMessage(
            `Failed to revert folder ${item.path}: ${error.message}`,
          )
        })
    }
  }

  // Additional Git operations (placeholder implementations)
  publish(): void {
    vscode.window.showInformationMessage('Published branch')
  }

  sync(): void {
    vscode.window.showInformationMessage('Synced changes')
  }

  pull(): void {
    vscode.window.showInformationMessage('Pulled changes')
  }

  push(): void {
    vscode.window.showInformationMessage('Pushed changes')
  }

  fetch(): void {
    vscode.window.showInformationMessage('Fetched changes')
  }

  // Commit UI methods
  showCommitMessageInput(repoName?: string): void {
    const targetRepo = repoName || this.currentRepository
    if (!targetRepo) {
      return
    }

    vscode.window
      .showInputBox({
        prompt: `Commit message for ${targetRepo}`,
        placeHolder: `Message (⌘⏎ to commit)`,
        value: '',
        valueSelection: [0, 0],
      })
      .then((message) => {
        if (message !== undefined) {
          this.setCommitMessage(message)
          this._onDidChangeTreeData.fire()
        }
      })
  }

  commitFromButton(repoName?: string): void {
    const targetRepo = repoName || this.currentRepository
    if (!targetRepo) {
      return
    }

    // TODO: Implement commit functionality
    vscode.window.showInformationMessage(
      'Commit functionality not yet implemented',
    )
  }
}
