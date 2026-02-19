import { formatDb } from '../domain/audio'
import type { AppDependencies } from '../application/ports'
import { createBrowserDependencies } from '../infrastructure/browser'
import type { MonitoringWarningCode } from '../domain/types'
import { useAuMonitorController } from './useAuMonitorController'

interface AppProps {
  dependencies?: AppDependencies
}

function latencyText(baseMs?: number, outputMs?: number): string {
  const parts: string[] = []
  if (typeof baseMs === 'number') {
    parts.push(`base ${baseMs} ms`)
  }
  if (typeof outputMs === 'number') {
    parts.push(`output ${outputMs} ms`)
  }
  if (parts.length === 0) {
    return '-'
  }
  return `${parts.join(' • ')} (estimated)`
}

function shouldShowInputTroubleshooting(
  statusCode: MonitoringWarningCode | null,
): boolean {
  return statusCode === 'input_silent' || statusCode === 'input_muted'
}

const defaultDependencies = createBrowserDependencies()

export default function App({ dependencies = defaultDependencies }: AppProps) {
  const controller = useAuMonitorController(dependencies)

  const secureContextBadge = controller.capabilities.secureContext
    ? 'HTTPS/localhost'
    : 'Insecure'
  const statusClass =
    controller.statusKind === 'ok'
      ? 'notice ok'
      : controller.statusKind === 'warning'
        ? 'notice warning'
        : controller.statusKind === 'error'
          ? 'notice error'
          : 'notice'
  const showInputTroubleshooting =
    controller.statusKind === 'warning' &&
    shouldShowInputTroubleshooting(controller.statusCode)

  return (
    <>
      <header className="container">
        <div className="header">
          <div>
            <h1>AuMonitor</h1>
            <p className="subtitle">
              Quick pre-call microphone check: monitor your <span className="mono">input</span>{' '}
              into <span className="mono">output</span> in real time (Raw / Call-like).
            </p>
          </div>
          <div className="badges">
            <span className="badge">Web</span>
            <span className="badge">{secureContextBadge}</span>
          </div>
        </div>

        {!controller.capabilities.secureContext && (
          <div className="notice warning" role="alert">
            This page requires HTTPS or localhost for microphone access.
          </div>
        )}
      </header>

      <main className="container">
        <section className="card">
          <h2>Safety</h2>
          <label className="checkbox" htmlFor="headphonesAck">
            <input
              id="headphonesAck"
              checked={controller.preferences.headphonesConfirmed}
              onChange={(event) =>
                controller.setHeadphonesConfirmed(event.target.checked)
              }
              type="checkbox"
            />
            I am using headphones (not speakers)
          </label>
          <p className="muted">
            Monitoring routes microphone audio back to output. Speakers may cause
            feedback.
          </p>
        </section>

        <section className="card">
          <h2>Devices</h2>
          <div className="grid">
            <div>
              <label htmlFor="inputSelect">Input (microphone)</label>
              <select
                id="inputSelect"
                onChange={(event) => controller.setInputId(event.target.value)}
                value={controller.preferences.inputId}
              >
                {controller.devices.inputs.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="outputSelect">Output (headphones)</label>
              <select
                disabled={!controller.capabilities.supportsSetSinkId}
                id="outputSelect"
                onChange={(event) => controller.setOutputId(event.target.value)}
                value={controller.preferences.outputId}
              >
                {(controller.capabilities.supportsSetSinkId
                  ? controller.devices.outputs
                  : [{ id: 'default', label: 'Default output', kind: 'audiooutput', isDefault: true }]
                ).map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label}
                  </option>
                ))}
              </select>
              <div className="muted small">
                {controller.capabilities.supportsSetSinkId
                  ? 'Output selection is supported.'
                  : 'This browser does not support output device selection.'}
              </div>
            </div>
          </div>
          <div className="row">
            <button
              className="secondary"
              disabled={controller.isRefreshingDevices}
              onClick={() => void controller.refreshDevices()}
              type="button"
            >
              {controller.isRefreshingDevices ? 'Refreshing...' : 'Refresh devices'}
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Mode</h2>
          <div className="segmented" role="tablist" aria-label="Mode">
            <button
              className={
                controller.preferences.mode === 'raw'
                  ? 'segmented-btn active'
                  : 'segmented-btn'
              }
              onClick={() => controller.setMode('raw')}
              type="button"
            >
              Raw
            </button>
            <button
              className={
                controller.preferences.mode === 'callLike'
                  ? 'segmented-btn active'
                  : 'segmented-btn'
              }
              onClick={() => controller.setMode('callLike')}
              type="button"
            >
              Call-like
            </button>
          </div>
          <p className="muted">
            Raw requests EC/NS/AGC = false. Call-like requests EC/NS/AGC = true
            (best-effort).
          </p>
        </section>

        <section className="card">
          <h2>Monitoring</h2>
          <div className="actions">
            <button
              disabled={!controller.canStart || controller.isBusy}
              onClick={controller.start}
              type="button"
            >
              Start
            </button>
            <button
              className="secondary"
              disabled={!controller.isMonitoring && !controller.isBusy}
              onClick={controller.stop}
              type="button"
            >
              Stop
            </button>
          </div>

          <div className="meters">
            <div className="meter-row">
              <div className="meter-label">RMS</div>
              <div className="meter">
                <div
                  className="meter-fill"
                  style={{ width: `${(controller.meter.rms * 100).toFixed(2)}%` }}
                />
              </div>
              <div className="meter-value">
                {formatDb(controller.meter.rms)} ({controller.meter.rms.toFixed(3)})
              </div>
            </div>
            <div className="meter-row">
              <div className="meter-label">Peak</div>
              <div className="meter">
                <div
                  className="meter-fill"
                  style={{ width: `${(controller.meter.peak * 100).toFixed(2)}%` }}
                />
              </div>
              <div className="meter-value">
                {formatDb(controller.meter.peak)} ({controller.meter.peak.toFixed(3)})
              </div>
            </div>
            <div className="meter-row">
              <div className="meter-label">Clipping</div>
              <div className={controller.meter.clipping ? 'clip on' : 'clip'}>
                {controller.meter.clipping ? 'YES' : 'No'}
              </div>
              <div className="meter-value">threshold 98%</div>
            </div>
          </div>

          <div className="stats">
            <div>
              <span className="stat-label">Latency</span>{' '}
              <span>
                {controller.latency
                  ? latencyText(
                      controller.latency.baseMs,
                      controller.latency.outputMs,
                    )
                  : '-'}
              </span>
            </div>
            <div>
              <span className="stat-label">Sample Rate</span>{' '}
              <span>
                {controller.latency
                  ? `${controller.latency.sampleRateHz} Hz`
                  : '-'}
              </span>
            </div>
            <div className="applied">
              <span className="stat-label">Applied</span>{' '}
              <code>
                {controller.appliedConstraints
                  ? JSON.stringify(controller.appliedConstraints)
                  : '-'}
              </code>
            </div>
          </div>

          <div className={statusClass} role="status">
            {controller.statusMessage}
          </div>
          {showInputTroubleshooting && (
            <div className="troubleshooting" role="note">
              <p className="troubleshooting-title">
                Troubleshooting for DJI/Bluetooth input
              </p>
              <ol className="troubleshooting-list">
                <li>Check mute state on DJI transmitter/receiver.</li>
                <li>Verify DJI microphone is selected in macOS Sound input.</li>
                <li>Switch mode to Call-like and retry monitoring.</li>
                <li>Reconnect the device and press Refresh devices.</li>
              </ol>
            </div>
          )}
        </section>
      </main>

      <footer className="container footer">
        <span className="muted small">
          Browser target: latest Chrome/Edge. Safari/Firefox are best-effort.
        </span>
      </footer>
    </>
  )
}
