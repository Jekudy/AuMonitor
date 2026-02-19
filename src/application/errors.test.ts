import { describe, expect, it } from 'vitest'

import { normalizeMonitoringError } from './errors'

describe('normalizeMonitoringError', () => {
  it('maps NotAllowedError to permission_denied', () => {
    const normalized = normalizeMonitoringError(
      new DOMException('blocked', 'NotAllowedError'),
    )
    expect(normalized.code).toBe('permission_denied')
  })

  it('maps NotReadableError to device_busy', () => {
    const normalized = normalizeMonitoringError(
      new DOMException('busy', 'NotReadableError'),
    )
    expect(normalized.code).toBe('device_busy')
  })

  it('maps AbortError to recoverable runtime message', () => {
    const normalized = normalizeMonitoringError(
      new DOMException('aborted', 'AbortError'),
    )
    expect(normalized.code).toBe('unknown')
    expect(normalized.message).toContain('Audio session was interrupted')
  })

  it('falls back to unknown for plain errors', () => {
    const normalized = normalizeMonitoringError(new Error('boom'))
    expect(normalized.code).toBe('unknown')
    expect(normalized.message).toContain('boom')
  })
})
