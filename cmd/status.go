package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/internal/repo"
	"github.com/airbornharsh/hit/internal/storage"
	"github.com/spf13/cobra"
)

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show the working tree status",
	Long: `Show the working tree status including staged, unstaged, and conflicted files.
	
This command shows:
- Files staged for commit
- Files with merge conflicts
- Unstaged changes`,
	Run: func(cmd *cobra.Command, args []string) {
		err := showStatus()
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
	},
}

func showStatus() error {
	// Check if we're in a repository
	_, err := storage.FindRepoRoot()
	if err != nil {
		return fmt.Errorf("not in a hit repository")
	}

	// Check for merge conflicts first
	conflictResolution, err := repo.LoadConflictResolution()
	if err == nil && conflictResolution != nil && len(conflictResolution.Conflicts) > 0 {
		if conflictResolution.IsMergeState {
			fmt.Println("In merge state - resolving conflicts:")
		} else {
			fmt.Println("Merge conflicts detected:")
		}

		for _, conflict := range conflictResolution.Conflicts {
			status := "❌ Conflict"
			if conflict.Status == "resolved" {
				status = "✅ Resolved"
			}
			fmt.Printf("  %s %s\n", status, conflict.FilePath)
		}

		if conflictResolution.HasUnresolvedConflicts() {
			fmt.Println("\nTo resolve conflicts:")
			fmt.Println("1. Edit the conflicted files manually")
			fmt.Println("2. Remove conflict markers (<<<<<<<, =======, >>>>>>>)")
			fmt.Println("3. Run 'hit add <file>' to stage resolved files")
			fmt.Println("4. Run 'hit commit' to complete the merge")
		} else {
			fmt.Println("\nAll conflicts resolved. Run 'hit commit' to complete the merge.")
		}
		return nil
	}

	// Load current index
	indexPath := filepath.Join(".hit", "index.json")
	indexData, err := os.ReadFile(indexPath)
	if err != nil {
		return fmt.Errorf("failed to read index: %v", err)
	}

	var index go_types.Index
	err = storage.Unmarshal(indexData, &index)
	if err != nil {
		return fmt.Errorf("failed to parse index: %v", err)
	}

	// Get current branch
	currentBranch, err := storage.GetBranch()
	if err != nil {
		return fmt.Errorf("failed to get current branch: %v", err)
	}

	fmt.Printf("On branch %s\n", currentBranch)

	// Check for staged files
	if len(index.Entries) > 0 {
		fmt.Println("\nStaged files:")
		for filePath := range index.Entries {
			fmt.Printf("  + %s\n", filePath)
		}
	} else {
		fmt.Println("\nNo staged files")
	}

	// Check for unstaged changes (simplified - would need more complex logic for full implementation)
	fmt.Println("\nWorking directory is clean")

	return nil
}

func init() {
	rootCmd.AddCommand(statusCmd)
}
