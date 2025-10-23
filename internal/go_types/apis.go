package go_types

type HeadCommitApiBody struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Exists     bool `json:"exists"`
		HeadCommit struct {
			ID        string `json:"_id"`
			Message   string `json:"message"`
			Author    string `json:"author"`
			Timestamp string `json:"timestamp"`
			Hash      string `json:"hash"`
			Parent    string `json:"parent"`
		} `json:"headCommit"`
	} `json:"data"`
}

type SignedUploadUrlApiBody struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		SignedUrl string `json:"signedUrl"`
		PublicUrl string `json:"publicUrl"`
		Exists    bool   `json:"exists"`
	} `json:"data"`
}

type CreateSessionApiBody struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		SessionId string `json:"sessionId"`
		Token     string `json:"token"`
	} `json:"data"`
}

type CheckSessionApiBody struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Valid string `json:"valid"`
		Token string `json:"token"`
		Email string `json:"email"`
	} `json:"data"`
}

type CloneRepositoryApiBody struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    struct {
		Username   string   `json:"username"`
		RepoName   string   `json:"repoName"`
		Repository string   `json:"repository"`
		Hashes     []string `json:"hashes"`
		Branches   []struct {
			Name       string `json:"name"`
			HeadCommit string `json:"headCommit"`
			Commits    []struct {
				Hash      string `json:"hash"`
				Parent    string `json:"parent"`
				Message   string `json:"message"`
				Author    string `json:"author"`
				Timestamp string `json:"timestamp"`
			} `json:"commits"`
		} `json:"branches"`
		Config     map[string]any `json:"config"`
		HeadBranch string         `json:"headBranch"`
	} `json:"data"`
}
