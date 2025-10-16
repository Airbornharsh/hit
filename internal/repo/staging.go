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

	index.Entries[filePath] = hash

	newData, _ := json.MarshalIndent(index, "", "  ")
	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		return "", err
	}

	return hash, nil
}

func AddAllFile(currentDir string) {
	fmt.Println("Current Dir", currentDir)

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
				fmt.Println("Ignored: ", path)
			} else {
				AddAllFile(path)
				fmt.Println("Choosed: ", path)
			}
		} else {
			AddFile(path)
		}
	}
}
