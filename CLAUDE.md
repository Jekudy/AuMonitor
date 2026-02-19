# CLAUDE.md

## What
AuMonitor is a web-first pre-call microphone check tool.
It verifies microphone and output behavior in about 30 seconds with live monitoring, mode comparison (`raw` vs `callLike`), and key signal indicators (RMS, Peak, clipping, latency).

## Current Phase
Phase: Stability hardening and GitHub Pages release path simplification.

Goals for this phase:
- Keep lifecycle stability fixes in place.
- Maintain clear edge-case behavior for device/browser churn.
- Keep deployment minimal and reliable via GitHub Pages.

## Rules
- Keep architecture layered: `presentation -> application -> domain -> infrastructure`.
- All monitoring lifecycle transitions must be deterministic via XState machine.
- Any lifecycle change (`start/stop/restart`) requires regression tests.
- Browser security constraints are first-class: HTTPS (or localhost) is mandatory for microphone access.
- No backend audio processing and no audio persistence.
- Deployment target is GitHub Pages by default.

## Known Issues
- GitHub Pages deploy depends on GitHub Actions availability.

## Known Issues & Quirks
- 2026-02-19 (resolved): `STOP` during `starting` could leave stale monitoring session resources.
- 2026-02-19 (resolved): mode/input changes in transitional states could desync UI preferences and active session config.
- 2026-02-19 (resolved): device input fallback after `devicechange` could update UI without deterministic session reconciliation.
- 2026-02-19: Docker/Hostinger path removed as overengineering for current static-app scope.
- 2026-02-19 (resolved): deploy workflow was gated only by push, now gated by successful `CI` run for `main`.
- 2026-02-19 (resolved): `refreshDevices` warnings now surface outside `monitoring` via global `SESSION_WARNING` handling.
- 2026-02-19 (resolved): startup now cleans acquired media tracks if session resource init fails.
- 2026-02-19 (resolved): GitHub Pages setup failed on private repository with `422 plan does not support`; workaround applied by switching repository visibility to public.
- 2026-02-19 (resolved): input selector could remain on `default` until manual refresh after first permission grant.
- 2026-02-19 (resolved): `callLike` AGC artifacts reduced by keeping AGC disabled in call-like profile.
- 2026-02-19 (resolved): mobile layout overflow fixed for meter rows/actions/segmented controls.
- 2026-02-19 (resolved): PRD startup/warning metrics were missing in runtime, now emitted to in-browser telemetry buffer.
- 2026-02-19 (resolved): tab suspend/resume now surfaces warning state and triggers device refresh on resume.
- 2026-02-19 (resolved): insecure-origin and busy-device edge cases now have explicit regression tests.
- 2026-02-19 (resolved): `main` branch protection enabled (CI required, 1 PR approval, conversation resolution).
- 2026-02-19 (resolved): CI check name aligned with branch protection context via explicit job name `CI`.
- 2026-02-19 (resolved): post-deploy smoke now uses retry loop to reduce false alerts from Pages propagation delay.

## Success Criteria (Current Phase)
- Monitoring lifecycle remains stable under rapid user actions.
- Critical edge cases are covered by tests and documented behavior.
- GitHub Pages deployment stays reproducible and predictable.

## Decision Log
- 2026-02-19: Deployment strategy switched back to GitHub Pages as primary path.
- 2026-02-19: System analysis artifacts introduced: use-case catalog, risk register, deployment design, runbook.
