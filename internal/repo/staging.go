package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/storage"
)

type Index struct {
	Entries map[string]string `json:"entries"` // file path -> object hash
	Changed bool              `json:"changed"`
}

// AddFile reads, hashes, compresses, and stores the file in .hit/objects
func AddFile(filePath string) (string, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		removeFromIndex(filePath)
		return "", fmt.Errorf("file does not exist: %s", filePath)
	}

	// Read file
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	// Hash content
	hash := storage.Hash(content)

	// Store object
	if err := storage.WriteObject(hash, content); err != nil {
		return "", err
	}

	// Update staging index
	indexFile := filepath.Join(".hit", "index.json")
	index := &Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	if existingHash, ok := index.Entries[filePath]; ok && existingHash == hash {
		println("No Change in File")
		return "", nil
	}

	index.Entries[filePath] = hash
	index.Changed = true

	newData, _ := json.MarshalIndent(index, "", "  ")
	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		return "", err
	}

	println("Added:", filePath)
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

	indexFile := filepath.Join(".hit", "index.json")
	index := &Index{Entries: make(map[string]string)}
	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	existingFiles := collectExistingFiles(pwd)

	for filePath := range existingFiles {
		AddFile(filePath)
	}

	for filePath := range index.Entries {
		if !existingFiles[filePath] && strings.HasPrefix(filePath, pwd) {
			removeFromIndex(filePath)
		}
	}
}

func collectExistingFiles(rootDir string) map[string]bool {
	existingFiles := make(map[string]bool)

	var collectFiles func(dir string)
	collectFiles = func(dir string) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}

		for _, entry := range entries {
			path := filepath.Join(dir, entry.Name())
			if entry.IsDir() {
				if !strings.HasSuffix(path, ".hit") {
					collectFiles(path)
				}
			} else {
				existingFiles[path] = true
			}
		}
	}

	collectFiles(rootDir)
	return existingFiles
}

func ResetFile(filePath string) (string, error) {
	indexFile := filepath.Join(".hit", "index.json")

	index := &Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	hash, exists := index.Entries[filePath]
	if !exists {
		return "", fmt.Errorf("file not staged: %s", filePath)
	}

	delete(index.Entries, filePath)
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
		path := pwd + "/" + entry.Name()
		if entry.IsDir() {
			checkHit := strings.HasSuffix(path, "/.hit")
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
	indexFile := filepath.Join(".hit", "index.json")
	index := &Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	if _, exists := index.Entries[filePath]; exists {
		delete(index.Entries, filePath)
		index.Changed = true

		newData, _ := json.MarshalIndent(index, "", "  ")
		os.WriteFile(indexFile, newData, 0644)
		fmt.Printf("Removed from index: %s\n", filePath)
	}
}
