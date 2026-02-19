import { describe, expect, it } from 'vitest'

import {
  buildAudioConstraints,
  linearToDb,
  meterFromSamples,
} from './audio'

describe('audio domain', () => {
  it('builds raw constraints', () => {
    const constraints = buildAudioConstraints('raw', 'default')
    expect(constraints.echoCancellation).toBe(false)
    expect(constraints.noiseSuppression).toBe(false)
    expect(constraints.autoGainControl).toBe(false)
    expect(constraints.deviceId).toBeUndefined()
  })

  it('builds call-like constraints with specific input', () => {
    const constraints = buildAudioConstraints('callLike', 'input-123')
    expect(constraints.echoCancellation).toBe(true)
    expect(constraints.noiseSuppression).toBe(true)
    expect(constraints.autoGainControl).toBe(false)
    expect(constraints.deviceId).toEqual({ exact: 'input-123' })
  })

  it('builds relaxed call-like constraints for fallback retry', () => {
    const constraints = buildAudioConstraints('callLike', 'input-123', {
      relaxProcessing: true,
    })
    expect(constraints.echoCancellation).toBe(true)
    expect(constraints.noiseSuppression).toBe(false)
    expect(constraints.autoGainControl).toBe(false)
    expect(constraints.deviceId).toEqual({ exact: 'input-123' })
  })

  it('calculates meter and clipping from samples', () => {
    const samples = new Float32Array([0, 0.5, -0.7, 1, -1])
    const meter = meterFromSamples(samples)
    expect(meter.peak).toBe(1)
    expect(meter.clipping).toBe(true)
    expect(meter.rms).toBeGreaterThan(0)
  })

  it('returns negative infinity for db conversion of zero', () => {
    expect(linearToDb(0)).toBe(Number.NEGATIVE_INFINITY)
  })
})
