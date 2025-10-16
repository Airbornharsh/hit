package repo

import (
	"fmt"
	"os"
	"path/filepath"
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
		".hit/refs",
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	// Create HEAD file
	headFile := filepath.Join(".hit", "HEAD")
	return os.WriteFile(headFile, []byte("ref: refs/heads/master\n"), 0644)
}
