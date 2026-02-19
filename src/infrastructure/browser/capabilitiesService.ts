import type {
  Capabilities,
  CapabilitiesService,
} from '../../application/ports'

function supportsSinkSelection(): boolean {
  const forceNoSinkId =
    new URLSearchParams(window.location.search).get('forceNoSinkId') === '1'
  if (forceNoSinkId) {
    return false
  }
  const mediaPrototype = HTMLMediaElement.prototype as unknown as Record<
    string,
    unknown
  >
  return typeof mediaPrototype.setSinkId === 'function'
}

export function createCapabilitiesService(): CapabilitiesService {
  return {
    detect(): Capabilities {
      const hasMediaDevices = typeof navigator.mediaDevices !== 'undefined'
      return {
        secureContext: window.isSecureContext,
        hasMediaDevices,
        supportsSetSinkId: supportsSinkSelection(),
      }
    },
  }
}
