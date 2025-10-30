package commit

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/repo"
	"github.com/airbornharsh/hit/internal/storage"
)

func CreateCommit(message string) (string, error) {
	// Check for unresolved merge conflicts
	conflictResolution, err := repo.LoadConflictResolution()
	var remoteCommits []go_types.Commit

	if conflictResolution != nil {
		if err == nil && conflictResolution.HasUnresolvedConflicts() {
			unresolved := conflictResolution.GetUnresolvedConflicts()
			fmt.Println("unresolved", unresolved)
			var filePaths []string
			for _, conflict := range unresolved {
				filePaths = append(filePaths, conflict.FilePath)
			}
			return "", fmt.Errorf("cannot commit: unresolved merge conflicts in files: %v", filePaths)
		}

		if len(conflictResolution.RemoteCommits) > 0 {
			remoteCommits = append(remoteCommits, conflictResolution.RemoteCommits...)
		}
		if conflictResolution.Message != "" {
			message = conflictResolution.Message
		}
	}

	if message == "" {
		return "", fmt.Errorf("cannot commit: no message provided")
	}

	stagedTreeHash, err := repo.BuildTreeFromStage()
	if err != nil {
		return "", err
	}

	currentBranch, err := storage.GetBranch()
	if err != nil {
		return "", err
	}

	// Check if we're in a merge state and use parent/otherParent from conflicts.json
	var parent, otherParent string
	if repo.IsInMergeState() {
		parent, otherParent, err = repo.GetMergeParents()
		if err != nil {
			return "", fmt.Errorf("failed to get merge parents: %v", err)
		}
	} else {
		// Normal commit - get parent from current branch
		parentFilePath := filepath.Join(".hit", "refs", "heads", currentBranch)
		parentFile, _ := os.ReadFile(parentFilePath)
		parent = strings.TrimSpace(string(parentFile))
		otherParent = "" // No other parent for normal commits
	}

	parentLogFilePath := filepath.Join(".hit", "logs", "refs", "heads", currentBranch)

	commit := go_types.Commit{
		Hash:        stagedTreeHash,
		Parent:      parent,
		OtherParent: otherParent,
		Message:     message,
		Author:      os.Getenv("USER"),
		Timestamp:   time.Now(),
	}

	var commits []go_types.Commit
	parentLogFile, _ := os.ReadFile(parentLogFilePath)
	json.Unmarshal(parentLogFile, &commits)

	commits = append(commits, commit)
	for _, remoteCommit := range remoteCommits {
		if remoteCommit.Hash == commit.Hash {
			continue
		}
		commits = append(commits, remoteCommit)
	}

	slices.SortFunc(commits, func(a, b go_types.Commit) int {
		if a.Timestamp.Before(b.Timestamp) {
			return -1
		} else if a.Timestamp.After(b.Timestamp) {
			return 1
		}
		return 0
	})

	commitsData, _ := json.Marshal(commits)

	err = os.WriteFile(parentLogFilePath, commitsData, 0644)
	if err != nil {
		return "", err
	}

	err = os.WriteFile(filepath.Join(".hit", "refs", "heads", currentBranch), []byte(stagedTreeHash), 0644)
	if err != nil {
		return "", err
	}

	// Clear conflict resolution if this was a merge commit
	if repo.IsInMergeState() {
		if err := repo.ClearConflictResolution(); err != nil {
			fmt.Printf("Warning: failed to clear conflict resolution: %v\n", err)
		}
	}

	return stagedTreeHash, nil
}

func LogCommits() {
	head, err := storage.GetHead()
	if err != nil {
		fmt.Println("Error getting HEAD:", err)
		return
	}

	logPath := filepath.Join(".hit", "logs", head)

	var commits []go_types.Commit
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

		fmt.Printf("commit %s\n", commit.Hash)
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

	var tree go_types.Tree
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

	var parentTree go_types.Tree
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

func ShowCommitExpanded(hash string) {
	commitData, err := storage.LoadObject(hash)
	if err != nil {
		fmt.Println("Error loading commit:", err)
		return
	}

	var tree go_types.Tree
	if err := json.Unmarshal([]byte(commitData), &tree); err != nil {
		fmt.Println("Error parsing tree:", err)
		return
	}

	if tree.Parent == "" || tree.Parent == "0000000000000000000000000000000000000000" {
		if len(tree.Entries) == 0 {
			fmt.Println("(no files)")
			return
		}
		for fileName, fileHash := range tree.Entries {
			fmt.Printf("diff -- %s (added)\n", fileName)
			diff := storage.GetDifference("", fileHash)
			if diff == "" {
				fmt.Println("(no content)")
			} else {
				fmt.Println(diff)
			}
		}
		return
	}

	parentCommitData, err := storage.LoadObject(tree.Parent)
	if err != nil {
		fmt.Println("Error loading parent commit:", err)
		return
	}

	var parentTree go_types.Tree
	if err := json.Unmarshal([]byte(parentCommitData), &parentTree); err != nil {
		fmt.Println("Error parsing parent tree:", err)
		return
	}

	printed := false
	for fileName, fileHash := range tree.Entries {
		parentHash, ok := parentTree.Entries[fileName]
		if !ok {
			// Added file
			fmt.Printf("diff -- %s (added)\n", fileName)
			diff := storage.GetDifference("", fileHash)
			if diff != "" {
				fmt.Println(diff)
			}
			printed = true
		} else if parentHash != fileHash {
			// Modified file
			diff := storage.GetDifference(parentHash, fileHash)
			if diff != "" {
				fmt.Printf("diff -- %s (modified)\n", fileName)
				fmt.Println(diff)
				printed = true
			}
		}
	}
	for fileName, parentHash := range parentTree.Entries {
		if _, ok := tree.Entries[fileName]; !ok {
			// Deleted file
			fmt.Printf("diff -- %s (deleted)\n", fileName)
			diff := storage.GetDifference(parentHash, "")
			if diff != "" {
				fmt.Println(diff)
			}
			printed = true
		}
	}
	if !printed {
		fmt.Println("(no changes)")
	}
}
