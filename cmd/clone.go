package cmd

import (
	"fmt"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var cloneCmd = &cobra.Command{
	Use:   "clone",
	Short: "Clone a repository",
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			fmt.Println("Usage: hit clone <url>")
			return
		}
		err := repo.CloneRepository(args[0])
		if err != nil {
			fmt.Println("Failed to clone repository:", err)
			return
		}
	},
}

func init() {
	rootCmd.AddCommand(cloneCmd)
}
