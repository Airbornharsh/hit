package cmd

import (
	"fmt"
	"os"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/airbornharsh/hit/internal/storage"
	"github.com/spf13/cobra"
)

var mergeCmd = &cobra.Command{
	Use:   "merge [remote] [branch]",
	Short: "Merge changes from another branch",
	Long: `Merge changes from another branch into the current branch.
	
Examples:
  hit merge origin main       # Merge remote main branch`,
	Args: cobra.MaximumNArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		targetBranch, _ := storage.GetBranch()
		remoteName := "origin"
		currentBranch := targetBranch
		if len(args) == 1 {
			remoteName = args[0]
		} else if len(args) == 2 {
			remoteName = args[0]
			targetBranch = args[1]
		}

		fmt.Println("Current Branch", currentBranch)
		fmt.Println("Target Branch", targetBranch)
		fmt.Println("Remote Name", remoteName)

		err := repo.MergeBranch(currentBranch, targetBranch, remoteName)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Successfully merged '%s' into current branch\n", targetBranch)
	},
}

func init() {
	rootCmd.AddCommand(mergeCmd)
}
