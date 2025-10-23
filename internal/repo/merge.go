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

	if targetCommit == currentCommit {
		fmt.Println("Already up to date")
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
	} else {
		return fmt.Errorf("only fast-forward merge is possible")
	}

	conflicts, err := detectThreeWayConflicts(currentCommit, targetCommit, commonAncestor)
	if err != nil {
		return fmt.Errorf("failed to detect three-way conflicts: %v", err)
	}

	if len(conflicts) > 0 {
		return fmt.Errorf("conflicts detected in the following files: %v", conflicts)
	}

	err = performThreeWayMerge(currentBranch, targetCommit, targetBranch)
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
		if visited[hash] {
			return nil
		}
		visited[hash] = true
		ancestors = append(ancestors, hash)

		commit, err := getCommitObject(hash)
		if err != nil {
			return err
		}

		if commit.Parent != "" && commit.Parent != "0000000000000000000000000000000000000000" {
			if err := traverse(commit.Parent); err != nil {
				return err
			}
		}

		return nil
	}

	return ancestors, traverse(commitHash)
}

// Conflict Fix
func detectThreeWayConflicts(currentCommit, targetCommit, commonAncestor string) ([]string, error) {
	currentTree, err := getCommitTree(currentCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to get current commit tree: %v", err)
	}

	targetTree, err := getCommitTree(targetCommit)
	if err != nil {
		return nil, fmt.Errorf("failed to get target commit tree: %v", err)
	}

	ancestorTree, err := getCommitTree(commonAncestor)
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

func performThreeWayMerge(currentBranch, targetCommit, branchName string) error {
	fmt.Printf("Creating merge commit for three-way merge...\n")

	mergeCommit, err := createMergeCommit(currentBranch, targetCommit, branchName)
	if err != nil {
		return fmt.Errorf("failed to create merge commit: %v", err)
	}

	refPath := filepath.Join(".hit", "refs", "heads", currentBranch)
	err = os.WriteFile(refPath, []byte(mergeCommit), 0644)
	if err != nil {
		return fmt.Errorf("failed to update branch reference: %v", err)
	}

	err = updateWorkingDirectoryFromCommit(mergeCommit)
	if err != nil {
		return fmt.Errorf("failed to update working directory: %v", err)
	}

	err = updateLocalLog(currentBranch, mergeCommit)
	if err != nil {
		return fmt.Errorf("failed to update local log: %v", err)
	}

	fmt.Printf("✅ Three-way merge completed successfully\n")
	return nil
}

func updateLocalLog(branchName, commitHash string) error {
	logPath := filepath.Join(".hit", "logs", "refs", "heads", branchName)

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

	commit, err := getCommitObject(commitHash)
	if err != nil {
		return fmt.Errorf("failed to get commit object: %v", err)
	}

	commits = append(commits, *commit)

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

func getCommitObject(commitHash string) (*go_types.Commit, error) {
	if commitHash == "0000000000000000000000000000000000000000" {
		return &go_types.Commit{
			Hash:   commitHash,
			Parent: "",
		}, nil
	}

	commitData, err := storage.LoadObject(commitHash)
	if err != nil {
		return nil, fmt.Errorf("failed to load commit object: %v", err)
	}

	var commit go_types.Commit
	err = json.Unmarshal([]byte(commitData), &commit)
	if err != nil {
		return nil, fmt.Errorf("failed to parse commit object: %v", err)
	}

	return &commit, nil
}

func getCommitTree(commitHash string) (*go_types.Tree, error) {
	if commitHash == "0000000000000000000000000000000000000000" {
		return &go_types.Tree{
			Entries: make(map[string]string),
			Parent:  "",
		}, nil
	}

	commitData, err := storage.LoadObject(commitHash)
	if err != nil {
		return nil, err
	}

	var tree go_types.Tree
	err = json.Unmarshal([]byte(commitData), &tree)
	if err != nil {
		return nil, err
	}

	return &tree, nil
}

func createMergeCommit(currentBranch, targetCommit, branchName string) (string, error) {
	currentCommit, err := getLocalBranchCommit(currentBranch)
	if err != nil {
		return "", err
	}

	message := fmt.Sprintf("Merge branch '%s' into %s", branchName, currentBranch)

	commit := go_types.Commit{
		Hash:      "",
		Parent:    currentCommit,
		Message:   message,
		Author:    "HIT User",
		Timestamp: go_types.TimeNow(),
	}

	commitData, err := json.Marshal(commit)
	if err != nil {
		return "", err
	}

	commitHash := storage.Hash(commitData)
	commit.Hash = commitHash

	err = storage.WriteObject(commitHash, commitData)
	if err != nil {
		return "", err
	}

	return commitHash, nil
}

func performFastForwardMerge(remoteName, currentBranch, targetCommit string) error {
	refPath := filepath.Join(".hit", "refs", "heads", currentBranch)
	err := os.WriteFile(refPath, []byte(targetCommit), 0644)
	if err != nil {
		return fmt.Errorf("failed to update branch reference: %v", err)
	}

	err = updateWorkingDirectoryFromCommit(targetCommit)
	if err != nil {
		return fmt.Errorf("failed to update working directory: %v", err)
	}

	err = updateLocalLogWithRemoteCommits(remoteName, currentBranch)
	if err != nil {
		return fmt.Errorf("failed to update local log: %v", err)
	}

	return nil
}

func updateWorkingDirectoryFromCommit(commitHash string) error {
	tree, err := getCommitTree(commitHash)
	if err != nil {
		return err
	}
	index := &go_types.Index{
		Entries: tree.Entries,
		Changed: true,
	}

	indexPath := filepath.Join(".hit", "index.json")
	indexData, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return err
	}

	err = os.WriteFile(indexPath, indexData, 0644)
	if err != nil {
		return err
	}

	for filePath, objectHash := range tree.Entries {
		err := restoreFileFromObject(filePath, objectHash)
		if err != nil {
			return fmt.Errorf("failed to restore file %s: %v", filePath, err)
		}
	}

	return nil
}

func updateLocalLogWithRemoteCommits(remoteName, branchName string) error {
	logPath := filepath.Join(".hit", "logs", "refs", "heads", branchName)

	remoteCommits, err := getAllCommitsFromRemote(remoteName, branchName)
	if err != nil {
		return fmt.Errorf("failed to get remote commits: %v", err)
	}

	updatedLogData, err := json.Marshal(remoteCommits)
	if err != nil {
		return fmt.Errorf("failed to marshal updated log: %v", err)
	}

	err = os.WriteFile(logPath, updatedLogData, 0644)
	if err != nil {
		return fmt.Errorf("failed to write updated log: %v", err)
	}

	return nil
}

func getAllCommitsFromRemote(remoteName, branchName string) ([]go_types.Commit, error) {
	var commits []go_types.Commit

	remoteBranchLogPath := filepath.Join(".hit", "logs", "refs", "remotes", remoteName, branchName)
	remoteBranchLogFile, err := os.ReadFile(remoteBranchLogPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read remote branch log: %v", err)
	}
	err = json.Unmarshal(remoteBranchLogFile, &commits)
	if err != nil {
		return nil, fmt.Errorf("failed to parse remote branch log: %v", err)
	}

	return commits, nil
}
