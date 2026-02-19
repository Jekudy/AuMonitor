import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  AppDependencies,
  MonitoringSessionHandle,
} from '../application/ports'
import type { DeviceOption, MonitoringPreferences } from '../domain/types'
import { useAuMonitorController } from './useAuMonitorController'

const DEFAULT_INPUT: DeviceOption = {
  id: 'default',
  label: 'System Default',
  kind: 'audioinput',
  isDefault: true,
}

const DEFAULT_OUTPUT: DeviceOption = {
  id: 'default',
  label: 'System Default',
  kind: 'audiooutput',
  isDefault: true,
}

const MIC_1: DeviceOption = {
  id: 'mic-1',
  label: 'Mic 1',
  kind: 'audioinput',
  isDefault: false,
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function createSession() {
  const stop = vi.fn(async () => undefined)
  const setOutputDevice = vi.fn(async () => undefined)
  const session: MonitoringSessionHandle = {
    stop,
    setOutputDevice,
    getAppliedConstraints: () => ({}),
    subscribe: () => () => undefined,
  }
  return { session, stop, setOutputDevice }
}

function createDependencies(options: {
  start: (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
  enumerateInputs?: () => Promise<DeviceOption[]>
  enumerateOutputs?: () => Promise<DeviceOption[]>
  initialPreferences?: Partial<MonitoringPreferences>
}) {
  let deviceChangeHandler: (() => void) | null = null
  const requestInputPermission = vi.fn(async () => undefined)

  const dependencies: AppDependencies = {
    capabilitiesService: {
      detect() {
        return {
          secureContext: true,
          hasMediaDevices: true,
          supportsSetSinkId: true,
        }
      },
    },
    settingsStore: {
      load(defaults) {
        return {
          ...defaults,
          ...options.initialPreferences,
        }
      },
      save: vi.fn(),
    },
    devicePort: {
      requestInputPermission,
      enumerateInputs:
        options.enumerateInputs ||
        (async () => [DEFAULT_INPUT, MIC_1]),
      enumerateOutputs:
        options.enumerateOutputs ||
        (async () => [DEFAULT_OUTPUT]),
      onDeviceChange(callback) {
        deviceChangeHandler = callback
        return () => {
          if (deviceChangeHandler === callback) {
            deviceChangeHandler = null
          }
        }
      },
    },
    monitoringPort: {
      start: options.start,
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }

  return {
    dependencies,
    requestInputPermission,
    triggerDeviceChange() {
      deviceChangeHandler?.()
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('useAuMonitorController', () => {
  it('stops a stale session when stop is clicked during starting', async () => {
    const firstStart = createDeferred<MonitoringSessionHandle>()
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(() => firstStart.promise)
    const { dependencies } = createDependencies({ start })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1)
    })

    act(() => {
      result.current.stop()
    })

    const staleSession = createSession()
    firstStart.resolve(staleSession.session)

    await waitFor(() => {
      expect(staleSession.stop).toHaveBeenCalledTimes(1)
    })
  })

  it('defers mode changes made during starting and restarts with latest preferences', async () => {
    const starts: Array<Deferred<MonitoringSessionHandle>> = []
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(() => {
      const deferred = createDeferred<MonitoringSessionHandle>()
      starts.push(deferred)
      return deferred.promise
    })
    const { dependencies } = createDependencies({ start })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1)
    })

    act(() => {
      result.current.setMode('callLike')
    })

    const firstSession = createSession()
    starts[0].resolve(firstSession.session)

    await waitFor(() => {
      expect(firstSession.stop).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(2)
    })

    const firstStartPreferences = start.mock.calls.at(0)?.[0]
    const secondStartPreferences = start.mock.calls.at(1)?.[0]
    expect(firstStartPreferences?.mode).toBe('raw')
    expect(secondStartPreferences?.mode).toBe('callLike')

    const secondSession = createSession()
    starts[1].resolve(secondSession.session)

    await waitFor(() => {
      expect(result.current.isMonitoring).toBe(true)
    })

    act(() => {
      result.current.stop()
    })

    await waitFor(() => {
      expect(secondSession.stop).toHaveBeenCalledTimes(1)
    })
  })

  it('reconciles device-change input fallback with restart and updated preferences', async () => {
    let currentInputs: DeviceOption[] = [DEFAULT_INPUT, MIC_1]
    const starts: Array<Deferred<MonitoringSessionHandle>> = []
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(() => {
      const deferred = createDeferred<MonitoringSessionHandle>()
      starts.push(deferred)
      return deferred.promise
    })
    const { dependencies, triggerDeviceChange } = createDependencies({
      start,
      enumerateInputs: async () => currentInputs,
      initialPreferences: {
        inputId: MIC_1.id,
        headphonesConfirmed: true,
      },
    })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1)
    })

    const firstSession = createSession()
    starts[0].resolve(firstSession.session)

    await waitFor(() => {
      expect(result.current.isMonitoring).toBe(true)
    })

    currentInputs = [DEFAULT_INPUT]
    act(() => {
      triggerDeviceChange()
    })

    await waitFor(() => {
      expect(result.current.preferences.inputId).toBe('default')
    })

    await waitFor(() => {
      expect(firstSession.stop).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(2)
    })

    const secondStartPreferences = start.mock.calls.at(1)?.[0]
    expect(secondStartPreferences?.inputId).toBe('default')

    const secondSession = createSession()
    starts[1].resolve(secondSession.session)

    await waitFor(() => {
      expect(result.current.isMonitoring).toBe(true)
    })

    act(() => {
      result.current.stop()
    })

    await waitFor(() => {
      expect(secondSession.stop).toHaveBeenCalledTimes(1)
    })
  })

  it('surfaces device refresh failures while idle', async () => {
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(async () => createSession().session)
    const { dependencies } = createDependencies({
      start,
      enumerateInputs: async () => {
        throw new Error('enumerate failed')
      },
    })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    await waitFor(() => {
      expect(result.current.statusKind).toBe('warning')
      expect(result.current.statusMessage).toBe(
        'Could not refresh devices. Try again.',
      )
    })
  })
})
