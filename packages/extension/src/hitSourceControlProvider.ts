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
  private repositories: Map<string, Repository> = new Map()
  private workspaceRoot: string
  private commitMessages: Map<string, string> = new Map()
  private currentRepository: string | null = null
  private folderHierarchySwitch: boolean = false
  private pushStatuses: Map<string, { canPush: boolean; aheadCount: number }> =
    new Map()

  constructor() {
    this.workspaceRoot =
      vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''

    this.setupFileChangeListener()
    vscode.commands.executeCommand(
      'setContext',
      'hit:folderHierarchy',
      this.folderHierarchySwitch,
    )
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
      return this.getRepositoriesList()
    }

    if (element.contextValue === 'repository') {
      return this.getRepositoryChildren(element.repositoryName!)
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

    this.repositories.clear()

    for (const file of files) {
      try {
        const repoPath = file.fsPath.split('/.hit/HEAD')[0]
        const pathParts = repoPath.split(/[/\\]/)
        const repoName = pathParts[pathParts.length - 1] || 'Unknown'

        const repoKey = repoPath

        if (!fs.existsSync(path.join(repoPath, '.hit', 'HEAD'))) {
          continue
        }

        const headFile = fs.readFileSync(
          path.join(repoPath, '.hit', 'HEAD'),
          'utf8',
        )
        const branch = headFile.split('ref: refs/heads/')[1]?.trim() || 'main'

        const repo = await this.createRepository(
          repoName,
          repoPath,
          branch,
          false,
        )
        this.repositories.set(repoKey, repo)
        await this.updateCanPushContextForRepo(repoKey)
      } catch (error) {
        Log.error(`Error initializing repository at ${file.fsPath}:`, error)
      }
    }

    if (this.repositories.size > 0 && !this.currentRepository) {
      this.currentRepository = Array.from(this.repositories.keys())[0]
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
      hasUncommittedChanges: uncommittedFileStatuses.size > 0,
      hasStagedChanges: stagedFileStatuses.size > 0,
      isMain,
      stagedFileStatuses,
      uncommittedFileStatuses,
    }
  }

  getRepository(repoKey?: string): Repository | null {
    if (repoKey) {
      return this.repositories.get(repoKey) || null
    }
    if (this.repositories.size === 0) {
      return null
    }
    if (this.currentRepository) {
      return this.repositories.get(this.currentRepository) || null
    }
    return Array.from(this.repositories.values())[0] || null
  }

  getAllRepositories(): Repository[] {
    return Array.from(this.repositories.values())
  }

  getRepositoryByKey(repoKey: string): Repository | null {
    return this.repositories.get(repoKey) || null
  }

  getCurrentRepository(): string | null {
    return this.currentRepository
  }

  getCommitMessage(repoKey?: string): string {
    const key = repoKey || this.currentRepository || ''
    return this.commitMessages.get(key) || ''
  }

  setCommitMessage(message: string, repoKey?: string): void {
    const key = repoKey || this.currentRepository || ''
    if (key) {
      this.commitMessages.set(key, message)
    }
  }

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

  private getRepositoriesList(): Thenable<HitTreeItem[]> {
    const repos = this.getAllRepositories()
    if (repos.length === 0) {
      return Promise.resolve([])
    }

    const sortedRepos = [...repos].sort((a, b) => a.name.localeCompare(b.name))

    const repoItems: HitTreeItem[] = []
    for (const repo of sortedRepos) {
      const repoKey = this.getRepositoryKey(repo.path)
      const pushStatus = this.pushStatuses.get(repoKey) || {
        canPush: false,
        aheadCount: 0,
      }

      let statusIcon: vscode.ThemeIcon
      let statusDescription = ''

      if (repo.hasStagedChanges) {
        statusIcon = new vscode.ThemeIcon('check')
        statusDescription = 'Staged changes'
      } else if (repo.hasUncommittedChanges) {
        statusIcon = new vscode.ThemeIcon('diff')
        statusDescription = 'Uncommitted changes'
      } else if (pushStatus.canPush) {
        statusIcon = new vscode.ThemeIcon('cloud-upload')
        statusDescription = `Push (${pushStatus.aheadCount})`
      } else {
        statusIcon = new vscode.ThemeIcon('git-branch')
        statusDescription = 'Up to date'
      }

      const description = `${repo.branch} • ${statusDescription}`

      repoItems.push(
        new HitTreeItem(
          repo.name,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          new vscode.ThemeIcon('repo'),
          'repository',
          undefined,
          description,
          `${repo.name} (${repo.branch}) - ${statusDescription}`,
          repo.path,
          true,
          repoKey,
        ),
      )
    }

    return Promise.resolve(repoItems)
  }

  private getRepositoryKey(repoPath: string): string {
    for (const [key, repo] of this.repositories.entries()) {
      if (repo.path === repoPath) {
        return key
      }
    }
    return repoPath
  }

  private getRepositoryChildren(repoKey: string): Thenable<HitTreeItem[]> {
    const repo = this.getRepositoryByKey(repoKey)
    if (!repo) {
      return Promise.resolve([])
    }

    this.currentRepository = repoKey
    const rootItems: HitTreeItem[] = []

    rootItems.push(
      new HitTreeItem(
        'Commit Message',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'hit.showCommitMessageInput',
          title: 'Commit Message',
          arguments: [repoKey],
        },
        new vscode.ThemeIcon('edit'),
        'input-area',
        undefined,
        this.getCommitMessage(repoKey) ||
          'Click to open commit message input dialog',
        'Enter your text here',
        undefined,
        undefined,
        repoKey,
      ),
    )

    const pushStatus = this.pushStatuses.get(repoKey) || {
      canPush: false,
      aheadCount: 0,
    }

    if (
      pushStatus.canPush &&
      !(
        repo.stagedFileStatuses.size > 0 ||
        repo.uncommittedFileStatuses.size > 0
      )
    ) {
      rootItems.push(
        new HitTreeItem(
          `Push (${pushStatus.aheadCount})`,
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'hit.push',
            title: 'Push',
            arguments: [repoKey],
          },
          new vscode.ThemeIcon('cloud-upload'),
          'push-button',
          undefined,
          `Push ${repo.branch}`,
          undefined,
          undefined,
          undefined,
          repoKey,
        ),
      )
    } else {
      rootItems.push(
        new HitTreeItem(
          'Commit',
          vscode.TreeItemCollapsibleState.None,
          {
            command: 'hit.commit',
            title: 'Commit Changes',
            arguments: [repoKey],
          },
          new vscode.ThemeIcon('check'),
          'commit-button',
          undefined,
          `Commit ${repo.branch}`,
          undefined,
          undefined,
          undefined,
          repoKey,
        ),
      )
    }

    rootItems.push(
      new HitTreeItem(
        'Staged Changes',
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        new vscode.ThemeIcon('check'),
        'staged-section',
        undefined,
        `${repo.stagedFileStatuses.size}`,
        undefined,
        undefined,
        undefined,
        repoKey,
      ),
    )

    rootItems.push(
      new HitTreeItem(
        'Changes',
        vscode.TreeItemCollapsibleState.Expanded,
        undefined,
        new vscode.ThemeIcon('diff'),
        'uncommitted-section',
        undefined,
        `${repo.uncommittedFileStatuses.size}`,
        undefined,
        undefined,
        undefined,
        repoKey,
      ),
    )

    return Promise.resolve(rootItems)
  }

  private getRepositorySectionChildren(
    repoKey: string,
    type: 'staged' | 'uncommitted',
  ): Thenable<HitTreeItem[]> {
    const repo = this.getRepositoryByKey(repoKey)
    if (!repo) {
      return Promise.resolve([])
    }

    const fileMap =
      type === 'staged' ? repo.stagedFileStatuses : repo.uncommittedFileStatuses

    const files = Array.from(fileMap.values())

    return Promise.resolve(this.buildHierarchicalTree(files, type, repoKey))
  }

  private getFolderChildren(element: HitTreeItem): Thenable<HitTreeItem[]> {
    if (!element.repositoryName || !this.folderHierarchySwitch) {
      return Promise.resolve([])
    }

    const repo = this.getRepositoryByKey(element.repositoryName)
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
    repoKey: string,
  ): HitTreeItem[] {
    if (!this.folderHierarchySwitch) {
      return files.map((fileStatus) =>
        this.createFileTreeItem(fileStatus, type, repoKey),
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
            repoKey,
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

      const fileItem = this.createFileTreeItem(fileStatus, type, repoKey)

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

  toRelativePath(absPath: string, repoPath: string): string {
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
    repoKey: string,
  ): HitTreeItem {
    const fileStatusProvider = new FileStatusProvider()
    const icon = fileStatusProvider.getFileIcon(fileStatus.path)
    const statusDescription = fileStatusProvider.getStatusDescription(
      fileStatus.status,
    )

    const contextValue = type === 'staged' ? 'staged-file' : 'uncommitted-file'

    const fileLabel = `${path.basename(fileStatus.path)} (${fileStatus.status})`

    const item = new HitTreeItem(
      fileLabel,
      vscode.TreeItemCollapsibleState.None,
      {
        command: 'hit.openDiff',
        title: 'Open Diff',
        arguments: [
          new HitTreeItem(
            fileLabel,
            vscode.TreeItemCollapsibleState.None,
            undefined,
            icon,
            contextValue,
            vscode.Uri.file(fileStatus.path),
            fileStatus.relativePath,
            `${fileStatus.path} (${statusDescription})`,
            fileStatus.path,
            false,
            repoKey,
          ),
        ],
      },
      icon,
      contextValue,
      vscode.Uri.file(fileStatus.path),
      fileStatus.relativePath,
      `${fileStatus.path} (${statusDescription})`,
      fileStatus.path,
      false,
      repoKey,
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
        this.stageFileInRepository(item.path, item.repositoryName)
        this._onDidChangeTreeData.fire()
        vscode.window.showInformationMessage(`Staged: ${item.label}`)
      }
    } else if (item.contextValue === 'uncommitted-section') {
      const repoKey = item.repositoryName || this.currentRepository
      if (repoKey) {
        this.stageAllInRepository(repoKey)
        this._onDidChangeTreeData.fire()
        vscode.window.showInformationMessage('Staged all changes')
      }
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
        this.unstageFileInRepository(item.path, item.repositoryName)
        this._onDidChangeTreeData.fire()
        vscode.window.showInformationMessage(`Unstaged: ${item.label}`)
      }
    } else if (item.contextValue === 'staged-section') {
      const repoKey = item.repositoryName || this.currentRepository
      if (repoKey) {
        this.unstageAllInRepository(repoKey)
        this._onDidChangeTreeData.fire()
        vscode.window.showInformationMessage('Unstaged all changes')
      }
    }
  }

  stageAll(): void {
    if (this.currentRepository) {
      this.stageAllInRepository(this.currentRepository)
      this._onDidChangeTreeData.fire()
    }
  }

  unstageAll(): void {
    if (this.currentRepository) {
      this.unstageAllInRepository(this.currentRepository)
      this._onDidChangeTreeData.fire()
    }
  }

  async commit(message?: string, repoKey?: string): Promise<void> {
    const targetRepoKey = repoKey || this.currentRepository
    const repo = targetRepoKey
      ? this.getRepositoryByKey(targetRepoKey)
      : this.getRepository()
    if (!repo) {
      vscode.window.showWarningMessage('No repository detected')
      return
    }

    let finalMessage =
      message || this.getCommitMessage(targetRepoKey || undefined)
    if (!finalMessage) {
      finalMessage =
        (await vscode.window.showInputBox({
          prompt: 'Commit message',
          placeHolder: `Message (⌘⏎ to commit on "${repo.branch}")`,
          value: '',
          valueSelection: [0, 0],
        })) || ''
      if (!finalMessage) return
      this.setCommitMessage(finalMessage, targetRepoKey || undefined)
    }

    const safeMsg = finalMessage.replace(/"/g, '\\"')

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Staging changes...`,
      },
      async () => {
        await cmdRunExec(`hit add .`, repo.path)
      },
    )

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Committing to ${repo.branch}...`,
      },
      async () => {
        try {
          await cmdRunExec(`hit commit -m "${safeMsg}"`, repo.path)
          this.setCommitMessage('', targetRepoKey || undefined)
          await this.refresh()
          vscode.window.showInformationMessage('Commit completed')
        } catch (err: any) {
          const msg = err?.message || String(err) || 'Unknown error'
          vscode.window.showErrorMessage(`Commit failed: ${msg}`)
        }
      },
    )
  }

  discard(item: HitTreeItem): void {
    if (item.path && item.repositoryName) {
      if (item.isFolder) {
        this.revertFolder(item)
      } else {
        this.revertFile(item)
      }
    } else if (item.contextValue === 'uncommitted-section') {
      const repoKey = item.repositoryName || this.currentRepository
      if (repoKey) {
        this.revertAllInRepository(repoKey)
        this._onDidChangeTreeData.fire()
        vscode.window.showInformationMessage('Reverted all uncommitted changes')
      }
    }
  }

  // File Operations
  openFile(fileName: string): void {
    const uri = vscode.Uri.file(fileName)
    vscode.workspace.openTextDocument(uri).then((doc) => {
      vscode.window.showTextDocument(doc)
    })
  }

  getCurrentBranch(repoKey?: string): string {
    const targetRepoKey = repoKey || this.currentRepository
    return this.getRepositoryCurrentBranch(targetRepoKey || undefined)
  }

  checkout(branch: string, repoKey?: string): void {
    const targetRepoKey = repoKey || this.currentRepository
    if (targetRepoKey) {
      this.checkoutRepositoryBranch(branch, targetRepoKey)
      this._onDidChangeTreeData.fire()
    }
  }

  stageFileInRepository(filePath: string, repoKey?: string): void {
    const repo = repoKey
      ? this.getRepositoryByKey(repoKey)
      : this.getRepository()
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

  unstageFileInRepository(filePath: string, repoKey?: string): void {
    const repo = repoKey
      ? this.getRepositoryByKey(repoKey)
      : this.getRepository()
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

  stageAllInRepository(repoKey?: string): void {
    const repo = repoKey
      ? this.getRepositoryByKey(repoKey)
      : this.getRepository()
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

  unstageAllInRepository(repoKey?: string): void {
    const repo = repoKey
      ? this.getRepositoryByKey(repoKey)
      : this.getRepository()
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

  getRepositoryCurrentBranch(repoKey?: string): string {
    const repo = repoKey
      ? this.getRepositoryByKey(repoKey)
      : this.getRepository()
    return repo ? repo.branch : 'main'
  }

  checkoutRepositoryBranch(branch: string, repoKey?: string): void {
    const repo = repoKey
      ? this.getRepositoryByKey(repoKey)
      : this.getRepository()
    if (repo) {
      repo.branch = branch
    }
  }

  revertAllInRepository(repoKey?: string): void {
    const repo = repoKey
      ? this.getRepositoryByKey(repoKey)
      : this.getRepository()
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
      for (const repoKey of this.repositories.keys()) {
        await this.updateCanPushContextForRepo(repoKey)
      }
      await this.updateCanPushContext()
      this._onDidChangeTreeData.fire()
    } catch (error) {
      Log.error('Error refreshing repository:', error)
      vscode.window.showErrorMessage('Failed to refresh repository data')
    }
  }

  toggleFolderHierarchy(): void {
    this.folderHierarchySwitch = !this.folderHierarchySwitch
    vscode.commands.executeCommand(
      'setContext',
      'hit:folderHierarchy',
      this.folderHierarchySwitch,
    )
    this._onDidChangeTreeData.fire()
  }

  getFolderHierarchyMode(): boolean {
    return this.folderHierarchySwitch
  }

  private async updateCanPushContextForRepo(repoKey: string): Promise<void> {
    try {
      const repo = this.getRepositoryByKey(repoKey)
      if (!repo) {
        this.pushStatuses.set(repoKey, { canPush: false, aheadCount: 0 })
        return
      }
      const res = await cmdRun<CommandInput, CommandOutput>({
        command: 'push-status',
        workspaceDir: repo.path,
      })
      if (res.success && res.data) {
        const data = res.data as any
        this.pushStatuses.set(repoKey, {
          canPush: !!data.needPush,
          aheadCount: data.aheadCount || 0,
        })
      } else {
        this.pushStatuses.set(repoKey, { canPush: false, aheadCount: 0 })
      }
    } catch (e) {
      this.pushStatuses.set(repoKey, { canPush: false, aheadCount: 0 })
    }
  }

  private async updateCanPushContext(): Promise<void> {
    try {
      const repo = this.getRepository()
      if (!repo) {
        await vscode.commands.executeCommand('setContext', 'hit:canPush', false)
        await vscode.commands.executeCommand(
          'setContext',
          'hit:pushAheadCount',
          0,
        )
        return
      }
      const repoKey = this.getRepositoryKey(repo.path)
      const pushStatus = this.pushStatuses.get(repoKey) || {
        canPush: false,
        aheadCount: 0,
      }
      await vscode.commands.executeCommand(
        'setContext',
        'hit:canPush',
        pushStatus.canPush,
      )
      await vscode.commands.executeCommand(
        'setContext',
        'hit:pushAheadCount',
        pushStatus.aheadCount,
      )
    } catch (e) {
      await vscode.commands.executeCommand('setContext', 'hit:canPush', false)
      await vscode.commands.executeCommand(
        'setContext',
        'hit:pushAheadCount',
        0,
      )
    }
  }

  private stageFolder(item: HitTreeItem): void {
    const repo = item.repositoryName
      ? this.getRepositoryByKey(item.repositoryName)
      : this.getRepository()
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
    const repo = item.repositoryName
      ? this.getRepositoryByKey(item.repositoryName)
      : this.getRepository()
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
    const repo = item.repositoryName
      ? this.getRepositoryByKey(item.repositoryName)
      : this.getRepository()
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
    const repo = item.repositoryName
      ? this.getRepositoryByKey(item.repositoryName)
      : this.getRepository()
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

  // Branch switching: list branches via cmdRun and checkout via cmdRunExec
  async openSwitchBranchQuickPick(repoKey?: string): Promise<void> {
    const targetRepoKey = repoKey || this.currentRepository
    const repo = targetRepoKey
      ? this.getRepositoryByKey(targetRepoKey)
      : this.getRepository()
    if (!repo) {
      vscode.window.showWarningMessage('No repository detected')
      return
    }

    try {
      const res = await cmdRun<CommandInput, CommandOutput>({
        command: 'branches',
        workspaceDir: repo.path,
      })
      if (!res.success) {
        vscode.window.showErrorMessage(res.message || 'Failed to list branches')
        return
      }
      const data = (res.data || {}) as { branches?: string[]; current?: string }
      const branches = data.branches || []
      const current = data.current || repo.branch

      if (branches.length === 0) {
        vscode.window.showInformationMessage('No branches found')
        return
      }

      const items: Array<
        vscode.QuickPickItem & { __type?: 'branch' | 'create' }
      > = [
        ...branches.map((b) => ({
          label: b,
          description: b === current ? 'current' : undefined,
          __type: 'branch' as const,
        })),
        {
          label: '$(add) Create new branch…',
          alwaysShow: true,
          __type: 'create' as const,
        },
      ]

      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `Current: ${current}. Choose a branch to checkout`,
        matchOnDescription: true,
      })
      if (!picked) return

      if ((picked as any).__type === 'create') {
        const newName = await vscode.window.showInputBox({
          prompt: 'Create new branch',
          placeHolder: 'new-branch-name',
          validateInput: (val) => {
            const t = val.trim()
            if (!t) return 'Branch name cannot be empty'
            if (branches.includes(t)) return 'Branch already exists'
            return undefined
          },
        })
        if (!newName) return

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Creating and switching to ${newName}...`,
          },
          async () => {
            try {
              await cmdRunExec(`hit checkout -b \"${newName}\"`, repo.path)
              await this.refresh()
              vscode.window.showInformationMessage(
                `Created and switched to branch ${newName}`,
              )
            } catch (err: any) {
              const msg = err?.message || String(err) || 'Unknown error'
              vscode.window.showErrorMessage(
                `Unable to create branch ${newName}: ${msg}`,
              )
            }
          },
        )
        return
      }

      if (picked.label === current) return

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Checking out ${picked.label}...`,
        },
        async () => {
          try {
            await cmdRunExec(`hit checkout \"${picked.label}\"`, repo.path)
            await this.refresh()
            vscode.window.showInformationMessage(
              `Switched to branch ${picked.label}`,
            )
          } catch (err: any) {
            const msg = err?.message || String(err) || 'Unknown error'
            vscode.window.showErrorMessage(
              `Unable to switch branch to ${picked.label}: ${msg}`,
            )
          }
        },
      )
    } catch (error: any) {
      Log.error('Switch branch failed:', error)
      vscode.window.showErrorMessage(
        `Failed to switch branch: ${error?.message || String(error)}`,
      )
    }
  }

  // Additional Git operations (placeholder implementations)
  publish(): void {
    vscode.window.showInformationMessage('Published branch')
  }

  sync(): void {
    vscode.window.showInformationMessage('Synced changes')
  }

  async pull(repoKey?: string): Promise<void> {
    const targetRepoKey = repoKey || this.currentRepository
    const repo = targetRepoKey
      ? this.getRepositoryByKey(targetRepoKey)
      : this.getRepository()
    if (!repo) {
      vscode.window.showWarningMessage('No repository detected')
      return
    }
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Pulling ${repo.branch}...`,
      },
      async () => {
        try {
          await cmdRunExec('hit pull', repo.path)
          await this.refresh()
          vscode.window.showInformationMessage('Pull completed')
        } catch (err: any) {
          const msg = err?.message || String(err) || 'Unknown error'
          vscode.window.showErrorMessage(`Pull failed: ${msg}`)
        }
      },
    )
  }

  async push(repoKey?: string): Promise<void> {
    const targetRepoKey = repoKey || this.currentRepository
    const repo = targetRepoKey
      ? this.getRepositoryByKey(targetRepoKey)
      : this.getRepository()
    if (!repo) {
      vscode.window.showWarningMessage('No repository detected')
      return
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Pushing ${repo.branch}...`,
      },
      async () => {
        try {
          await cmdRunExec('hit push', repo.path)
          await this.refresh()
          vscode.window.showInformationMessage('Push completed')
        } catch (err: any) {
          const msg = err?.message || String(err) || 'Unknown error'
          vscode.window.showErrorMessage(`Push failed: ${msg}`)
        }
      },
    )
  }

  getPushAheadCount(repoKey?: string): string {
    const targetRepoKey = repoKey || this.currentRepository
    const pushStatus = targetRepoKey
      ? this.pushStatuses.get(targetRepoKey) || {
          canPush: false,
          aheadCount: 0,
        }
      : { canPush: false, aheadCount: 0 }
    return pushStatus.aheadCount > 0 ? ` (${pushStatus.aheadCount})` : ''
  }

  async fetch(repoKey?: string): Promise<void> {
    const targetRepoKey = repoKey || this.currentRepository
    const repo = targetRepoKey
      ? this.getRepositoryByKey(targetRepoKey)
      : this.getRepository()
    if (!repo) {
      vscode.window.showWarningMessage('No repository detected')
      return
    }
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Fetching...`,
      },
      async () => {
        try {
          await cmdRunExec('hit fetch', repo.path)
          await this.refresh()
          vscode.window.showInformationMessage('Fetch completed')
        } catch (err: any) {
          const msg = err?.message || String(err) || 'Unknown error'
          vscode.window.showErrorMessage(`Fetch failed: ${msg}`)
        }
      },
    )
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
