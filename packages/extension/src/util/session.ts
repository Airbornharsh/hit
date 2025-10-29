import os from 'os'
import path from 'path'
import fs from 'fs'
import Log from './log'

class Session {
  static getSession() {
    const homeDir = os.homedir()
    const sessionFilePath = path.join(homeDir, '.hit_session')
    if (fs.existsSync(sessionFilePath)) {
      try {
        const session = JSON.parse(fs.readFileSync(sessionFilePath, 'utf8'))
        return session
      } catch (error) {
        Log.error('Error parsing session file:', error)
        return null
      }
    }
    return null
  }
}

export default Session
