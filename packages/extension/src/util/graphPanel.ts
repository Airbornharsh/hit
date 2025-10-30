import * as vscode from 'vscode'
import Log from './log'
import { cmdRun } from './cmdRun'
import { buildHitUri, hitContentProvider } from './diffProvider'

export class GraphPanel {
  private static current: GraphPanel | undefined
  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []
  private readonly workspaceDir: string

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

  private renderHtml(data: any): string {
    const allNodes = Array.isArray(data?.nodes) ? data.nodes : []
    const headsMap: Record<string, string> =
      data && data.heads ? (data.heads as Record<string, string>) : {}
    const currentBranch: string = (data && (data as any).currentBranch) || ''

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
        return `<g class="node" onclick="toggleDetails('${n.hash}')" style="cursor: pointer;">
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

    const list = layout
      .map((n: any) => {
        const y = topPad + n.y * rowH - 14
        const msg = (n.message || '').split('\n')[0]
        return `
        <div class="row" onclick="toggleDetails('${n.hash}')" style="top:${y}px;">
          <span class="message">${msg || '(no message)'}</span>
          <span class="date">${n.date || ''}</span>
          <span class="author">${n.author || ''}</span>
          <span class="hash">${n.hash.slice(0, 7)}</span>
        </div>
        <div class="details" id="det-${n.hash}" style="display: none; top:${y + rowH}px;">
          <div class="det-row"><span class="det-label">Commit</span><code>${n.hash}</code></div>
          ${n.author ? `<div class="det-row"><span class="det-label">Author</span><span>${n.author}</span></div>` : ''}
          ${n.date ? `<div class="det-row"><span class="det-label">Date</span><span>${n.date}</span></div>` : ''}
          ${Array.isArray(n.parents) && n.parents.length > 0 ? `<div class="det-row"><span class="det-label">Parents</span>${n.parents.map((p: string) => `<a href="#" class="link parent" onclick="event.stopPropagation(); scrollToParent('${p}')">${p.slice(0, 7)}</a>`).join(' ')}</div>` : ''}
          ${Array.isArray(n.refs) && n.refs.length > 0 ? `<div class="det-row"><span class="det-label">Refs</span>${n.refs.map((r: string) => `<span class="ref">${r}</span>`).join(' ')}</div>` : ''}
          <div class="det-row"><span class="det-label">Files</span><span id="files-loading-${n.hash}" class="loading">Loading files...</span><div id="files-list-${n.hash}" class="files-list" style="display: none;"></div></div>
          <div class="det-row"><button onclick="event.stopPropagation(); closeDetails('${n.hash}')">Close</button></div>
        </div>`
      })
      .join('')

    const height = topPad + layout.length * rowH + 40
    const lanesWidth = Math.max(1, nextLane) * colW
    const width = leftPad + Math.max(8, nextLane + 2) * colW

    const rowsLeft = leftPad + lanesWidth + 16
    const headerH = 32

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    :root {
      --desc-col: 1fr;
      --date-col: 180px;
      --author-col: 160px;
      --hash-col: 100px;
      --row-h: ${rowH}px;
    }
    body { color: var(--vscode-foreground); background: var(--vscode-editor-background); font: 12.5px/1.5 var(--vscode-editor-font-family); }
    .container { position: relative; }
    .header { position: sticky; top: 0; z-index: 2; display: flex; gap: 12px; padding: 6px 8px; border-bottom: 1px solid var(--vscode-toolbar-hoverOutline); background: var(--vscode-editor-background); }
    .h-col { font-weight: 600; opacity: 0.9; }
    .rows { position:absolute; left:${rowsLeft}px; top:${headerH}px; right:12px; padding-right:6px; }
    .row { position:absolute; display:flex; gap: 12px; cursor:pointer; align-items: center; height: var(--row-h); }
    .row:hover { background: color-mix(in srgb, var(--vscode-editor-foreground) 8%, transparent); }
    .row .message { display:flex; align-items:center; gap:8px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row .date, .row .author, .row .hash { flex: 0 0 100px; width: 100px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hash { color: var(--vscode-textLink-foreground); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .ref { display:inline-block; padding:1px 6px; margin-left:6px; border-radius:10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size: 11px; }
    .meta { opacity: 0.7; }
    svg { display:block; }
    g.node { cursor: pointer; }
    g.node:hover .commit-node { filter: brightness(1.3); stroke-width: 2; }
    .pill-row { display:flex; gap:6px; align-items:center; justify-content:center; }
    .ref-pill { display:inline-block; padding:1px 6px; border-radius:10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); font-size:10px; line-height:14px; white-space:nowrap; }
    .ref-pill.head { outline: 1px solid var(--vscode-textLink-foreground); }
    .details { position: absolute; left: ${rowsLeft}px; right: 12px; background: var(--vscode-editorWidget-background); border:1px solid var(--vscode-editorWidget-border); border-radius:6px; padding:8px 10px; max-width: 900px; z-index: 10; }
    .det-row { margin: 4px 0; }
    .det-label { display:inline-block; width:80px; opacity:0.8; }
    .loading { opacity: 0.7; font-style: italic; }
    .files-list { margin-top: 8px; }
    .file-item { display: flex; align-items: center; padding: 2px 0; cursor: pointer; border-radius: 3px; }
    .file-item:hover { background: color-mix(in srgb, var(--vscode-editor-foreground) 5%, transparent); }
    .file-status { display: inline-block; width: 12px; height: 12px; border-radius: 2px; margin-right: 8px; font-size: 10px; text-align: center; line-height: 12px; font-weight: bold; }
    .file-status.added { background: var(--vscode-gitDecoration-addedResourceForeground); color: var(--vscode-gitDecoration-addedResourceForeground); }
    .file-status.modified { background: var(--vscode-gitDecoration-modifiedResourceForeground); color: var(--vscode-gitDecoration-modifiedResourceForeground); }
    .file-status.deleted { background: var(--vscode-gitDecoration-deletedResourceForeground); color: var(--vscode-gitDecoration-deletedResourceForeground); }
    .file-path { flex: 1; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    /* Tree */
    .tree { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .tree ul { list-style: none; padding-left: 16px; margin: 0; }
    .tree .node { display: flex; align-items: center; gap: 6px; padding: 2px 0; }
    .tree .node.folder { cursor: pointer; }
    .tree .caret { width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 6px solid var(--vscode-editor-foreground); transition: transform 0.1s ease; }
    .tree .expanded > .node .caret { transform: rotate(90deg); }
    .tree .children { margin-left: 12px; }
    .tree .file { cursor: pointer; border-radius: 3px; }
    .tree .file:hover { background: color-mix(in srgb, var(--vscode-editor-foreground) 5%, transparent); }
    .link { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .link:hover { text-decoration: underline; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius:4px; padding:3px 8px; cursor:pointer; }
    button:hover { filter: brightness(1.1); }
    .branch-label { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 500; }
  </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <span class="h-col" style="flex: 1;">Description</span>
        <span class="h-col" style="width: 100px;">Date</span>
        <span class="h-col" style="width: 100px;">Author</span>
        <span class="h-col" style="width: 100px;">Commit</span>
      </div>
      <svg width="${width}" height="${height}">
        ${edges}
        ${circles}
      </svg>
      <div class="rows">
        ${list}
      </div>
    </div>
    <script>
      const vscode = acquireVsCodeApi();
      console.log('Graph panel script loaded')
      
      function toggleDetailsByHash(hash) {
        console.log('toggleDetailsByHash called with hash:', hash)
        if (!hash) {
          console.log('No hash provided')
          return
        }
        
        // Close all other details first
        const allDetails = document.querySelectorAll('.details')
        allDetails.forEach(detail => {
          if (detail.id !== 'det-' + hash) {
            detail.style.display = 'none'
            detail.hidden = true
          }
        })
        
        // Find the details element for this commit
        const det = document.getElementById('det-'+hash)
        console.log('Found details element:', det)
        
        if (det) {
          // Check current display state
          const isCurrentlyHidden = det.style.display === 'none' || det.hidden
          console.log('Current state - isHidden:', isCurrentlyHidden)
          
          if (isCurrentlyHidden) {
            // Show the details
            det.style.display = 'block'
            det.hidden = false
            console.log('Showing details for:', hash)
            
            // Load files if not already loaded
            if (!det.dataset.filesLoaded) {
              console.log('Loading commit files for:', hash)
              loadCommitFiles(hash)
            }
          } else {
            // Hide the details
            det.style.display = 'none'
            det.hidden = true
            console.log('Hiding details for:', hash)
          }
        } else {
          console.log('Details element not found for hash:', hash)
        }
      }
      
      async function loadCommitFiles(hash) {
        const loadingEl = document.getElementById('files-loading-'+hash)
        const filesEl = document.getElementById('files-list-'+hash)
        const detEl = document.getElementById('det-'+hash)
        
        if (!loadingEl || !filesEl || !detEl) return
        
        try {
          // Call the extension command to get commit files
          const result = await vscode.postMessage({
            command: 'getCommitFiles',
            commitHash: hash
          })
          
          // This will be handled by the extension
        } catch (error) {
          loadingEl.textContent = 'Error loading files'
          console.error('Error loading commit files:', error)
        }
      }
      
      function renderFilesList(hash, files) {
        const loadingEl = document.getElementById('files-loading-'+hash)
        const filesEl = document.getElementById('files-list-'+hash)
        const detEl = document.getElementById('det-'+hash)
        
        if (!loadingEl || !filesEl || !detEl) return
        
        loadingEl.style.display = 'none'
        filesEl.style.display = 'block'
        detEl.dataset.filesLoaded = 'true'
        
        if (!files || files.length === 0) {
          filesEl.innerHTML = '<div style="opacity: 0.7; font-style: italic;">No files changed</div>'
          return
        }
        
        // Build a tree from the file paths
        const root = { name: '', folders: new Map(), files: [] }
        for (const f of files) {
          const parts = String(f.path || '').split('/').filter(Boolean)
          let node = root
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i]
            const isLast = i === parts.length - 1
            if (isLast) {
              node.files.push({ name: part, fullPath: f.path, status: f.status })
            } else {
              if (!node.folders.has(part)) node.folders.set(part, { name: part, folders: new Map(), files: [] })
              node = node.folders.get(part)
            }
          }
        }
        
        const sym = (s) => s === 'added' ? '+' : s === 'deleted' ? '-' : '~'
        
        function renderFolder(folder) {
          let html = ''
          if (folder.name) {
            html += '<div class="node folder"><span class="caret"></span><span>' + folder.name + '</span></div>'
          }
          html += '<ul class="children">'
          // Folders first
          folder.folders.forEach((child) => {
            html += '<li class="expanded">' + renderFolder(child) + '</li>'
          })
          // Files
          folder.files.forEach((file) => {
            const st = file.status || 'modified'
            html += '<li class="file" data-file-path="' + file.fullPath + '" data-commit-hash="' + hash + '">' +
                    '<div class="node file">' +
                    '<span class="file-status ' + st + '">' + sym(st) + '</span>' +
                    '<span class="file-path">' + file.name + '</span>' +
                    '</div></li>'
          })
          html += '</ul>'
          return html
        }

        filesEl.innerHTML = '<div class="tree">' + renderFolder(root) + '</div>'

// File click
filesEl.querySelectorAll('li.file').forEach(li => {
  li.addEventListener('click', (e) => {
    const el = e.currentTarget
    const filePath = el.getAttribute('data-file-path')
    const commitHash = el.getAttribute('data-commit-hash')
    openFileDiff(filePath, commitHash)
  })
})
      }

function openFileDiff(filePath, commitHash) {
  // Send message to extension to open diff
  vscode.postMessage({
    command: 'openFileDiff',
    filePath: filePath,
    commitHash: commitHash
  })
}

// Listen for messages from the extension
window.addEventListener('message', event => {
  const message = event.data
  switch (message.command) {
    case 'renderFiles':
      renderFilesList(message.commitHash, message.files)
      break
  }
})
// Simple global functions for onclick handlers
window.toggleDetails = function (hash) {
  toggleDetailsByHash(hash)
}

window.closeDetails = function (hash) {
  const det = document.getElementById('det-' + hash)
  if (det) {
    det.style.display = 'none'
    det.hidden = true
  }
}

// Handle parent links with simple onclick
window.scrollToParent = function (hash) {
  const targetRow = document.querySelector('.row[onclick*="' + hash + '"]')
  if (targetRow) {
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}
  </script>
  </body>
  </html>`
  }
}
