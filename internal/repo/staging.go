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

func getRepoRoot() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		hitDir := filepath.Join(dir, ".hit")
		if _, err := os.Stat(hitDir); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("not in a git repository")
		}
		dir = parent
	}
}

func getRelativePath(absPath string) (string, error) {
	repoRoot, err := getRepoRoot()
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
		removeFromIndex(relPath)
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

func AddAllFile(currentDir string) {
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

	repoRoot, err := getRepoRoot()
	if err != nil {
		return
	}

	indexFile := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}
	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	existingFiles := collectExistingFiles(pwd)

	for filePath := range existingFiles {
		absPath := filepath.Join(repoRoot, filePath)
		AddFile(absPath)
	}

	for filePath := range index.Entries {
		if !existingFiles[filePath] {
			absFilePath := filepath.Join(repoRoot, filePath)
			if strings.HasPrefix(absFilePath, pwd) {
				removeFromIndex(filePath)
			}
		}
	}
}

func collectExistingFiles(rootDir string) map[string]bool {
	existingFiles := make(map[string]bool)

	ignoreMatcher, err := storage.GetIgnoreMatcher()
	if err != nil {
		repoRoot, err := storage.FindRepoRoot()
		if err != nil {
			return existingFiles
		}
		ignoreMatcher, err = storage.NewIgnoreMatcher(repoRoot)
		if err != nil {
			return existingFiles
		}
	}

	var collectFiles func(dir string)
	collectFiles = func(dir string) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}

		for _, entry := range entries {
			absPath := filepath.Join(dir, entry.Name())

			if strings.HasSuffix(absPath, ".hit") {
				continue
			}

			relPath, err := getRelativePath(absPath)
			if err != nil {
				continue
			}
			relPath = filepath.ToSlash(relPath)

			if ignoreMatcher.ShouldIgnore(relPath, entry.IsDir()) {
				continue
			}

			if entry.IsDir() {
				collectFiles(absPath)
			} else {
				existingFiles[relPath] = true
			}
		}
	}

	collectFiles(rootDir)
	return existingFiles
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

	delete(index.Entries, relPath)
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

func removeFromIndex(filePath string) {
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

	indexFile := filepath.Join(".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	if _, exists := index.Entries[relPath]; exists {
		delete(index.Entries, relPath)
		index.Changed = true

		newData, _ := json.MarshalIndent(index, "", "  ")
		os.WriteFile(indexFile, newData, 0644)
		fmt.Printf("Removed from index: %s\n", relPath)
	}
}
