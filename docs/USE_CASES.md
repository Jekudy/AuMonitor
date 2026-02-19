# USE_CASES.md

## Core Use Cases

| ID | Use Case | Preconditions | Expected Outcome |
|---|---|---|---|
| UC-01 | Start monitoring | HTTPS/localhost, mic available, headphones confirmed | State reaches `monitoring`, meters update |
| UC-02 | Stop monitoring | Session active | Session closes, state returns to `idle`, no active audio resources |
| UC-03 | Switch mode while monitoring | Session active | Safe stop/restart, new constraints applied |
| UC-04 | Switch input while monitoring | Multiple inputs available | Safe stop/restart with selected input |
| UC-05 | Change output device | Browser supports `setSinkId` | Output route updates or graceful fallback warning |
| UC-06 | Permission denied | User rejects permission | Error state with actionable recovery guidance |
| UC-07 | Device unplugged during monitoring | Session active | Controlled stop/warning, no crash |
| UC-08 | Browser without sink selection | No `setSinkId` support | Output selector disabled, app remains usable |

## Edge and Failure Cases

| ID | Scenario | Risk | Required Behavior |
|---|---|---|---|
| EC-01 | Stop clicked during `starting` | Orphaned session | Created resources are always closed |
| EC-02 | Rapid `Start/Stop/Start` clicks | State desync | Deterministic final state and one active session max |
| EC-03 | Mode/input changed in transitional states | UI/session drift | Final running session matches latest UI values |
| EC-04 | Device list refresh fails | Silent degradation | Warning shown, prior stable state preserved |
| EC-05 | Tab suspended/resumed | Context interruption | Recoverable state and user-visible status |
| EC-06 | Two tabs run simultaneously | Device contention | Clear busy/conflict messaging |
| EC-07 | localStorage unavailable/corrupt | Preference load errors | Fallback to defaults without crash |
| EC-08 | Insecure origin in production | Full feature outage | Blocked start with explicit HTTPS guidance |

## Deployment Use Cases (GitHub Pages)

| ID | Scenario | Expected Outcome |
|---|---|---|
| GP-01 | Push to `main` | `Deploy Pages` workflow builds and publishes `dist/` |
| GP-02 | Bad release detected | Revert commit on `main` republishes last known-good state |
| GP-03 | Pages config drift | Deployment fails fast in workflow and surfaces logs |

## Acceptance Checklist
- Every P0/P1 edge case has at least one automated test.
- Every user-visible warning maps to a documented recovery step.
- Pages deploy and rollback-by-revert flow are validated.
