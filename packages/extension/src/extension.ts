import * as vscode from 'vscode'
import {
  HitSourceControlProvider,
  HitTreeItem,
} from './hitSourceControlProvider'
import Log from './util/log'

export async function activate(context: vscode.ExtensionContext) {
  Log.log('Congratulations, your extension "hit" is now active!')

  const hitSourceControlProvider = new HitSourceControlProvider()

  // Initialize repository
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

    vscode.commands.registerCommand('hit.refresh', async () => {
      await hitSourceControlProvider.refresh()
    }),
  ]

  context.subscriptions.push(...disposables)
}

export function deactivate() {}
