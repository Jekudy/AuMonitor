# PRD.md

## Problem / Opportunity
Users need a fast and reliable way to validate microphone quality before calls.
Current browser/device variability causes missed permissions, wrong device routing, muted inputs, and unstable startup behavior.

Opportunity:
- Reduce failed call starts due to local audio setup problems.
- Provide one predictable flow users can run before any meeting.

## Target Audience
- Primary: remote workers using laptops + external/Bluetooth microphones.
- Secondary: creators and support/sales teams who need repeatable pre-call checks.

## Product Goals
- Give a reliable pre-call check experience in <= 30 seconds.
- Surface actionable warnings when setup is broken.
- Maintain stable lifecycle behavior under user/device churn.
- Support low-friction deployment through GitHub Pages.

## Non-Goals
- No cloud audio processing.
- No meeting platform integrations in this phase.
- No account system or backend persistence.

## Functional Requirements
1. User can start/stop monitoring safely with explicit headphone confirmation.
2. User can pick input/output device (with browser capability fallback).
3. User can switch between `raw` and `callLike` monitoring modes.
4. App shows live RMS/Peak/clipping/latency and applied constraints.
5. App detects and reports key warning states (`input_silent`, `input_muted`, output switch failures).
6. App handles permission-denied and unavailable-device cases with recoverable UX.

## Stability Requirements
1. No orphaned media sessions after stop/restart actions.
2. UI state and active session configuration must stay consistent.
3. Device changes while monitoring must not crash app.
4. Startup/stop behavior must be deterministic under rapid user clicks.

## Deployment Requirements (GitHub Pages)
1. Build output is static (`dist/`) and reproducible.
2. Deployment is automated from `main` via GitHub Actions.
3. Rollback is possible by revert to last known-good commit.
4. Deployed site is available over HTTPS.

## NFR / SLO / SLI
- Availability SLO: 99.5% monthly (frontend reachable over HTTPS).
- Startup success SLO: >= 98% successful transitions to `monitoring` on supported browsers.
- Median time-to-monitoring: <= 3 seconds after `Start` (permission already granted).
- Error budget: <= 2% failed starts per release cohort.

## Metrics
- `monitor_start_attempts`
- `monitor_start_success`
- `monitor_start_failure_by_error_code`
- `warning_events_by_code`
- `time_to_monitoring_ms`
- `session_unexpected_stop_count`

## Milestones
1. System hardening spec and risk matrix.
2. Lifecycle race-condition fixes and regression tests.
3. GitHub Pages deployment automation and smoke checks.
4. Release readiness with rollback procedure.

## Out of Scope (Now)
- Native desktop wrapper.
- Historical analytics dashboard.
- Multi-user settings sync.

## Open Questions
1. Нужен ли отдельный staging preview кроме PR checks?
2. Нужен ли внешний мониторинг доступности Pages, или достаточно GitHub Actions + ручного smoke?
3. Should we support non-Chromium browsers as a first-class SLA target in this phase?
