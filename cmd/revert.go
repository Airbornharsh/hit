package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var revertCmd = &cobra.Command{
	Use:   "revert [file]",
	Short: "Revert file(s) from staging area",
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
				repo.RemoveAllFile(filePath)
			} else {
				if _, err := os.Stat(file); os.IsNotExist(err) {
					fmt.Printf("File does not exist: %s\n", file)
					continue
				}
				hash, err := repo.RemoveFile(filePath)
				if err != nil {
					fmt.Printf("Error reverting file %s: %v\n", file, err)
					continue
				}
				fmt.Printf("Reverted %s as %s\n", file, hash)
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(revertCmd)
}
