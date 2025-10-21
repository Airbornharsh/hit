package auth

import (
	"fmt"
	"time"

	"github.com/airbornharsh/hit/internal/apis"
	"github.com/airbornharsh/hit/utils"
)

func Login() {
	sessionApiBody, err := apis.CreateSessionApi()
	if err != nil {
		fmt.Println("Error in Generating Session:", err)
		return
	}

	url := fmt.Sprintf("%s/terminal?token=%s", utils.FRONTEND_URL, sessionApiBody.Data.Token)
	fmt.Println("Opening browser:", url)
	utils.OpenBrowser(url)

	timeout := 5 * time.Minute
	endTime := time.Now().Add(timeout)
	sessionId := sessionApiBody.Data.SessionId

	for time.Now().Before((endTime)) {
		time.Sleep(3 * time.Second)

		checkSessionApiBody, err := apis.CheckSessionApi(sessionId)
		if err != nil {
			continue
		}

		switch checkSessionApiBody.Data.Valid {
		case "active":
			if checkSessionApiBody.Data.Token != "" {
				utils.SetSession(checkSessionApiBody.Data.Email, checkSessionApiBody.Data.Token)
				fmt.Printf("✅ Logged in successfully with email %s\n", checkSessionApiBody.Data.Email)
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
