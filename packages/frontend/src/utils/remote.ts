/**
 * Constructs a remote URL for the Hit platform
 * @param username - The username
 * @param repoName - The repository name
 * @returns The constructed remote URL
 */
export function constructRemote(username: string, repoName: string): string {
  return `hit@hithub.com:${username}/${repoName}.hit`
}
