package cmd

import (
	"fmt"
	"os"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/airbornharsh/hit/internal/storage"

	"github.com/spf13/cobra"
)

var pushCmd = &cobra.Command{
	Use:   "push",
	Short: "Push commits to a remote repository",
	Long:  `Push commits to a remote repository. Use 'hit push' to push the current branch to origin, 'hit push [branch]' to push a specific branch to origin, or 'hit push -u [REMOTENAME] [BRANCH]' to push and set upstream tracking.`,
	Run: func(cmd *cobra.Command, args []string) {
		if _, err := os.Stat(".hit"); os.IsNotExist(err) {
			fmt.Println("Error: Not a HIT repository")
			return
		}

		var remoteName, branchName string

		if len(args) == 0 {
			// hit push - no args: use origin and current branch
			remoteName = "origin"
			branchName = ""
		} else if len(args) >= 1 && args[0] == "-u" {
			if len(args) < 3 {
				fmt.Println("Usage: hit push -u [REMOTENAME] [BRANCH]")
				return
			}
			remoteName = args[1]
			branchName = args[2]
		} else if len(args) == 1 {
			// hit push [BRANCH] - use origin remote
			remoteName = "origin"
			branchName = args[0]
		} else {
			fmt.Println("Usage: hit push | hit push [branch] | hit push -u [REMOTENAME] [BRANCH]")
			return
		}

		if branchName == "" {
			currentBranch, err := storage.GetBranch()
			if err != nil {
				fmt.Printf("Error getting current branch: %v\n", err)
				return
			}
			branchName = currentBranch
		}

		fmt.Println("Remote Name", remoteName)
		fmt.Println("Branch Name", branchName)

		if err := repo.Push(remoteName, branchName); err != nil {
			fmt.Printf("Error: %v\n", err)
			return
		}

		fmt.Println("Pushed commits to remote repository")
	},
}

func init() {
	rootCmd.AddCommand(pushCmd)
}
