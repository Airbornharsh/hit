package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/airbornharsh/hit/internal/apis"
	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/storage"
)

func CloneRepository(url string) error {
	println("Cloning repository from", url)

	part1 := strings.Split(url, "/")
	part2 := strings.Split(part1[len(part1)-1], ".")
	remoteName := part2[0]

	err := os.MkdirAll(filepath.Join(remoteName), 0755)
	if err != nil {
		return fmt.Errorf("failed to create directory %s: %v", remoteName, err)
	}
	err = os.Chdir(filepath.Join(remoteName))
	if err != nil {
		return fmt.Errorf("failed to change directory to %s: %v", remoteName, err)
	}

	if _, err := os.Stat(".hit"); !os.IsNotExist(err) {
		return fmt.Errorf("repository already exists")
	}

	dirs := []string{
		".hit",
		".hit/objects",
		".hit/refs/heads",
		".hit/logs/refs/heads",
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %v", dir, err)
		}
	}

	cloneRepositoryApiBody, err := apis.CloneRepositoryData(url)
	if err != nil {
		return fmt.Errorf("failed to clone repository: %v", err)
	}

	headFilePath := filepath.Join(".hit", "HEAD")
	headBranch := cloneRepositoryApiBody.Data.HeadBranch
	if headBranch == "" {
		headBranch = "master"
	}
	err = os.WriteFile(headFilePath, []byte(fmt.Sprintf("ref: refs/heads/%s\n", headBranch)), 0644)
	if err != nil {
		return fmt.Errorf("failed to create HEAD file: %v", err)
	}

	var headCommitHash string

	for _, branch := range cloneRepositoryApiBody.Data.Branches {
		refFilePath := filepath.Join(".hit", "refs", "heads", branch.Name)
		logFilePath := filepath.Join(".hit", "logs", "refs", "heads", branch.Name)

		if branch.Name == headBranch {
			headCommitHash = branch.HeadCommit
		}

		err = os.WriteFile(refFilePath, []byte(branch.HeadCommit), 0644)
		if err != nil {
			return fmt.Errorf("failed to create ref file for branch %s: %v", branch.Name, err)
		}

		logData, err := json.Marshal(branch.Commits)
		if err != nil {
			return fmt.Errorf("failed to marshal commits for branch %s: %v", branch.Name, err)
		}
		err = os.WriteFile(logFilePath, logData, 0644)
		if err != nil {
			return fmt.Errorf("failed to create log file for branch %s: %v", branch.Name, err)
		}
	}

	err = saveConfig(cloneRepositoryApiBody.Data.Config)
	if err != nil {
		return fmt.Errorf("failed to save config: %v", err)
	}

	headCommit, err := storage.LoadObjectUrl(headCommitHash)
	if err != nil {
		return fmt.Errorf("failed to load head commit: %v", err)
	}
	var headCommitData go_types.Tree
	err = json.Unmarshal([]byte(headCommit), &headCommitData)
	if err != nil {
		return fmt.Errorf("failed to unmarshal head commit: %v", err)
	}

	entries := make(map[string]string)
	for path, hash := range headCommitData.Entries {
		entries[filepath.ToSlash(path)] = hash
	}

	err = createIndexFromClone(entries)
	if err != nil {
		return fmt.Errorf("failed to create index: %v", err)
	}

	err = restoreObjectsFromHashes(cloneRepositoryApiBody.Data.Hashes)
	if err != nil {
		return fmt.Errorf("failed to restore objects: %v", err)
	}

	err = restoreFilesFromEntries(headCommitData.Entries)
	if err != nil {
		return fmt.Errorf("failed to restore files: %v", err)
	}

	return nil
}

func saveConfig(config map[string]any) error {
	filePath := filepath.Join(".hit", "config")

	if config == nil {
		config = map[string]any{
			"remotes": map[string]any{},
		}
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %v", err)
	}

	return os.WriteFile(filePath, data, 0644)
}

func createIndexFromClone(entries map[string]string) error {
	index := &go_types.Index{
		Entries: entries,
		Changed: false,
	}

	index.Changed = true

	indexFile := filepath.Join(".hit", "index.json")
	newData, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal index: %v", err)
	}

	if err := os.WriteFile(indexFile, newData, 0644); err != nil {
		return fmt.Errorf("failed to write index file: %v", err)
	}

	return nil
}

func restoreFilesFromEntries(entries map[string]string) error {
	type fileEntry struct {
		path string
		hash string
	}

	var files []fileEntry
	for path, hash := range entries {
		files = append(files, fileEntry{path: path, hash: hash})
	}

	numCPUs := runtime.NumCPU()
	if numCPUs > len(files) {
		numCPUs = len(files)
	}

	chunkSize := (len(files) + numCPUs - 1) / numCPUs

	var wg sync.WaitGroup
	errChan := make(chan error, numCPUs)

	for i := 0; i < numCPUs; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if end > len(files) {
			end = len(files)
		}
		if start >= len(files) {
			break
		}

		chunk := files[start:end]
		wg.Add(1)
		go func(chunk []fileEntry, workerID int) {
			defer wg.Done()

			for _, file := range chunk {
				err := storage.RestoreFileFromObject(file.path, file.hash)
				if err != nil {
					errChan <- fmt.Errorf("file worker %d failed to restore file %s: %v", workerID, file.path, err)
					return
				}
			}
		}(chunk, i)
	}

	go func() {
		wg.Wait()
		close(errChan)
	}()

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

func restoreObjectsFromHashes(hashes []string) error {
	numCPUs := runtime.NumCPU()
	if numCPUs > len(hashes) {
		numCPUs = len(hashes)
	}

	chunkSize := (len(hashes) + numCPUs - 1) / numCPUs

	var wg sync.WaitGroup
	errChan := make(chan error, numCPUs)

	for i := 0; i < numCPUs; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if end > len(hashes) {
			end = len(hashes)
		}
		if start >= len(hashes) {
			break
		}

		chunk := hashes[start:end]
		wg.Add(1)
		go func(chunk []string, workerID int) {
			defer wg.Done()

			for _, hash := range chunk {
				err := restoreObjectFromUrl(hash)
				if err != nil {
					errChan <- fmt.Errorf("worker %d failed to restore object %s: %v", workerID, hash, err)
					return
				}
			}
		}(chunk, i)
	}

	go func() {
		wg.Wait()
		close(errChan)
	}()

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

func restoreObjectFromUrl(hash string) error {
	objectData, err := storage.LoadObjectUrlCompressed(hash)
	if err != nil {
		return fmt.Errorf("failed to load object %s: %v", hash, err)
	}
	segment := hash[:2]
	fileName := hash[2:]
	filePath := filepath.Join(".hit", "objects", segment, fileName)
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %v", filepath.Dir(filePath), err)
	}
	return os.WriteFile(filePath, []byte(objectData), 0644)
}
