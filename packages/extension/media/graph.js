const vscode = acquireVsCodeApi()
console.log('[Hit] Graph panel script loaded')

function toggleDetailsByHash(hash) {
  if (!hash) return
  const allDetails = document.querySelectorAll('.details')
  allDetails.forEach((detail) => {
    if (detail.id !== 'det-' + hash) {
      detail.style.display = 'none'
      detail.hidden = true
    }
  })
  const det = document.getElementById('det-' + hash)
  if (det) {
    const isCurrentlyHidden = det.style.display === 'none' || det.hidden
    if (isCurrentlyHidden) {
      det.style.display = 'grid'
      det.hidden = false
      if (!det.dataset.filesLoaded) {
        loadCommitFiles(hash)
      }
    } else {
      det.style.display = 'none'
      det.hidden = true
    }
  }
}

async function loadCommitFiles(hash) {
  const loadingEl = document.getElementById('files-loading-' + hash)
  const filesEl = document.getElementById('files-list-' + hash)
  const detEl = document.getElementById('det-' + hash)
  if (!loadingEl || !filesEl || !detEl) return
  try {
    await vscode.postMessage({ command: 'getCommitFiles', commitHash: hash })
  } catch (error) {
    loadingEl.textContent = 'Error loading files'
  }
}

function renderFilesList(hash, files) {
  const loadingEl = document.getElementById('files-loading-' + hash)
  const filesEl = document.getElementById('files-list-' + hash)
  const detEl = document.getElementById('det-' + hash)
  if (!loadingEl || !filesEl || !detEl) return
  loadingEl.style.display = 'none'
  filesEl.style.display = 'block'
  detEl.dataset.filesLoaded = 'true'
  if (!files || files.length === 0) {
    filesEl.innerHTML =
      '<div style="opacity: 0.7; font-style: italic;">No files changed</div>'
    return
  }
  const root = { name: '', folders: new Map(), files: [] }
  for (const f of files) {
    const parts = String(f.path || '')
      .split('/')
      .filter(Boolean)
    let node = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      if (isLast) {
        node.files.push({ name: part, fullPath: f.path, status: f.status })
      } else {
        if (!node.folders.has(part))
          node.folders.set(part, { name: part, folders: new Map(), files: [] })
        node = node.folders.get(part)
      }
    }
  }
  const sym = (s) => (s === 'added' ? '+' : s === 'deleted' ? '-' : '~')
  function renderFolder(folder) {
    let html = ''
    if (folder.name) {
      html +=
        '<div class="node folder"><span class="caret"></span><span>' +
        folder.name +
        '</span></div>'
    }
    html += '<ul class="children">'
    folder.folders.forEach((child) => {
      html += '<li class="expanded">' + renderFolder(child) + '</li>'
    })
    folder.files.forEach((file) => {
      const st = file.status || 'modified'
      html +=
        '<li class="file" data-file-path="' +
        file.fullPath +
        '" data-commit-hash="' +
        hash +
        '">' +
        '<div class="node file">' +
        '<span class="file-status ' +
        st +
        '">' +
        sym(st) +
        '</span>' +
        '<span class="file-path">' +
        file.name +
        '</span>' +
        '</div></li>'
    })
    html += '</ul>'
    return html
  }
  filesEl.innerHTML = '<div class="tree">' + renderFolder(root) + '</div>'
  filesEl.querySelectorAll('li.file').forEach((li) => {
    li.addEventListener('click', (e) => {
      const el = e.currentTarget
      const filePath = el.getAttribute('data-file-path')
      const commitHash = el.getAttribute('data-commit-hash')
      openFileDiff(filePath, commitHash)
    })
  })
}

function openFileDiff(filePath, commitHash) {
  vscode.postMessage({ command: 'openFileDiff', filePath, commitHash })
}

window.addEventListener('message', (event) => {
  const message = event.data
  switch (message.command) {
    case 'renderFiles':
      renderFilesList(message.commitHash, message.files)
      break
  }
})

window.toggleDetails = function (hash) {
  toggleDetailsByHash(hash)
}
// window.closeDetails = function (hash) {
//   const det = document.getElementById('det-' + hash)
//   if (det) {
//     det.style.display = 'none'
//     det.hidden = true
//   }
// }
window.scrollToParent = function (hash) {
  const targetRow = document.querySelector('.row[onclick*="' + hash + '"]')
  if (targetRow) {
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

let ctxMenu
function ensureContextMenu(hash) {
  if (ctxMenu) return ctxMenu
  ctxMenu = document.createElement('div')
  ctxMenu.className = 'context-menu'
  ctxMenu.innerHTML = `
    <div style="font-size: 12px; font-weight: bold; padding-left: 4px;">${hash.slice(0, 7)}</div>
    <div class="item" data-action="createBranch">Create Branch…</div>
    <div class="item" data-action="mergeIntoCurrent">Merge into Current Branch</div>
  `
  document.body.appendChild(ctxMenu)
  ctxMenu.addEventListener('click', (e) => {
    const actionEl = e.target.closest('.item')
    if (!actionEl) return
    const action = actionEl.getAttribute('data-action')
    const hash = ctxMenu.getAttribute('data-hash')
    hideContextMenu()
    if (hash && action) {
      vscode.postMessage({
        command: 'graphContextAction',
        action,
        commitHash: hash,
      })
    }
  })
  return ctxMenu
}

function showContextMenu(hash, x, y) {
  const menu = ensureContextMenu(hash)
  menu.style.left = `${x}px`
  menu.style.top = `${y}px`
  menu.style.display = 'block'
  menu.setAttribute('data-hash', hash)
}

function hideContextMenu() {
  if (ctxMenu) ctxMenu.style.display = 'none'
}

document.addEventListener('contextmenu', (e) => {
  const target = e.target
  const el = target.closest('[data-hash]')
  if (el) {
    e.preventDefault()
    const hash = el.getAttribute('data-hash')
    showContextMenu(hash, e.clientX, e.clientY)
  } else {
    hideContextMenu()
  }
})

document.addEventListener('click', () => hideContextMenu())
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideContextMenu()
})
