package cmd

import (
	"github.com/airbornharsh/hit/internal/commit"
	"github.com/spf13/cobra"
)

var logsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Show Commits",
	Run: func(cmd *cobra.Command, args []string) {
		commit.LogCommits()
	},
}

func init() {
	rootCmd.AddCommand(logsCmd)
}
