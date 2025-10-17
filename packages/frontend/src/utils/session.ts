export const getTerminalToken = () => {
  const terminalToken = localStorage.getItem('hit_terminalToken')
  return terminalToken
}

export const setTerminalToken = (terminalToken: string) => {
  if (terminalToken) {
    localStorage.setItem('hit_terminalToken', terminalToken)
  }
}

export const clearTerminalToken = () => {
  localStorage.removeItem('hit_terminalToken')
}
