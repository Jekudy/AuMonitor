import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import type { MonitoringSessionHandle } from './ports'
import { appMachine } from './machine'

const fakeSession: MonitoringSessionHandle = {
  stop: async () => undefined,
  setOutputDevice: async () => undefined,
  getAppliedConstraints: () => ({}),
  subscribe: () => () => undefined,
}

describe('appMachine', () => {
  it('follows start to monitoring to stop lifecycle', () => {
    const actor = createActor(appMachine).start()
    expect(actor.getSnapshot().value).toBe('idle')

    actor.send({ type: 'START_CLICKED' })
    expect(actor.getSnapshot().value).toBe('requestingPermission')

    actor.send({
      type: 'PERMISSION_GRANTED',
    })
    expect(actor.getSnapshot().value).toBe('starting')

    actor.send({
      type: 'SESSION_STARTED',
      session: fakeSession,
      applied: {},
    })
    expect(actor.getSnapshot().value).toBe('monitoring')

    actor.send({
      type: 'STOP_CLICKED',
    })
    expect(actor.getSnapshot().value).toBe('stopping')

    actor.send({
      type: 'SESSION_STOPPED',
    })
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })

  it('moves to error on permission denial', () => {
    const actor = createActor(appMachine).start()
    actor.send({ type: 'START_CLICKED' })
    actor.send({
      type: 'PERMISSION_DENIED',
      message: 'Denied',
    })
    expect(actor.getSnapshot().value).toBe('error')
    expect(actor.getSnapshot().context.statusKind).toBe('error')
    actor.stop()
  })

  it('stores warning code in status context', () => {
    const actor = createActor(appMachine).start()
    actor.send({ type: 'START_CLICKED' })
    actor.send({ type: 'PERMISSION_GRANTED' })
    actor.send({
      type: 'SESSION_STARTED',
      session: fakeSession,
      applied: {},
    })
    actor.send({
      type: 'SESSION_WARNING',
      code: 'input_silent',
      message: 'Input is silent.',
    })
    expect(actor.getSnapshot().context.statusKind).toBe('warning')
    expect(actor.getSnapshot().context.statusCode).toBe('input_silent')
    actor.stop()
  })

  it('handles warnings outside monitoring state', () => {
    const actor = createActor(appMachine).start()
    actor.send({
      type: 'SESSION_WARNING',
      code: 'output_switch_failed',
      message: 'Could not refresh devices. Try again.',
    })
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.statusKind).toBe('warning')
    expect(actor.getSnapshot().context.statusCode).toBe('output_switch_failed')
    expect(actor.getSnapshot().context.statusMessage).toBe(
      'Could not refresh devices. Try again.',
    )
    actor.stop()
  })
})
