package cmd

import (
	"github.com/airbornharsh/hit/internal/storage"

	"github.com/spf13/cobra"
)

var testCmd = &cobra.Command{
	Use:   "test",
	Short: "Testing Comand",
	Run: func(cmd *cobra.Command, args []string) {
		num, err := storage.LoadObject("a4cd450aef96a93e91629d6d7d39261cbb9fb931")
		println(num, err)
		println("Test Command")
	},
}

func init() {
	rootCmd.AddCommand(testCmd)
}
