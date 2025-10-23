package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/airbornharsh/hit/internal/apis"
	"github.com/airbornharsh/hit/internal/storage"
)

func FetchRemote(remoteName string) error {
	remoteURL, err := GetRemoteURL(remoteName)
	if err != nil {
		return fmt.Errorf("failed to get remote URL: %v", err)
	}

	fmt.Printf("Fetching from remote '%s' (%s)\n", remoteName, remoteURL)

	cloneData, err := apis.CloneRepositoryData(remoteURL)
	if err != nil {
		return fmt.Errorf("failed to fetch repository data: %v", err)
	}

	err = createRemoteTrackingDirs(remoteName)
	if err != nil {
		return fmt.Errorf("failed to create remote tracking directories: %v", err)
	}

	err = fetchRemoteBranches(remoteName, cloneData.Data.Branches)
	if err != nil {
		return fmt.Errorf("failed to fetch remote branches: %v", err)
	}

	err = fetchRemoteObjects(cloneData.Data.Hashes)
	if err != nil {
		return fmt.Errorf("failed to fetch remote objects: %v", err)
	}

	fmt.Printf("Fetched %d branches and %d objects from remote '%s'\n",
		len(cloneData.Data.Branches), len(cloneData.Data.Hashes), remoteName)

	return nil
}

func createRemoteTrackingDirs(remoteName string) error {
	dirs := []string{
		filepath.Join(".hit", "refs", "remotes", remoteName),
		filepath.Join(".hit", "logs", "refs", "remotes", remoteName),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
	}

	return nil
}

func fetchRemoteBranches(remoteName string, branches []struct {
	Name       string `json:"name"`
	HeadCommit string `json:"headCommit"`
	Commits    []struct {
		Hash      string `json:"hash"`
		Parent    string `json:"parent"`
		Message   string `json:"message"`
		Author    string `json:"author"`
		Timestamp string `json:"timestamp"`
	} `json:"commits"`
}) error {
	for _, branch := range branches {
		refPath := filepath.Join(".hit", "refs", "remotes", remoteName, branch.Name)
		err := os.WriteFile(refPath, []byte(branch.HeadCommit), 0644)
		if err != nil {
			return fmt.Errorf("failed to create remote ref for %s: %v", branch.Name, err)
		}

		logPath := filepath.Join(".hit", "logs", "refs", "remotes", remoteName, branch.Name)
		logData, err := json.Marshal(branch.Commits)
		if err != nil {
			return fmt.Errorf("failed to marshal commits for %s: %v", branch.Name, err)
		}
		err = os.WriteFile(logPath, logData, 0644)
		if err != nil {
			return fmt.Errorf("failed to create remote log for %s: %v", branch.Name, err)
		}
	}

	return nil
}

func fetchRemoteObjects(hashes []string) error {
	if len(hashes) == 0 {
		return nil
	}

	numCPUs := runtime.NumCPU()
	if numCPUs > len(hashes) {
		numCPUs = len(hashes)
	}

	chunkSize := (len(hashes) + numCPUs - 1) / numCPUs
	fmt.Printf("Fetching %d objects using %d CPUs with chunk size %d\n", len(hashes), numCPUs, chunkSize)

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
				err := fetchObjectFromRemote(hash)
				if err != nil {
					errChan <- fmt.Errorf("worker %d failed to fetch object %s: %v", workerID, hash, err)
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

func fetchObjectFromRemote(hash string) error {
	segment := hash[:2]
	fileName := hash[2:]
	filePath := filepath.Join(".hit", "objects", segment, fileName)

	if _, err := os.Stat(filePath); err == nil {
		return nil
	}

	objectData, err := storage.LoadObjectUrlCompressed(hash)
	if err != nil {
		return fmt.Errorf("failed to load object %s: %v", hash, err)
	}

	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %v", dir, err)
	}

	err = os.WriteFile(filePath, []byte(objectData), 0644)
	if err != nil {
		return fmt.Errorf("failed to write object %s: %v", hash, err)
	}

	return nil
}
