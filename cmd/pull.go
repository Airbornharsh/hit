package cmd

import (
	"fmt"
	"os"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/airbornharsh/hit/utils"
	"github.com/spf13/cobra"
)

var pullCmd = &cobra.Command{
	Use:   "pull [remote] [branch]",
	Short: "Fetch and merge changes from a remote repository",
	Long: `Pull fetches changes from a remote repository and merges them into the current branch.
This is equivalent to running 'hit fetch' followed by 'hit merge'.
	
Examples:
  hit pull origin main       # Pull and merge origin/main
  hit pull origin           # Pull and merge origin/current-branch
  hit pull                  # Pull from default remote`,
	Args: cobra.MaximumNArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		targetBranch, _ := utils.GetBranch()
		remoteName := "origin"
		if len(args) == 1 {
			remoteName = args[0]
		} else if len(args) == 2 {
			remoteName = args[0]
			targetBranch = args[1]
		} else {
			if targetBranch == "" {
				fmt.Println("Error: No branch name provided")
				os.Exit(1)
			}
		}

		err := repo.PullRemote(remoteName, targetBranch)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Successfully pulled from remote '%s'\n", remoteName)
	},
}

func init() {
	rootCmd.AddCommand(pullCmd)
}
