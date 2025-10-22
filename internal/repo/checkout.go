package repo

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/storage"
	"github.com/airbornharsh/hit/utils"
)

func CreateBranch(branch string) error {
	if _, err := os.Stat(filepath.Join(".hit", "refs", "heads", branch)); err == nil {
		return fmt.Errorf("branch '%s' already exists", branch)
	}

	currentBranch, err := utils.GetBranch()
	if err != nil {
		return fmt.Errorf("failed to get current branch: %v", err)
	}

	currentCommitHash, err := utils.GetCurrentCommit(currentBranch)
	if err != nil {
		return fmt.Errorf("failed to get current commit: %v", err)
	}

	newBranchRefPath := filepath.Join(".hit", "refs", "heads", branch)
	err = os.WriteFile(newBranchRefPath, []byte(currentCommitHash), 0644)
	if err != nil {
		return fmt.Errorf("failed to create branch ref: %v", err)
	}

	currentBranchLogsPath := filepath.Join(".hit", "logs", "refs", "heads", currentBranch)
	if _, err := os.Stat(currentBranchLogsPath); err == nil {
		currentBranchLogsFile, err := os.ReadFile(currentBranchLogsPath)
		if err != nil {
			return fmt.Errorf("failed to read current branch logs: %v", err)
		}

		newBranchLogsPath := filepath.Join(".hit", "logs", "refs", "heads", branch)
		err = os.WriteFile(newBranchLogsPath, currentBranchLogsFile, 0644)
		if err != nil {
			return fmt.Errorf("failed to create branch logs: %v", err)
		}
	}

	headPath := filepath.Join(".hit", "HEAD")
	newHead := fmt.Sprintf("ref: refs/heads/%s", branch)
	err = os.WriteFile(headPath, []byte(newHead), 0644)
	if err != nil {
		return fmt.Errorf("failed to update HEAD: %v", err)
	}

	return nil
}

func SwitchBranch(branch string) error {
	if _, err := os.Stat(filepath.Join(".hit", "refs", "heads", branch)); os.IsNotExist(err) {
		return fmt.Errorf("branch '%s' does not exist", branch)
	}

	_, err := utils.GetBranch()
	if err != nil {
		return err
	}

	hasUncommittedChanges, err := hasUncommittedChanges()
	if err != nil {
		return fmt.Errorf("failed to check for uncommitted changes: %v", err)
	}

	if hasUncommittedChanges {
		return fmt.Errorf("you have uncommitted changes. Please commit or stash them before switching branches")
	}

	headPath := filepath.Join(".hit", "HEAD")
	newHead := fmt.Sprintf("ref: refs/heads/%s", branch)
	err = os.WriteFile(headPath, []byte(newHead), 0644)
	if err != nil {
		return fmt.Errorf("failed to update HEAD: %v", err)
	}

	commitHash, err := utils.GetCurrentCommit(branch)
	if err != nil {
		return fmt.Errorf("failed to get commit hash for branch '%s': %v", branch, err)
	}

	if commitHash == "" {
		return fmt.Errorf("branch '%s' has no commits", branch)
	}

	treeData, err := storage.LoadObject(commitHash)
	if err != nil {
		return fmt.Errorf("failed to load tree object: %v", err)
	}

	var tree go_types.Tree
	err = json.Unmarshal([]byte(treeData), &tree)
	if err != nil {
		return fmt.Errorf("failed to parse tree object: %v", err)
	}

	err = updateWorkingDirectory(tree)
	if err != nil {
		return fmt.Errorf("failed to update working directory: %v", err)
	}

	err = updateIndex(tree)
	if err != nil {
		return fmt.Errorf("failed to update index: %v", err)
	}

	return nil
}

func hasUncommittedChanges() (bool, error) {
	indexPath := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexPath); err == nil {
		json.Unmarshal(data, index)
	}

	workingFiles, err := getAllWorkingFiles()
	if err != nil {
		return false, fmt.Errorf("failed to get working directory files: %v", err)
	}

	for filePath := range workingFiles {
		if _, exists := index.Entries[filePath]; !exists {
			return true, nil
		}
	}

	for filePath := range index.Entries {
		if _, exists := workingFiles[filePath]; !exists {
			return true, nil
		}
	}

	for filePath, expectedHash := range index.Entries {
		if actualHash, exists := workingFiles[filePath]; exists {
			if actualHash != expectedHash {
				return true, nil
			}
		}
	}

	return false, nil
}

func getAllWorkingFiles() (map[string]string, error) {
	workingFiles := make(map[string]string)

	err := filepath.WalkDir(".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if strings.HasPrefix(path, ".hit") {
			if d.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if d.IsDir() {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read file %s: %v", path, err)
		}

		hash := storage.Hash(content)
		workingFiles[path] = hash

		return nil
	})

	if err != nil {
		return nil, err
	}

	return workingFiles, nil
}

func updateWorkingDirectory(tree go_types.Tree) error {
	indexPath := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexPath); err == nil {
		json.Unmarshal(data, index)
	}

	for filePath := range index.Entries {
		if _, exists := tree.Entries[filePath]; !exists {
			if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
				return fmt.Errorf("failed to remove file %s: %v", filePath, err)
			}
		}
	}

	for filePath, objectHash := range tree.Entries {
		err := restoreFileFromObject(filePath, objectHash)
		if err != nil {
			return fmt.Errorf("failed to restore file %s: %v", filePath, err)
		}
	}

	return nil
}

func updateIndex(tree go_types.Tree) error {
	indexPath := filepath.Join(".hit", "index.json")

	index := &go_types.Index{
		Entries: make(map[string]string),
		Changed: false,
	}

	for filePath, objectHash := range tree.Entries {
		index.Entries[filePath] = objectHash
	}

	indexData, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal index: %v", err)
	}

	err = os.WriteFile(indexPath, indexData, 0644)
	if err != nil {
		return fmt.Errorf("failed to write index: %v", err)
	}

	return nil
}

func restoreFileFromObject(filePath, objectHash string) error {
	objectData, err := storage.LoadObject(objectHash)
	if err != nil {
		return fmt.Errorf("failed to load object %s: %v", objectHash, err)
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %v", dir, err)
	}

	err = os.WriteFile(filePath, []byte(objectData), 0644)
	if err != nil {
		return fmt.Errorf("failed to write file %s: %v", filePath, err)
	}

	return nil
}
