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
8. Run smoke checks on published URL

## Smoke Checks
1. HTTPS endpoint loads app.
2. App loads and `Start` button behavior is correct.
3. Fallback message appears for unsupported output selection path.

## Incident Triage
1. Check latest `Deploy Pages` and `CI` workflow runs.
2. Verify built artifact (`dist`) in workflow logs.
3. Confirm Pages settings use `GitHub Actions` deployment source.
4. If broken after release, rollback by reverting commit(s) on `main`.

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
  - Fix: deploy workflow now runs on successful `CI` workflow completion for `main` (or manual dispatch).
  - Regression: workflow trigger contract documented in `docs/DEPLOYMENT_GITHUB_PAGES.md`.

## Last Verified
- Date: 2026-02-19
- Commands:
  1. `npm run lint`
  2. `npm run typecheck`
  3. `npm run test`
  4. `npm run test:e2e`

## Rollback Procedure
1. Identify last known-good commit on `main`.
2. Revert problematic commit(s).
3. Push revert commit.
4. Wait for `Deploy Pages` workflow to complete.
5. Re-run smoke checks.
