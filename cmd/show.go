package cmd

import (
	"github.com/airbornharsh/hit/internal/commit"
	"github.com/spf13/cobra"
)

var expand bool

var showCmd = &cobra.Command{
	Use:   "show [commit]",
	Short: "Show files for commit",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		for _, com := range args {
			if expand {
				commit.ShowCommitExpanded(com)
			} else {
				commit.ShowCommit(com)
			}
		}
	},
}

func init() {
	showCmd.Flags().BoolVarP(&expand, "expand", "e", false, "Show per-file diffs vs parent")
	rootCmd.AddCommand(showCmd)
}
