package utils

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Session struct {
	Email string `json:"email"`
	Token string `json:"token"`
}

var HomeDir string = func() string {
	dir, err := os.UserHomeDir()
	if err != nil {
		panic(err)
	}
	return dir
}()

var SessionFilePath = filepath.Join(HomeDir, ".hit_session")

func CreateSessionFile() {
	os.Create(SessionFilePath)
}

func GetSession() *Session {
	file, _ := os.ReadFile(SessionFilePath)
	var session Session
	json.Unmarshal(file, &session)
	return &session
}

func SetSession(email string, token string) {
	var session = Session{
		Email: email,
		Token: token,
	}

	data, err := json.Marshal(session)
	if err != nil {
		return
	}

	CreateSessionFile()

	os.WriteFile(SessionFilePath, data, 0755)
}

func DeleteSession() {
	os.Remove(SessionFilePath)
}
