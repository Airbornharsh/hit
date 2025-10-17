package cmd

import (
	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var staged bool

var diffCmd = &cobra.Command{
	Use:   "diff",
	Short: "Show changes between working tree, index and HEAD",
	Run: func(cmd *cobra.Command, args []string) {
		if staged {
			repo.DiffIndexVsHead()
		} else {
			repo.DiffWorkingVsIndex()
		}
	},
}

func init() {
	diffCmd.Flags().BoolVar(&staged, "staged", false, "Compare staged changes against HEAD")
	rootCmd.AddCommand(diffCmd)
}
