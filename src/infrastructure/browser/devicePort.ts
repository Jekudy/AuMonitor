import type {
  DevicePort,
  Logger,
  Unsubscribe,
} from '../../application/ports'
import type { DeviceKind, DeviceOption } from '../../domain/types'

function ensureMediaDevices() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      'MediaDevices API is unavailable in this browser.',
      'NotSupportedError',
    )
  }
}

function mapDevices(
  devices: MediaDeviceInfo[],
  kind: DeviceKind,
): DeviceOption[] {
  const filtered = devices.filter((device) => device.kind === kind)
  const options: DeviceOption[] = [
    {
      id: 'default',
      label: 'System Default',
      kind,
      isDefault: true,
    },
  ]

  const seen = new Set<string>()
  let fallbackIndex = 1
  for (const device of filtered) {
    if (!device.deviceId || seen.has(device.deviceId)) {
      continue
    }
    seen.add(device.deviceId)
    options.push({
      id: device.deviceId,
      label:
        device.label.trim().length > 0
          ? device.label
          : `${kind === 'audioinput' ? 'Microphone' : 'Output'} ${fallbackIndex++}`,
      kind,
      isDefault: false,
    })
  }

  return options
}

async function enumerate(kind: DeviceKind): Promise<DeviceOption[]> {
  ensureMediaDevices()
  const devices = await navigator.mediaDevices.enumerateDevices()
  return mapDevices(devices, kind)
}

export function createBrowserDevicePort(logger: Logger): DevicePort {
  return {
    async requestInputPermission() {
      ensureMediaDevices()
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      for (const track of stream.getTracks()) {
        track.stop()
      }
    },
    enumerateInputs() {
      return enumerate('audioinput')
    },
    enumerateOutputs() {
      return enumerate('audiooutput')
    },
    onDeviceChange(callback: () => void): Unsubscribe {
      if (!navigator.mediaDevices?.addEventListener) {
        return () => undefined
      }
      const handler = () => {
        logger.info('Audio device change detected.')
        callback()
      }
      navigator.mediaDevices.addEventListener('devicechange', handler)
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handler)
      }
    },
  }
}

