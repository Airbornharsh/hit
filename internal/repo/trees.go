package repo

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"

	"github.com/airbornharsh/hit/internal/storage"
	"github.com/airbornharsh/hit/utils"
)

type TreeEntry struct {
	Name string `json:"name"`
	Hash string `json:"hash"`
}

type Tree struct {
	Entries []TreeEntry `json:"entries"`
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
	newData, _ := json.MarshalIndent(index, "", "  ")
	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		return "", err
	}

	if len(index.Entries) == 0 {
		return buildEmptyTree()
	}

	rootTree := &Tree{Entries: make([]TreeEntry, 0)}

	var sortedPaths []string
	for path := range index.Entries {
		sortedPaths = append(sortedPaths, path)
	}
	sort.Strings(sortedPaths)

	println("Sorted Paths", sortedPaths)

	for _, absolutePath := range sortedPaths {
		hash := index.Entries[absolutePath]

		relativePath, err := filepath.Rel(repoRoot, absolutePath)
		if err != nil {
			continue
		}

		println("Relative Path", relativePath)

		// Use forward slashes for consistency
		relativePath = filepath.ToSlash(relativePath)

		// Add file entry with relative path as name
		rootTree.Entries = append(rootTree.Entries, TreeEntry{
			Name: relativePath,
			Hash: hash,
		})
	}

	sort.Slice(rootTree.Entries, func(i, j int) bool {
		return rootTree.Entries[i].Name < rootTree.Entries[j].Name
	})

	println("Root Tree", rootTree)

	return storeTree(rootTree)
}

func buildEmptyTree() (string, error) {
	emptyTree := &Tree{Entries: make([]TreeEntry, 0)}
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
