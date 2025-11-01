import * as vscode from 'vscode'
import {
  HitSourceControlProvider,
  HitTreeItem,
} from './hitSourceControlProvider'
import {
  registerHitContentProvider,
  buildHitUri,
  hitContentProvider,
} from './util/diffProvider'
import { cmdRun, CommandInput, CommandOutput } from './util/cmdRun'
import Log from './util/log'
import { GraphPanel } from './util/graphPanel'

export async function activate(context: vscode.ExtensionContext) {
  Log.log('Congratulations, your extension "hit" is now active!')

  const hitSourceControlProvider = new HitSourceControlProvider()

  registerHitContentProvider(context)

  await hitSourceControlProvider.initializeRepository()

  vscode.window.registerTreeDataProvider(
    'hitSourceControl',
    hitSourceControlProvider,
  )

  const disposables = [
    vscode.commands.registerCommand('hit.signIn', () => {
      hitSourceControlProvider.signIn()
    }),

    vscode.commands.registerCommand(
      'hit.showCommitMessageInput',
      async (repoKey?: string) => {
        const targetRepoKey =
          repoKey ||
          hitSourceControlProvider.getCurrentRepository() ||
          undefined
        const input = await vscode.window.showInputBox({
          prompt: 'Enter your text',
          placeHolder: 'Type something here...',
          value: hitSourceControlProvider.getCommitMessage(targetRepoKey) || '',
          valueSelection: [0, 0],
        })
        if (input !== undefined) {
          hitSourceControlProvider.setCommitMessage(input, targetRepoKey)
        }
        await hitSourceControlProvider.refresh()
      },
    ),

    vscode.commands.registerCommand('hit.toggleFolderHierarchy', () => {
      hitSourceControlProvider.toggleFolderHierarchy()
    }),

    vscode.commands.registerCommand('hit.toggleFolderHierarchy.tree', () => {
      hitSourceControlProvider.toggleFolderHierarchy()
    }),
    vscode.commands.registerCommand('hit.toggleFolderHierarchy.list', () => {
      hitSourceControlProvider.toggleFolderHierarchy()
    }),

    vscode.commands.registerCommand('hit.stage', (item: HitTreeItem) => {
      hitSourceControlProvider.stage(item)
    }),

    vscode.commands.registerCommand('hit.unstage', (item: HitTreeItem) => {
      hitSourceControlProvider.unstage(item)
    }),

    vscode.commands.registerCommand('hit.discard', (item: HitTreeItem) => {
      hitSourceControlProvider.discard(item)
    }),

    vscode.commands.registerCommand(
      'hit.openDiff',
      async (item: HitTreeItem) => {
        if (!item || !item.repositoryName || !item.path) return
        const repo = hitSourceControlProvider.getRepositoryByKey(
          item.repositoryName,
        )
        if (!repo) return
        const relPath = hitSourceControlProvider.toRelativePath(
          item.path,
          repo.path,
        )
        const mode = item.contextValue === 'staged-file' ? 'staged' : 'unstaged'
        const res = await cmdRun<CommandInput, CommandOutput>({
          command: `diff-content ${mode} ${relPath}`,
          workspaceDir: repo.path,
        })
        if (!res.success || !res.data) return
        const data = res.data as any
        const leftLabel =
          data.leftLabel || (mode === 'staged' ? 'HEAD' : 'INDEX')
        const rightLabel =
          data.rightLabel || (mode === 'staged' ? 'INDEX' : 'WORKSPACE')

        const leftUri = buildHitUri(leftLabel, relPath)
        hitContentProvider.setContent(leftUri, data.left || '')

        let rightUri: vscode.Uri
        if (mode === 'unstaged') {
          rightUri = vscode.Uri.file(require('path').join(repo.path, relPath))
        } else {
          rightUri = buildHitUri(rightLabel, relPath)
          hitContentProvider.setContent(rightUri, data.right || '')
        }

        const title = `${relPath} — ${leftLabel} ↔ ${rightLabel}`
        vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title)
      },
    ),

    vscode.commands.registerCommand('hit.refresh', async () => {
      await hitSourceControlProvider.refresh()
    }),

    vscode.commands.registerCommand(
      'hit.commit',
      async (item?: HitTreeItem | string) => {
        const repoKey =
          typeof item === 'string'
            ? item
            : item?.repositoryName ||
              hitSourceControlProvider.getCurrentRepository() ||
              undefined
        await hitSourceControlProvider.commit(undefined, repoKey)
      },
    ),

    vscode.commands.registerCommand(
      'hit.push',
      async (item?: HitTreeItem | string) => {
        const repoKey =
          typeof item === 'string'
            ? item
            : item?.repositoryName ||
              hitSourceControlProvider.getCurrentRepository() ||
              undefined
        await hitSourceControlProvider.push(repoKey)
      },
    ),

    vscode.commands.registerCommand('hit.pull', async (repoKey?: string) => {
      await hitSourceControlProvider.pull(repoKey)
    }),

    vscode.commands.registerCommand('hit.fetch', async (repoKey?: string) => {
      await hitSourceControlProvider.fetch(repoKey)
    }),

    vscode.commands.registerCommand(
      'hit.switchBranch',
      async (item?: HitTreeItem | string) => {
        const repoKey =
          typeof item === 'string'
            ? item
            : item?.repositoryName ||
              hitSourceControlProvider.getCurrentRepository() ||
              undefined
        await (hitSourceControlProvider as any).openSwitchBranchQuickPick(
          repoKey,
        )
      },
    ),

    vscode.commands.registerCommand(
      'hit.openSCMenu',
      async (item?: HitTreeItem | string) => {
        const repoKey =
          typeof item === 'string'
            ? item
            : item?.repositoryName ||
              hitSourceControlProvider.getCurrentRepository() ||
              undefined
        const pushAheadCount =
          hitSourceControlProvider.getPushAheadCount(repoKey)
        const pick = await vscode.window.showQuickPick(
          [
            { label: 'Pull', description: 'hit pull', action: 'pull' },
            {
              label: 'Push' + pushAheadCount,
              description: 'hit push',
              action: 'push',
            },
            { label: 'Fetch', description: 'hit fetch', action: 'fetch' },
            {
              label: 'Checkout to…',
              description: 'switch branch',
              action: 'switch',
            },
          ],
          { placeHolder: 'Hit actions' },
        )
        if (!pick) return
        if (pick.action === 'pull')
          return vscode.commands.executeCommand('hit.pull', repoKey)
        if (pick.action === 'push')
          return vscode.commands.executeCommand('hit.push', repoKey)
        if (pick.action === 'fetch')
          return vscode.commands.executeCommand('hit.fetch', repoKey)
        if (pick.action === 'switch')
          return vscode.commands.executeCommand('hit.switchBranch', repoKey)
      },
    ),

    vscode.commands.registerCommand(
      'hit.showGraph',
      async (item?: HitTreeItem | string) => {
        const repoKey =
          typeof item === 'string'
            ? item
            : item?.repositoryName ||
              hitSourceControlProvider.getCurrentRepository() ||
              undefined
        const repo = repoKey
          ? hitSourceControlProvider.getRepositoryByKey(repoKey)
          : hitSourceControlProvider.getRepository()
        if (!repo) {
          vscode.window.showWarningMessage('No repository detected')
          return
        }
        const res = await cmdRun<CommandInput, CommandOutput>({
          command: 'graph-log',
          workspaceDir: repo.path,
        })
        if (!res.success) {
          vscode.window.showErrorMessage(res.message || 'Failed to load graph')
          return
        }
        GraphPanel.show(context, `Hit Graph — ${repo.name}`, res.data)
      },
    ),
  ]

  context.subscriptions.push(...disposables)
}

export function deactivate() {}
