# AuMonitor QA Checklist

## Scope

Manual regression + automated checks for core monitoring reliability.

## Automated checks

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run test:e2e`

## Manual regression scenarios

### Core flow

1. Open app on HTTPS/localhost.
2. Verify `Start` is disabled before safety checkbox.
3. Enable checkbox and start monitoring.
4. Speak and verify RMS/Peak meters move.
5. Stop and verify monitoring halts immediately.

### Mode behavior

1. Start in `Raw`.
2. Switch to `Call-like`.
3. Verify session restarts and app remains stable.
4. Confirm applied settings update (best-effort).

### Output routing

1. On Chrome/Edge, switch output from default to headphones.
2. Switch back to default output.
3. Verify fallback warning if selected output becomes unavailable.

### Device changes

1. Start monitoring.
2. Disconnect current input device.
3. Verify controlled stop/warning and no crash.
4. Reconnect device and refresh list.

### Permission and errors

1. Deny microphone access.
2. Verify clear status error and recoverability.
3. Grant permission and re-run start.

## Hardware matrix (target)

### Input

- Built-in microphone
- AirPods microphone
- DJI Mic 2
- iPhone microphone (if exposed by OS)
- Krisp Microphone

### Output

- AirPods
- Krisp Speaker
- Default output fallback

## Cross-platform matrix

1. macOS + Chrome latest
2. macOS + Edge latest
3. Windows + Chrome latest
4. Windows + Edge latest

## Known limitations (to verify and communicate)

1. `setSinkId` is unavailable in some browsers.
2. Constraint application (`EC/NS/AGC`) is browser-controlled.
3. Bluetooth latency varies by device and profile.

