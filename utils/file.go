package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/go_types"
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

func GetBranch() (string, error) {
	location, err := GetHead()
	if err != nil {
		return "", err
	}

	segements := strings.Split(location, "/")
	return segements[len(segements)-1], nil
}

func GetCurrentCommit(branch string) (string, error) {
	filePath := filepath.Join(".hit", "refs", "heads", branch)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return "", fmt.Errorf("branch %s does not exist", branch)
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func GetConfig() (*go_types.RemoteConfig, error) {
	filePath := filepath.Join(".hit", "config")
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file does not exist")
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var config go_types.RemoteConfig
	err = json.Unmarshal(data, &config)
	if err != nil {
		return nil, err
	}

	return &config, nil
}
