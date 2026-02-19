export type MonitoringErrorCode =
  | 'permission_denied'
  | 'device_not_found'
  | 'device_busy'
  | 'constraints'
  | 'security'
  | 'unsupported'
  | 'unknown'

export interface MonitoringError {
  code: MonitoringErrorCode
  message: string
}

export function normalizeMonitoringError(error: unknown): MonitoringError {
  const unknownError: MonitoringError = {
    code: 'unknown',
    message: 'Unexpected error while accessing audio devices.',
  }

  if (!(error instanceof DOMException)) {
    if (error instanceof Error && error.message) {
      return { ...unknownError, message: error.message }
    }
    return unknownError
  }

  const name = error.name

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return {
      code: 'permission_denied',
      message:
        'Microphone access is denied. Allow microphone access in browser and OS settings.',
    }
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      code: 'device_not_found',
      message: 'No microphone found. Connect a microphone and try again.',
    }
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      code: 'device_busy',
      message:
        'Microphone is busy or unavailable. Close other call apps or choose another input.',
    }
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return {
      code: 'constraints',
      message:
        'Selected input is unavailable for current constraints. Try System Default input.',
    }
  }

  if (name === 'SecurityError') {
    return {
      code: 'security',
      message:
        'This page requires HTTPS or localhost to access microphone devices.',
    }
  }

  if (name === 'NotSupportedError') {
    return {
      code: 'unsupported',
      message: 'This browser does not support required audio APIs.',
    }
  }

  if (name === 'AbortError' || name === 'InvalidStateError') {
    return {
      code: 'unknown',
      message:
        'Audio session was interrupted. Retry Start or reconnect the microphone.',
    }
  }

  return { ...unknownError, message: error.message || unknownError.message }
}
