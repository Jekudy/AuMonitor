import type {
  Logger,
  MonitoringPort,
  MonitoringSessionHandle,
  Unsubscribe,
} from '../../application/ports'
import type {
  AppliedConstraints,
  MonitoringPreferences,
  MonitoringUpdate,
  MonitoringWarningUpdate,
} from '../../domain/types'
import {
  buildAudioConstraints,
  latencyFromContext,
  meterFromSamples,
} from '../../domain/audio'

interface InternalSessionResources {
  stream: MediaStream
  track: MediaStreamTrack
  context: AudioContext
  analyser: AnalyserNode
  destination: MediaStreamAudioDestinationNode
  audioElement: HTMLAudioElement
  meterBuffer: Float32Array
}

const SILENCE_WARMUP_MS = 1500
const SILENCE_WINDOW_MS = 2500
const SILENCE_PEAK_EPSILON = 0.0003

function supportsSetSinkId(
  audioElement: HTMLMediaElement,
): audioElement is HTMLMediaElement & { setSinkId: (sinkId: string) => Promise<void> } {
  return typeof audioElement.setSinkId === 'function'
}

function isConstraintError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false
  }
  return (
    error.name === 'OverconstrainedError' ||
    error.name === 'ConstraintNotSatisfiedError'
  )
}

function emitWarning(
  emit: (update: MonitoringUpdate) => void,
  warning: Omit<MonitoringWarningUpdate, 'type'>,
) {
  emit({
    type: 'warning',
    ...warning,
  })
}

function cleanupAudioElement(audioElement: HTMLAudioElement) {
  try {
    audioElement.pause()
  } catch {
    // Ignore pause failures.
  }
  audioElement.srcObject = null
  if (audioElement.parentNode) {
    audioElement.parentNode.removeChild(audioElement)
  }
}

function stopStreamTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    try {
      track.stop()
    } catch {
      // Ignore track stop failures.
    }
  }
}

async function closeSessionResources(resources: InternalSessionResources) {
  try {
    await resources.context.close()
  } catch {
    // Ignore close failures.
  }
  stopStreamTracks(resources.stream)
  cleanupAudioElement(resources.audioElement)
}

async function createInputStream(
  preferences: MonitoringPreferences,
  logger: Logger,
  emit: (update: MonitoringUpdate) => void,
): Promise<MediaStream> {
  const attempts: MediaTrackConstraints[] = [
    buildAudioConstraints(preferences.mode, preferences.inputId),
  ]

  if (preferences.mode === 'callLike') {
    attempts.push(
      buildAudioConstraints(preferences.mode, preferences.inputId, {
        relaxProcessing: true,
      }),
    )
  }

  let lastError: unknown = null
  for (let index = 0; index < attempts.length; index += 1) {
    const constraints = attempts[index]
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: constraints,
      })
      if (index > 0) {
        emitWarning(emit, {
          code: 'constraints_relaxed',
          message:
            'Call-like constraints failed. Monitoring continues with relaxed processing.',
          details: {
            inputId: preferences.inputId || 'default',
            mode: preferences.mode,
          },
        })
      }
      return stream
    } catch (error) {
      lastError = error
      const canRetry = index + 1 < attempts.length && isConstraintError(error)
      if (canRetry) {
        logger.warn(
          'Audio constraints failed. Retrying with relaxed processing constraints.',
          { error },
        )
        continue
      }
      throw error
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }
  throw new DOMException('No audio track is available.', 'NotFoundError')
}

async function createSessionResources(
  stream: MediaStream,
): Promise<InternalSessionResources> {
  const track = stream.getAudioTracks()[0]
  if (!track) {
    throw new DOMException('No audio track is available.', 'NotFoundError')
  }

  const context = new AudioContext({ latencyHint: 'interactive' })
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 2048
  analyser.smoothingTimeConstant = 0.2
  const destination = context.createMediaStreamDestination()

  source.connect(analyser)
  analyser.connect(destination)

  const audioElement = document.createElement('audio')
  audioElement.autoplay = true
  audioElement.setAttribute('playsinline', 'true')
  audioElement.hidden = true
  audioElement.srcObject = destination.stream
  document.body.appendChild(audioElement)

  return {
    stream,
    track,
    context,
    analyser,
    destination,
    audioElement,
    meterBuffer: new Float32Array(analyser.fftSize),
  }
}

export function createBrowserMonitoringPort(logger: Logger): MonitoringPort {
  return {
    async start(
      preferences: MonitoringPreferences,
    ): Promise<MonitoringSessionHandle> {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException(
          'MediaDevices API is unavailable in this browser.',
          'NotSupportedError',
        )
      }

      const listeners = new Set<(update: MonitoringUpdate) => void>()
      const bufferedWarnings: MonitoringWarningUpdate[] = []
      let animationFrameId = 0
      let closed = false
      let silentWindowStartMs: number | null = null
      let silentWarningEmitted = false
      let monitoringStartedAtMs = 0

      const emit = (update: MonitoringUpdate) => {
        if (update.type === 'warning' && listeners.size === 0) {
          bufferedWarnings.push(update)
          return
        }
        listeners.forEach((listener) => listener(update))
      }

      const stream = await createInputStream(preferences, logger, emit)
      let resources: InternalSessionResources
      try {
        resources = await createSessionResources(stream)
      } catch (error) {
        stopStreamTracks(stream)
        throw error
      }

      const applied: AppliedConstraints = {
        ...resources.track.getSettings(),
      }

      const buildInputDetails = () => {
        const settings = resources.track.getSettings()
        const details: Record<string, string | number | boolean> = {
          inputId: preferences.inputId || 'default',
          mode: preferences.mode,
          trackLabel: resources.track.label || 'Unknown track',
        }
        if (typeof settings.sampleRate === 'number') {
          details.sampleRate = settings.sampleRate
        }
        if (typeof settings.channelCount === 'number') {
          details.channelCount = settings.channelCount
        }
        return details
      }

      const setOutputDevice = async (outputId: string) => {
        if (!supportsSetSinkId(resources.audioElement)) {
          if (outputId !== 'default') {
            throw new DOMException(
              'Output selection is not supported in this browser.',
              'NotSupportedError',
            )
          }
          return
        }
        const sinkId = outputId || 'default'
        await resources.audioElement.setSinkId(sinkId)
      }

      const handleTrackEnded = () => {
        emit({ type: 'track-ended' })
      }
      const handleTrackMuted = () => {
        emitWarning(emit, {
          code: 'input_muted',
          message:
            'Input track is muted by browser or device. Check DJI mute state and reconnect if needed.',
          details: buildInputDetails(),
        })
      }
      const handleTrackUnmuted = () => {
        logger.info('Input track unmuted.')
      }

      const stop = async () => {
        if (closed) {
          return
        }
        closed = true
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId)
          animationFrameId = 0
        }
        resources.track.removeEventListener('ended', handleTrackEnded)
        resources.track.removeEventListener('mute', handleTrackMuted)
        resources.track.removeEventListener('unmute', handleTrackUnmuted)
        await closeSessionResources(resources)
        listeners.clear()
      }

      const loop = () => {
        resources.analyser.getFloatTimeDomainData(
          resources.meterBuffer as unknown as Float32Array<ArrayBuffer>,
        )
        const meter = meterFromSamples(resources.meterBuffer)
        emit({
          type: 'metrics',
          meter,
          latency: latencyFromContext(resources.context),
        })

        const nowMs = performance.now()
        const elapsedMs = nowMs - monitoringStartedAtMs
        if (!silentWarningEmitted && elapsedMs >= SILENCE_WARMUP_MS) {
          if (meter.peak <= SILENCE_PEAK_EPSILON) {
            if (silentWindowStartMs === null) {
              silentWindowStartMs = nowMs
            }
            const silentDurationMs = nowMs - silentWindowStartMs
            if (silentDurationMs >= SILENCE_WINDOW_MS) {
              silentWarningEmitted = true
              emitWarning(emit, {
                code: 'input_silent',
                message:
                  'Input is active but signal stays near zero. Check DJI mute state and OS input routing.',
                details: buildInputDetails(),
              })
            }
          } else {
            silentWindowStartMs = null
          }
        }

        animationFrameId = requestAnimationFrame(loop)
      }

      resources.track.addEventListener('ended', handleTrackEnded)
      resources.track.addEventListener('mute', handleTrackMuted)
      resources.track.addEventListener('unmute', handleTrackUnmuted)

      if (resources.context.state !== 'running') {
        try {
          await resources.context.resume()
        } catch (error) {
          logger.warn('AudioContext resume failed.', { error })
        }
      }
      if (resources.context.state !== 'running') {
        emitWarning(emit, {
          code: 'context_not_running',
          message:
            'Audio engine is not fully running. Monitoring may stay silent until browser audio resumes.',
        })
      }

      if (preferences.outputId) {
        try {
          await setOutputDevice(preferences.outputId)
        } catch (error) {
          logger.warn(
            'Cannot apply selected output device. Falling back to default.',
            {
              error,
            },
          )
          emitWarning(emit, {
            code: 'output_switch_failed',
            message: 'Cannot switch output device. Falling back to default output.',
          })
          try {
            await setOutputDevice('default')
          } catch {
            // Ignore fallback errors.
          }
        }
      }

      try {
        await resources.audioElement.play()
      } catch (error) {
        logger.warn('Audio playback was blocked by the browser.', { error })
        emitWarning(emit, {
          code: 'playback_blocked',
          message:
            'Playback is blocked by browser autoplay policy. Click Start again.',
        })
      }

      monitoringStartedAtMs = performance.now()
      animationFrameId = requestAnimationFrame(loop)

      return {
        stop,
        getAppliedConstraints() {
          return applied
        },
        async setOutputDevice(outputId: string) {
          await setOutputDevice(outputId || 'default')
        },
        subscribe(listener): Unsubscribe {
          listeners.add(listener)
          for (const warning of bufferedWarnings) {
            listener(warning)
          }
          bufferedWarnings.length = 0
          return () => listeners.delete(listener)
        },
      }
    },
  }
}
