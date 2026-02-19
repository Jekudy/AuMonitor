# AuMonitor

AuMonitor is a web-first pre-call microphone checker for Windows/macOS.  
It lets you monitor `input -> output` in real time, compare `Raw` vs `Call-like` mode, and see RMS/Peak/Clipping/Latency in ~30 seconds before a call.

## Live

Primary deployment target: GitHub Pages.

After deploy, URL is:

`https://<github_username>.github.io/<repo_name>/`

## Stack and architecture

- Runtime: `React 19 + TypeScript 5 + Vite 7`
- Lifecycle: `XState` finite state machine
- Tests: `Vitest` + `Testing Library` + `Playwright` smoke
- Hosting: GitHub Pages from built `dist/` artifact

Architecture docs:
- `docs/ARCHITECTURE.md`
- `docs/QA.md`
- `docs/DEPLOYMENT_GITHUB_PAGES.md`

## Local development

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` - start local dev server
- `npm run build` - typecheck and build production bundle
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm run test` - run unit/component tests
- `npm run test:e2e` - run Playwright smoke tests

## Usage

1. Open in latest Chrome/Edge over HTTPS (or localhost).
2. Connect headphones and confirm safety checkbox.
3. Choose input device and mode (`Raw` / `Call-like`).
4. If available, select output device.
5. Start monitoring, speak for 10-20 seconds, then stop.

## Browser support matrix

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Input capture / WebAudio | Yes | Yes | Best-effort | Best-effort |
| Output device selection (`setSinkId`) | Yes | Yes | No | No |
| Raw/Call-like constraints | Best-effort | Best-effort | Best-effort | Best-effort |

## Known limitations

- Browser may ignore some `echoCancellation`/`noiseSuppression`/`autoGainControl` constraints.
- `setSinkId` is not available in all browsers.
- Bluetooth latency is device-dependent and not guaranteed.
- No backend, telemetry, or cloud processing.

## Privacy

- No network calls for audio processing.
- No audio persistence.
- Only local preferences are stored in browser localStorage.

## Spec

- `aumonitor_tz1.md` is the source of truth PRD/SPEC.
