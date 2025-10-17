package commit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/airbornharsh/hit/internal/storage"
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

	commitsData, _ := json.Marshal(commits)

	err = os.WriteFile(parentLogFilePath, commitsData, 0644)
	if err != nil {
		return "", err
	}

	err = os.WriteFile(".hit/refs/heads/master", []byte(stagedTreeHash), 0644)
	if err != nil {
		return "", err
	}

	return stagedTreeHash, nil
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

		fmt.Printf("commit %s\n", commit.Tree)
		fmt.Printf("Author: %s\n", commit.Author)
		fmt.Printf("Date:   %s\n", commit.Timestamp.Format("Mon Jan 2 15:04:05 2006 -0700"))
		fmt.Printf("\n    %s\n\n", commit.Message)
	}
}

func ShowCommit(hash string) {
	commitData, err := storage.LoadObject(hash)
	if err != nil {
		fmt.Println("Error loading commit:", err)
		return
	}

	var tree repo.Tree
	if err := json.Unmarshal([]byte(commitData), &tree); err != nil {
		fmt.Println("Error parsing tree:", err)
		return
	}

	// Check if this is the initial commit (no parent)
	if tree.Parent == "" || tree.Parent == "0000000000000000000000000000000000000000" {
		fmt.Println("Initial commit - all files:")
		if len(tree.Entries) == 0 {
			fmt.Println("  (no files)")
		} else {
			for fileName := range tree.Entries {
				fmt.Printf("  + %s\n", fileName)
			}
		}
		return
	}

	parentCommitData, err := storage.LoadObject(tree.Parent)
	if err != nil {
		fmt.Println("Error loading parent commit:", err)
		return
	}

	var parentTree repo.Tree
	if err := json.Unmarshal([]byte(parentCommitData), &parentTree); err != nil {
		fmt.Println("Error parsing parent tree:", err)
		return
	}

	// Create sets of file names for comparison
	currentFiles := make(map[string]bool)
	parentFiles := make(map[string]bool)

	for fileName := range tree.Entries {
		currentFiles[fileName] = true
	}

	for fileName := range parentTree.Entries {
		parentFiles[fileName] = true
	}

	// Find added files (in current but not in parent)
	fmt.Println("Added files:")
	added := false
	for fileName := range currentFiles {
		if !parentFiles[fileName] {
			fmt.Printf("  + %s\n", fileName)
			added = true
		}
	}
	if !added {
		fmt.Println("  (none)")
	}

	// Find deleted files (in parent but not in current)
	fmt.Println("\nDeleted files:")
	deleted := false
	for fileName := range parentFiles {
		if !currentFiles[fileName] {
			fmt.Printf("  - %s\n", fileName)
			deleted = true
		}
	}
	if !deleted {
		fmt.Println("  (none)")
	}

	// Find modified files (in both but with different hashes)
	fmt.Println("\nModified files:")
	modified := false
	for fileName, fileHash := range tree.Entries {
		if parentFiles[fileName] {
			parentFileHash := parentTree.Entries[fileName]
			if parentFileHash != fileHash {
				fmt.Printf("  ~ %s\n", fileName)
				modified = true
			}
		}
	}
	if !modified {
		fmt.Println("  (none)")
	}
}
