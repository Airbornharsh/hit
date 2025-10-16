package commit

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"time"

	"github.com/airbornharsh/hit/internal/repo"
)

type Commit struct {
	Tree      string    `json:"tree"`
	Parent    string    `json:"parent"`
	Message   string    `json:"message"`
	Author    string    `json:"author"`
	Timestamp time.Time `json:"timestamp"`
}

func CreateCommit(message string) (string, error) {
	stagedTreeHash, err := repo.BuildTreeFromStage()
	if err != nil {
		return "", err
	}

	parentFilePath := ".hit/refs/heads/master"
	parentLogFilePath := ".hit/logs/refs/heads/master"

	parentFile, _ := os.ReadFile(parentFilePath)
	parentLogFile, _ := os.ReadFile(parentLogFilePath)

	commit := Commit{
		Tree:      stagedTreeHash,
		Parent:    string(parentFile),
		Message:   message,
		Author:    os.Getenv("USER"),
		Timestamp: time.Now(),
	}

	var commits []Commit

	json.Unmarshal(parentLogFile, &commits)

	commits = append(commits, commit)

	data, _ := json.Marshal(commit)
	commitsData, _ := json.Marshal(commits)
	hashBytes := sha1.Sum(data)
	hash := hex.EncodeToString(hashBytes[:])

	objectPath := filepath.Join(".hit", "objects", hash[:2])
	os.MkdirAll(objectPath, 0755)
	err = os.WriteFile(filepath.Join(objectPath, hash[2:]), data, 0644)
	if err != nil {
		return "", err
	}

	err = os.WriteFile(parentLogFilePath, commitsData, 0644)
	if err != nil {
		return "", err
	}

	err = os.WriteFile(".hit/refs/heads/master", []byte(hash), 0644)
	if err != nil {
		return "", err
	}

	return hash, nil
}
