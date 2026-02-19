import type {
  AppliedConstraints,
  DeviceOption,
  MonitoringPreferences,
  MonitoringUpdate,
} from '../domain/types'

export type Unsubscribe = () => void

export interface DevicePort {
  requestInputPermission(): Promise<void>
  enumerateInputs(): Promise<DeviceOption[]>
  enumerateOutputs(): Promise<DeviceOption[]>
  onDeviceChange(callback: () => void): Unsubscribe
}

export interface MonitoringSessionHandle {
  stop(): Promise<void>
  setOutputDevice(outputId: string): Promise<void>
  getAppliedConstraints(): AppliedConstraints
  subscribe(listener: (update: MonitoringUpdate) => void): Unsubscribe
}

export interface MonitoringPort {
  start(preferences: MonitoringPreferences): Promise<MonitoringSessionHandle>
}

export interface SettingsPort {
  load(defaults: MonitoringPreferences): MonitoringPreferences
  save(preferences: MonitoringPreferences): void
}

export interface Capabilities {
  secureContext: boolean
  hasMediaDevices: boolean
  supportsSetSinkId: boolean
}

export interface CapabilitiesService {
  detect(): Capabilities
}

export interface Logger {
  info(message: string, details?: unknown): void
  warn(message: string, details?: unknown): void
  error(message: string, details?: unknown): void
}

export type TelemetryValue = string | number | boolean | null

export interface TelemetryPort {
  track(
    eventName: string,
    payload?: Record<string, TelemetryValue>,
  ): void
}

export interface AppDependencies {
  devicePort: DevicePort
  monitoringPort: MonitoringPort
  settingsStore: SettingsPort
  capabilitiesService: CapabilitiesService
  logger: Logger
  telemetry: TelemetryPort
}
