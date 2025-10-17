package repo

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"

	"github.com/airbornharsh/hit/internal/storage"
	"github.com/airbornharsh/hit/utils"
)

type Tree struct {
	Entries map[string]string `json:"entries"` // file path -> object hash
	Parent  string            `json:"parent"`
}

var ErrNoStagedChanges = errors.New("no staged changes to commit")

func RandomHash() string {
	bytes := make([]byte, 20)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

func BuildTreeFromStage() (string, error) {
	repoRoot, err := utils.FindRepoRoot()
	if err != nil {
		return "", err
	}

	indexFile := filepath.Join(repoRoot, ".hit", "index.json")
	index := &Index{Entries: make(map[string]string)}

	if data, err := os.ReadFile(indexFile); err == nil {
		json.Unmarshal(data, index)
	}

	if !index.Changed {
		return "", ErrNoStagedChanges
	}

	index.Changed = false

	if len(index.Entries) == 0 {
		return buildEmptyTree()
	}

	rootTree := &Tree{Entries: make(map[string]string)}

	for relativePath, hash := range index.Entries {
		normalizedPath := filepath.ToSlash(relativePath)
		rootTree.Entries[normalizedPath] = hash
	}

	parentHash, _ := utils.GetHeadHash()
	rootTree.Parent = parentHash

	println("Parent Commit", parentHash)

	return storeTree(rootTree)
}

func buildEmptyTree() (string, error) {
	emptyTree := &Tree{Entries: make(map[string]string), Parent: ""}
	return storeTree(emptyTree)
}

func storeTree(tree *Tree) (string, error) {
	data, err := json.Marshal(tree)
	if err != nil {
		return "", err
	}

	hash := storage.Hash(data)

	if err := storage.WriteObject(hash, data); err != nil {
		return "", err
	}

	return hash, nil
}
