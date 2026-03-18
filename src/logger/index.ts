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
    const isDev =
      // Vite / modern bundlers may inject import.meta.env
      (typeof import.meta !== "undefined" &&
        (import.meta as any)?.env &&
        (import.meta as any).env.DEV) ||
      // Node / other bundlers
      (typeof process !== "undefined" &&
        (process as any)?.env &&
        (process as any).env.NODE_ENV !== "production")

    if (isDev) {
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
