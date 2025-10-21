package apis

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/airbornharsh/hit/internal/go_types"
	"github.com/airbornharsh/hit/utils"
)

func CreateSessionApi() (*go_types.CreateSessionApiBody, error) {
	url := utils.BACKEND_URL + "/api/v1/auth/session"
	resp, err := http.Post(url, "application/json", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyByte, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var body go_types.CreateSessionApiBody
	err = json.Unmarshal(bodyByte, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %v. Response body: %s", err, string(bodyByte))
	}

	if !body.Success || body.Data.Token == "" {
		return nil, fmt.Errorf("API returned error: %s", body.Message)
	}

	return &body, nil
}

func CheckSessionApi(sessionId string) (*go_types.CheckSessionApiBody, error) {
	url := fmt.Sprintf(utils.BACKEND_URL+"/api/v1/auth/session/%s", sessionId)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var checkRes go_types.CheckSessionApiBody
	if err := json.Unmarshal(bodyBytes, &checkRes); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %v. Response body: %s", err, string(bodyBytes))
	}

	if !checkRes.Success {
		return nil, fmt.Errorf("API returned error: %s", checkRes.Message)
	}

	return &checkRes, nil
}
