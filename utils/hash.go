package utils

import (
	"path/filepath"
)

func HashInfo(hash string) (string, string, string, error) {
	rootPath, err := FindRepoRoot()
	if err != nil {
		return "", "", "", err
	}

	segment := hash[0:2]
	fileName := hash[2:]

	filePath := filepath.Join(rootPath, ".hit", "objects", segment, fileName)

	return segment, fileName, filePath, nil
}
