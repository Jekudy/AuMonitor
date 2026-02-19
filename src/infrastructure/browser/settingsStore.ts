import type {
  MonitoringPreferences,
  MonitorMode,
} from '../../domain/types'
import type { SettingsPort } from '../../application/ports'

const STORAGE_KEY = 'aumonitor_preferences_v1'

function isMode(value: string): value is MonitorMode {
  return value === 'raw' || value === 'callLike'
}

export function createLocalStorageSettingsStore(): SettingsPort {
  return {
    load(defaults: MonitoringPreferences): MonitoringPreferences {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) {
          return defaults
        }
        const parsed = JSON.parse(raw) as Partial<MonitoringPreferences>
        const maybeMode = parsed.mode
        return {
          mode:
            typeof maybeMode === 'string' && isMode(maybeMode)
              ? maybeMode
              : defaults.mode,
          inputId:
            typeof parsed.inputId === 'string' ? parsed.inputId : defaults.inputId,
          outputId:
            typeof parsed.outputId === 'string'
              ? parsed.outputId
              : defaults.outputId,
          headphonesConfirmed:
            typeof parsed.headphonesConfirmed === 'boolean'
              ? parsed.headphonesConfirmed
              : defaults.headphonesConfirmed,
        }
      } catch {
        return defaults
      }
    },
    save(preferences: MonitoringPreferences): void {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
      } catch {
        // Ignore localStorage failures.
      }
    },
  }
}
