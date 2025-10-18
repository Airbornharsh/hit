package auth

import (
	"fmt"
	"time"

	"github.com/airbornharsh/hit/internal/apis"
	"github.com/airbornharsh/hit/utils"
)

func Login() {
	session, err := apis.CreateSessionApi()
	if err != nil {
		fmt.Println("Error in Generating Session:", err)
		return
	}

	url := fmt.Sprintf("%s/terminal?token=%s", utils.FRONTEND_URL, session.Token)
	fmt.Println("Opening browser:", url)
	utils.OpenBrowser(url)

	timeout := 5 * time.Minute
	endTime := time.Now().Add(timeout)
	sessionId := session.SessionId

	for time.Now().Before((endTime)) {
		time.Sleep(3 * time.Second)

		data, err := apis.CheckSessionApi(sessionId)
		if err != nil {
			continue
		}

		switch data.Valid {
		case "active":
			if data.Token != "" {
				utils.SetSession(data.Email, data.Token)
				fmt.Printf("✅ Logged in successfully with email %s\n", data.Email)
				return
			} else {
				fmt.Println("⚠️ Try again later")
				return
			}
		case "expired":
			fmt.Println("⚠️ Session expired")
			return
		case "deleted":
			fmt.Println("⚠️ Session deleted")
			return
		}
	}
}

func User() {
	session := utils.GetSession()
	if session == nil || session.Email == "" || session.Token == "" {
		fmt.Println("⚠️ You are not logged in")
		return
	} else {
		fmt.Println("User:", session.Email)
	}
}

func Logout() {
	utils.DeleteSession()
	fmt.Println("Logged out successfully")
}
