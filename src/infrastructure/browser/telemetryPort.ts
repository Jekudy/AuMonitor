import type { Logger, TelemetryPort, TelemetryValue } from '../../application/ports'

export interface TelemetryEventRecord {
  eventName: string
  payload: Record<string, TelemetryValue>
  recordedAtIso: string
}

const EVENT_BUFFER_LIMIT = 300

function getTelemetryBuffer(): TelemetryEventRecord[] | null {
  if (typeof window === 'undefined') {
    return null
  }
  if (!Array.isArray(window.__AUMONITOR_TELEMETRY__)) {
    window.__AUMONITOR_TELEMETRY__ = []
  }
  return window.__AUMONITOR_TELEMETRY__
}

function normalizePayload(
  payload?: Record<string, TelemetryValue>,
): Record<string, TelemetryValue> {
  if (!payload) {
    return {}
  }
  return { ...payload }
}

export function createBrowserTelemetryPort(logger: Logger): TelemetryPort {
  return {
    track(eventName, payload) {
      const record: TelemetryEventRecord = {
        eventName,
        payload: normalizePayload(payload),
        recordedAtIso: new Date().toISOString(),
      }

      const buffer = getTelemetryBuffer()
      if (buffer) {
        buffer.push(record)
        if (buffer.length > EVENT_BUFFER_LIMIT) {
          buffer.splice(0, buffer.length - EVENT_BUFFER_LIMIT)
        }
      }

      if (import.meta.env.DEV) {
        logger.info(`Telemetry: ${eventName}`, record.payload)
      }
    },
  }
}
