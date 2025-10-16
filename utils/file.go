package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

func GetHead() (string, error) {
	headFilePath := filepath.Join(".hit", "HEAD")

	data, err := os.ReadFile(headFilePath)
	if err != nil {
		return "", err
	}
	location := strings.TrimSpace(strings.Split(string(data), "ref: ")[1])
	return location, nil
}

func GetHeadHash() (string, error) {
	location, err := GetHead()
	if err != nil {
		return "", nil
	}

	file, _ := os.ReadFile(filepath.Join(".hit", location))
	return string(file), nil
}
