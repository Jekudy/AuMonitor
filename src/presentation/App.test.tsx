import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import type { AppDependencies } from '../application/ports'
import App from './App'
import type { MonitoringUpdate } from '../domain/types'

const deps: AppDependencies = {
  capabilitiesService: {
    detect() {
      return {
        secureContext: true,
        hasMediaDevices: true,
        supportsSetSinkId: false,
      }
    },
  },
  settingsStore: {
    load(defaults) {
      return defaults
    },
    save() {},
  },
  devicePort: {
    async requestInputPermission() {},
    async enumerateInputs() {
      return [
        {
          id: 'default',
          label: 'System Default',
          kind: 'audioinput',
          isDefault: true,
        },
      ]
    },
    async enumerateOutputs() {
      return [
        {
          id: 'default',
          label: 'System Default',
          kind: 'audiooutput',
          isDefault: true,
        },
      ]
    },
    onDeviceChange() {
      return () => undefined
    },
  },
  monitoringPort: {
    async start() {
      throw new Error('Not needed in this test')
    },
  },
  logger: {
    info() {},
    warn() {},
    error() {},
  },
}

afterEach(() => {
  cleanup()
})

describe('App', () => {
  it('keeps Start disabled until headphones confirmation', async () => {
    const user = userEvent.setup()
    render(<App dependencies={deps} />)

    const startButton = screen.getByRole('button', { name: 'Start' })
    expect(startButton).toBeDisabled()

    await user.click(
      screen.getByRole('checkbox', { name: /I am using headphones/i }),
    )

    expect(startButton).toBeEnabled()
  })

  it('shows troubleshooting block when input warning is reported', async () => {
    const user = userEvent.setup()
    const monitoringDeps: AppDependencies = {
      ...deps,
      monitoringPort: {
        async start() {
          return {
            stop: async () => undefined,
            setOutputDevice: async () => undefined,
            getAppliedConstraints: () => ({}),
            subscribe(listener: (update: MonitoringUpdate) => void) {
              listener({
                type: 'warning',
                code: 'input_silent',
                message: 'Input is active but signal stays near zero.',
              })
              return () => undefined
            },
          }
        },
      },
    }

    render(<App dependencies={monitoringDeps} />)

    await user.click(
      screen.getByRole('checkbox', { name: /I am using headphones/i }),
    )
    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(
      await screen.findByText('Troubleshooting for DJI/Bluetooth input'),
    ).toBeVisible()
  })
})
