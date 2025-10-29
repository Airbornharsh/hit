class Log {
  static log(...args: any[]) {
    console.log('[Hit] ', ...args)
  }
  static error(...args: any[]) {
    console.error('[Hit] ', ...args)
  }
  static warn(...args: any[]) {
    console.warn('[Hit] ', ...args)
  }
  static info(...args: any[]) {
    console.info('[Hit] ', ...args)
  }
}

export default Log
