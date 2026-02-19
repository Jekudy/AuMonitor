# AuMonitor Architecture

## Goal

Deliver a reliable 30-second pre-call microphone check with clear separation of concerns and deterministic lifecycle behavior.

## Layered design

```text
presentation (React UI)
    -> application (state machine + orchestration)
        -> domain (types, constraints, meter math)
            -> infrastructure (browser adapters)
```

## Modules

- `src/domain`
  - `types.ts`: public domain contracts
  - `audio.ts`: constraints, meter and latency calculations
- `src/application`
  - `ports.ts`: interfaces (`DevicePort`, `MonitoringPort`, `SettingsPort`)
  - `machine.ts`: lifecycle finite state machine
  - `errors.ts`: browser error normalization
- `src/infrastructure/browser`
  - `devicePort.ts`: media device enumeration + permission
  - `monitoringPort.ts`: WebAudio session implementation
  - `settingsStore.ts`: localStorage adapter
  - `capabilitiesService.ts`: feature detection
  - `logger.ts`: browser logger
- `src/presentation`
  - `App.tsx`: UI
  - `useAuMonitorController.ts`: orchestration glue

## State machine

States:

1. `idle`
2. `requestingPermission`
3. `starting`
4. `monitoring`
5. `stopping`
6. `error`

Key transitions:

1. `START_CLICKED -> requestingPermission`
2. `PERMISSION_GRANTED -> starting`
3. `SESSION_STARTED -> monitoring`
4. `STOP_CLICKED -> stopping`
5. `SESSION_STOPPED -> idle`
6. `PERMISSION_DENIED | SESSION_FAILED -> error`

Why:

- prevents double-start races
- centralizes lifecycle status
- keeps stop/start behavior predictable

## Dependency lifecycle

Application scope (singletons):

- capabilities service
- settings store
- logger
- port factories

Session scope (per monitoring run):

- media stream and audio track
- audio context and nodes
- RAF meter loop
- event listeners

Session resources are always released on `stop()`.

## Public interfaces

- `DevicePort`
  - `requestInputPermission()`
  - `enumerateInputs()`
  - `enumerateOutputs()`
  - `onDeviceChange(cb)`
- `MonitoringPort`
  - `start(preferences) -> MonitoringSessionHandle`
- `MonitoringSessionHandle`
  - `stop()`
  - `setOutputDevice(outputId)`
  - `getAppliedConstraints()`
  - `subscribe(listener)`
- `SettingsPort`
  - `load(defaults)`
  - `save(preferences)`

## Browser constraints

- `setSinkId` support is optional and feature-detected.
- `Raw`/`Call-like` constraints are best-effort per browser behavior.
- no backend, no cloud audio path.

