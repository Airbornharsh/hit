package go_types

type RepoDetails struct {
	Name                  string       `json:"name"`
	Path                  string       `json:"path"`
	Branch                string       `json:"branch"`
	HasUncommittedChanges bool         `json:"hasUncommittedChanges"`
	HasStagedChanges      bool         `json:"hasStagedChanges"`
	IsMain                bool         `json:"isMain"`
	FileStatuses          []FileStatus `json:"fileStatuses"`
}

type FileStatus struct {
	Path          string `json:"path"`
	RelativePath  string `json:"relativePath"`
	Status        string `json:"status"` // M, A, D, R, C
	Staged        bool   `json:"staged"`
	WorkspacePath string `json:"workspacePath"`
}

type Output struct {
	Success bool   `json:"success"`
	Data    any    `json:"data,omitempty"`
	Message string `json:"message"`
}
