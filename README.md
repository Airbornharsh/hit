# Hit - A Fast, Minimal Version Control System

Hit is a lightweight, Git-inspired version control system written in Go. It comes with:

- A cross-platform CLI for local repositories
- A web UI for browsing repositories and commits: https://hit.harshkeshri.com
- A VS Code extension for source control integration

## Installation

Choose one of the following methods:

### macOS (Homebrew)

```bash
brew tap airbornharsh/hit
brew install hit
```

### Linux/macOS (Install Script)

```bash
curl -fsSL https://raw.githubusercontent.com/Airbornharsh/hit/main/scripts/install.sh | bash
```

### Manual

1. Download a binary for your platform from Releases: https://github.com/Airbornharsh/hit/releases
2. Make it executable and add to PATH:

```bash
chmod +x ./hit && sudo mv ./hit /usr/local/bin/hit
```

Verify installation:

```bash
hit version
```

## Quick Start

Initialize a repository:

```bash
hit init
```

Stage files and commit:

```bash
hit add .
hit commit -m "Initial commit"
```

Add a remote and push:

```bash
hit remote add origin "hit@hithub.com:<username>/<repo>.hit"
hit push -u origin <branch>
```

Clone an existing repository:

```bash
hit clone "hit@hithub.com:<username>/<repo>.hit"
```

View repo in the web UI:

- Open https://hit.harshkeshri.com and navigate to your repository

## CLI Commands

Common commands (subset):

- Initialize

```bash
hit init
```

- Status

```bash
hit status
```

- Stage / Unstage

```bash
hit add <path>
hit add .
hit reset <path>
```

- Commit

```bash
hit commit -m "Your message"
```

- Remote

```bash
hit remote add origin "hit@hithub.com:<username>/<repo>.hit"
hit remote -v
```

- Push / Pull / Fetch

```bash
hit push [-u] origin <branch>
hit pull origin <branch>
hit fetch origin
```

- Branches

```bash
hit branch                # list branches
hit branch <name>         # create branch
hit checkout <name>       # switch branch
```

- History / Diff

```bash
hit log                   # view commits
hit show <commit-hash>    # show a commit
hit diff <path>           # show local changes for a file
```

## Remotes

Hit uses a simple SSH-like remote format:

```
hit@hithub.com:<username>/<repo>.hit
```

Examples:

```bash
hit clone "hit@hithub.com:alice/project.hit"
hit remote add origin "hit@hithub.com:bob/notes.hit"
```

## VS Code Extension

A VS Code extension is available under `packages/extension`. It provides:

- Multi-repository support
- Staging/unstaging and diff viewing
- Commit/push operations per repository
- Branch switching and commit graph

Install from the Marketplace:[ https://marketplace.visualstudio.com/items?itemName=AirbornHarsh.hit](https://marketplace.visualstudio.com/items?itemName=AirbornHarsh.hit)

You can also install the packaged VSIX or use the Marketplace (when available).

## Website / API

- Web UI: https://hit.harshkeshri.com
- Server API lives in `packages/server` and exposes endpoints for repositories, branches, commits, and signed uploads.

## Contributing

1. Fork and clone the repo
2. Build CLI locally:

```bash
go build -o hit ./main.go
./hit version
```

3. Commit changes and open a PR
