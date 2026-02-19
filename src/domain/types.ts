export type MonitorMode = 'raw' | 'callLike'

export type AppStatus =
  | 'idle'
  | 'requestingPermission'
  | 'starting'
  | 'monitoring'
  | 'stopping'
  | 'error'

export type DeviceKind = 'audioinput' | 'audiooutput'

export type StatusKind = 'neutral' | 'ok' | 'warning' | 'error'

export type MonitoringWarningCode =
  | 'input_silent'
  | 'input_muted'
  | 'constraints_relaxed'
  | 'playback_blocked'
  | 'output_switch_failed'
  | 'context_not_running'

export interface DeviceOption {
  id: string
  label: string
  kind: DeviceKind
  isDefault: boolean
}

export interface MonitoringPreferences {
  mode: MonitorMode
  inputId: string
  outputId: string
  headphonesConfirmed: boolean
}

export interface MeterSnapshot {
  rms: number
  peak: number
  clipping: boolean
  rmsDb: number
  peakDb: number
}

export interface LatencySnapshot {
  baseMs?: number
  outputMs?: number
  sampleRateHz: number
  estimated: true
}

export interface AppliedConstraints {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
  deviceId?: string
}

export interface MonitoringMetricsUpdate {
  type: 'metrics'
  meter: MeterSnapshot
  latency: LatencySnapshot
}

export interface MonitoringWarningUpdate {
  type: 'warning'
  code: MonitoringWarningCode
  message: string
  details?: Record<string, string | number | boolean>
}

export interface MonitoringTrackEndedUpdate {
  type: 'track-ended'
}

export type MonitoringUpdate =
  | MonitoringMetricsUpdate
  | MonitoringWarningUpdate
  | MonitoringTrackEndedUpdate
