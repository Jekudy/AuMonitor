# DEV_SECURITY_UPGRADE_PLAN.md

## Scope
Address `npm audit` findings in developer toolchain dependencies
(`eslint` / `@eslint/*` / `ajv` / `minimatch`) without breaking CI quality gates.

## Current State (2026-02-19)
- Runtime dependencies: `npm audit --omit=dev` -> no high/critical findings.
- Dev dependencies: audit reports high severity findings in eslint transitive tree.
- Automatic `npm audit fix --force` proposes `eslint@10`, which is a breaking jump.

## Plan
1. Keep runtime audit as blocking in CI (high/critical).
2. Keep dev audit as non-blocking report to track debt.
3. Prepare controlled eslint major upgrade in a dedicated branch:
   - update eslint + related plugins together,
   - run full lint/typecheck/test/e2e/build,
   - fix config incompatibilities before merge.
4. Re-run `npm audit` after upgrade and remove debt entry once clean.

## Acceptance Criteria
1. Runtime security gate stays green in CI.
2. Dev audit report is visible on a schedule and on PRs.
3. Eslint major upgrade is merged only after full compatibility validation.

## Debt Target Date
- Planned completion for eslint-chain major upgrade: **2026-03-15**.
