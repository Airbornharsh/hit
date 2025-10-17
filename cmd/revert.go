package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var resetCmd = &cobra.Command{
	Use:   "reset [file]",
	Short: "Reset file(s) from staging area",
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
				repo.ResetAllFile(filePath)
			} else {
				if _, err := os.Stat(file); os.IsNotExist(err) {
					fmt.Printf("File does not exist: %s\n", file)
					continue
				}
				hash, err := repo.ResetFile(filePath)
				if err != nil {
					fmt.Printf("Error resetting file %s: %v\n", file, err)
					continue
				}
				fmt.Printf("Reseted %s as %s\n", file, hash)
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(resetCmd)
}
