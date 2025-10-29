import * as vscode from 'vscode'

const SCHEME = 'hit'

class HitContentProvider implements vscode.TextDocumentContentProvider {
  private cache = new Map<string, string>()
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>()
  readonly onDidChange = this._onDidChange.event

  setContent(uri: vscode.Uri, content: string): void {
    this.cache.set(uri.toString(), content ?? '')
    this._onDidChange.fire(uri)
  }

  provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
    const key = uri.toString()
    return this.cache.get(key) ?? ''
  }
}

export const hitContentProvider = new HitContentProvider()
export const hitScheme = SCHEME

export function registerHitContentProvider(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(
      SCHEME,
      hitContentProvider,
    ),
  )
}

export function buildHitUri(label: string, relPath: string): vscode.Uri {
  const safe = relPath.replace(/\\/g, '/').replace(/\s/g, '%20')
  return vscode.Uri.parse(`${SCHEME}:/${label}/${safe}`)
}
