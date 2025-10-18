package cmd

import (
	"github.com/airbornharsh/hit/internal/auth"
	"github.com/spf13/cobra"
)

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Logout of Hit",
	Run: func(cmd *cobra.Command, args []string) {
		auth.Logout()
	},
}

func init() {
	rootCmd.AddCommand(logoutCmd)
}
