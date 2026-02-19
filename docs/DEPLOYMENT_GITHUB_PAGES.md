# DEPLOYMENT_GITHUB_PAGES.md

## Why GitHub Pages
- Static frontend app, no backend runtime required.
- Zero server ops for MVP.
- Simple and low-cost deployment path.

## Current Pipeline
- Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: successful `CI` run for `main` (and manual dispatch)
- Build: `npm ci` + `npm run build`
- Artifact: `dist/`
- Deploy target: GitHub Pages

## One-time Setup (Repository)
1. In GitHub repository settings, open `Pages`.
2. Set `Build and deployment` to `GitHub Actions`.
3. Ensure default branch is `main`.
4. In branch protection for `main`, require `CI` workflow status checks before merge.

## Deploy Flow
1. Merge changes into `main`.
2. Wait for `CI` workflow to pass.
3. Wait for `Deploy Pages` workflow to complete.
4. Open the Pages URL.

## Rollback
1. Identify last known-good commit on `main`.
2. Revert problematic commit(s).
3. Push revert commit to `main`.
4. Wait for `Deploy Pages` workflow to finish.

## Smoke Checklist
1. Site opens over HTTPS.
2. Safety checkbox gating works (`Start` disabled until checked).
3. Start/Stop monitoring flow works in Chrome/Edge on supported environment.
4. Output fallback message appears in unsupported browsers.
