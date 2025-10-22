package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/storage"
	"github.com/airbornharsh/hit/utils"
)

func DiffWorkingVsIndex() {
	repoRoot, err := utils.FindRepoRoot()
	if err != nil {
		fmt.Println("Not a hit repository")
		return
	}

	indexPath := filepath.Join(repoRoot, ".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}
	if data, err := os.ReadFile(indexPath); err == nil {
		_ = json.Unmarshal(data, index)
	}

	ignoreMatcher, err := NewIgnoreMatcher(repoRoot)
	if err != nil {
		ignoreMatcher = &IgnoreMatcher{rules: []IgnoreRule{}}
	}

	working := make(map[string]string)

	var walk func(dir string)
	walk = func(dir string) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return
		}
		for _, entry := range entries {
			p := filepath.Join(dir, entry.Name())
			if entry.IsDir() {
				if strings.HasSuffix(p, ".hit") {
					continue
				}
				walk(p)
				continue
			}
			rel, err := filepath.Rel(repoRoot, p)
			if err != nil {
				continue
			}
			relSlash := filepath.ToSlash(rel)

			if ignoreMatcher.ShouldIgnore(relSlash, false) {
				continue
			}

			// hash file content
			content, err := os.ReadFile(p)
			if err != nil {
				continue
			}
			working[relSlash] = storage.Hash(content)
		}
	}
	walk(repoRoot)

	added := []string{}
	deleted := []string{}
	modified := []string{}

	for rel, whash := range working {
		if ihash, ok := index.Entries[rel]; !ok {
			added = append(added, rel)
		} else if ihash != whash {
			modified = append(modified, rel)
		}
	}

	for rel := range index.Entries {
		if _, ok := working[rel]; !ok {
			deleted = append(deleted, rel)
		}
	}

	printDiffResult("unstaged", added, deleted, modified)
}

func DiffIndexVsHead() {
	repoRoot, err := utils.FindRepoRoot()
	if err != nil {
		fmt.Println("Not a hit repository")
		return
	}

	indexPath := filepath.Join(repoRoot, ".hit", "index.json")
	index := &go_types.Index{Entries: make(map[string]string)}
	if data, err := os.ReadFile(indexPath); err == nil {
		_ = json.Unmarshal(data, index)
	}

	headHash, _ := utils.GetHeadHash()
	headEntries := make(map[string]string)
	if headHash != "" && headHash != "0000000000000000000000000000000000000000" {
		obj, err := storage.LoadObject(headHash)
		if err == nil {
			var tree go_types.Tree
			if err := json.Unmarshal([]byte(obj), &tree); err == nil {
				for rel, h := range tree.Entries {
					headEntries[filepath.ToSlash(rel)] = h
				}
			}
		}
	}

	added := []string{}
	deleted := []string{}
	modified := []string{}

	if len(headEntries) == 0 {
		for rel := range index.Entries {
			added = append(added, rel)
		}
		printDiffResult("staged", added, deleted, modified)
		return
	}

	for rel, ihash := range index.Entries {
		if hhash, ok := headEntries[rel]; !ok {
			added = append(added, rel)
		} else if ihash != hhash {
			modified = append(modified, rel)
		}
	}
	for rel := range headEntries {
		if _, ok := index.Entries[rel]; !ok {
			deleted = append(deleted, rel)
		}
	}

	printDiffResult("staged", added, deleted, modified)
}

func printDiffResult(scope string, added, deleted, modified []string) {
	fmt.Printf("Changes (%s):\n", scope)
	fmt.Println("Added:")
	if len(added) == 0 {
		fmt.Println("  (none)")
	} else {
		for _, f := range added {
			fmt.Printf("  + %s\n", f)
		}
	}

	fmt.Println("\nDeleted:")
	if len(deleted) == 0 {
		fmt.Println("  (none)")
	} else {
		for _, f := range deleted {
			fmt.Printf("  - %s\n", f)
		}
	}

	fmt.Println("\nModified:")
	if len(modified) == 0 {
		fmt.Println("  (none)")
	} else {
		for _, f := range modified {

			fmt.Printf("  ~ %s\n", f)
		}
	}
}
