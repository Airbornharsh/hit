package cmd

import (
	"fmt"

	"github.com/airbornharsh/hit/internal/repo"

	"github.com/spf13/cobra"
)

var remoteCmd = &cobra.Command{
	Use:   "remote",
	Short: "Manage remote repositories",
	Long:  `Manage remote repositories. Use 'hit remote add <name> <url>' to add a remote, 'hit remote remove <name>' to remove a remote, or 'hit remote' to list all remotes.`,
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 0 {
			if err := repo.ListRemotes(); err != nil {
				fmt.Printf("Error: %v\n", err)
				return
			}
			return
		}

		switch args[0] {
		case "add":
			if len(args) < 3 {
				fmt.Println("Usage: hit remote add <name> <url>")
				return
			}
			if err := repo.AddRemote(args[1], args[2]); err != nil {
				fmt.Printf("Error: %v\n", err)
				return
			}
			fmt.Printf("Remote '%s' added successfully\n", args[1])

		case "remove":
			if len(args) < 2 {
				fmt.Println("Usage: hit remote remove <name>")
				return
			}
			if err := repo.RemoveRemote(args[1]); err != nil {
				fmt.Printf("Error: %v\n", err)
				return
			}
			fmt.Printf("Remote '%s' removed successfully\n", args[1])

		default:
			fmt.Printf("Unknown subcommand: %s\n", args[0])
			fmt.Println("Available subcommands: add, remove")
		}
	},
}

func init() {
	rootCmd.AddCommand(remoteCmd)
}
