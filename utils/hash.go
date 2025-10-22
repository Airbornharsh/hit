package utils

import (
	"fmt"
	"path/filepath"
)

func HashInfo(hash string) (string, string, string, error) {
	if len(hash) < 2 {
		return "", "", "", fmt.Errorf("invalid hash: hash must be at least 2 characters long")
	}

	rootPath, err := FindRepoRoot()
	if err != nil {
		return "", "", "", err
	}

	segment := hash[0:2]
	fileName := hash[2:]

	filePath := filepath.Join(rootPath, ".hit", "objects", segment, fileName)

	return segment, fileName, filePath, nil
}
