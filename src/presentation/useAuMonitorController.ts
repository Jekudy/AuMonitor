import { useMachine } from '@xstate/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { normalizeMonitoringError } from '../application/errors'
import { appMachine } from '../application/machine'
import type { AppDependencies } from '../application/ports'
import { DEFAULT_PREFERENCES, ZERO_METER } from '../domain/audio'
import type {
  DeviceOption,
  MonitoringPreferences,
  MonitoringWarningCode,
} from '../domain/types'

interface DeviceLists {
  inputs: DeviceOption[]
  outputs: DeviceOption[]
}

type ReconfigureReason = 'mode' | 'input' | 'device_change'

interface PendingStartTelemetry {
  attemptId: number
  startedAtMs: number
}

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

function hasDevice(
  devices: DeviceOption[],
  id: string,
): boolean {
  return devices.some((device) => device.id === id)
}

export function useAuMonitorController(dependencies: AppDependencies) {
  const capabilities = useMemo(
    () => dependencies.capabilitiesService.detect(),
    [dependencies.capabilitiesService],
  )
  const [state, send] = useMachine(appMachine)
  const [preferences, setPreferences] = useState<MonitoringPreferences>(() =>
    dependencies.settingsStore.load(DEFAULT_PREFERENCES),
  )
  const [devices, setDevices] = useState<DeviceLists>({
    inputs: [DEFAULT_INPUT],
    outputs: [DEFAULT_OUTPUT],
  })
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false)

  const permissionRequestRef = useRef<Promise<void> | null>(null)
  const permissionGrantedRef = useRef(false)
  const permissionPreflightAttemptedRef = useRef(false)
  const startAttemptRef = useRef(0)
  const stopLockRef = useRef(false)
  const restartAfterStopRef = useRef(false)
  const pendingReconfigureRef = useRef<ReconfigureReason | null>(null)
  const preferencesRef = useRef(preferences)
  const pendingStartTelemetryRef = useRef<PendingStartTelemetry | null>(null)
  const nextStartTelemetryIdRef = useRef(0)

  const isIdle = state.matches('idle')
  const isError = state.matches('error')
  const isRequestingPermission = state.matches('requestingPermission')
  const isStarting = state.matches('starting')
  const isStopping = state.matches('stopping')
  const isMonitoring = state.matches('monitoring')

  useEffect(() => {
    preferencesRef.current = preferences
  }, [preferences])

  const requestRestart = useCallback((): boolean => {
    if (!isMonitoring) {
      return false
    }
    restartAfterStopRef.current = true
    send({ type: 'STOP_CLICKED' })
    return true
  }, [isMonitoring, send])

  const queueReconfigure = useCallback((reason: ReconfigureReason) => {
    pendingReconfigureRef.current = reason
  }, [])

  const trackWarningEvent = useCallback(
    (code?: MonitoringWarningCode) => {
      dependencies.telemetry.track('warning_events_by_code', {
        code: code || 'unknown',
      })
    },
    [dependencies.telemetry],
  )

  const emitSessionWarning = useCallback(
    (message: string, code?: MonitoringWarningCode) => {
      trackWarningEvent(code)
      send({
        type: 'SESSION_WARNING',
        message,
        code,
      })
    },
    [send, trackWarningEvent],
  )

  const finalizeStartTelemetry = useCallback(
    (
      outcome: 'success' | 'failure',
      options?: {
        errorCode?: string
      },
    ) => {
      const pending = pendingStartTelemetryRef.current
      if (!pending) {
        return
      }
      pendingStartTelemetryRef.current = null

      if (outcome === 'success') {
        const elapsedMs = Math.max(0, performance.now() - pending.startedAtMs)
        dependencies.telemetry.track('monitor_start_success', {
          attempt_id: pending.attemptId,
        })
        dependencies.telemetry.track('time_to_monitoring_ms', {
          attempt_id: pending.attemptId,
          value_ms: Math.round(elapsedMs),
        })
        return
      }

      dependencies.telemetry.track('monitor_start_failure_by_error_code', {
        attempt_id: pending.attemptId,
        error_code: options?.errorCode || 'unknown',
      })
    },
    [dependencies.telemetry],
  )

  const ensureInputPermission = useCallback(async () => {
    if (permissionGrantedRef.current) {
      return
    }
    if (permissionRequestRef.current) {
      return permissionRequestRef.current
    }
    const request = dependencies.devicePort.requestInputPermission()
      .then(() => {
        permissionGrantedRef.current = true
      })
      .finally(() => {
        permissionRequestRef.current = null
      })
    permissionRequestRef.current = request
    return request
  }, [dependencies.devicePort])

  const refreshDevices = useCallback(async () => {
    setIsRefreshingDevices(true)
    try {
      const [inputs, outputs] = await Promise.all([
        dependencies.devicePort.enumerateInputs(),
        dependencies.devicePort.enumerateOutputs(),
      ])
      setDevices({
        inputs: inputs.length > 0 ? inputs : [DEFAULT_INPUT],
        outputs: outputs.length > 0 ? outputs : [DEFAULT_OUTPUT],
      })
      const currentPreferences = preferencesRef.current
      const inputFallbackApplied = !hasDevice(inputs, currentPreferences.inputId)
      const outputFallbackApplied =
        capabilities.supportsSetSinkId &&
        !hasDevice(outputs, currentPreferences.outputId)

      setPreferences((current) => {
        const resolvedInputId = hasDevice(inputs, current.inputId)
          ? current.inputId
          : 'default'
        const resolvedOutputId =
          capabilities.supportsSetSinkId &&
          !hasDevice(outputs, current.outputId)
            ? 'default'
            : current.outputId
        if (
          resolvedInputId === current.inputId &&
          resolvedOutputId === current.outputId
        ) {
          return current
        }
        return {
          ...current,
          inputId: resolvedInputId,
          outputId: resolvedOutputId,
        }
      })

      if (inputFallbackApplied) {
        queueReconfigure('device_change')
        emitSessionWarning(
          'Selected input is unavailable. Switched to System Default.',
        )
      }
      if (outputFallbackApplied) {
        emitSessionWarning(
          'Selected output is unavailable. Switched to default output.',
          'output_switch_failed',
        )
      }
    } catch (error) {
      dependencies.logger.warn('Device refresh failed.', { error })
      emitSessionWarning('Could not refresh devices. Try again.')
    } finally {
      setIsRefreshingDevices(false)
    }
  }, [
    capabilities.supportsSetSinkId,
    dependencies,
    emitSessionWarning,
    queueReconfigure,
  ])

  useEffect(() => {
    const unsubscribe = dependencies.devicePort.onDeviceChange(() => {
      send({ type: 'DEVICE_CHANGED' })
      void refreshDevices()
    })
    void refreshDevices()
    return unsubscribe
  }, [dependencies.devicePort, refreshDevices, send])

  useEffect(() => {
    if (permissionPreflightAttemptedRef.current) {
      return
    }
    if (!capabilities.secureContext || !capabilities.hasMediaDevices) {
      return
    }
    permissionPreflightAttemptedRef.current = true
    ;(async () => {
      try {
        await ensureInputPermission()
        void refreshDevices()
      } catch (error) {
        const normalized = normalizeMonitoringError(error)
        dependencies.logger.info('Initial microphone permission preflight failed.', {
          code: normalized.code,
          message: normalized.message,
        })
        emitSessionWarning(normalized.message)
      }
    })()
  }, [
    capabilities.hasMediaDevices,
    capabilities.secureContext,
    dependencies.logger,
    emitSessionWarning,
    ensureInputPermission,
    refreshDevices,
  ])

  useEffect(() => {
    dependencies.settingsStore.save(preferences)
  }, [dependencies.settingsStore, preferences])

  useEffect(() => {
    if (!isRequestingPermission) {
      return
    }
    ;(async () => {
      try {
        await ensureInputPermission()
        send({ type: 'PERMISSION_GRANTED' })
        void refreshDevices()
      } catch (error) {
        const normalized = normalizeMonitoringError(error)
        finalizeStartTelemetry('failure', { errorCode: normalized.code })
        send({ type: 'PERMISSION_DENIED', message: normalized.message })
      }
    })()
  }, [
    ensureInputPermission,
    finalizeStartTelemetry,
    isRequestingPermission,
    refreshDevices,
    send,
  ])

  useEffect(() => {
    if (!isStarting) {
      return
    }
    startAttemptRef.current += 1
    const startAttempt = startAttemptRef.current
    let cancelled = false

    ;(async () => {
      try {
        const session = await dependencies.monitoringPort.start(
          preferencesRef.current,
        )
        if (cancelled || startAttemptRef.current !== startAttempt) {
          try {
            await session.stop()
          } catch (stopError) {
            dependencies.logger.warn(
              'Failed to stop stale session during restart.',
              {
                stopError,
              },
            )
          }
          return
        }
        send({
          type: 'SESSION_STARTED',
          session,
          applied: session.getAppliedConstraints(),
        })
        finalizeStartTelemetry('success')
      } catch (error) {
        if (cancelled || startAttemptRef.current !== startAttempt) {
          return
        }
        const normalized = normalizeMonitoringError(error)
        finalizeStartTelemetry('failure', { errorCode: normalized.code })
        send({ type: 'SESSION_FAILED', message: normalized.message })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    dependencies.logger,
    dependencies.monitoringPort,
    finalizeStartTelemetry,
    isStarting,
    send,
  ])

  useEffect(() => {
    if (!isStopping || stopLockRef.current) {
      return
    }
    stopLockRef.current = true
    ;(async () => {
      try {
        if (state.context.session) {
          await state.context.session.stop()
        }
        send({ type: 'SESSION_STOPPED' })
      } catch (error) {
        const normalized = normalizeMonitoringError(error)
        send({ type: 'SESSION_FAILED', message: normalized.message })
      } finally {
        stopLockRef.current = false
      }
    })()
  }, [isStopping, send, state.context.session])

  useEffect(() => {
    if (!state.context.session) {
      return
    }
    const unsubscribe = state.context.session.subscribe((update) => {
      if (update.type === 'metrics') {
        send({
          type: 'METRICS_UPDATED',
          meter: update.meter,
          latency: update.latency,
        })
      }
      if (update.type === 'warning') {
        trackWarningEvent(update.code)
        send({
          type: 'SESSION_WARNING',
          message: update.message,
          code: update.code,
        })
      }
      if (update.type === 'track-ended') {
        dependencies.telemetry.track('session_unexpected_stop_count', {
          reason: 'track_ended',
        })
        send({ type: 'TRACK_ENDED' })
      }
    })
    return unsubscribe
  }, [dependencies.telemetry, send, state.context.session, trackWarningEvent])

  useEffect(() => {
    if (!isMonitoring || !state.context.session) {
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await state.context.session?.setOutputDevice(preferences.outputId)
      } catch (error) {
        if (cancelled) {
          return
        }
        dependencies.logger.warn('Output switch failed.', { error })
        emitSessionWarning(
          'Cannot switch output device. Using default output.',
          'output_switch_failed',
        )
        setPreferences((current) => ({ ...current, outputId: 'default' }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    dependencies.logger,
    emitSessionWarning,
    isMonitoring,
    preferences.outputId,
    state.context.session,
  ])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isMonitoring) {
        return
      }
      if (document.visibilityState === 'hidden') {
        emitSessionWarning(
          'Tab moved to background. Browser may pause audio processing.',
          'context_not_running',
        )
        return
      }
      if (document.visibilityState === 'visible') {
        dependencies.logger.info(
          'Tab became visible again. Refreshing device state after resume.',
        )
        void refreshDevices()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [dependencies.logger, emitSessionWarning, isMonitoring, refreshDevices])

  useEffect(() => {
    if (!isIdle || !restartAfterStopRef.current) {
      return
    }
    restartAfterStopRef.current = false
    send({ type: 'START_CLICKED' })
  }, [isIdle, send])

  useEffect(() => {
    if (!pendingReconfigureRef.current || !isMonitoring) {
      return
    }
    const reason = pendingReconfigureRef.current
    pendingReconfigureRef.current = null
    dependencies.logger.info('Applying deferred reconfiguration.', { reason })
    const restartRequested = requestRestart()
    if (!restartRequested) {
      pendingReconfigureRef.current = reason
    }
  }, [
    dependencies.logger,
    isMonitoring,
    preferences.inputId,
    preferences.mode,
    requestRestart,
  ])

  useEffect(() => {
    if (!pendingReconfigureRef.current) {
      return
    }
    if (isError || (isIdle && !restartAfterStopRef.current)) {
      pendingReconfigureRef.current = null
    }
  }, [isError, isIdle])

  const setMode = useCallback(
    (mode: MonitoringPreferences['mode']) => {
      setPreferences((current) => ({ ...current, mode }))
      send({ type: 'MODE_CHANGED' })
      const restartRequested = requestRestart()
      if (
        !restartRequested &&
        (isRequestingPermission || isStarting || isStopping)
      ) {
        queueReconfigure('mode')
      }
    },
    [
      isRequestingPermission,
      isStarting,
      isStopping,
      queueReconfigure,
      requestRestart,
      send,
    ],
  )

  const setInputId = useCallback(
    (inputId: string) => {
      setPreferences((current) => ({ ...current, inputId }))
      send({ type: 'INPUT_CHANGED' })
      const restartRequested = requestRestart()
      if (
        !restartRequested &&
        (isRequestingPermission || isStarting || isStopping)
      ) {
        queueReconfigure('input')
      }
    },
    [
      isRequestingPermission,
      isStarting,
      isStopping,
      queueReconfigure,
      requestRestart,
      send,
    ],
  )

  const setOutputId = useCallback(
    (outputId: string) => {
      setPreferences((current) => ({ ...current, outputId }))
      send({ type: 'OUTPUT_CHANGED' })
    },
    [send],
  )

  const setHeadphonesConfirmed = useCallback((value: boolean) => {
    setPreferences((current) => ({ ...current, headphonesConfirmed: value }))
  }, [])

  const canStart = useMemo(() => {
    const canStartFromState = isIdle || isError
    return (
      canStartFromState &&
      capabilities.secureContext &&
      capabilities.hasMediaDevices &&
      preferences.headphonesConfirmed &&
      devices.inputs.length > 0
    )
  }, [
    capabilities,
    devices.inputs.length,
    isError,
    isIdle,
    preferences.headphonesConfirmed,
  ])

  const isBusy = isRequestingPermission || isStarting || isStopping

  const meter = state.context.meter || ZERO_METER
  const latency = state.context.latency

  return {
    capabilities,
    preferences,
    devices,
    meter,
    latency,
    appliedConstraints: state.context.applied,
    status: state.context.status,
    statusKind: state.context.statusKind,
    statusCode: state.context.statusCode,
    statusMessage: state.context.statusMessage,
    canStart,
    isBusy,
    isMonitoring,
    isRefreshingDevices,
    setMode,
    setInputId,
    setOutputId,
    setHeadphonesConfirmed,
    refreshDevices,
    start() {
      if (!canStart || isBusy) {
        return
      }
      nextStartTelemetryIdRef.current += 1
      pendingStartTelemetryRef.current = {
        attemptId: nextStartTelemetryIdRef.current,
        startedAtMs: performance.now(),
      }
      dependencies.telemetry.track('monitor_start_attempts', {
        attempt_id: nextStartTelemetryIdRef.current,
        mode: preferencesRef.current.mode,
        input_id: preferencesRef.current.inputId,
        output_id: preferencesRef.current.outputId,
      })
      send({ type: 'START_CLICKED' })
    },
    stop() {
      if (isRequestingPermission || isStarting) {
        finalizeStartTelemetry('failure', { errorCode: 'cancelled' })
      }
      restartAfterStopRef.current = false
      send({ type: 'STOP_CLICKED' })
    },
  }
}
