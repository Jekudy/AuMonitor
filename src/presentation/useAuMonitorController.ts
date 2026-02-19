import { useMachine } from '@xstate/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { normalizeMonitoringError } from '../application/errors'
import { appMachine } from '../application/machine'
import type { AppDependencies } from '../application/ports'
import { DEFAULT_PREFERENCES, ZERO_METER } from '../domain/audio'
import type { DeviceOption, MonitoringPreferences } from '../domain/types'

interface DeviceLists {
  inputs: DeviceOption[]
  outputs: DeviceOption[]
}

type ReconfigureReason = 'mode' | 'input' | 'device_change'

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

  const permissionLockRef = useRef(false)
  const startAttemptRef = useRef(0)
  const stopLockRef = useRef(false)
  const restartAfterStopRef = useRef(false)
  const pendingReconfigureRef = useRef<ReconfigureReason | null>(null)
  const preferencesRef = useRef(preferences)

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
        send({
          type: 'SESSION_WARNING',
          message: 'Selected input is unavailable. Switched to System Default.',
        })
      }
      if (outputFallbackApplied) {
        send({
          type: 'SESSION_WARNING',
          message: 'Selected output is unavailable. Switched to default output.',
          code: 'output_switch_failed',
        })
      }
    } catch (error) {
      dependencies.logger.warn('Device refresh failed.', { error })
      send({
        type: 'SESSION_WARNING',
        message: 'Could not refresh devices. Try again.',
      })
    } finally {
      setIsRefreshingDevices(false)
    }
  }, [capabilities.supportsSetSinkId, dependencies, queueReconfigure, send])

  useEffect(() => {
    const unsubscribe = dependencies.devicePort.onDeviceChange(() => {
      send({ type: 'DEVICE_CHANGED' })
      void refreshDevices()
    })
    void refreshDevices()
    return unsubscribe
  }, [dependencies.devicePort, refreshDevices, send])

  useEffect(() => {
    dependencies.settingsStore.save(preferences)
  }, [dependencies.settingsStore, preferences])

  useEffect(() => {
    if (!isRequestingPermission || permissionLockRef.current) {
      return
    }
    permissionLockRef.current = true
    ;(async () => {
      try {
        await dependencies.devicePort.requestInputPermission()
        send({ type: 'PERMISSION_GRANTED' })
      } catch (error) {
        const normalized = normalizeMonitoringError(error)
        send({ type: 'PERMISSION_DENIED', message: normalized.message })
      } finally {
        permissionLockRef.current = false
      }
    })()
  }, [dependencies.devicePort, isRequestingPermission, send])

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
      } catch (error) {
        if (cancelled || startAttemptRef.current !== startAttempt) {
          return
        }
        const normalized = normalizeMonitoringError(error)
        send({ type: 'SESSION_FAILED', message: normalized.message })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [dependencies.logger, dependencies.monitoringPort, isStarting, send])

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
        send({
          type: 'SESSION_WARNING',
          message: update.message,
          code: update.code,
        })
      }
      if (update.type === 'track-ended') {
        send({ type: 'TRACK_ENDED' })
      }
    })
    return unsubscribe
  }, [send, state.context.session])

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
        send({
          type: 'SESSION_WARNING',
          message: 'Cannot switch output device. Using default output.',
          code: 'output_switch_failed',
        })
        setPreferences((current) => ({ ...current, outputId: 'default' }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dependencies.logger, isMonitoring, preferences.outputId, send, state.context.session])

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
      send({ type: 'START_CLICKED' })
    },
    stop() {
      restartAfterStopRef.current = false
      send({ type: 'STOP_CLICKED' })
    },
  }
}
