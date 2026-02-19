# RISK_REGISTER.md

## Scale
- Likelihood: Low / Medium / High
- Impact: Low / Medium / High / Critical

| ID | Risk | Likelihood | Impact | Detection Signal | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-01 | Orphaned audio session on stop during startup | Medium | Critical | Mic remains active after `idle` | Start-attempt cancellation token + cleanup guard | ag-developer | Resolved |
| R-02 | UI/session config mismatch | Medium | High | Applied constraints differ from selected controls | Reconfiguring path + single source of truth transition | ag-developer | Resolved |
| R-03 | Device-change causes stale running session | Medium | High | Warnings and audio behavior diverge after hardware change | Session reconciliation on device refresh | ag-developer | Resolved |
| R-04 | Browser capability mismatch (`setSinkId`) | High | Medium | Repeated output-switch warnings | Capability-gated preferences and fallback strategy | ag-developer | Open |
| R-05 | Pages deploy pipeline failure | Medium | High | `Deploy Pages` workflow red | Keep deploy workflow minimal and CI checks green before merge | ag-mechanic | Open |
| R-06 | Broken release reaches `main` | Medium | High | Production smoke fails after deploy | Rollback by revert and enforce review gate | ag-developer/ag-reviewer | Open |
| R-07 | Pages config drift in repository settings | Low | Medium | Deploy succeeds but site not updated | Keep Pages source = GitHub Actions and document setup | ag-mechanic | Open |
| R-08 | Untracked runtime anomalies | Medium | Medium | Unknown failure modes in production | Structured release checklist + smoke after deploy | ag-mechanic | Open |

## Top Priority
1. R-04, R-05, R-06 (operational reliability)
2. Keep regression tests for resolved lifecycle bugs intact
