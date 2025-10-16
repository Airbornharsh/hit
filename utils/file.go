package utils

import (
	"fmt"
	"os"
	"path/filepath"
)

func FindRepoRoot() (string, error) {
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
			// Reached filesystem root
			return "", fmt.Errorf("not in a hit repository")
		}
		dir = parent
	}
}
