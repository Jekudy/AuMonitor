import type { Logger } from '../../application/ports'

export function createBrowserLogger(scope: string): Logger {
  const prefix = `[${scope}]`
  return {
    info(message, details) {
      if (details === undefined) {
        console.info(prefix, message)
        return
      }
      console.info(prefix, message, details)
    },
    warn(message, details) {
      if (details === undefined) {
        console.warn(prefix, message)
        return
      }
      console.warn(prefix, message, details)
    },
    error(message, details) {
      if (details === undefined) {
        console.error(prefix, message)
        return
      }
      console.error(prefix, message, details)
    },
  }
}

