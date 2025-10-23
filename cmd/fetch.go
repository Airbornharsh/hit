package cmd

import (
	"fmt"
	"os"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var fetchCmd = &cobra.Command{
	Use:   "fetch [remote]",
	Short: "Download objects and refs from a remote repository",
	Long: `Fetch downloads objects and refs from a remote repository.
	
Examples:
  hit fetch origin        # Fetch from origin remote
  hit fetch               # Fetch from default remote`,
	Args: cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		remoteName := "origin"
		if len(args) > 0 {
			remoteName = args[0]
		}

		err := repo.FetchRemote(remoteName)
		if err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Successfully fetched from remote '%s'\n", remoteName)
	},
}

func init() {
	rootCmd.AddCommand(fetchCmd)
}
