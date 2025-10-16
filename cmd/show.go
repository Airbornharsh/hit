package cmd

import (
	"github.com/airbornharsh/hit/internal/commit"
	"github.com/spf13/cobra"
)

var showCmd = &cobra.Command{
	Use:   "show [commit]",
	Short: "Show files for commit",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		for _, com := range args {
			commit.ShowCommit(com)
		}
	},
}

func init() {
	rootCmd.AddCommand(showCmd)
}
