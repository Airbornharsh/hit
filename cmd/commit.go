package cmd

import (
	"fmt"

	"github.com/airbornharsh/hit/internal/commit"

	"github.com/spf13/cobra"
)

var message string

var commitCmd = &cobra.Command{
	Use:   "commit",
	Short: "Record changes to the repository",
	Run: func(cmd *cobra.Command, args []string) {
		hash, err := commit.CreateCommit(message)
		if err != nil {
			println("Error creating commit:", err)
			return
		}

		fmt.Printf("[hit] Commit created: %s\n", hash)
	},
}

func init() {
	commitCmd.Flags().StringVarP(&message, "message", "m", "", "Commit message")
	rootCmd.AddCommand(commitCmd)
}
