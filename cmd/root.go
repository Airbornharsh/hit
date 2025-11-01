package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var Version string = "dev"

var rootCmd = &cobra.Command{
	Use:   "hit",
	Short: "hit - a fast, minimal version control system",
	Long:  `HIT is a lightweight version control system built in Go, inspired by Git.`,
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number of hit",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("hit version %s\n", Version)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		println(err)
		os.Exit(1)
	}
}
