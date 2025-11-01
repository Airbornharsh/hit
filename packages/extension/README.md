# Hit - Source Control Extension

Hit is a VS Code extension that provides a Git-like source control interface for the Hit version control system.

## Features

- **Multi-repository support**: Work with multiple Hit repositories in a single workspace
- **Source control tree view**: Visual representation of staged and unstaged changes
- **Commit management**: Easy commit message input and commit operations
- **Branch management**: Switch branches and create new branches from the extension
- **Push/Pull/Fetch**: Synchronize your repositories with remote
- **Diff viewer**: View changes in files with built-in diff comparison
- **Commit graph**: Visualize commit history with an interactive graph
- **File staging**: Stage, unstage, and discard changes at file or folder level
- **Tree/List view toggle**: Switch between hierarchical tree view and flat list view

## Requirements

- VS Code version 1.105.0 or higher
- Hit CLI tool installed and available in your PATH

## Extension Settings

This extension contributes the following commands:

- `hit.signIn`: Sign in to your Hit account
- `hit.commit`: Commit staged changes
- `hit.push`: Push commits to remote
- `hit.pull`: Pull changes from remote
- `hit.fetch`: Fetch changes from remote
- `hit.switchBranch`: Switch to a different branch
- `hit.showGraph`: Display commit history graph
- `hit.stage`: Stage file or folder changes
- `hit.unstage`: Unstage file or folder changes
- `hit.discard`: Discard uncommitted changes

## Usage

1. Open a workspace containing Hit repositories (directories with `.hit` folder)
2. The extension will automatically detect all Hit repositories
3. Use the Source Control sidebar to view and manage your repositories
4. Right-click on repository items to access commit, push, pull, and other operations
5. Right-click on files to stage, unstage, or view diffs

## Repository

For more information, visit the [GitHub repository](https://github.com/Airbornharsh/hit).
