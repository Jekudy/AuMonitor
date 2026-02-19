import type {
  AppliedConstraints,
  LatencySnapshot,
  MeterSnapshot,
  MonitorMode,
  MonitoringPreferences,
} from './types'

export const CLIP_THRESHOLD = 0.98

export const DEFAULT_PREFERENCES: MonitoringPreferences = {
  mode: 'raw',
  inputId: 'default',
  outputId: 'default',
  headphonesConfirmed: false,
}

export const ZERO_METER: MeterSnapshot = {
  rms: 0,
  peak: 0,
  clipping: false,
  rmsDb: Number.NEGATIVE_INFINITY,
  peakDb: Number.NEGATIVE_INFINITY,
}

export function linearToDb(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return Number.NEGATIVE_INFINITY
  }
  return 20 * Math.log10(value)
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.max(0, Math.min(1, value))
}

export function formatDb(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '-inf dB'
  }
  return `${linearToDb(value).toFixed(1)} dB`
}

export function buildAudioConstraints(
  mode: MonitorMode,
  inputId: string,
  options?: {
    relaxProcessing?: boolean
  },
): MediaTrackConstraints {
  const isCallLike = mode === 'callLike'
  const relaxedCallLike = isCallLike && options?.relaxProcessing === true
  const constraints: MediaTrackConstraints = {
    echoCancellation: isCallLike,
    noiseSuppression: isCallLike && !relaxedCallLike,
    autoGainControl: false,
  }
  if (inputId && inputId !== 'default') {
    constraints.deviceId = { exact: inputId }
  }
  return constraints
}

export function meterFromSamples(
  samples: Float32Array<ArrayBufferLike>,
): MeterSnapshot {
  let peak = 0
  let sumSq = 0
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index]
    const absolute = Math.abs(value)
    if (absolute > peak) {
      peak = absolute
    }
    sumSq += value * value
  }
  const rms = Math.sqrt(sumSq / samples.length)
  return {
    rms,
    peak,
    clipping: peak >= CLIP_THRESHOLD,
    rmsDb: linearToDb(rms),
    peakDb: linearToDb(peak),
  }
}

export function latencyFromContext(context: AudioContext): LatencySnapshot {
  const latency: LatencySnapshot = {
    sampleRateHz: context.sampleRate,
    estimated: true,
  }
  if (typeof context.baseLatency === 'number') {
    latency.baseMs = Math.round(context.baseLatency * 1000)
  }
  if (typeof context.outputLatency === 'number') {
    latency.outputMs = Math.round(context.outputLatency * 1000)
  }
  return latency
}

export function appliedConstraintsFromSettings(
  settings: MediaTrackSettings,
): AppliedConstraints {
  return {
    echoCancellation:
      typeof settings.echoCancellation === 'boolean'
        ? settings.echoCancellation
        : undefined,
    noiseSuppression:
      typeof settings.noiseSuppression === 'boolean'
        ? settings.noiseSuppression
        : undefined,
    autoGainControl:
      typeof settings.autoGainControl === 'boolean'
        ? settings.autoGainControl
        : undefined,
    deviceId: settings.deviceId || undefined,
  }
}
