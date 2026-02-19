import { assign, setup } from 'xstate'

import type { MonitoringSessionHandle } from './ports'
import type {
  AppliedConstraints,
  AppStatus,
  LatencySnapshot,
  MeterSnapshot,
  MonitoringWarningCode,
  StatusKind,
} from '../domain/types'
import { ZERO_METER } from '../domain/audio'

export interface AppMachineContext {
  status: AppStatus
  statusKind: StatusKind
  statusCode: MonitoringWarningCode | null
  statusMessage: string
  lastError: string | null
  session: MonitoringSessionHandle | null
  meter: MeterSnapshot
  latency: LatencySnapshot | null
  applied: AppliedConstraints | null
}

export type AppMachineEvent =
  | { type: 'START_CLICKED' }
  | { type: 'STOP_CLICKED' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED'; message: string }
  | { type: 'SESSION_STARTED'; session: MonitoringSessionHandle; applied: AppliedConstraints }
  | { type: 'SESSION_FAILED'; message: string }
  | { type: 'SESSION_STOPPED'; message?: string }
  | { type: 'SESSION_WARNING'; message: string; code?: MonitoringWarningCode }
  | { type: 'METRICS_UPDATED'; meter: MeterSnapshot; latency: LatencySnapshot }
  | { type: 'TRACK_ENDED' }
  | { type: 'DEVICE_CHANGED' }
  | { type: 'MODE_CHANGED' }
  | { type: 'INPUT_CHANGED' }
  | { type: 'OUTPUT_CHANGED' }

export const initialContext: AppMachineContext = {
  status: 'idle',
  statusKind: 'neutral',
  statusCode: null,
  statusMessage: 'Stopped',
  lastError: null,
  session: null,
  meter: ZERO_METER,
  latency: null,
  applied: null,
}

export const appMachine = setup({
  types: {
    context: {} as AppMachineContext,
    events: {} as AppMachineEvent,
  },
}).createMachine({
  id: 'auMonitor',
  initial: 'idle',
  context: initialContext,
  on: {
    SESSION_WARNING: {
      actions: assign({
        statusKind: 'warning',
        statusCode: ({ event }) => event.code || null,
        statusMessage: ({ event }) => event.message,
      }),
    },
  },
  states: {
    idle: {
      entry: assign({
        status: 'idle',
        statusKind: 'neutral',
        statusCode: null,
        statusMessage: 'Stopped',
        lastError: null,
      }),
      on: {
        START_CLICKED: {
          target: 'requestingPermission',
          actions: assign({
            statusMessage: 'Requesting microphone permission...',
            statusKind: 'neutral',
            statusCode: null,
          }),
        },
      },
    },
    requestingPermission: {
      entry: assign({
        status: 'requestingPermission',
      }),
      on: {
        PERMISSION_GRANTED: {
          target: 'starting',
          actions: assign({
            statusMessage: 'Starting monitoring...',
            statusKind: 'neutral',
            statusCode: null,
          }),
        },
        PERMISSION_DENIED: {
          target: 'error',
          actions: assign({
            lastError: ({ event }) => event.message,
          }),
        },
        SESSION_FAILED: {
          target: 'error',
          actions: assign({
            lastError: ({ event }) => event.message,
          }),
        },
        STOP_CLICKED: {
          target: 'idle',
        },
      },
    },
    starting: {
      entry: assign({
        status: 'starting',
      }),
      on: {
        SESSION_STARTED: {
          target: 'monitoring',
          actions: assign({
            session: ({ event }) => event.session,
            applied: ({ event }) => event.applied,
            statusKind: 'ok',
            statusCode: null,
            statusMessage: 'Monitoring',
            lastError: null,
          }),
        },
        SESSION_FAILED: {
          target: 'error',
          actions: assign({
            lastError: ({ event }) => event.message,
          }),
        },
        STOP_CLICKED: {
          target: 'idle',
        },
      },
    },
    monitoring: {
      entry: assign({
        status: 'monitoring',
      }),
      on: {
        METRICS_UPDATED: {
          actions: assign({
            meter: ({ event }) => event.meter,
            latency: ({ event }) => event.latency,
          }),
        },
        TRACK_ENDED: {
          target: 'stopping',
          actions: assign({
            statusMessage: 'Input stream ended. Stopping...',
            statusKind: 'warning',
            statusCode: null,
          }),
        },
        STOP_CLICKED: {
          target: 'stopping',
          actions: assign({
            statusMessage: 'Stopping...',
            statusKind: 'neutral',
            statusCode: null,
          }),
        },
      },
    },
    stopping: {
      entry: assign({
        status: 'stopping',
      }),
      on: {
        SESSION_STOPPED: {
          target: 'idle',
          actions: assign({
            session: null,
            applied: null,
            meter: ZERO_METER,
            latency: null,
            statusMessage: ({ event }) => event.message || 'Stopped',
            statusKind: 'neutral',
            statusCode: null,
          }),
        },
        SESSION_FAILED: {
          target: 'error',
          actions: assign({
            session: null,
            applied: null,
            meter: ZERO_METER,
            latency: null,
            lastError: ({ event }) => event.message,
            statusCode: null,
          }),
        },
      },
    },
    error: {
      entry: assign({
        status: 'error',
        statusKind: 'error',
        statusCode: null,
        statusMessage: ({ context }) => context.lastError || 'Unexpected error.',
      }),
      on: {
        START_CLICKED: {
          target: 'requestingPermission',
          actions: assign({
            statusMessage: 'Requesting microphone permission...',
            statusKind: 'neutral',
            statusCode: null,
            lastError: null,
          }),
        },
        STOP_CLICKED: {
          target: 'idle',
          actions: assign({
            session: null,
            applied: null,
            meter: ZERO_METER,
            latency: null,
            statusCode: null,
          }),
        },
      },
    },
  },
})
