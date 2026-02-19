import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  AppDependencies,
  MonitoringSessionHandle,
} from '../application/ports'
import type {
  DeviceOption,
  MonitoringPreferences,
  MonitoringUpdate,
} from '../domain/types'
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
  requestInputPermission?: () => Promise<void>
}) {
  let deviceChangeHandler: (() => void) | null = null
  const requestInputPermission = vi.fn(
    options.requestInputPermission || (async () => undefined),
  )
  const enumerateInputs = vi.fn(
    options.enumerateInputs ||
      (async () => [DEFAULT_INPUT, MIC_1]),
  )
  const enumerateOutputs = vi.fn(
    options.enumerateOutputs ||
      (async () => [DEFAULT_OUTPUT]),
  )
  const telemetryTrack = vi.fn()

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
      enumerateInputs,
      enumerateOutputs,
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
    telemetry: {
      track: telemetryTrack,
    },
  }

  return {
    dependencies,
    telemetryTrack,
    enumerateInputs,
    enumerateOutputs,
    requestInputPermission,
    triggerDeviceChange() {
      deviceChangeHandler?.()
    },
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

function setVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
}

describe('useAuMonitorController', () => {
  it('stops a stale session when stop is clicked during starting', async () => {
    const firstStart = createDeferred<MonitoringSessionHandle>()
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(() => firstStart.promise)
    const { dependencies } = createDependencies({
      start,
      initialPreferences: {
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
    const { dependencies } = createDependencies({
      start,
      initialPreferences: {
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

  it('requests permission on load and refreshes inputs without extra prompt on start', async () => {
    let permissionGranted = false
    const { session } = createSession()
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(async () => session)
    const requestInputPermission = vi.fn(async () => {
      permissionGranted = true
    })
    const { dependencies } = createDependencies({
      start,
      requestInputPermission,
      enumerateInputs: async () =>
        permissionGranted ? [DEFAULT_INPUT, MIC_1] : [DEFAULT_INPUT],
      initialPreferences: {
        headphonesConfirmed: true,
      },
    })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    await waitFor(() => {
      expect(requestInputPermission).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(result.current.devices.inputs.map((device) => device.id)).toContain(
        MIC_1.id,
      )
    })

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(start).toHaveBeenCalledTimes(1)
    })

    expect(requestInputPermission).toHaveBeenCalledTimes(1)
  })

  it('tracks start attempts, successful starts and time-to-monitoring', async () => {
    const { session } = createSession()
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(async () => session)
    const { dependencies, telemetryTrack } = createDependencies({
      start,
      initialPreferences: {
        headphonesConfirmed: true,
      },
    })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.isMonitoring).toBe(true)
    })

    expect(telemetryTrack).toHaveBeenCalledWith(
      'monitor_start_attempts',
      expect.objectContaining({
        attempt_id: expect.any(Number),
        mode: 'raw',
      }),
    )
    expect(telemetryTrack).toHaveBeenCalledWith(
      'monitor_start_success',
      expect.objectContaining({
        attempt_id: expect.any(Number),
      }),
    )
    expect(telemetryTrack).toHaveBeenCalledWith(
      'time_to_monitoring_ms',
      expect.objectContaining({
        attempt_id: expect.any(Number),
        value_ms: expect.any(Number),
      }),
    )
  })

  it('tracks start failures by normalized error code for device contention', async () => {
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(async () => {
      throw new DOMException('busy', 'NotReadableError')
    })
    const { dependencies, telemetryTrack } = createDependencies({
      start,
      initialPreferences: {
        headphonesConfirmed: true,
      },
    })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.statusKind).toBe('error')
      expect(result.current.statusMessage).toContain('Microphone is busy')
    })

    expect(telemetryTrack).toHaveBeenCalledWith(
      'monitor_start_failure_by_error_code',
      expect.objectContaining({
        error_code: 'device_busy',
      }),
    )
  })

  it('warns on tab backgrounding and refreshes devices on resume while monitoring', async () => {
    setVisibilityState('visible')
    const { session } = createSession()
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(async () => session)
    const { dependencies, enumerateInputs, telemetryTrack } = createDependencies({
      start,
      initialPreferences: {
        headphonesConfirmed: true,
      },
    })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.isMonitoring).toBe(true)
    })

    const beforeResumeRefreshCalls = enumerateInputs.mock.calls.length

    setVisibilityState('hidden')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(result.current.statusKind).toBe('warning')
      expect(result.current.statusCode).toBe('context_not_running')
    })

    expect(telemetryTrack).toHaveBeenCalledWith('warning_events_by_code', {
      code: 'context_not_running',
    })

    setVisibilityState('visible')
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    await waitFor(() => {
      expect(enumerateInputs.mock.calls.length).toBeGreaterThan(
        beforeResumeRefreshCalls,
      )
    })
  })

  it('tracks warning and unexpected-stop metrics from monitoring session updates', async () => {
    let listener: ((update: MonitoringUpdate) => void) | null = null
    const session: MonitoringSessionHandle = {
      stop: vi.fn(async () => undefined),
      setOutputDevice: vi.fn(async () => undefined),
      getAppliedConstraints: () => ({}),
      subscribe(callback) {
        listener = callback
        return () => {
          listener = null
        }
      },
    }
    const start = vi.fn<
      (preferences: MonitoringPreferences) => Promise<MonitoringSessionHandle>
    >(async () => session)
    const { dependencies, telemetryTrack } = createDependencies({
      start,
      initialPreferences: {
        headphonesConfirmed: true,
      },
    })

    const { result } = renderHook(() => useAuMonitorController(dependencies))

    act(() => {
      result.current.start()
    })

    await waitFor(() => {
      expect(result.current.isMonitoring).toBe(true)
    })

    act(() => {
      listener?.({
        type: 'warning',
        code: 'input_silent',
        message: 'Input is active but signal stays near zero.',
      })
    })
    act(() => {
      listener?.({ type: 'track-ended' })
    })

    expect(telemetryTrack).toHaveBeenCalledWith('warning_events_by_code', {
      code: 'input_silent',
    })
    expect(telemetryTrack).toHaveBeenCalledWith('session_unexpected_stop_count', {
      reason: 'track_ended',
    })
  })
})
