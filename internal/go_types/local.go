package go_types

import "time"

type Remote struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

type RemoteConfig struct {
	Remotes map[string]Remote `json:"remotes"`
}

type Index struct {
	Entries map[string]string `json:"entries"` // file path -> object hash
	Changed bool              `json:"changed"`
}

type Tree struct {
	Entries map[string]string `json:"entries"` // file path -> object hash
	Parent  string            `json:"parent"`
}

type Commit struct {
	Hash      string    `json:"hash"`
	Parent    string    `json:"parent"`
	Message   string    `json:"message"`
	Author    string    `json:"author"`
	Timestamp time.Time `json:"timestamp"`
}

func TimeNow() time.Time {
	return time.Now()
}
