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

    vscode.commands.registerCommand('hit.showCommitMessageInput', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'Enter your text',
        placeHolder: 'Type something here...',
        value: hitSourceControlProvider.getCommitMessage() || '',
        valueSelection: [0, 0],
      })
      if (input !== undefined) {
        hitSourceControlProvider.setCommitMessage(input)
      }
      await hitSourceControlProvider.refresh()
    }),

    vscode.commands.registerCommand('hit.actionButton', () => {
      vscode.window.showInformationMessage('Action button clicked! 🚀')
    }),

    vscode.commands.registerCommand('hit.toggleFolderHierarchy', () => {
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
        if (!item || !item.repositoryName) return
        const repo = hitSourceControlProvider.getRepository()
        if (!repo || !item.path) return
        const relPath = (hitSourceControlProvider as any)['toRelativePath'](
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
  ]

  context.subscriptions.push(...disposables)
}

export function deactivate() {}
