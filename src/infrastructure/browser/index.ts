import type { AppDependencies } from '../../application/ports'
import { createCapabilitiesService } from './capabilitiesService'
import { createBrowserDevicePort } from './devicePort'
import { createBrowserLogger } from './logger'
import { createBrowserMonitoringPort } from './monitoringPort'
import { createLocalStorageSettingsStore } from './settingsStore'

export function createBrowserDependencies(): AppDependencies {
  const logger = createBrowserLogger('AuMonitor')
  return {
    logger,
    capabilitiesService: createCapabilitiesService(),
    settingsStore: createLocalStorageSettingsStore(),
    devicePort: createBrowserDevicePort(logger),
    monitoringPort: createBrowserMonitoringPort(logger),
  }
}

