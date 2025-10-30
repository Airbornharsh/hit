package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/storage"
)

func getRelativePath(absPath string) (string, error) {
	repoRoot, err := storage.FindRepoRoot()
	if err != nil {
		return "", err
	}

	relPath, err := filepath.Rel(repoRoot, absPath)
	if err != nil {
		return "", err
	}

	return relPath, nil
}

// AddFile reads, hashes, compresses, and stores the file in .hit/objects
func AddFile(filePath string) (string, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		relPath, _ := getRelativePath(absPath)
		removeFromIndex(relPath, nil)
		return "", fmt.Errorf("file does not exist: %s", filePath)
	}

	relPath, err := getRelativePath(absPath)
	if err != nil {
		return "", err
	}

	ignoreMatcher, err := storage.GetIgnoreMatcher()
	if err == nil {
		relPathSlash := filepath.ToSlash(relPath)
		if ignoreMatcher.ShouldIgnore(relPathSlash, false) {
			return "", fmt.Errorf("file is ignored by .hitignore: %s", filePath)
		}
	}

	content, err := os.ReadFile(absPath)
	if err != nil {
		return "", err
	}

	if HasConflictMarkers(string(content)) {
		return "", fmt.Errorf("file contains unresolved conflict markers: %s (resolve conflicts before adding)", filePath)
	}

	conflictResolution, err := LoadConflictResolution()
	if err == nil && conflictResolution != nil {
		if CheckFileForConflicts(relPath) {
			conflictResolution.MarkResolved(relPath)
			conflictResolution.SaveConflictResolution()
		}
	}

	hash := storage.Hash(content)

	if err := storage.WriteObject(hash, content); err != nil {
		return "", err
	}

	indexFile := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	if existingHash, ok := index.Entries[relPath]; ok && existingHash == hash {
		return "", nil
	}

	index.Entries[relPath] = hash
	index.Changed = true

	newData, _ := json.MarshalIndent(index, "", "  ")
	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		return "", err
	}

	println("Added to Stage:", relPath)
	return hash, nil
}

func AddAllFile(currentDir string) error {
	var pwd = "/"
	if currentDir == "." {
		var pwdError error
		pwd, pwdError = os.Getwd()
		if pwdError != nil {
			return pwdError
		}
	} else {
		pwd = currentDir
	}

	repoRoot, err := storage.FindRepoRoot()
	if err != nil {
		return err
	}

	indexFile := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}
	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	existingFiles := storage.CollectAllFiles(pwd, repoRoot)

	for filePath := range existingFiles {
		absPath := filepath.Join(repoRoot, filePath)
		_, err := AddFile(absPath)
		if err != nil {
			return err
		}
	}

	for filePath := range index.Entries {
		if !existingFiles[filePath] {
			absFilePath := filepath.Join(repoRoot, filePath)
			if strings.HasPrefix(absFilePath, pwd) {
				removeFromIndex(filePath, index)
			}
		}
	}

	return nil
}

func ResetFile(filePath string) (string, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return "", err
	}

	relPath, err := getRelativePath(absPath)
	if err != nil {
		return "", err
	}

	indexFile := filepath.Join(".hit", "index.json")

	index := &go_types.Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	hash, exists := index.Entries[relPath]
	if !exists {
		return "", fmt.Errorf("file not staged: %s", relPath)
	}

	if relPath != "" {
		tree, err := storage.GetHeadTree()
		if err != nil {
			return "", err
		}
		tempHash := tree.Entries[relPath]
		if tempHash == "" {
			delete(index.Entries, relPath)
		} else {
			index.Entries[relPath] = tempHash
		}
	}

	index.Changed = true

	newData, _ := json.MarshalIndent(index, "", "  ")
	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		return "", err
	}

	return hash, nil
}

func ResetAllFile(currentDir string) {
	var pwd = "/"
	if currentDir == "." {
		var pwdError error
		pwd, pwdError = os.Getwd()
		if pwdError != nil {
			return
		}
	} else {
		pwd = currentDir
	}

	entries, entriesErr := os.ReadDir(pwd)
	if entriesErr != nil {
		return
	}

	for _, entry := range entries {
		path := filepath.Join(pwd, entry.Name())
		if entry.IsDir() {
			checkHit := strings.HasSuffix(path, ".hit")
			if checkHit {
				continue
			}
			ResetAllFile(path)
		} else {
			_, _ = ResetFile(path)
		}
	}
}

func removeFromIndex(filePath string, indexData *go_types.Index) {
	var relPath string
	if filepath.IsAbs(filePath) {
		var err error
		relPath, err = getRelativePath(filePath)
		if err != nil {
			return
		}
	} else {
		relPath = filePath
	}

	index := &go_types.Index{Entries: make(map[string]string)}
	indexFile := filepath.Join(".hit", "index.json")
	if indexData == nil {
		if data, err := os.ReadFile(indexFile); err == nil {
			json.Unmarshal(data, index)
		}
	} else {
		index = indexData
	}

	if _, exists := index.Entries[relPath]; exists {
		delete(index.Entries, relPath)
		index.Changed = true

		newData, _ := json.MarshalIndent(index, "", "  ")
		os.WriteFile(indexFile, newData, 0644)
		fmt.Printf("Removed from index: %s\n", relPath)
	}
}

func RevertFile(filePath string) (string, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return "", err
	}

	relPath, err := getRelativePath(absPath)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		removeFromIndex(relPath, nil)
		return "", fmt.Errorf("file does not exist: %s", filePath)
	}

	indexFile := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	tree, err := storage.GetHeadTree()
	if err != nil {
		return "", err
	}

	var targetHash string
	var source string

	if indexHash, exists := index.Entries[relPath]; exists {
		headHash, headExists := tree.Entries[relPath]
		if headExists && indexHash != headHash {
			targetHash = indexHash
			source = "staged changes"
		} else if headExists {
			targetHash = headHash
			source = "last commit"
		} else {
			removeFromIndex(relPath, nil)
			os.Remove(absPath)
			return "", fmt.Errorf("file not in last commit: %s", relPath)
		}
	} else {
		headHash, headExists := tree.Entries[relPath]
		if !headExists {
			removeFromIndex(relPath, nil)
			os.Remove(absPath)
			return "", fmt.Errorf("file not in last commit: %s", relPath)
		}
		targetHash = headHash
		source = "last commit"
	}

	content, err := storage.LoadObject(targetHash)
	if err != nil {
		return "", fmt.Errorf("failed to read file from %s: %v", source, err)
	}

	if err := os.WriteFile(absPath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %v", err)
	}

	index.Entries[relPath] = targetHash
	index.Changed = true

	newData, _ := json.MarshalIndent(index, "", "  ")
	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		return "", err
	}

	fmt.Printf("Reverted %s from %s\n", relPath, source)
	return targetHash, nil
}

func RevertAllFile(currentDir string) {
	var pwd = "/"
	if currentDir == "." {
		var pwdError error
		pwd, pwdError = os.Getwd()
		if pwdError != nil {
			return
		}
	} else {
		pwd = currentDir
	}

	repoRoot, err := storage.FindRepoRoot()
	if err != nil {
		return
	}

	existingFiles := storage.CollectAllFiles(pwd, repoRoot)
	for filePath := range existingFiles {
		absPath := filepath.Join(repoRoot, filePath)
		RevertFile(absPath)
	}

	indexFile := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}
	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	relPwd, err := filepath.Rel(repoRoot, pwd)
	if err != nil {
		relPwd = pwd
	}

	for filePath := range index.Entries {
		if strings.HasPrefix(filePath, relPwd+"/") || (relPwd == "." && !strings.Contains(filePath, "/")) {
			absFilePath := filepath.Join(repoRoot, filePath)
			if _, err := os.Stat(absFilePath); os.IsNotExist(err) {
				removeFromIndex(filePath, nil)
			}
		}
	}
}
