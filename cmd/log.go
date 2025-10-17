package cmd

import (
	"github.com/airbornharsh/hit/internal/commit"
	"github.com/spf13/cobra"
)

var logCmd = &cobra.Command{
	Use:   "log",
	Short: "Show Commits",
	Run: func(cmd *cobra.Command, args []string) {
		commit.LogCommits()
	},
}

func init() {
	rootCmd.AddCommand(logCmd)
}
