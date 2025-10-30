package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var addCmd = &cobra.Command{
	Use:   "add [file]",
	Short: "Add file(s) to staging area",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		for _, file := range args {
			pwd, err := os.Getwd()
			if err != nil {
				continue
			}
			filePath := filepath.Join(pwd, file)

			if file == "." {
				err := repo.AddAllFile(filePath)
				if err != nil {
					fmt.Printf("Error adding all files: %v\n", err)
					continue
				}
			} else {
				// Check if it's a directory
				if info, err := os.Stat(file); err == nil && info.IsDir() {
					err := repo.AddAllFile(filePath)
					if err != nil {
						fmt.Printf("Error adding all files: %v\n", err)
						continue
					}
				} else {
					_, err = repo.AddFile(filePath)
					if err != nil {
						if !strings.Contains(err.Error(), "file does not exist") {
							fmt.Printf("Error adding file %s: %v\n", file, err)
						}
						continue
					}
				}
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(addCmd)
}
