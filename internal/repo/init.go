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

func InitRepo() error {
	// Check if .hit already exists
	if _, err := os.Stat(".hit"); !os.IsNotExist(err) {
		return fmt.Errorf("repository already exists")
	}

	// Create required folders
	dirs := []string{
		".hit",
		".hit/objects",
		".hit/refs/heads",
		".hit/logs/refs/heads",
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	InitializeIndex()

	// Create HEAD file
	headFilePath := filepath.Join(".hit", "HEAD")
	headRefFilePath := filepath.Join(".hit", "refs", "heads", "master")
	headLogRefFilePath := filepath.Join(".hit", "logs", "refs", "heads", "master")
	configFilePath := filepath.Join(".hit", "config")
	configData := []byte(`{
		"remotes": {
		}
	}`)
	err := os.WriteFile(headFilePath, []byte("ref: refs/heads/master\n"), 0644)
	if err != nil {
		return err
	}
	err = os.WriteFile(headRefFilePath, []byte("0000000000000000000000000000000000000000"), 0644)
	if err != nil {
		return err
	}
	err = os.WriteFile(headLogRefFilePath, []byte("[]"), 0644)
	if err != nil {
		return err
	}
	err = os.WriteFile(configFilePath, configData, 0644)
	if err != nil {
		return err
	}
	return err
}

func InitializeIndex() {
	// Get current working directory (repo root)
	repoRoot, err := os.Getwd()
	if err != nil {
		fmt.Printf("Error getting current directory: %v\n", err)
		return
	}

	// Create index structure
	index := &go_types.Index{
		Entries: make(map[string]string),
		Changed: false,
	}

	// Collect all files in the repository
	existingFiles := collectAllFiles(repoRoot)

	// Process each file
	for filePath := range existingFiles {
		// Convert absolute path to relative path
		relPath, err := filepath.Rel(repoRoot, filePath)
		if err != nil {
			fmt.Printf("Error converting path %s: %v\n", filePath, err)
			continue
		}

		// Read file content
		content, err := os.ReadFile(filePath)
		if err != nil {
			fmt.Printf("Error reading file %s: %v\n", filePath, err)
			continue
		}

		// Hash content
		hash := storage.Hash(content)

		// Store object
		if err := storage.WriteObject(hash, content); err != nil {
			fmt.Printf("Error storing object for %s: %v\n", filePath, err)
			continue
		}

		// Add to index
		index.Entries[relPath] = hash
		index.Changed = true
	}

	// Write index to file
	indexFile := filepath.Join(".hit", "index.json")
	newData, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling index: %v\n", err)
		return
	}

	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		fmt.Printf("Error writing index file: %v\n", err)
		return
	}

	fmt.Printf("Initialized index with %d files\n", len(index.Entries))
}

func collectAllFiles(rootDir string) map[string]bool {
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
			path := filepath.Join(dir, entry.Name())

			if strings.HasSuffix(path, ".hit") {
				continue
			}

			relPath, err := filepath.Rel(rootDir, path)
			if err != nil {
				continue
			}
			relPath = filepath.ToSlash(relPath)

			if ignoreMatcher.ShouldIgnore(relPath, entry.IsDir()) {
				continue
			}

			if entry.IsDir() {
				collectFiles(path)
			} else {
				existingFiles[path] = true
			}
		}
	}

	collectFiles(rootDir)
	return existingFiles
}
