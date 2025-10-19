package repo

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Remote struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type RemoteConfig struct {
	Remotes map[string]Remote `json:"remotes"`
}

func AddRemote(name, url string) error {
	if name == "" {
		return fmt.Errorf("remote name cannot be empty")
	}

	if !isValidRemoteURL(url) {
		return fmt.Errorf("invalid remote URL format")
	}

	remotes, err := loadRemotes()
	if err != nil {
		return err
	}

	if _, exists := remotes.Remotes[name]; exists {
		return fmt.Errorf("remote '%s' already exists", name)
	}

	remotes.Remotes[name] = Remote{
		Name: name,
		URL:  url,
	}

	return saveRemotes(remotes)
}

func RemoveRemote(name string) error {
	remotes, err := loadRemotes()
	if err != nil {
		return err
	}

	if _, exists := remotes.Remotes[name]; !exists {
		return fmt.Errorf("remote '%s' does not exist", name)
	}

	delete(remotes.Remotes, name)

	return saveRemotes(remotes)
}

func ListRemotes() error {
	remotes, err := loadRemotes()
	if err != nil {
		return err
	}

	if len(remotes.Remotes) == 0 {
		fmt.Println("No remotes configured")
		return nil
	}

	for name, remote := range remotes.Remotes {
		fmt.Printf("%s\t%s\n", name, remote.URL)
	}

	return nil
}

func GetRemoteURL(name string) (string, error) {
	remotes, err := loadRemotes()
	if err != nil {
		return "", err
	}

	remote, exists := remotes.Remotes[name]
	if !exists {
		return "", fmt.Errorf("remote '%s' does not exist", name)
	}

	return remote.URL, nil
}

func loadRemotes() (*RemoteConfig, error) {
	configPath := filepath.Join(".hit", "config")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &RemoteConfig{
			Remotes: make(map[string]Remote),
		}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, err
	}

	var config RemoteConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	if config.Remotes == nil {
		config.Remotes = make(map[string]Remote)
	}

	return &config, nil
}

func saveRemotes(config *RemoteConfig) error {
	configPath := filepath.Join(".hit", "config")

	data, err := json.Marshal(config)
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func isValidRemoteURL(url string) bool {
	if url == "" {
		return false
	}

	if strings.Contains(url, "@") && strings.Contains(url, ":") {
		parts := strings.Split(url, "@")
		if len(parts) == 2 {
			hostPath := parts[1]
			if strings.Contains(hostPath, ":") {
				return true
			}
		}
	}

	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		return true
	}

	return false
}
