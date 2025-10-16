package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "hit",
	Short: "hit - a fast, minimal version control system",
	Long:  `HIT is a lightweight version control system built in Go, inspired by Git.`,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
