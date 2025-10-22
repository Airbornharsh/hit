package cmd

import (
	"fmt"
	"os"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var deleteBranch bool
var forceDelete bool

var branchCmd = &cobra.Command{
	Use:   "branch",
	Short: "List, create, or delete branches",
	Long: `Manage branches in your repository.

Examples:
  hit branch                    # List all branches
  hit branch -d <branch>       # Delete a branch (safe delete)
  hit branch -D <branch>       # Force delete a branch (unsafe delete)`,
	Run: func(cmd *cobra.Command, args []string) {
		if deleteBranch || forceDelete {
			if len(args) == 0 {
				fmt.Println("Error: Branch name required for deletion")
				os.Exit(1)
			}

			branchName := args[0]
			err := repo.DeleteBranch(branchName, forceDelete)
			if err != nil {
				fmt.Printf("Error: %v\n", err)
				os.Exit(1)
			}
		} else {
			err := repo.ListBranches()
			if err != nil {
				fmt.Printf("Error: %v\n", err)
				os.Exit(1)
			}
		}
	},
}

func init() {
	branchCmd.Flags().BoolVarP(&deleteBranch, "delete", "d", false, "Delete a branch")
	branchCmd.Flags().BoolVarP(&forceDelete, "force", "D", false, "Force delete a branch (unsafe)")
	rootCmd.AddCommand(branchCmd)
}
