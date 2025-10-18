package cmd

import (
	"github.com/airbornharsh/hit/internal/auth"
	"github.com/spf13/cobra"
)

var userCmd = &cobra.Command{
	Use:   "user",
	Short: "Get current user",
	Run: func(cmd *cobra.Command, args []string) {
		auth.User()
	},
}

func init() {
	rootCmd.AddCommand(userCmd)
}
