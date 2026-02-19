import { afterEach, describe, expect, it, vi } from 'vitest'

import { createBrowserMonitoringPort } from './monitoringPort'
import type { Logger } from '../../application/ports'
import type { MonitoringPreferences, MonitoringUpdate } from '../../domain/types'

type TrackEventName = 'ended' | 'mute' | 'unmute'

const defaultPreferences: MonitoringPreferences = {
  mode: 'raw',
  inputId: 'device-1',
  outputId: 'default',
  headphonesConfirmed: true,
}

class FakeTrack {
  label = 'RIGHT-DJI-MIC2'
  private listeners: Record<TrackEventName, Set<EventListener>> = {
    ended: new Set<EventListener>(),
    mute: new Set<EventListener>(),
    unmute: new Set<EventListener>(),
  }

  getSettings(): MediaTrackSettings {
    return {
      sampleRate: 24000,
      channelCount: 1,
      deviceId: 'device-1',
    }
  }

  stop() {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type !== 'ended' && type !== 'mute' && type !== 'unmute') {
      return
    }
    this.listeners[type].add(listener as EventListener)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    if (type !== 'ended' && type !== 'mute' && type !== 'unmute') {
      return
    }
    this.listeners[type].delete(listener as EventListener)
  }

  emit(type: TrackEventName) {
    const event = new Event(type)
    for (const listener of this.listeners[type]) {
      listener(event)
    }
  }
}

interface TestHarness {
  track: FakeTrack
  updates: MonitoringUpdate[]
  getUserMediaMock: ReturnType<typeof vi.fn>
  runFrames: (count: number, frameStepMs: number, sampleValue: number) => void
}

function installHarness(options?: {
  getUserMediaImpl?: () => Promise<MediaStream>
}): TestHarness {
  const track = new FakeTrack()
  const stream = {
    getAudioTracks: () => [track as unknown as MediaStreamTrack],
    getTracks: () => [track as unknown as MediaStreamTrack],
  } as unknown as MediaStream
  let sampleValue = 0
  let nowMs = 0

  const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => nowMs)
  void nowSpy

  let rafId = 0
  const rafCallbacks = new Map<number, FrameRequestCallback>()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    rafId += 1
    rafCallbacks.set(rafId, callback)
    return rafId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id)
  })

  class FakeAudioContext {
    state: AudioContextState = 'running'
    sampleRate = 24000
    baseLatency = 0.011
    outputLatency = 0.18

    createMediaStreamSource() {
      return {
        connect() {},
      } as unknown as MediaStreamAudioSourceNode
    }

    createAnalyser() {
      return {
        fftSize: 2048,
        smoothingTimeConstant: 0.2,
        connect() {},
        getFloatTimeDomainData(buffer: Float32Array<ArrayBufferLike>) {
          for (let index = 0; index < buffer.length; index += 1) {
            buffer[index] = sampleValue
          }
        },
      } as unknown as AnalyserNode
    }

    createMediaStreamDestination() {
      return {
        stream: {} as MediaStream,
      } as MediaStreamAudioDestinationNode
    }

    async resume() {
      this.state = 'running'
    }

    async close() {}
  }

  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})

  const getUserMediaMock = vi.fn(
    options?.getUserMediaImpl || (async () => stream),
  )
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: getUserMediaMock,
      enumerateDevices: vi.fn(async () => []),
    },
  })

  const updates: MonitoringUpdate[] = []
  const runFrames = (count: number, frameStepMs: number, value: number) => {
    sampleValue = value
    for (let index = 0; index < count; index += 1) {
      const next = rafCallbacks.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined
      if (!next) {
        throw new Error('No animation frame callback queued.')
      }
      const [id, callback] = next
      rafCallbacks.delete(id)
      nowMs += frameStepMs
      callback(nowMs)
    }
  }

  return {
    track,
    updates,
    getUserMediaMock,
    runFrames,
  }
}

function createLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('createBrowserMonitoringPort', () => {
  it('emits input_silent warning once when stream stays near zero', async () => {
    const harness = installHarness()
    const port = createBrowserMonitoringPort(createLogger())

    const session = await port.start(defaultPreferences)
    session.subscribe((update) => {
      harness.updates.push(update)
    })

    harness.runFrames(50, 100, 0)

    const silentWarnings = harness.updates.filter(
      (update) => update.type === 'warning' && update.code === 'input_silent',
    )
    expect(silentWarnings).toHaveLength(1)

    await session.stop()
  })

  it('emits input_muted warning on track mute event', async () => {
    const harness = installHarness()
    const port = createBrowserMonitoringPort(createLogger())

    const session = await port.start(defaultPreferences)
    session.subscribe((update) => {
      harness.updates.push(update)
    })

    harness.track.emit('mute')

    const mutedWarning = harness.updates.find(
      (update) => update.type === 'warning' && update.code === 'input_muted',
    )
    expect(mutedWarning).toBeDefined()

    await session.stop()
  })

  it('retries with relaxed constraints after OverconstrainedError', async () => {
    const track = new FakeTrack()
    const stream = {
      getAudioTracks: () => [track as unknown as MediaStreamTrack],
      getTracks: () => [track as unknown as MediaStreamTrack],
    } as unknown as MediaStream
    const harness = installHarness({
      getUserMediaImpl: vi
        .fn()
        .mockRejectedValueOnce(
          new DOMException('constraints', 'OverconstrainedError'),
        )
        .mockResolvedValueOnce(stream),
    })
    const port = createBrowserMonitoringPort(createLogger())

    const session = await port.start({
      ...defaultPreferences,
      mode: 'callLike',
    })
    session.subscribe((update) => {
      harness.updates.push(update)
    })

    const warning = harness.updates.find(
      (update) =>
        update.type === 'warning' && update.code === 'constraints_relaxed',
    )
    expect(warning).toBeDefined()
    expect(harness.getUserMediaMock).toHaveBeenCalledTimes(2)

    await session.stop()
  })

  it('does not emit input_silent warning for non-silent signal', async () => {
    const harness = installHarness()
    const port = createBrowserMonitoringPort(createLogger())

    const session = await port.start(defaultPreferences)
    session.subscribe((update) => {
      harness.updates.push(update)
    })

    harness.runFrames(60, 100, 0.04)

    const silentWarning = harness.updates.find(
      (update) => update.type === 'warning' && update.code === 'input_silent',
    )
    expect(silentWarning).toBeUndefined()

    await session.stop()
  })

  it('stops stream tracks if session resource initialization fails', async () => {
    const stopTrack = vi.fn()
    const track = {
      stop: stopTrack,
      getSettings: () => ({} as MediaTrackSettings),
      label: 'failing-track',
    } as unknown as MediaStreamTrack
    const stream = {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => stream),
        enumerateDevices: vi.fn(async () => []),
      },
    })
    vi.stubGlobal(
      'AudioContext',
      class FailingAudioContext {
        constructor() {
          throw new Error('audio-context-init-failed')
        }
      },
    )

    const port = createBrowserMonitoringPort(createLogger())

    await expect(port.start(defaultPreferences)).rejects.toThrow(
      'audio-context-init-failed',
    )
    expect(stopTrack).toHaveBeenCalledTimes(1)
  })
})
