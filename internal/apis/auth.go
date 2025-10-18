package apis

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/airbornharsh/hit/utils"
)

type CreateSessionApiBodyData struct {
	SessionId string `json:"sessionId"`
	Token     string `json:"token"`
}

type CreateSessionApiBody struct {
	Success bool                     `json:"success"`
	Message string                   `json:"message"`
	Data    CreateSessionApiBodyData `json:"data"`
}

func CreateSessionApi() (*CreateSessionApiBodyData, error) {
	url := utils.BACKEND_URL + "/api/v1/auth/session"
	resp, err := http.Post(url, "application/json", nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyByte, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var body CreateSessionApiBody
	err = json.Unmarshal(bodyByte, &body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %v. Response body: %s", err, string(bodyByte))
	}

	if !body.Success || body.Data.Token == "" {
		return nil, fmt.Errorf("API returned error: %s", body.Message)
	}

	return &body.Data, nil
}

type CheckSessionApiBodyData struct {
	Valid string `json:"valid"`
	Token string `json:"token"`
	Email string `json:"email"`
}

type CheckSessionApiBody struct {
	Success bool                    `json:"success"`
	Message string                  `json:"message"`
	Data    CheckSessionApiBodyData `json:"data"`
}

func CheckSessionApi(sessionId string) (*CheckSessionApiBodyData, error) {
	url := fmt.Sprintf(utils.BACKEND_URL+"/api/v1/auth/session/%s", sessionId)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API request failed with status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var checkRes CheckSessionApiBody
	if err := json.Unmarshal(bodyBytes, &checkRes); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %v. Response body: %s", err, string(bodyBytes))
	}

	if !checkRes.Success {
		return nil, fmt.Errorf("API returned error: %s", checkRes.Message)
	}

	return &checkRes.Data, nil
}
