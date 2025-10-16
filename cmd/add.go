package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var addCmd = &cobra.Command{
	Use:   "add [file]",
	Short: "Add file(s) to staging area",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		for _, file := range args {
			info, _ := os.Stat(file)
			pwd, err := os.Getwd()
			if err != nil {
				continue
			}
			filePath := filepath.Join(pwd, file)
			if file == "." || info.IsDir() {
				repo.AddAllFile(filePath)
			} else {
				if _, err := os.Stat(file); os.IsNotExist(err) {
					fmt.Printf("File does not exist: %s\n", file)
					continue
				}
				_, err := repo.AddFile(filePath)
				if err != nil {
					fmt.Printf("Error adding file %s: %v\n", file, err)
					continue
				}
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(addCmd)
}
