# runbook.md

## Purpose
Operational guide for stable AuMonitor deployment and incident handling.

## Environment Targets
- Primary: GitHub Pages (production)
- Validation: local dev + CI checks

## Release Checklist
1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run test:e2e`
5. Push/merge to `main`
6. Verify `CI` workflow success on `main`
7. Verify `Deploy Pages` workflow success
8. Verify `Post Deploy Smoke` workflow success
9. Run smoke checks on published URL

## Smoke Checks
1. HTTPS endpoint loads app.
2. App loads and `Start` button behavior is correct.
3. Fallback message appears for unsupported output selection path.
4. Post-deploy smoke workflow passes (`Post Deploy Smoke`).

## Telemetry Checks
1. Open DevTools and inspect `window.__AUMONITOR_TELEMETRY__`.
2. Verify startup path emits:
   - `monitor_start_attempts`
   - `monitor_start_success`
   - `time_to_monitoring_ms`
3. Verify warning path emits `warning_events_by_code`.
4. See details in `docs/OBSERVABILITY.md`.

## Incident Triage
1. Check latest `Deploy Pages` and `CI` workflow runs.
2. Check latest `Post Deploy Smoke` run and issue alerts.
3. Check latest `Security Audit` run (runtime gate).
4. Verify built artifact (`dist`) in workflow logs.
5. Confirm Pages settings use `GitHub Actions` deployment source.
6. If broken after release, rollback by reverting commit(s) on `main`.

## Known Failure Patterns
- Browser permission denial (user environment)
- Device contention (another app/tab)
- Insecure context blocking media APIs
- Lifecycle race conditions under rapid UI actions

## Known Bugs & Status
- BUG-2026-02-19-01 (resolved): stale session leak when user clicked `Stop` during `starting`.
  - Fix: stale-start cleanup with attempt ownership and explicit `session.stop()` on canceled start.
  - Regression: `src/presentation/useAuMonitorController.test.tsx` (`stops a stale session when stop is clicked during starting`).
- BUG-2026-02-19-02 (resolved): mode/input change during transitional states could start with outdated config.
  - Fix: deferred reconfiguration queue and deterministic restart once monitoring is active.
  - Regression: `src/presentation/useAuMonitorController.test.tsx` (`defers mode changes made during starting...`).
- BUG-2026-02-19-03 (resolved): input fallback on `devicechange` could update preferences without restarting session.
  - Fix: device-change reconciliation queues reconfiguration and restarts active session.
  - Regression: `src/presentation/useAuMonitorController.test.tsx` (`reconciles device-change input fallback...`).
- BUG-2026-02-19-04 (resolved): partial startup failure could leak active microphone track.
  - Fix: explicit stream track cleanup when session resource initialization fails.
  - Regression: `src/infrastructure/browser/monitoringPort.test.ts` (`stops stream tracks if session resource initialization fails`).
- BUG-2026-02-19-05 (resolved): `refreshDevices` warning path was silent outside `monitoring`.
  - Fix: global `SESSION_WARNING` handling in state machine.
  - Regression: `src/application/machine.test.ts` (`handles warnings outside monitoring state`), `src/presentation/useAuMonitorController.test.tsx` (`surfaces device refresh failures while idle`).
- BUG-2026-02-19-06 (resolved): Pages deploy could publish even when CI failed.
  - Fix: deploy workflow now runs only on successful `CI` workflow completion for `main`.
  - Regression: workflow trigger contract documented in `docs/DEPLOYMENT_GITHUB_PAGES.md`.
- BUG-2026-02-19-07 (resolved): input selector could stay locked to `default` until manual refresh after first permission grant.
  - Fix: explicit device refresh right after successful permission preflight and grant in requesting-permission flow.
  - Regression: `src/presentation/useAuMonitorController.test.tsx` (`requests permission on load and refreshes inputs without extra prompt on start`).
- BUG-2026-02-19-08 (resolved): `callLike` monitoring profile introduced aggressive AGC artifacts on some microphones.
  - Fix: updated call-like constraints to keep AGC off (`echoCancellation=true`, `noiseSuppression=true`, fallback keeps EC on and relaxes NS).
  - Regression: `src/domain/audio.test.ts` call-like and relaxed call-like constraints assertions.
- BUG-2026-02-19-09 (resolved): layout could overflow on mobile widths.
  - Fix: responsive rules for actions, segmented control, meter rows and card spacing.
  - Regression: `e2e/smoke.spec.ts` (`keeps layout stable on mobile width`).
- BUG-2026-02-19-10 (resolved): startup outcomes were not observable against PRD SLO/SLI metrics.
  - Fix: telemetry instrumentation for start attempts/success/failure, warning codes, time-to-monitoring and unexpected stops.
  - Regression: `src/presentation/useAuMonitorController.test.tsx` metrics assertions.
- BUG-2026-02-19-11 (resolved): background tab suspend/resume had no explicit recovery signal.
  - Fix: `visibilitychange` handling warns on backgrounding and refreshes devices on resume.
  - Regression: `src/presentation/useAuMonitorController.test.tsx` (`warns on tab backgrounding and refreshes devices...`).
- BUG-2026-02-19-12 (resolved): insecure origin and device contention edge cases lacked explicit regression coverage.
  - Fix: added tests for insecure-origin guidance and busy-device start failure path.
  - Regression: `src/presentation/App.test.tsx` insecure-origin test, `src/presentation/useAuMonitorController.test.tsx` busy-device test.
- BUG-2026-02-19-13 (resolved): `main` branch lacked enforcement of CI/review gates.
  - Fix: GitHub branch protection enabled (`CI` required, 1 approving review, conversation resolution, admin enforcement).
  - Verification: `gh api repos/Jekudy/AuMonitor/branches/main/protection` returns active policy.
- BUG-2026-02-19-14 (resolved): branch protection required check context drifted from emitted CI check name.
  - Fix: CI job now emits explicit check run name `CI` (`.github/workflows/ci.yml`).
  - Verification: next CI run exposes `CI` check context for branch protection.
- BUG-2026-02-19-15 (resolved): post-deploy smoke could false-fail due to fixed propagation delay.
  - Fix: replaced static wait with bounded retry loop (8 attempts, 15s interval).
  - Verification: `.github/workflows/post-deploy-smoke.yml` retries before opening incident issue.

## Last Verified
- Date: 2026-02-19
- Commands:
  1. `npm run lint`
  2. `npm run typecheck`
  3. `npm run test`
  4. `npm run test:e2e`
  5. `npm run build`

## Rollback Procedure
1. Identify last known-good commit on `main`.
2. Revert problematic commit(s).
3. Push revert commit.
4. Wait for `Deploy Pages` workflow to complete.
5. Re-run smoke checks.
