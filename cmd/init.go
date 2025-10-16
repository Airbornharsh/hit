package cmd

import (
	"fmt"

	"github.com/airbornharsh/hit/internal/repo"

	"github.com/spf13/cobra"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a new HIT repository",
	Run: func(cmd *cobra.Command, args []string) {
		err := repo.InitRepo()
		if err != nil {
			fmt.Println("Error:", err)
			return
		}
		fmt.Println("Initialized empty HIT repository in .hit/")
	},
}

func init() {
	rootCmd.AddCommand(initCmd)
}
