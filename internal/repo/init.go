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
		".hit/refs/heads",
		".hit/logs/refs/heads",
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	// Create HEAD file
	headFilePath := filepath.Join(".hit", "HEAD")
	headRefFilePath := filepath.Join(".hit", "refs", "heads", "master")
	headLogRefFilePath := filepath.Join(".hit", "logs", "refs", "heads", "master")
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
	return err
}
