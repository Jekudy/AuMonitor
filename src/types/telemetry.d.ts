import type { TelemetryEventRecord } from '../infrastructure/browser/telemetryPort'

declare global {
  interface Window {
    __AUMONITOR_TELEMETRY__?: TelemetryEventRecord[]
  }
}

export {}
