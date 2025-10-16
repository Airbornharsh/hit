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

	entries, entriesErr := os.ReadDir(pwd)
	if entriesErr != nil {
		return
	}

	for _, entry := range entries {
		path := pwd + "/" + entry.Name()
		if entry.IsDir() {
			checkHit := strings.HasSuffix(path, "/.hit")
			if !checkHit {
				AddAllFile(path)
			}
		} else {
			AddFile(path)
		}
	}
}

func RemoveFile(filePath string) (string, error) {
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

func RemoveAllFile(currentDir string) {
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
			RemoveAllFile(path)
		} else {
			_, _ = RemoveFile(path)
		}
	}
}
