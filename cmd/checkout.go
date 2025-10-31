package cmd

import (
	"fmt"
	"os"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var newBranch bool
var checkoutCmd = &cobra.Command{
	Use:   "checkout [branch]",
	Short: "Checkout a branch",
	Long: `Checkout a branch to switch to it or create a new branch.
	
Examples:
  hit checkout main          # Switch to the main branch
  hit checkout -b feature    # Create and switch to a new branch called 'feature'
  hit checkout -b feature <commit>  # Create 'feature' at the given commit and switch to it
  hit checkout --branch dev  # Create and switch to a new branch called 'dev'`,
	Args: cobra.RangeArgs(1, 2),
	Run: func(cmd *cobra.Command, args []string) {
		branch := args[0]

		if newBranch {
			if len(args) == 2 {
				commitHash := args[1]
				err := repo.CreateBranchAt(branch, commitHash)
				if err != nil {
					fmt.Printf("Error: Failed to create branch '%s' at %s: %v\n", branch, commitHash, err)
					os.Exit(1)
				}
				fmt.Printf("Switched to a new branch '%s' at %s\n", branch, commitHash)
			} else {
				err := repo.CreateBranch(branch)
				if err != nil {
					fmt.Printf("Error: Failed to create branch '%s': %v\n", branch, err)
					os.Exit(1)
				}
				fmt.Printf("Switched to a new branch '%s'\n", branch)
			}
		} else {
			err := repo.SwitchBranch(branch)
			if err != nil {
				fmt.Printf("Error: Failed to checkout branch '%s': %v\n", branch, err)
				os.Exit(1)
			}
			fmt.Printf("Switched to branch '%s'\n", branch)
		}
	},
}

func init() {
	checkoutCmd.Flags().BoolVarP(&newBranch, "branch", "b", false, "Create a new branch and checkout to it")
	rootCmd.AddCommand(checkoutCmd)
}
