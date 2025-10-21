class RemoteService {
  static async remoteBreakdown(remote: string) {
    const parts = remote.split('hit@hithub.com:')
    const parts1 = parts[1].split('/')
    const userName = parts1[0]
    const repoName = parts1[1].split('.')[0]
    return { userName, repoName }
  }
}

export default RemoteService
