import * as vscode from 'vscode'
import Log from './log'
import { cmdRun, cmdRunExec } from './cmdRun'
import { buildHitUri, hitContentProvider } from './diffProvider'

export class GraphPanel {
  private static current: GraphPanel | undefined
  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []
  private readonly workspaceDir: string
  private readonly context: vscode.ExtensionContext
  private headsMap: Record<string, string> = {}

  static show(context: vscode.ExtensionContext, title: string, data: any) {
    if (GraphPanel.current) {
      GraphPanel.current.update(data)
      GraphPanel.current.panel.reveal()
      return
    }
    const panel = vscode.window.createWebviewPanel(
      'hitGraph',
      title,
      vscode.ViewColumn.Active,
      { enableScripts: true },
    )
    GraphPanel.current = new GraphPanel(panel, context, data)
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    data: any,
  ) {
    this.panel = panel
    this.context = context
    this.workspaceDir =
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders.length > 0
        ? vscode.workspace.workspaceFolders[0].uri.fsPath
        : ''
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'getCommitFiles':
            await this.handleGetCommitFiles(message.commitHash)
            break
          case 'openFileDiff':
            await this.handleOpenFileDiff(message.filePath, message.commitHash)
            break
          case 'graphContextAction':
            await this.handleGraphContextAction(
              message.action,
              message.commitHash,
            )
            break
        }
      },
      null,
      this.disposables,
    )

    this.update(data)
  }

  private dispose() {
    while (this.disposables.length) {
      const d = this.disposables.pop()
      try {
        d?.dispose()
      } catch {}
    }
    GraphPanel.current = undefined
  }

  private update(data: any) {
    this.panel.webview.html = this.renderHtml(data)
  }

  private async handleGetCommitFiles(commitHash: string) {
    try {
      const result = (await cmdRun({
        command: `commit-files ${commitHash}`,
        workspaceDir: this.workspaceDir,
      })) as any

      if (result.success && result.data) {
        const files = result.data.files || []
        this.panel.webview.postMessage({
          command: 'renderFiles',
          commitHash: commitHash,
          files: files,
        })
      } else {
        this.panel.webview.postMessage({
          command: 'renderFiles',
          commitHash: commitHash,
          files: [],
          error: result.message || 'Failed to load files',
        })
      }
    } catch (error) {
      Log.error('Error fetching commit files:', error)
      this.panel.webview.postMessage({
        command: 'renderFiles',
        commitHash: commitHash,
        files: [],
        error: 'Failed to load files',
      })
    }
  }

  private async handleOpenFileDiff(filePath: string, commitHash: string) {
    try {
      const result = (await cmdRun({
        command: `diff-content commit ${filePath} ${commitHash}`,
        workspaceDir: this.workspaceDir,
      })) as any

      if (result.success && result.data) {
        const data = result.data as any
        const leftLabel = 'Parent'
        const rightLabel = commitHash.slice(0, 7)

        const leftUri = buildHitUri(leftLabel, filePath)
        hitContentProvider.setContent(leftUri, data.left || '')

        const rightUri = buildHitUri(rightLabel, filePath)
        hitContentProvider.setContent(rightUri, data.right || '')

        const title = `${filePath} — ${leftLabel} ↔ ${rightLabel}`
        vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title)
      } else {
        vscode.window.showErrorMessage(`Failed to load diff for ${filePath}`)
      }
    } catch (error) {
      Log.error('Error opening file diff:', error)
      vscode.window.showErrorMessage(`Failed to open diff for ${filePath}`)
    }
  }

  private async handleGraphContextAction(action: string, commitHash: string) {
    try {
      if (action === 'createBranch') {
        const name = await vscode.window.showInputBox({
          title: 'Create Branch from Commit',
          placeHolder: 'feature/my-branch',
          ignoreFocusOut: true,
        })
        if (!name) return
        await cmdRunExec(
          `hit checkout -b ${name} ${commitHash}`,
          this.workspaceDir,
        )
        vscode.window.showInformationMessage(
          `Created and switched to '${name}' at ${commitHash.slice(0, 7)}`,
        )
      } else if (action === 'mergeIntoCurrent') {
        const branchName = this.headsMap[commitHash]
        Log.info('branchName', branchName)
        if (branchName)
          await cmdRunExec(`hit merge origin ${branchName}`, this.workspaceDir)
        else await cmdRunExec(`hit merge -c ${commitHash}`, this.workspaceDir)
        vscode.window.showInformationMessage(
          `Merged ${commitHash.slice(0, 7)} into current branch`,
        )
      }
    } catch (err: any) {
      const msg = typeof err?.message === 'string' ? err.message : String(err)
      vscode.window.showErrorMessage(msg)
    }
  }

  private renderHtml(data: any): string {
    const allNodes = Array.isArray(data?.nodes) ? data.nodes : []
    const headsMap: Record<string, string> =
      data && data.heads ? (data.heads as Record<string, string>) : {}
    const currentBranch: string = (data && (data as any).currentBranch) || ''
    this.headsMap = headsMap

    Log.info('allNodes', allNodes)
    Log.info('headsMap', headsMap)

    const allNodesMap = new Map<string, any>()
    allNodes.forEach((node: any) => {
      allNodesMap.set(node.hash, node)
    })

    const sortedNodes = allNodes.slice().sort((a: any, b: any) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateB - dateA
    })

    const hashToY = new Map<string, number>()
    sortedNodes.forEach((node: any, i: number) => {
      hashToY.set(node.hash, i)
    })

    const hashToLane = new Map<string, number>()
    const laneToBranch: Record<number, string> = {}
    let nextLane = 0

    Object.entries(headsMap).forEach(([hash, branchName]) => {
      if (!hashToLane.has(hash)) {
        hashToLane.set(hash, nextLane)
        laneToBranch[nextLane] = branchName
        nextLane++
      }
    })

    if (nextLane === 0) {
      nextLane = 1
    }

    const visited = new Set<string>()
    const queue: Array<{ hash: string; lane: number }> = []

    Object.entries(headsMap).forEach(([hash, branchName]) => {
      const lane = hashToLane.get(hash) ?? 0
      queue.push({ hash, lane })
      visited.add(hash)
    })

    while (queue.length > 0) {
      const { hash, lane } = queue.shift()!
      hashToLane.set(hash, lane)

      const node = allNodesMap.get(hash)
      if (!node) continue

      const parents = Array.isArray(node.parents) ? node.parents : []

      if (parents.length === 0) {
        continue
      }

      if (parents.length > 0 && !visited.has(parents[0])) {
        visited.add(parents[0])
        hashToLane.set(parents[0], lane)
        queue.push({ hash: parents[0], lane })
      }

      for (let i = 1; i < parents.length; i++) {
        const parentHash = parents[i]
        if (!visited.has(parentHash)) {
          visited.add(parentHash)
          if (!hashToLane.has(parentHash)) {
            const newLane = nextLane++
            hashToLane.set(parentHash, newLane)
            queue.push({ hash: parentHash, lane: newLane })
          } else {
            queue.push({ hash: parentHash, lane: hashToLane.get(parentHash)! })
          }
        }
      }
    }

    sortedNodes.forEach((node: any) => {
      if (!hashToLane.has(node.hash)) {
        const parents = Array.isArray(node.parents) ? node.parents : []
        if (parents.length > 0 && hashToLane.has(parents[0])) {
          hashToLane.set(node.hash, hashToLane.get(parents[0])!)
        } else {
          hashToLane.set(node.hash, 0)
        }
      }
    })

    const layout = sortedNodes.map((node: any, i: number) => {
      const lane = hashToLane.get(node.hash) ?? 0
      let primaryBranch = 'main'
      if (Array.isArray(node.refs) && node.refs.length > 0) {
        const mainRef = node.refs.find(
          (r: string) => r === 'main' || r === 'master',
        )
        primaryBranch = mainRef || node.refs[0]
      }
      return { ...node, y: i, lane, branch: primaryBranch }
    })

    const laneColor = (lane: number) =>
      [
        '#6ea8fe',
        '#94d3a2',
        '#f6c177',
        '#d3a6ff',
        '#f28b82',
        '#7bdff2',
        '#b2f7ef',
      ][lane % 7]
    const rowH = 28,
      colW = 18,
      leftPad = 60,
      topPad = 20

    const circles = layout
      .map((n: any) => {
        const cx = leftPad + n.lane * colW
        const cy = topPad + n.y * rowH
        const title = (n.message || '').split('\n')[0]
        const stroke = 'var(--vscode-editor-foreground)'
        let headBranch = headsMap[n.hash]
        if (headBranch) {
          if (currentBranch && headBranch === currentBranch) {
            headBranch = `* ${headBranch}`
          }
        }
        const pills = headBranch
          ? `<foreignObject x="${cx - 40}" y="${cy - 18}" width="80" height="16">
             <div xmlns="http://www.w3.org/1999/xhtml" class="pill-row">
               <span class="ref-pill head">${headBranch}</span>
             </div>
           </foreignObject>`
          : ''
        const fillColor = laneColor(n.lane)
        const isHead = !!headBranch
        return `<g class="node" data-hash="${n.hash}" onclick="toggleDetails('${n.hash}')" style="cursor: pointer;">
                ${isHead ? `<circle cx="${cx}" cy="${cy}" r="7" stroke="${stroke}" stroke-width="1" fill="none" opacity="0.3"/>` : ''}
                <circle cx="${cx}" cy="${cy}" r="5" stroke="${stroke}" stroke-width="1.5" fill="${fillColor}" class="commit-node"><title>${n.hash}\n${title}</title></circle>
                ${pills}
              </g>`
      })
      .join('')

    const nodeMap = new Map(layout.map((n: any) => [n.hash, n]))

    const mainParentLines = layout
      .map((n: any) => {
        if (!Array.isArray(n.parents) || n.parents.length === 0) return ''

        const fromX = leftPad + n.lane * colW
        const fromY = topPad + n.y * rowH

        const mainParentHash = n.parents[0]
        const mainParent = nodeMap.get(mainParentHash) as any

        if (!mainParent) return ''

        const toX = leftPad + mainParent.lane * colW
        const toY = topPad + mainParent.y * rowH
        const c = laneColor(n.lane)

        if (mainParent.lane === n.lane) {
          return `<line x1="${fromX}" y1="${fromY}" x2="${toX}" y2="${toY}" stroke="${c}" stroke-width="2" fill="none" opacity="0.6"/>`
        } else {
          const dx = toX - fromX
          const dy = Math.abs(toY - fromY)
          const controlOffsetX = Math.abs(dx) * 0.5
          const controlOffsetY = dy * 0.2
          const path = `M ${fromX} ${fromY} C ${fromX + controlOffsetX} ${fromY + controlOffsetY}, ${toX - controlOffsetX} ${toY - controlOffsetY}, ${toX} ${toY}`
          return `<path d="${path}" stroke="${c}" stroke-width="2" fill="none" opacity="0.5" stroke-dasharray="3,3"/>`
        }
      })
      .join('')

    const mergeLines = layout
      .map((n: any) => {
        if (!Array.isArray(n.parents) || n.parents.length === 0) return ''
        const fromX = leftPad + n.lane * colW
        const fromY = topPad + n.y * rowH
        const otherParentHash = n.otherParent || ''

        if (!otherParentHash) return ''

        const parent = nodeMap.get(otherParentHash) as any
        if (!parent) return ''

        const toX = leftPad + parent.lane * colW
        const toY = topPad + parent.y * rowH
        const c = laneColor(n.lane)

        const dx = toX - fromX
        const dy = Math.abs(toY - fromY)

        const controlOffsetX = Math.abs(dx) * 0.6
        const controlOffsetY = dy * 0.3

        const path = `M ${fromX} ${fromY} C ${fromX + controlOffsetX} ${fromY + controlOffsetY}, ${toX - controlOffsetX} ${toY - controlOffsetY}, ${toX} ${toY}`
        return `<path d="${path}" stroke="${c}" stroke-width="2.5" fill="none" opacity="0.8"/>`
      })
      .join('')

    const edges = mainParentLines + mergeLines

    const height = topPad + layout.length * rowH + 40
    const lanesWidth = Math.max(1, nextLane) * colW
    const width = leftPad + Math.max(8, nextLane + 2) * colW
    const rowsLeft = leftPad + lanesWidth + 16
    const headerH = 36

    const list = layout
      .map((n: any) => {
        const y = topPad + n.y * rowH - 14
        const msg = (n.message || '').split('\n')[0]
        return `
        <div class="row" data-hash="${n.hash}" onclick="toggleDetails('${n.hash}')" style="top:${y}px;">
          <span class="message">${msg || '(no message)'}</span>
          <span class="date">${new Date(n.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''}</span>
          <span class="author">${n.author || ''}</span>
          <span class="hash">${n.hash.slice(0, 7)}</span>
        </div>
        <div class="details" id="det-${n.hash}" data-hash="${n.hash}" style="display: none; top:${y + rowH}px; left:${rowsLeft}px;">
          <div class="details-info">
            <div class="det-row"><span class="det-label">Commit</span><code>${n.hash}</code></div>
            ${n.author ? `<div class="det-row"><span class="det-label">Author</span><span>${n.author}</span></div>` : ''}
            ${n.date ? `<div class="det-row"><span class="det-label">Date</span><span>${n.date}</span></div>` : ''}
            ${Array.isArray(n.parents) && n.parents.length > 0 ? `<div class="det-row"><span  class="det-label">Parents</span>${n.parents.map((p: string) => `<button class="link parent parent-btn" onclick="toggleDetails('${p}'); scrollToParent('${p}')">${p.slice(0, 7)}</button>`).join(' ')}</div>` : ''}
            ${Array.isArray(n.refs) && n.refs.length > 0 ? `<div class="det-row"><span class="det-label">Refs</span>${n.refs.map((r: string) => `<span class="ref">${r}</span>`).join(' ')}</div>` : ''}
          </div>
          <div class="details-files">
            <div class="det-row"><span class="det-label">Files</span><span id="files-loading-${n.hash}" class="loading">Loading files...</span><div id="files-list-${n.hash}" class="files-list" style="display: none;"></div></div>
          </div>
        </div>`
      })
      .join('')

    const webview = this.panel.webview
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media')
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaRoot, 'graph.css'),
    )
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaRoot, 'graph.js'),
    )
    const csp = `default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource};`

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${cssUri}">
  
  </head>
  <body>
    <div class="container">
      <div class="header">
        <span class="h-col" style="flex: 1;">Description</span>
        <span class="h-col" style="width: 180px;">Date</span>
        <span class="h-col" style="width: 100px;">Author</span>
        <span class="h-col" style="width: 100px;">Commit</span>
      </div>
      <svg width="${width}" height="${height}">
        ${edges}
        ${circles}
      </svg>
      <div class="rows" style="left:${rowsLeft}px; top:${headerH}px;">
        ${list}
      </div>
    </div>
    <script src="${jsUri}"></script>
  </body>
  </html>`
  }
}
