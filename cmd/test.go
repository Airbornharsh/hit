package cmd

import (
	"github.com/airbornharsh/hit/internal/storage"

	"github.com/spf13/cobra"
)

var testCmd = &cobra.Command{
	Use:   "test [hash]",
	Short: "Testing Comand",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		for _, hash := range args {
			num, err := storage.LoadObject(hash)
			println(num, err)
		}
	},
}

func init() {
	rootCmd.AddCommand(testCmd)
}
