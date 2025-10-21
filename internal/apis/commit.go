package apis

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/utils"
)

func GetHeadCommitHash(remote string, branchName string) (bool, string, error) {
	url := fmt.Sprintf(utils.BACKEND_URL+"/api/v1/branch/%s/head-commit?remote=%s", branchName, remote)

	token := utils.GetSession().Token

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return false, "", err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Terminal %s", token))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, "", fmt.Errorf("failed to get head commit: %s", resp.Status)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, "", err
	}

	var headCommitApiBody go_types.HeadCommitApiBody
	err = json.Unmarshal(body, &headCommitApiBody)
	if err != nil {
		return false, "", err
	}

	if !headCommitApiBody.Success {
		return false, "", fmt.Errorf("failed to get head commit: %s", headCommitApiBody.Message)
	}

	return headCommitApiBody.Data.Exists, headCommitApiBody.Data.HeadCommit.Hash, nil
}

func CreateCommit(remote string, branchName string, commits []go_types.Commit) error {
	url := fmt.Sprintf(utils.BACKEND_URL+"/api/v1/branch/%s/commits?remote=%s", branchName, remote)

	token := utils.GetSession().Token

	jsonBody, err := json.Marshal(map[string]any{
		"commits": commits,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Terminal %s", token))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// any 200 status code is fine
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("failed to create commit: %s", resp.Status)
	}

	return nil
}
