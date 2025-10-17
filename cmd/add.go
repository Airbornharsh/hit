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
				repo.AddAllFile(filePath)
			} else {
				// Check if it's a directory
				if info, err := os.Stat(file); err == nil && info.IsDir() {
					repo.AddAllFile(filePath)
				} else {
					// Try to add the file (AddFile will handle non-existent files)
					_, err := repo.AddFile(filePath)
					if err != nil {
						// Don't print error for non-existent files as AddFile already handles it
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
