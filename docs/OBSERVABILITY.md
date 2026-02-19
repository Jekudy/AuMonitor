# OBSERVABILITY.md

## Goal
Define runtime signals used to evaluate startup stability and warning quality.

## Event Stream
Client telemetry is written to `window.__AUMONITOR_TELEMETRY__` as an in-memory
ring buffer (max 300 records). In development mode events are also logged via
the browser logger.

Record shape:

```ts
{
  eventName: string
  payload: Record<string, string | number | boolean | null>
  recordedAtIso: string
}
```

## Implemented Metrics
- `monitor_start_attempts`
- `monitor_start_success`
- `monitor_start_failure_by_error_code`
- `warning_events_by_code`
- `time_to_monitoring_ms`
- `session_unexpected_stop_count`

## How To Inspect Locally
1. Open browser DevTools Console on the app page.
2. Run `window.__AUMONITOR_TELEMETRY__`.
3. Filter by `eventName` to validate a specific flow.

## Quick Checks
1. Start success path should include:
   - `monitor_start_attempts`
   - `monitor_start_success`
   - `time_to_monitoring_ms`
2. Permission denial or busy device should include:
   - `monitor_start_attempts`
   - `monitor_start_failure_by_error_code`
3. Session warning should include:
   - `warning_events_by_code`

