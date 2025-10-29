package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/airbornharsh/hit/internal/repo"
	"github.com/spf13/cobra"
)

var revertCmd = &cobra.Command{
	Use:   "revert [file]",
	Short: "Revert file(s) to last commit state",
	Args:  cobra.MinimumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		for _, file := range args {
			pwd, err := os.Getwd()
			if err != nil {
				continue
			}
			filePath := filepath.Join(pwd, file)

			if file == "." {
				repo.RevertAllFile(filePath)
			} else {
				if info, err := os.Stat(file); err == nil && info.IsDir() {
					repo.RevertAllFile(filePath)
				} else {
					if repo.CheckFileForConflicts(file) {
						fmt.Printf("Cannot revert file %s: has unresolved merge conflicts\n", file)
						continue
					}

					_, err := repo.RevertFile(filePath)
					if err != nil {
						if !strings.Contains(err.Error(), "file does not exist") {
							fmt.Printf("Error reverting file %s: %v\n", file, err)
						}
						continue
					}

					conflictResolution, err := repo.LoadConflictResolution()
					if err == nil && conflictResolution != nil {
						conflictResolution.MarkResolved(file)
						conflictResolution.SaveConflictResolution()
					}
				}
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(revertCmd)
}
