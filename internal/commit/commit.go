package commit

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/airbornharsh/hit/utils"
)

type Commit struct {
	Tree      string    `json:"tree"`
	Parent    string    `json:"parent"`
	Message   string    `json:"message"`
	Author    string    `json:"author"`
	Timestamp time.Time `json:"timestamp"`
}

const (
	parentFilePath    = ".hit/refs/heads/master"
	parentLogFilePath = ".hit/logs/refs/heads/master"
)

func CreateCommit(message string) (string, error) {
	stagedTreeHash, err := repo.BuildTreeFromStage()
	if err != nil {
		return "", err
	}

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

func LogCommits() {
	head, err := utils.GetHead()
	if err != nil {
		fmt.Println("Error getting HEAD:", err)
		return
	}

	logPath := filepath.Join(".hit", "logs", head)

	var commits []Commit
	logFile, err := os.ReadFile(logPath)
	if err != nil {
		fmt.Println("No commits found")
		return
	}

	if err := json.Unmarshal(logFile, &commits); err != nil {
		fmt.Println("Error parsing commit log:", err)
		return
	}

	if len(commits) == 0 {
		fmt.Println("No commits found")
		return
	}

	fmt.Printf("Found %d commit(s)\n\n", len(commits))

	// Display commits in chronological order (oldest first)
	for i := 0; i < len(commits); i++ {
		commit := commits[i]
		hash := calculateCommitHash(commit)

		fmt.Printf("commit %s\n", hash)
		fmt.Printf("Author: %s\n", commit.Author)
		fmt.Printf("Date:   %s\n", commit.Timestamp.Format("Mon Jan 2 15:04:05 2006 -0700"))
		fmt.Printf("\n    %s\n\n", commit.Message)
	}
}

// calculateCommitHash calculates the hash for a commit (same logic as CreateCommit)
func calculateCommitHash(commit Commit) string {
	data, _ := json.Marshal(commit)
	hashBytes := sha1.Sum(data)
	return hex.EncodeToString(hashBytes[:])
}
