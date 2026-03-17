export type LogLevel = "debug" | "info" | "warn" | "error"

export interface Logger {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

class ConsoleLogger implements Logger {
  private prefix: string

  constructor(prefix = "[WebSocketPro]") {
    this.prefix = prefix
  }

  debug(...args: any[]) {
    if (import.meta && import.meta.env && import.meta.env.DEV) {
      console.debug(this.prefix, ...args)
    }
  }

  info(...args: any[]) {
    console.info(this.prefix, ...args)
  }

  warn(...args: any[]) {
    console.warn(this.prefix, ...args)
  }

  error(...args: any[]) {
    console.error(this.prefix, ...args)
  }
}

let currentLogger: Logger = new ConsoleLogger()

export const getLogger = (): Logger => currentLogger

export const setLogger = (logger: Logger) => {
  currentLogger = logger
}
