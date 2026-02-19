# Worklog

#### 2026-02-19 13:15 — [ag-partner] Архитектурное ревью стабильности и Docker-ready деплоя
- Что обсуждено: архитектура AuMonitor, точки отказа в lifecycle/состояниях, непродуманные юз-кейсы, готовность к контейнерному деплою.
- Решение: зафиксирован список критичных рисков (гонки start/stop, рассинхрон настроек/сессии, gap по контейнеризации) и подготовлено подробное ТЗ для системного аналитика с фокусом на стабильность и Docker hosting.

#### 2026-02-19 13:29 — [ag-systems-analyst] Системный пакет документов под стабильность и Docker
- Проанализировано: системные границы, петли обратной связи, точки отказа lifecycle и deployment.
- Найденные связи/риски: критичны гонки start/stop, рассинхрон UI/session, отсутствие Docker rollout/rollback контура.
- Решение: оформлены `CLAUDE.md`, `PRD.md`, `SYSTEM_ANALYSIS`, `USE_CASES`, `RISK_REGISTER`, `DEPLOYMENT_DOCKER`, `runbook`; рекомендован Hostinger VPS + Docker + HTTPS-first.

#### 2026-02-19 13:55 — [ag-developer] Фиксы lifecycle гонок и детерминированного reconfigure
- Что сделано: исправлен race `stop during starting`, добавлен deferred reconfigure для mode/input/devicechange, добавлены регрессионные тесты на переходные состояния.
- Файлы: src/presentation/useAuMonitorController.ts, src/presentation/useAuMonitorController.test.tsx, CLAUDE.md, docs/runbook.md
- Решение: ownership start-attempt + cleanup stale sessions, потому что это устраняет утечки и синхронизирует UI/сессию при churn.
- Restarts: 0

#### 2026-02-19 13:56 — [ag-reviewer] Ревью фиксов lifecycle и регрессионных тестов
- Результат: approve
- Критичных: 0, важных: 0
- Файлы: src/presentation/useAuMonitorController.ts, src/presentation/useAuMonitorController.test.tsx, docs/runbook.md, CLAUDE.md

#### 2026-02-19 14:11 — [ag-mechanic] Docker + Hostinger CI/CD и rollback контур
- Что настроено/задеплоено: добавлены Docker runtime (Caddy), compose-манифест, GitHub Actions для build/push/deploy и manual rollback, а также deploy/rollback скрипты для Hostinger VPS.
- URL / платформа: целевая платформа Hostinger VPS (Docker), endpoint health `/healthz`.
- Конфигурация: Dockerfile, Caddyfile, .dockerignore, docker-compose.yml, .env.example, workflows `deploy-docker.yml`/`rollback-hostinger.yml`, чеклист `docs/HOSTINGER_VPS_CHECKLIST.md`.
- Restarts: 0

#### 2026-02-19 14:21 — [ag-partner] Пересмотр deployment-стратегии
- Что обсуждено: Docker/Hostinger vs GitHub Pages для текущего этапа продукта.
- Решение: Docker признан оверинжинирингом для статического MVP, выбран возврат к GitHub Pages как основному каналу релиза.

#### 2026-02-19 14:21 — [ag-mechanic] Переделка infra под GitHub Pages
- Что настроено/задеплоено: восстановлен auto-deploy Pages на push в `main`, удалены Docker workflows и артефакты.
- URL / платформа: GitHub Pages (`https://<github_username>.github.io/<repo_name>/`).
- Конфигурация: обновлены `deploy-pages` workflow, `README`, `CLAUDE`, `PRD`, `runbook`, `SYSTEM_ANALYSIS`, `USE_CASES`, `RISK_REGISTER`, добавлен `docs/DEPLOYMENT_GITHUB_PAGES.md`.
- Restarts: 0

#### 2026-02-19 14:35 — [ag-reviewer] Ревью после перехода на GitHub Pages
- Результат: request changes
- Критичных: 1, важных: 2
- Файлы: src/infrastructure/browser/monitoringPort.ts, src/presentation/useAuMonitorController.ts, src/application/machine.ts, .github/workflows/deploy-pages.yml

#### 2026-02-19 14:42 — [ag-partner] Решение по Git remote
- Что обсуждено: почему `gh issue list` не работал и почему в репозитории не было `origin`.
- Решение: root cause — локальный git без привязанного remote; подключён `origin` на `https://github.com/Jekudy/AuMonitor.git`.

#### 2026-02-19 14:42 — [ag-developer] Реализация 3 findings из ревью
- Что сделано: устранена утечка mic tracks при partial-start failure; `SESSION_WARNING` сделан глобальным для всех состояний; deploy Pages переведён на trigger от успешного `CI`; добавлены регрессионные тесты.
- Файлы: src/infrastructure/browser/monitoringPort.ts, src/infrastructure/browser/monitoringPort.test.ts, src/application/machine.ts, src/application/machine.test.ts, src/presentation/useAuMonitorController.test.tsx, .github/workflows/deploy-pages.yml, docs/DEPLOYMENT_GITHUB_PAGES.md, docs/runbook.md, CLAUDE.md
- Решение: фиксировать проблемы на уровне источника (resource lifecycle + machine semantics + release gate), потому что это прямо снижает прод-риски.
- Restarts: 0

#### 2026-02-19 14:47 — [ag-reviewer] Повторное ревью после фиксов findings
- Результат: approve
- Критичных: 0, важных: 0
- Файлы: src/infrastructure/browser/monitoringPort.ts, src/application/machine.ts, .github/workflows/deploy-pages.yml, src/infrastructure/browser/monitoringPort.test.ts, src/application/machine.test.ts, src/presentation/useAuMonitorController.test.tsx

#### 2026-02-19 15:07 — [ag-mechanic] Деплой на GitHub Pages завершён
- Что настроено/задеплоено: репозиторий переключён в `public`, создан и настроен Pages site, выполнен manual run `Deploy Pages` после успешного `CI`.
- URL / платформа: https://jekudy.github.io/AuMonitor/ (GitHub Pages).
- Конфигурация: Pages `build_type=workflow`, workflow run `CI` #22193655984 (success), `Deploy Pages` #22193928704 (success), smoke-check live URL пройден.
- Restarts: 0

#### 2026-02-19 15:13 — [ag-partner] Диагностика проблемы переключения input
- Что обсуждено: в ряде браузерных сценариев список input-устройств остаётся урезанным до `default`, потому что после grant permission не происходил автоматический refresh.
- Решение: после `PERMISSION_GRANTED` запускать `refreshDevices()`, плюс добавить регрессионный тест на появление новых input-опций после permission.

#### 2026-02-19 15:17 — [ag-developer] Фикс input permission flow + call-like профиль + mobile адаптив
- Что сделано: добавлен preflight-запрос микрофонного permission на загрузке, дедупликация permission-запросов и refresh input-list после grant; смягчён `callLike` профиль (AGC off); усилены responsive-правила для mobile и добавлен e2e smoke на отсутствие горизонтального overflow.
- Файлы: src/presentation/useAuMonitorController.ts, src/presentation/useAuMonitorController.test.tsx, src/domain/audio.ts, src/domain/audio.test.ts, src/presentation/App.tsx, src/styles.css, e2e/smoke.spec.ts, docs/runbook.md, CLAUDE.md
- Решение: убрать задержку permission/device enumeration и агрессивный AGC, потому что это напрямую влияло на UX выбора input и качество звука в call-like.
- Restarts: 0

#### 2026-02-19 15:39 — [ag-systems-analyst] Финальный системный чек перед релизом
- Проанализировано: `CLAUDE.md`, `PRD.md`, `docs/runbook.md`, `docs/SYSTEM_ANALYSIS.md`, `docs/RISK_REGISTER.md`, `docs/USE_CASES.md`, `.agency/handoff.md`, состояние GitHub Actions/Issues.
- Найденные связи/риски: CI/deploy контур технически стабилен и проходит проверки, но governance-контур неполный — ветка `main` без branch protection (required checks/reviews), что оставляет риск unreviewed release при зелёном CI.
- Решение: Go с условиями — сохранить текущий Pages+CI контур как baseline, и добавить branch protection + регулярный smoke мониторинг как leverage points для устойчивости.

#### 2026-02-19 15:43 — [ag-reviewer] Финальный pre-merge чек
- Результат: approve
- Критичных: 0, важных: 0
- Файлы: .github/workflows/deploy-pages.yml, src/presentation/useAuMonitorController.ts, src/domain/audio.ts, src/styles.css, e2e/smoke.spec.ts
- Проверки: `npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build` — all green.
- Остаточный риск (process): branch protection для `main` не настроен в GitHub settings, поэтому policy review/check enforcement держится только на дисциплине команды.

#### 2026-02-19 15:44 — [ag-partner] Финальное резюме цикла и распределение задач
- Что обсуждено: объединение findings из security-review, системного анализа и финального code review.
- Решение: релизный кодовый контур признан стабильным (approve), цикл закрывается после устранения process-рисков: branch protection, мониторинг/смоки, добор edge-case покрытия и SLO-метрик.

#### 2026-02-19 15:54 — [ag-developer] Реализованы D1+D2+D3 и infra hardening из финального handoff
- Что сделано: добавлен telemetry port и метрики PRD (`monitor_start_*`, `warning_events_by_code`, `time_to_monitoring_ms`, `session_unexpected_stop_count`); реализован edge-case handling для tab suspend/resume и покрыты тестами insecure-origin + device contention; добавлены security automation артефакты (`security-audit` workflow, `post-deploy-smoke`, `dependabot`) и план обновления dev toolchain.
- Файлы: src/application/ports.ts, src/infrastructure/browser/index.ts, src/infrastructure/browser/telemetryPort.ts, src/types/telemetry.d.ts, src/presentation/useAuMonitorController.ts, src/presentation/useAuMonitorController.test.tsx, src/presentation/App.test.tsx, .github/workflows/security-audit.yml, .github/workflows/post-deploy-smoke.yml, .github/dependabot.yml, docs/OBSERVABILITY.md, docs/DEV_SECURITY_UPGRADE_PLAN.md, docs/runbook.md, docs/DEPLOYMENT_GITHUB_PAGES.md, CLAUDE.md, package.json
- Решение: telemetry вынесен в отдельный порт, потому что это сохраняет слоистую архитектуру и позволяет расширить отправку метрик без переписывания контроллера.
- Restarts: 0

#### 2026-02-19 15:58 — [ag-reviewer] Повторный финальный чек измерений и release-gates
- Результат: request changes
- Критичных: 0, важных: 1
- Файлы: .github/workflows/ci.yml, .github/workflows/post-deploy-smoke.yml, docs/DEPLOYMENT_GITHUB_PAGES.md

#### 2026-02-19 16:00 — [ag-developer] Финальные доработки по повторному ревью
- Что сделано: устранён drift required-check context через явное имя CI job (`name: CI`), post-deploy smoke переведён с fixed delay на retry loop (8 попыток, 15с); обновлены runbook/CLAUDE/deployment docs.
- Файлы: .github/workflows/ci.yml, .github/workflows/post-deploy-smoke.yml, docs/runbook.md, docs/DEPLOYMENT_GITHUB_PAGES.md, CLAUDE.md
- Решение: выравнивание check context и retry логика закрывают риск блокировки merge и ложных инцидентов при задержке публикации Pages.
- Restarts: 0

#### 2026-02-19 16:01 — [ag-partner] Решение по go/no-go
- Что обсуждено: можно ли идти в финальный rollout после закрытия reviewer findings.
- Решение: Go (катимся), потому что блокирующие техриски закрыты: CI/deploy gate синхронизирован, post-deploy smoke устойчивее, тестовый контур зелёный.
