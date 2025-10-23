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

func CloneRepositoryData(remote string) (go_types.CloneRepositoryApiBody, error) {
	url := fmt.Sprintf(utils.BACKEND_URL+"/api/v1/repo/clone?remote=%s", remote)

	token := utils.GetSession().Token

	jsonBody, err := json.Marshal(map[string]any{
		"remote": remote,
	})
	if err != nil {
		return go_types.CloneRepositoryApiBody{}, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	if err != nil {
		return go_types.CloneRepositoryApiBody{}, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Terminal %s", token))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return go_types.CloneRepositoryApiBody{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return go_types.CloneRepositoryApiBody{}, fmt.Errorf("failed to clone repository: %s", resp.Status)
	}

	var cloneRepositoryApiBody go_types.CloneRepositoryApiBody

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return go_types.CloneRepositoryApiBody{}, err
	}

	err = json.Unmarshal(body, &cloneRepositoryApiBody)
	if err != nil {
		return go_types.CloneRepositoryApiBody{}, err
	}

	if !cloneRepositoryApiBody.Success {
		return go_types.CloneRepositoryApiBody{}, fmt.Errorf("failed to clone repository: %s", cloneRepositoryApiBody.Message)
	}

	return cloneRepositoryApiBody, nil
}
