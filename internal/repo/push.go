package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/airbornharsh/hit/internal/apis"
	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/utils"
)

func Push(remoteName, branchName string) error {
	config, err := utils.GetConfig()
	if err != nil {
		return err
	}

	_, ok := config.Remotes[remoteName]
	if !ok {
		return fmt.Errorf("remote %s not found", remoteName)
	}

	remote := config.Remotes[remoteName].URL

	err = apis.UploadAllFiles(remote)
	if err != nil {
		return err
	}

	headExists, currentCommit, err := apis.GetHeadCommitHash(remote, branchName)
	if err != nil {
		return err
	}

	commits := []go_types.Commit{}
	branchLogPath := filepath.Join(".hit", "logs", "refs", "heads", branchName)
	branchLogFile, _ := os.ReadFile(branchLogPath)
	err = json.Unmarshal(branchLogFile, &commits)
	if err != nil {
		return err
	}

	apiCommits := []go_types.Commit{}

	if headExists {
		for i, commit := range commits {
			if commit.Hash == currentCommit {
				apiCommits = commits[i+1:]
				break
			}
		}
	} else {
		apiCommits = commits
	}

	err = apis.CreateCommit(remote, branchName, apiCommits)
	if err != nil {
		return err
	}

	remoteBranchDirPath := filepath.Join(".hit", "refs", "remotes", remoteName)
	err = os.MkdirAll(remoteBranchDirPath, 0755)
	if err != nil {
		return err
	}
	remoteBranchPath := filepath.Join(remoteBranchDirPath, branchName)
	err = os.WriteFile(remoteBranchPath, []byte(currentCommit), 0644)
	if err != nil {
		return err
	}

	remoteBranchLogDirPath := filepath.Join(".hit", "logs", "refs", "remotes", remoteName)
	err = os.MkdirAll(remoteBranchLogDirPath, 0755)
	if err != nil {
		return err
	}
	remoteBranchLogPath := filepath.Join(remoteBranchLogDirPath, branchName)
	remoteBranchLogData, err := json.Marshal(commits)
	if err != nil {
		return err
	}
	err = os.WriteFile(remoteBranchLogPath, remoteBranchLogData, 0644)
	if err != nil {
		return err
	}

	return nil
}
