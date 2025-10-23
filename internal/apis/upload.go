package apis

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/utils"
)

func UploadFile(remote string, hash string) (string, error) {
	filePath := filepath.Join(".hit", "objects", hash[:2], hash[2:])
	file, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	token := utils.GetSession().Token

	url := fmt.Sprintf(utils.BACKEND_URL+"/api/v1/repo/signed-url/%s?remote=%s", hash, remote)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Terminal %s", token))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("API request failed with status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var signedUploadUrlApiBody go_types.SignedUploadUrlApiBody
	err = json.Unmarshal(body, &signedUploadUrlApiBody)
	if err != nil {
		return "", err
	}

	if !signedUploadUrlApiBody.Success {
		return "", fmt.Errorf("API request failed: %s", signedUploadUrlApiBody.Message)
	}

	if signedUploadUrlApiBody.Data.Exists {
		return signedUploadUrlApiBody.Data.PublicUrl, nil
	}

	req, err = http.NewRequest("PUT", signedUploadUrlApiBody.Data.SignedUrl, bytes.NewReader(file))
	if err != nil {
		return "", err
	}

	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("API request failed with status %d", resp.StatusCode)
	}

	url = fmt.Sprintf(utils.BACKEND_URL+"/api/v1/repo/signed-url/%s/confirm?remote=%s", hash, remote)
	req, err = http.NewRequest("POST", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Terminal %s", token))
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	return signedUploadUrlApiBody.Data.PublicUrl, nil
}

func UploadAllFiles(remote string) error {
	filePath := filepath.Join(".hit", "objects")
	hashRootEntries, err := os.ReadDir(filePath)
	if err != nil {
		fmt.Println("Error reading .hit/objects:", err)
		return err
	}

	fileChan := make(chan string)

	numWorkers := runtime.NumCPU() * 2
	if numWorkers < 4 {
		numWorkers = 4
	}

	var wg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for hash := range fileChan {
				_, err := UploadFile(remote, hash)
				if err != nil {
					os.Exit(1)
				}
			}
		}(i + 1)
	}

	go func() {
		defer close(fileChan)
		for _, entry := range hashRootEntries {
			path := filepath.Join(filePath, entry.Name())
			hashEntries, err := os.ReadDir(path)
			if err != nil {
				fmt.Println("Error reading subdir:", path, err)
				continue
			}
			for _, hashEntry := range hashEntries {
				fullHash := entry.Name() + hashEntry.Name()
				fileChan <- fullHash
			}
		}
	}()

	wg.Wait()
	return err
}
