package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/airbornharsh/hit/internal/extension"
	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/spf13/cobra"
)

type Input struct {
	Command      string `json:"command"`
	WorkspaceDir string `json:"workspaceDir,omitempty"`
}

var repoExtensionCmd = &cobra.Command{
	Use:    "repo-extension",
	Short:  "Get repository extension details",
	Hidden: true,
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "error: missing pipe arguments")
			os.Exit(1)
		}

		readPipe := args[0]
		writePipe := args[1]

		r, err := os.OpenFile(readPipe, os.O_RDONLY, os.ModeNamedPipe)
		if err != nil {
			fmt.Fprintln(os.Stderr, "error opening read pipe:", err)
			os.Exit(1)
		}
		defer r.Close()

		var input Input
		if err := json.NewDecoder(r).Decode(&input); err != nil {
			fmt.Fprintln(os.Stderr, "error decoding input:", err)
			os.Exit(1)
		}

		if input.WorkspaceDir != "" {
			fmt.Fprintf(os.Stderr, "Changing to workspace directory: %s\n", input.WorkspaceDir)
			if err := os.Chdir(input.WorkspaceDir); err != nil {
				output := go_types.Output{
					Success: false,
					Message: fmt.Sprintf("failed to change to workspace directory: %v", err),
				}
				w, err := os.OpenFile(writePipe, os.O_WRONLY, os.ModeNamedPipe)
				if err != nil {
					fmt.Fprintln(os.Stderr, "error opening write pipe:", err)
					os.Exit(1)
				}
				defer w.Close()
				json.NewEncoder(w).Encode(output)
				return
			}
			if cwd, err := os.Getwd(); err == nil {
				fmt.Fprintf(os.Stderr, "Current working directory: %s\n", cwd)
			}
		}

		var output go_types.Output
		commandParts := strings.Split(input.Command, " ")
		command := commandParts[0]
		switch command {
		case "status":
			output = extension.HandleStatusCommand()
		case "commit-tree":
			output = extension.HandleCommitTreeCommand(commandParts[1:])
		case "diff-content":
			output = extension.HandleDiffContentCommand(commandParts[1:])
		default:
			output = go_types.Output{
				Success: false,
				Data:    commandParts,
				Message: fmt.Sprintf("unknown command: %s", input.Command),
			}
		}

		w, err := os.OpenFile(writePipe, os.O_WRONLY, os.ModeNamedPipe)
		if err != nil {
			fmt.Fprintln(os.Stderr, "error opening write pipe:", err)
			os.Exit(1)
		}
		defer w.Close()

		if err := json.NewEncoder(w).Encode(output); err != nil {
			fmt.Fprintln(os.Stderr, "error encoding output:", err)
			os.Exit(1)
		}
	},
}

func init() {
	rootCmd.AddCommand(repoExtensionCmd)
}
