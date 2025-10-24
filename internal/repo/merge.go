package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/storage"
)

func MergeBranch(currentBranch string, targetBranch string, remoteName string) error {
	currentCommit, err := getLocalBranchCommit(currentBranch)
	if err != nil {
		return fmt.Errorf("failed to get current branch commit: %v", err)
	}

	targetCommit, err := getRemoteBranchCommit(remoteName, targetBranch)
	if err != nil {
		return fmt.Errorf("failed to get target branch commit: %v", err)
	}

	if isAlreadyMerged(remoteName, targetBranch, currentCommit, targetCommit) {
		remoteCommits, err := storage.GetRemoteCommits(remoteName, targetBranch)
		if err != nil {
			return fmt.Errorf("failed to get remote commits: %v", err)
		}
		err = storage.UpdateHeadCommits(currentBranch, remoteCommits)
		if err != nil {
			return fmt.Errorf("failed to update head commits: %v", err)
		}

		err = storage.UpdateHeadRef(currentBranch, targetCommit)
		if err != nil {
			return fmt.Errorf("failed to update head ref: %v", err)
		}

		err = storage.UpdateWorkingDirectoryAndIndexFromCommit(targetCommit)
		if err != nil {
			return fmt.Errorf("failed to update working directory and index: %v", err)
		}

		return nil
	}

	commonAncestor, err := findCommonAncestor(currentCommit, targetCommit)
	if err != nil {
		return fmt.Errorf("failed to find common ancestor: %v", err)
	}

	if isFastForwardPossible(currentCommit, commonAncestor) {
		err = performFastForwardMerge(remoteName, currentBranch, targetCommit)
		if err != nil {
			return fmt.Errorf("failed to perform fast-forward merge: %v", err)
		}
		return nil
	}

	_, err = detectThreeWayConflicts(currentCommit, targetCommit, commonAncestor)
	if err != nil {
		return fmt.Errorf("failed to detect three-way conflicts: %v", err)
	}

	err = performThreeWayMerge(remoteName, currentCommit, targetCommit, currentBranch, targetBranch, commonAncestor)
	if err != nil {
		return fmt.Errorf("failed to perform three-way merge: %v", err)
	}

	return nil
}

func getLocalBranchCommit(branchName string) (string, error) {
	refPath := filepath.Join(".hit", "refs", "heads", branchName)
	data, err := os.ReadFile(refPath)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func getRemoteBranchCommit(remoteName string, branchName string) (string, error) {
	refPath := filepath.Join(".hit", "refs", "remotes", remoteName, branchName)
	data, err := os.ReadFile(refPath)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func findCommonAncestor(commit1, commit2 string) (string, error) {
	ancestors1, err := getAllAncestors(commit1)
	if err != nil {
		return "", err
	}

	ancestors2, err := getAllAncestors(commit2)
	if err != nil {
		return "", err
	}

	for _, ancestor1 := range ancestors1 {
		if slices.Contains(ancestors2, ancestor1) {
			return ancestor1, nil
		}
	}

	return "", fmt.Errorf("no common ancestor found")
}

func isFastForwardPossible(currentCommit, commonAncestor string) bool {
	return currentCommit == commonAncestor
}

func getAllAncestors(commitHash string) ([]string, error) {
	var ancestors []string
	visited := make(map[string]bool)

	var traverse func(string) error
	traverse = func(hash string) error {
		if visited[hash] || hash == "0000000000000000000000000000000000000000" {
			return nil
		}
		visited[hash] = true
		ancestors = append(ancestors, hash)

		commit, err := storage.GetCommitObject(hash)
		if err != nil {
			return err
		}

		if commit.Parent != "" && commit.Parent != "0000000000000000000000000000000000000000" {
			if err := traverse(commit.Parent); err != nil {
				return err
			}
		}

		if commit.OtherParent != "" && commit.OtherParent != "0000000000000000000000000000000000000000" {
			if err := traverse(commit.OtherParent); err != nil {
				return err
			}
		}

		return nil
	}

	return ancestors, traverse(commitHash)
}

func detectThreeWayConflicts(currentCommit, targetCommit, commonAncestor string) ([]string, error) {
	currentTree, err := storage.GetCommitTree(currentCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to get current commit tree: %v", err)
	}

	targetTree, err := storage.GetCommitTree(targetCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to get target commit tree: %v", err)
	}

	ancestorTree, err := storage.GetCommitTree(commonAncestor)
	if err != nil {
		return nil, fmt.Errorf("failed to get ancestor commit tree: %v", err)
	}

	var conflicts []string

	allFiles := make(map[string]bool)
	for file := range currentTree.Entries {
		allFiles[file] = true
	}
	for file := range targetTree.Entries {
		allFiles[file] = true
	}
	for file := range ancestorTree.Entries {
		allFiles[file] = true
	}

	for file := range allFiles {
		currentHash := currentTree.Entries[file]
		targetHash := targetTree.Entries[file]
		ancestorHash := ancestorTree.Entries[file]

		if hasThreeWayConflict(currentHash, targetHash, ancestorHash) {
			fmt.Printf("  Conflict detected in file: %s\n", file)
			conflicts = append(conflicts, file)
		}
	}

	return conflicts, nil
}

func hasThreeWayConflict(current, target, ancestor string) bool {
	if current == target {
		return false
	}
	if current == ancestor || target == ancestor {
		return false
	}
	return true
}

func isAlreadyMerged(remoteName, targetBranch, currentCommit, targetCommit string) bool {
	remoteCommits, err := storage.GetRemoteCommits(remoteName, targetBranch)
	if err != nil {
		return false
	}

	currentCommitExists := false
	for _, commit := range remoteCommits {
		if commit.Hash == currentCommit {
			currentCommitExists = true
		}
		if currentCommitExists && commit.OtherParent == currentCommit {
			return true
		}
	}

	return false
}

func performThreeWayMerge(remoteName, currentCommit, targetCommit, currentBranch, targetBranch, commonAncestor string) error {
	fmt.Printf("Performing three-way merge...\n")

	mergedTree, err := performThreeWayFileMerge(currentCommit, targetCommit, commonAncestor)
	if err != nil {
		return fmt.Errorf("failed to perform three-way file merge: %v", err)
	}

	mergeCommit, err := createMergeCommitWithTree(currentCommit, targetCommit, currentBranch, targetBranch, mergedTree)
	if err != nil {
		return fmt.Errorf("failed to create merge commit: %v", err)
	}

	refPath := filepath.Join(".hit", "refs", "heads", currentBranch)
	err = os.WriteFile(refPath, []byte(mergeCommit.Hash), 0644)
	if err != nil {
		return fmt.Errorf("failed to update branch reference: %v", err)
	}

	err = storage.UpdateWorkingDirectoryAndIndexFromCommit(mergeCommit.Hash)
	if err != nil {
		return fmt.Errorf("failed to update working directory: %v", err)
	}

	err = updateLocalLog(remoteName, currentBranch, mergeCommit)
	if err != nil {
		return fmt.Errorf("failed to update local log: %v", err)
	}

	fmt.Printf("✅ Three-way merge completed successfully\n")
	return nil
}

func updateLocalLog(remoteName, branchName string, commit *go_types.Commit) error {
	logPath := filepath.Join(".hit", "logs", "refs", "heads", branchName)
	logRemotePath := filepath.Join(".hit", "logs", "refs", "remotes", remoteName, branchName)

	var commits []go_types.Commit
	logData, err := os.ReadFile(logPath)
	if err != nil {
		commits = []go_types.Commit{}
	} else {
		err = json.Unmarshal(logData, &commits)
		if err != nil {
			return fmt.Errorf("failed to parse existing log: %v", err)
		}
	}

	var remoteCommits []go_types.Commit
	logRemoteData, err := os.ReadFile(logRemotePath)
	if err != nil {
		remoteCommits = []go_types.Commit{}
	} else {
		err = json.Unmarshal(logRemoteData, &remoteCommits)
		if err != nil {
			return fmt.Errorf("failed to parse existing log: %v", err)
		}
	}

	commits = append(commits, *commit)

	commitExists := make(map[string]bool)
	for _, commit := range commits {
		commitExists[commit.Hash] = true
	}

	for _, commit := range remoteCommits {
		if commitExists[commit.Hash] {
			continue
		}
		commits = append(commits, commit)
	}

	slices.SortFunc(commits, func(a, b go_types.Commit) int {
		if a.Timestamp.Before(b.Timestamp) {
			return -1
		} else if a.Timestamp.After(b.Timestamp) {
			return 1
		}
		return 0
	})

	updatedLogData, err := json.Marshal(commits)
	if err != nil {
		return fmt.Errorf("failed to marshal updated log: %v", err)
	}

	err = os.WriteFile(logPath, updatedLogData, 0644)
	if err != nil {
		return fmt.Errorf("failed to write updated log: %v", err)
	}

	return nil
}

func performFastForwardMerge(remoteName, currentBranch, targetCommit string) error {
	refPath := filepath.Join(".hit", "refs", "heads", currentBranch)
	err := os.WriteFile(refPath, []byte(targetCommit), 0644)
	if err != nil {
		return fmt.Errorf("failed to update branch reference: %v", err)
	}

	err = storage.UpdateWorkingDirectoryAndIndexFromCommit(targetCommit)
	if err != nil {
		return fmt.Errorf("failed to update working directory and index: %v", err)
	}

	err = updateLocalLogWithRemoteCommits(remoteName, currentBranch)
	if err != nil {
		return fmt.Errorf("failed to update local log: %v", err)
	}

	return nil
}

func updateLocalLogWithRemoteCommits(remoteName, branchName string) error {
	remoteCommits, err := storage.GetRemoteCommits(remoteName, branchName)
	if err != nil {
		return fmt.Errorf("failed to get remote commits: %v", err)
	}

	err = storage.UpdateHeadCommits(branchName, remoteCommits)
	if err != nil {
		return fmt.Errorf("failed to update head commits: %v", err)
	}

	err = storage.UpdateHeadRef(branchName, remoteCommits[len(remoteCommits)-1].Hash)
	if err != nil {
		return fmt.Errorf("failed to update head ref: %v", err)
	}

	return nil
}

func performThreeWayFileMerge(currentCommit, targetCommit, commonAncestor string) (*go_types.Tree, error) {
	currentTree, err := storage.GetCommitTree(currentCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to get current tree: %v", err)
	}

	targetTree, err := storage.GetCommitTree(targetCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to get target tree: %v", err)
	}

	ancestorTree, err := storage.GetCommitTree(commonAncestor)
	if err != nil {
		return nil, fmt.Errorf("failed to get ancestor tree: %v", err)
	}

	allFiles := make(map[string]bool)
	for file := range currentTree.Entries {
		allFiles[file] = true
	}
	for file := range targetTree.Entries {
		allFiles[file] = true
	}
	for file := range ancestorTree.Entries {
		allFiles[file] = true
	}

	mergedTree := &go_types.Tree{
		Entries: make(map[string]string),
		Parent:  "",
	}

	for file := range allFiles {
		currentHash := currentTree.Entries[file]
		targetHash := targetTree.Entries[file]
		ancestorHash := ancestorTree.Entries[file]

		mergedHash, err := mergeFileThreeWay(currentHash, targetHash, ancestorHash)
		if err != nil {
			return nil, fmt.Errorf("failed to merge file %s: %v", file, err)
		}

		if mergedHash != "" {
			mergedTree.Entries[file] = mergedHash
		}
	}

	treeData, err := json.Marshal(mergedTree)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal merged tree: %v", err)
	}

	treeHash := storage.Hash(treeData)
	err = storage.WriteObject(treeHash, treeData)
	if err != nil {
		return nil, fmt.Errorf("failed to store merged tree: %v", err)
	}

	return mergedTree, nil
}

func mergeFileThreeWay(currentHash, targetHash, ancestorHash string) (string, error) {
	if currentHash == targetHash || targetHash == ancestorHash {
		return currentHash, nil
	}

	if currentHash == ancestorHash {
		return targetHash, nil
	}

	return mergeFileContent(currentHash, targetHash, ancestorHash)
}

func mergeFileContent(currentHash, targetHash, ancestorHash string) (string, error) {
	currentContent, err := getFileContent(currentHash)
	if err != nil {
		return "", fmt.Errorf("failed to get current content: %v", err)
	}

	targetContent, err := getFileContent(targetHash)
	if err != nil {
		return "", fmt.Errorf("failed to get target content: %v", err)
	}

	ancestorContent, err := getFileContent(ancestorHash)
	if err != nil {
		return "", fmt.Errorf("failed to get ancestor content: %v", err)
	}

	mergedContent := currentContent
	if targetContent != ancestorContent {
		mergedContent = currentContent + "\n" + targetContent
	}

	contentBytes := []byte(mergedContent)
	contentHash := storage.Hash(contentBytes)
	err = storage.WriteObject(contentHash, contentBytes)
	if err != nil {
		return "", fmt.Errorf("failed to store merged content: %v", err)
	}

	return contentHash, nil
}

func getFileContent(hash string) (string, error) {
	if hash == "" {
		return "", nil
	}

	content, err := storage.LoadObject(hash)
	if err != nil {
		return "", err
	}

	return content, nil
}

func createMergeCommitWithTree(currentCommit, targetCommit, currentBranch, targetBranch string, tree *go_types.Tree) (*go_types.Commit, error) {
	var message string
	if targetBranch == currentBranch {
		message = fmt.Sprintf("Merging Commit %s into %s", targetCommit, currentCommit)
	} else {
		message = fmt.Sprintf("Merge branch '%s' into %s", targetBranch, currentBranch)
	}

	treeData, err := json.Marshal(tree)
	if err != nil {
		return nil, err
	}

	treeHash := storage.Hash(treeData)
	err = storage.WriteObject(treeHash, treeData)
	if err != nil {
		return nil, err
	}

	commit := go_types.Commit{
		Hash:        treeHash,
		Parent:      currentCommit,
		OtherParent: targetCommit,
		Message:     message,
		Author:      os.Getenv("USER"),
		Timestamp:   go_types.TimeNow(),
	}

	return &commit, nil
}
