# Contributing

Thanks for helping improve AuMonitor.

## Dev setup

This project uses `React + TypeScript + Vite`.

```bash
npm install
npm run dev
```

Then open `http://localhost:5173`.

`getUserMedia` requires HTTPS/localhost (not `file://`).

## Quality gates

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## What we accept

- Fixes for device handling, UX, and error messages.
- Browser compatibility improvements (Chrome/Edge first).
- Documentation improvements.

## What we avoid (MVP)

- Backend services, analytics, trackers.
- External CDNs for fonts/scripts.
- Heavy dependencies / bundlers.
