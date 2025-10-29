package storage

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
			return "", fmt.Errorf("not in a hit repository")
		}
		dir = parent
	}
}

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

func GetHeadTree() (*go_types.Tree, error) {
	commitHash, err := GetHeadHash()
	if err != nil {
		return nil, err
	}

	commitEntriesData, err := LoadObject(commitHash)
	if err != nil {
		return nil, err
	}

	var tree go_types.Tree
	err = json.Unmarshal([]byte(commitEntriesData), &tree)
	if err != nil {
		return nil, err
	}

	return &tree, nil
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

func GetRemoteCommits(remoteName, branchName string) ([]go_types.Commit, error) {
	logRemotePath := filepath.Join(".hit", "logs", "refs", "remotes", remoteName, branchName)
	data, err := os.ReadFile(logRemotePath)
	if err != nil {
		return nil, err
	}

	var commits []go_types.Commit
	err = json.Unmarshal(data, &commits)
	if err != nil {
		return nil, err
	}

	return commits, nil
}

func GetHeadCommits(branchName string) ([]go_types.Commit, error) {
	logPath := filepath.Join(".hit", "logs", "refs", "heads", branchName)
	data, err := os.ReadFile(logPath)
	if err != nil {
		return nil, err
	}

	var commits []go_types.Commit
	err = json.Unmarshal(data, &commits)
	if err != nil {
		return nil, err
	}
	return commits, nil
}

func UpdateHeadCommits(branchName string, commits []go_types.Commit) error {
	logPath := filepath.Join(".hit", "logs", "refs", "heads", branchName)
	data, err := json.Marshal(commits)
	if err != nil {
		return err
	}

	err = os.WriteFile(logPath, data, 0644)
	if err != nil {
		return err
	}

	return nil
}

func UpdateHeadRef(branchName string, commitHash string) error {
	refPath := filepath.Join(".hit", "refs", "heads", branchName)
	err := os.WriteFile(refPath, []byte(commitHash), 0644)
	if err != nil {
		return err
	}

	return nil
}

func GetCommitTree(commitHash string) (*go_types.Tree, error) {
	if commitHash == "0000000000000000000000000000000000000000" {
		return &go_types.Tree{
			Entries: make(map[string]string),
			Parent:  "",
		}, nil
	}

	commitData, err := LoadObject(commitHash)
	if err != nil {
		return nil, err
	}

	var tree go_types.Tree
	err = json.Unmarshal([]byte(commitData), &tree)
	if err != nil {
		return nil, err
	}

	return &tree, nil
}

func GetCommitObject(branchName, commitHash string) (*go_types.Commit, error) {
	if commitHash == "0000000000000000000000000000000000000000" {
		return &go_types.Commit{
			Hash:   commitHash,
			Parent: "",
		}, nil
	}

	var commits []go_types.Commit
	logPath := filepath.Join(".hit", "logs", "refs", "heads", branchName)
	data, err := os.ReadFile(logPath)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, &commits)
	if err != nil {
		return nil, err
	}

	commitData, err := LoadObject(commitHash)
	if err != nil {
		return nil, err
	}

	var commit go_types.Commit
	err = json.Unmarshal([]byte(commitData), &commit)
	if err != nil {
		return nil, err
	}

	return &commit, nil
}

func GetRemoteCommitObject(remoteName, branchName, commitHash string) (*go_types.Commit, error) {
	if commitHash == "0000000000000000000000000000000000000000" {
		return &go_types.Commit{
			Hash:   commitHash,
			Parent: "",
		}, nil
	}

	var commits []go_types.Commit
	logPath := filepath.Join(".hit", "logs", "refs", "remotes", remoteName, branchName)
	data, err := os.ReadFile(logPath)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, &commits)
	if err != nil {
		return nil, err
	}

	commitData, err := LoadObject(commitHash)
	if err != nil {
		return nil, err
	}

	var commit go_types.Commit
	err = json.Unmarshal([]byte(commitData), &commit)
	if err != nil {
		return nil, err
	}

	return &commit, nil
}

func UpdateWorkingDirectoryAndIndexFromCommit(commitHash string) error {
	tree, err := GetCommitTree(commitHash)
	if err != nil {
		return err
	}

	index := &go_types.Index{
		Entries: tree.Entries,
		Changed: false,
	}

	indexPath := filepath.Join(".hit", "index.json")

	fmt.Println("\n\n", index)

	ignoreMatcher, err := GetIgnoreMatcher()
	if err != nil {
		repoRoot, err := FindRepoRoot()
		if err != nil {
			return err
		}
		ignoreMatcher, _ = NewIgnoreMatcher(repoRoot)
	}

	for filePath := range index.Entries {
		if _, exists := tree.Entries[filePath]; !exists {
			if !ignoreMatcher.ShouldIgnore(filePath, false) {
				if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
					return fmt.Errorf("failed to remove file %s: %v", filePath, err)
				}
			}
		}
	}

	for filePath, objectHash := range tree.Entries {
		if !ignoreMatcher.ShouldIgnore(filePath, false) {
			err := RestoreFileFromObject(filePath, objectHash)
			if err != nil {
				return fmt.Errorf("failed to restore file %s: %v", filePath, err)
			}
		}
	}

	newIndex := &go_types.Index{
		Entries: tree.Entries,
		Changed: false,
	}

	newIndexData, err := json.MarshalIndent(newIndex, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal new index: %v", err)
	}

	err = os.WriteFile(indexPath, newIndexData, 0644)
	if err != nil {
		return fmt.Errorf("failed to write new index: %v", err)
	}

	return nil
}

func RestoreFileFromObject(filePath, objectHash string) error {
	objectData, err := LoadObject(objectHash)
	if err != nil {
		return fmt.Errorf("failed to load object %s: %v", objectHash, err)
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %v", dir, err)
	}

	err = os.WriteFile(filePath, []byte(objectData), 0644)
	if err != nil {
		return fmt.Errorf("failed to write file %s: %v", filePath, err)
	}

	return nil
}

func GetFileContentFromHash(hash string) (string, error) {
	if hash == "" {
		return "", nil
	}

	content, err := LoadObject(hash)
	if err != nil {
		return "", err
	}

	return content, nil
}

func MarshalIndent(v interface{}, prefix, indent string) ([]byte, error) {
	return json.MarshalIndent(v, prefix, indent)
}

func Unmarshal(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}
