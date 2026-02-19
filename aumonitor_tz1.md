# AuMonitor Web — SPEC/PRD (v1)

Дата: 2026-02-12

## 1) Контекст и проблема

Ты выходишь на созвоны из шумных мест (отель/коворкинг/аэропорт/машина). В Google Meet и Контур Толк собеседники иногда жалуются, что тебя плохо слышно: голос “съедается” шумодавом/гейтом на фоне сильного шума. Сейчас диагностика — QuickTime запись или “звонок себе”.

Кейс “для друзей”: хочется сделать публичную версию, чтобы по ссылке могли пользоваться с Windows и macOS, без установки приложений.

## 2) Цель и критерий успеха

**Цель:** за ~30 секунд до созвона понять, “всё ок” ли по слышимости, и принять решение (сменить локацию/микрофон), без подсказок от приложения.

**Успех:** пользователь открывает URL → выбирает устройства → нажимает `Start` → слышит себя в наушниках и по этому уверенно решает, можно ли начинать звонок.

## 3) Аудитория

- Автор + друзья (Windows/macOS).
- Использование: перед созвоном (приоритет), иногда — во время созвона (best-effort).

## 4) JTBD

1. Перед звонком быстро проверить качество голоса в текущей локации.
2. Сравнить разные микрофоны/гарнитуры (например: built-in / AirPods / DJI Mic 2 / Krisp).
3. В шуме понять, “не тонет ли голос” и нет ли перегруза.

## 5) Scope (MVP) / Out of scope

### 5.1 MVP (делаем)

- Формат: **статический сайт (URL)**, без сборки и бэкенда.
- Стек: **React + TypeScript + Vite**, clean architecture lite.
- Lifecycle: state machine (`idle/requestingPermission/starting/monitoring/stopping/error`).
- **Safety:** чекбокс “Я в наушниках” обязателен для `Start`.
- Выбор **Input** (микрофон) из доступных в браузере.
- Выбор **Output** (best-effort): если браузер поддерживает `setSinkId`, можно выбрать output-девайс; иначе — используется default output и это явно показано.
- Режимы:
  - `Raw` — просим browser применить `echoCancellation/noiseSuppression/autoGainControl = false` (best-effort)
  - `Call-like` — просим `... = true` (best-effort, ближе к call apps)
- **Реалтайм-мониторинг:** трансляция input → output (без доп. обработки).
- Визуализация:
  - RMS
  - Peak
  - Clipping (порог фиксированный)
  - Latency (estimated) + sample rate
  - “Applied settings” = `track.getSettings()` (чтобы видеть, что реально применилось)
- Хранение настроек: `localStorage` (deviceId/режим/галочка).
- Приватность: никаких сетевых запросов/аналитики/CDN; аудио не пишется на диск.

**Целевые девайсы (как “должно работать, если ОС/браузер их видит”):**
- Input: built-in mic, AirPods mic, DJI Mic 2, iPhone mic (Continuity/как устройство ОС), Krisp Microphone.
- Output: AirPods, Krisp Speaker.

### 5.2 Не делаем в MVP (non-goals)

- Нативные приложения (.dmg/.exe), подписи, авто‑обновления.
- Интеграции с Meet/Контур Толк (deep links, плагины).
- “Точное 1:1 как слышит собеседник” (кодеки/AGC/NS в call apps не повторяем полностью).
- Рекомендации (“слишком шумно/переключи X”), скоринг качества.
- Запись/проигрывание тестового фрагмента.
- PWA/offline как явное требование (интернет нужен только чтобы открыть страницу; дальше всё локально).

## 6) UX/UI (минимально)

Одна страница:

- Safety блок + чекбокс “Я в наушниках”.
- `Input` selector.
- `Output` selector (если поддерживается) + подсказка “если не поддерживается — default output”.
- Переключатель `Raw` / `Call-like`.
- Кнопки `Start` / `Stop`.
- Индикаторы: RMS/Peak/Clipping + Latency + Sample rate + Applied settings.
- Строка статуса: `Stopped / Monitoring / Need HTTPS / No permission / Cannot switch output / Input ended`.

## 7) Технические требования (decision complete)

### 7.0 Архитектурные слои

- `presentation`: React UI
- `application`: use-cases, orchestration, state machine
- `domain`: типы, правила, инварианты, аудио-математика
- `infrastructure`: browser adapters (`MediaDevices`, `WebAudio`, `localStorage`)

### 7.1 Структура файлов

- `src/presentation/*`
- `src/application/*`
- `src/domain/*`
- `src/infrastructure/*`

### 7.2 Доступ к устройствам

- После первого `getUserMedia` — `enumerateDevices` и заполнение селекторов.
- Реагировать на `devicechange`: обновлять списки, сохранять выбранные значения если они ещё доступны.

### 7.3 Захват и мониторинг

- `getUserMedia({ audio: { deviceId?, echoCancellation, noiseSuppression, autoGainControl } })`
- Audio graph:
  - `MediaStreamSource` → `AnalyserNode` → `MediaStreamDestination`
  - `<audio autoplay>` воспроизводит `destination.stream`
- Output (best-effort):
  - если `audioEl.setSinkId` доступен и выбран конкретный output — вызывать `setSinkId`.
  - если ошибка `setSinkId` — показывать warning и падать обратно на default output.

### 7.4 Meters / clipping

- Каждые ~33мс считать:
  - `peak = max(abs(samples))`
  - `rms = sqrt(mean(samples^2))`
- `clipping = peak >= 0.98` (фиксированный порог)

### 7.5 Latency (estimated)

- Показать:
  - `audioContext.baseLatency` (если доступно)
  - `audioContext.outputLatency` (если доступно)
  - подпись `(estimated)`

### 7.6 Ошибки/ограничения

- Insecure context (не HTTPS/localhost): показать ошибку и заблокировать `Start`.
- Permission denied: показать ошибку и объяснить, что нужно разрешение микрофона.
- Autoplay/play error: показать warning и предложить нажать Start ещё раз.
- Если input stream закончился (`track ended`) — остановить мониторинг и показать статус.

### 7.7 Приватность

- Не использовать внешние CDN/шрифты/скрипты.
- Не отправлять никаких запросов.
- Не записывать аудио на диск.

## 8) Acceptance Criteria (проверки)

1) Пользователь может открыть страницу, дать доступ к микрофону и увидеть список `Input`.
2) После `Start` пользователь слышит себя в выбранном output (или default output) и видит, что meters двигаются.
3) `Stop` прекращает мониторинг и освобождает микрофон.
4) Переключение `Raw` ↔ `Call-like` меняет “Applied settings” (best-effort) и перезапускает мониторинг.
5) Если браузер не поддерживает `setSinkId`, output selector скрыт/задизейблен и показано объяснение.
6) В режиме без HTTPS/localhost старт невозможен и показано почему.

## 9) Сценарии тестирования (manual QA)

### macOS (Chrome)

1) Input: built-in / AirPods mic / DJI Mic 2 / Krisp Microphone → старт, слышно, meters двигаются.
2) Output: AirPods / Krisp Speaker → `setSinkId` (если доступно) и звук идёт туда.
3) Шумная локация → переключение Raw/Call-like, субъективная разница, Applied settings.

### Windows (Chrome/Edge)

1) Любой микрофон/гарнитура → старт/стоп стабильны.
2) Output selector есть и переключает output (если поддерживается).

### Edge cases

1) Отключить гарнитуру во время мониторинга → приложение не падает, показывает статус.
2) Параллельно открыт Meet/Толк → best-effort; если браузер/ОС не даёт микрофон, пользователь увидит понятную ошибку.

## 10) Публикация (free hosting)

- Хостинг: GitHub Pages.
- Деплой: GitHub Actions build + deploy `dist/`.

## 12) Quality gates

- `eslint` + `tsc --noEmit` обязательны в CI.
- Unit/component tests (`Vitest`, `Testing Library`).
- E2E smoke (`Playwright`).

## 11) Риски и ограничения

- Риск фидбэка в колонках: enforce сделать нельзя → только обязательное подтверждение “я в наушниках”.
- `Raw/Call-like` = best-effort: браузер может игнорировать constraints → показывать `track.getSettings()`.
- Output selection доступен не во всех браузерах.
- Bluetooth может давать большую задержку: latency показываем, но не гарантируем значения.
