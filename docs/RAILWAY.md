# Подробная инструкция: AEOGEO на Railway

Этот документ описывает, как развернуть **backend (FastAPI)** из монорепозитория на [Railway](https://railway.app). Фронтенд (`packages/web`) и **Temporal worker** рассматриваются отдельно — на Railway их обычно выносят в отдельные сервисы или оставляют на VPS.

---

## Что вы получите в итоге

- Репозиторий на GitHub подключён к Railway: **каждый push** в выбранную ветку (например `main`) **автоматически** пересобирает и деплоит API.
- Отдельные managed-сервисы **PostgreSQL** (с расширением pgvector — см. ниже) и **Redis**.
- Публичный HTTPS-URL для API (например `https://xxx.up.railway.app`).

---

## Предварительные требования

1. Аккаунт [Railway](https://railway.app) (можно войти через GitHub).
2. Репозиторий AEOGEO на GitHub (код уже в `main` или другой ветке).
3. Настроенный **Clerk** (ключи приложения) — без них авторизация в приложении не заработает.
4. Понимание, что **Dockerfile API** в репозитории рассчитан на **контекст сборки = корень репозитория** (файл `packages/api/Dockerfile` копирует `packages/geo-audit` и `packages/api`).

---

## Шаг 1. Создать проект и подключить репозиторий

1. В Railway: **New Project** → **Deploy from GitHub**.
2. Разрешите Railway доступ к нужным репозиториям (GitHub OAuth).
3. Выберите репозиторий **AEOGEO**.
4. Railway может предложить автодетект — **не используйте** автосборку из подпапки как единственный вариант без проверки: для API нужен **корень репо** и путь к Dockerfile (см. шаг 3).

После создания появится первый сервис (часто с ошибкой сборки — это нормально, пока не настроен Dockerfile).

---

## Шаг 2. Добавить PostgreSQL и Redis

### PostgreSQL

1. В том же **Project** нажмите **+ New** → **Database** → **PostgreSQL**.
2. Дождитесь provisioning. В карточке Postgres откройте **Variables** (или **Connect**).
3. Railway выдаёт переменные вроде `DATABASE_URL`, `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`.

Важно для этого проекта:

- Приложение ожидает **`DATABASE_URL`** в формате **SQLAlchemy async**:
  - нужно: `postgresql+asyncpg://...`
  - у Railway часто: `postgresql://...` (драйвер `psycopg2` по умолчанию в URL)

**Что сделать:** в переменных сервиса **API** (не Postgres) задайте `DATABASE_URL` вручную, скопировав логин/пароль/хост/порт/имя БД из переменных Postgres, и замените префикс:

```text
postgresql://user:pass@host:port/db
  →
postgresql+asyncpg://user:pass@host:port/db
```

Либо используйте **Reference** в Railway UI: подставьте компоненты `${{ Postgres.VAR }}` (название сервиса Postgres может отличаться — выберите свой из выпадающего списка), собрав строку с `postgresql+asyncpg://`.

### Расширение pgvector

Образ в Docker для API основан на приложении, которое использует **pgvector**. Стандартный Postgres на Railway **может не включать** расширение `vector`. Варианты:

- Подключить **внешний** Postgres с уже включённым pgvector (Neon, Supabase, свой VPS).
- Или использовать кастомный образ/плагин с pgvector, если появится в вашем стеке.

Если миграции упадут на `CREATE EXTENSION vector`, смотрите логи деплоя и документацию выбранной БД.

### Redis

1. **+ New** → **Database** → **Redis**.
2. Скопируйте **внутренний** URL (часто `REDIS_URL` или `PRIVATE_URL`) — его укажете в API.

---

## Шаг 3. Настроить сервис API (Docker из монорепозитория)

1. Откройте сервис, который собирает ваше приложение (или создайте **Empty Service** и привяжите репозиторий).
2. Вкладка **Settings** (или **Build**):

   - **Source**: репозиторий AEOGEO, ветка `main` (или ваша прод-ветка).
   - **Root Directory**: оставьте **пустым** или `/` — корень репозитория.
   - **Builder**: **Dockerfile**.
   - **Dockerfile path**: `packages/api/Dockerfile`.

3. **Не кладите один общий `railway.toml` в корень для API и фронта:** Railway применяет его ко **всем** сервисам с этим репо — фронт начнёт собирать образ API, а pre-deploy миграций может пытаться выполниться на веб-сервисе. Настройки **Dockerfile / pre-deploy** задавайте **в UI каждого сервиса**. Памятка: `railway.toml.example`.

4. **Start command** (если Railway позволяет переопределить):

   - По умолчанию в Dockerfile:  
     `uv run uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - Railway обычно задаёт `PORT` — убедитесь, что приложение слушает **`0.0.0.0` и порт из `$PORT`**, если платформа подставляет переменную.  
   - Если образ жёстко использует порт `8000`, в настройках сервиса выставьте **Port** `8000` или добавьте в Dockerfile CMD с `$PORT` (при необходимости — отдельный патч репозитория).

5. **Pre-deploy / Release** (только сервис API): одна команда, **одна строка** (у Railway массив команд — максимум один элемент):

   ```text
   uv run alembic upgrade head
   ```

   Рабочий каталог в образе уже `/work/packages/api` (см. Dockerfile). Не используйте массив вида `["sh","-c","..."]` — парсер Railway ругается.

   Альтернатива: pre-deploy **не задавать**, миграции один раз в **Shell** API.

6. Включите **Auto Deploy** на нужную ветку: **Settings** → **Triggers** / **Deploy** → deploy on push.

---

## Шаг 4. Переменные окружения API

В сервисе API откройте **Variables** и задайте (имена как в `app/config.py` / `.env` — Railway передаёт их в контейнер):

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | `postgresql+asyncpg://...` (см. шаг 2) |
| `REDIS_URL` | URL Redis из плагина (internal) |
| `SECRET_KEY` | Случайная длинная строка для сессий/подписей |
| `CORS_ORIGINS` | Через запятую: URL фронта и при необходимости URL preview, например `https://app.yourdomain.com,https://yourapp.up.railway.app` |
| `DEBUG` | Для прода: `false` |
| `ENCRYPTION_KEY` | Ключ Fernet (как в проде; не коммитьте в git) |
| `CLERK_PUBLISHABLE_KEY` | Из Clerk Dashboard |
| `CLERK_SECRET_KEY` | Из Clerk Dashboard |
| `CLERK_FRONTEND_API_URL` | При необходимости (см. Clerk) |
| `CLERK_INVITATION_REDIRECT_URL` | Публичный URL фронта, путь `/accept-invite` |
| `CLERK_WEBHOOK_SECRET` | Signing secret для webhook `user.created` (Svix) |
| `TAVILY_API_KEY` | Если используете Tavily |
| Прочие ключи AI | По необходимости из вашего `packages/api/.env` |

Публичный URL API после деплоя возьмите в **Settings → Networking → Generate Domain** (или свой домен).

Обновите:

- **`CORS_ORIGINS`** — добавьте origin фронтенда.
- В **Clerk**: разрешённые origins / redirect URLs под ваш прод-фронт и API при необходимости.

### Webhook Clerk

В Clerk → **Webhooks** добавьте endpoint:

```text
https://<ваш-api-домен>/api/v1/auth/webhook
```

Событие: **`user.created`**. Вставьте **`CLERK_WEBHOOK_SECRET`** из настроек webhook в переменные Railway.

---

## Шаг 5. Сеть и домен

1. В сервисе API: **Networking** → **Generate Domain** — получите `https://xxx.up.railway.app`.
2. Привязка своего домена: **Custom Domain** → следуйте подсказкам Railway (DNS CNAME).
3. Убедитесь, что **HTTPS** включён (по умолчанию у Railway).

Проверка живости приложения:

```http
GET https://<ваш-домен>/api/v1/health
```

Ожидается JSON вроде `{"status":"healthy",...}`.

---

## Шаг 6. Фронтенд отдельным сервисом (Railway)

Нужен **второй сервис** в том же проекте: тот же GitHub-репозиторий, но другой Dockerfile и своя ссылка (Generate Domain).

### 6.1. Создать сервис

1. **New** → **GitHub Repo** → репозиторий AEOGEO (или **Duplicate** API-сервиса и поменять настройки).
2. **Settings**:
   - **Root Directory**: пусто (корень монорепозитория).
   - **Dockerfile Path**: **`packages/web/Dockerfile.railway`** (без ведущего `/`; не путать с `Dockerfile` — это dev `vite dev`, на Railway не соберётся в прод).
   - **Pre-deploy**: оставить **пустым** (миграции только на API).

### 6.2. Переменные сборки (Build) — обязательно

Vite подставляет env **на этапе `bun run build`**, поэтому без них фронт не узнает API и Clerk.

В **Variables** этого сервиса добавьте и отметьте как доступные **на build** (в Railway у переменной есть переключатель Build / Runtime — включите **Build** для обоих):

| Переменная | Пример значения |
|------------|-----------------|
| `VITE_API_URL` | `https://ваш-api.up.railway.app` — **без** суффикса `/api/v1` |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` из Clerk (тот же продукт, что и бэкенд) |

Сохраните и сделайте **Redeploy**.

Сборка в образе — **`bun run build`** (`widget` + **Vite**). Отдельный полный **`tsc`** в этот путь не входит (иначе на слабом builder CPU уходят десятки минут). Проверку типов держите в **CI** или локально: `cd packages/web && bun run typecheck`. Строгая сборка с `tsc` перед Vite: `bun run build:strict`.

### 6.3. Домен фронта

**Networking** → **Generate Domain** — получите отдельную ссылку вида `https://что-то.up.railway.app` или подключите свой поддомен.

### 6.4. API: CORS и Clerk

1. В сервисе **API** переменная **`CORS_ORIGINS`**: через запятую добавьте **полный origin фронта** (например `https://web-production-xxx.up.railway.app`).
2. В **Clerk Dashboard** → **Domains / Paths** (или Allowed origins): разрешите origin фронта; в **Redirect URLs** добавьте URL логина/колбэков под новый домен (см. документацию Clerk для SPA).

### 6.5. Почему не `Dockerfile.prod` с nginx

`Dockerfile.prod` слушает порт **80**; на Railway контейнеру обычно задают **`PORT`**. Образ `Dockerfile.railway` отдаёт `dist` через **`serve`** и слушает **`$PORT`**.

Альтернатива без Docker: **Vercel / Netlify / Cloudflare Pages** — root `packages/web`, те же `VITE_*` при сборке.

Во всех случаях **`VITE_API_URL`** = публичный базовый URL API (без `/api/v1`).

---

## Шаг 7. Temporal и фоновый worker

В репозитории пайплайн завязан на **Temporal** (`app.workflows.worker`). На Railway **нет** managed Temporal «из коробки». Варианты:

- Поднять **Temporal** отдельно (отдельный Railway-сервис с `temporalio/auto-setup`, свой Postgres, сложнее в проде).
- Использовать **[Temporal Cloud](https://temporal.io/cloud)** и прописать `TEMPORAL_HOST`, сертификаты/mTLS по их доке.
- Оставить **worker на VPS**, а API — на Railway (worker должен видеть тот же `TEMPORAL_HOST` и очередь `aeogeo-pipeline`).

Без worker очереди **не обработаются**, но HTTP API и БД могут работать.

---

## Сборка Docker и типичные проблемы

1. **Таймаут сборки**  
   Dockerfile ставит **Playwright + Chromium** (`uv run playwright install --with-deps chromium`) — сборка долгая. В Railway увеличьте **Build timeout** в настройках сервиса / проекта.

2. **Неверный контекст**  
   Ошибки вроде «не найден `packages/geo-audit`» означают, что **Root Directory** не корень репозитория или Dockerfile path неверный.

3. **Порт**  
   Если контейнер слушает только `8000`, а Railway проксирует `$PORT`, выровняйте CMD или настройку порта в панели.

4. **Миграции**  
   Если таблиц нет — выполните вручную один раз:

   ```bash
   uv run alembic upgrade head
   ```

   через **Railway Shell** в контейнере API (или Release Command).

---

## Краткий чеклист

- [ ] Проект Railway + GitHub, ветка с автодеплоем  
- [ ] Postgres + Redis, `DATABASE_URL` с `+asyncpg`, `REDIS_URL`  
- [ ] Сервис API: Dockerfile `packages/api/Dockerfile`, root = корень репо  
- [ ] Все секреты и Clerk; `CORS_ORIGINS`; webhook Clerk на `/api/v1/auth/webhook`  
- [ ] Домен API; `/api/v1/health` отвечает  
- [ ] Миграции применены  
- [ ] Фронт задеплоен отдельно с `VITE_API_URL`  
- [ ] План по Temporal/worker (отдельно от этой инструкции)  

---

## Ответ внутренней ИИ Railway: что верно, что нет

Ниже — разбор типичного ответа про `asyncpg`, pre-deploy и таймауты.

### Верно

- В сервис **API** нужно передать строку подключения к Postgres, в т.ч. через **reference**:  
  `DATABASE_URL = ${{ Postgres.DATABASE_URL }}`  
  Имя сервиса (`Postgres`) должно **совпадать** с именем плагина Postgres в вашем проекте (если переименовали — подставьте своё).
- **Pre-deploy** выполняется **до** старта приложения, в **том же приватном network**, с теми же **переменными окружения**, что и у сервиса (см. [Pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command)).
- Команда миграций: `uv run alembic upgrade head` из каталога приложения (`/work/packages/api` в нашем Dockerfile). Задаётся в **UI сервиса API** (pre-deploy) или вручную в Shell — **не** общим `railway.toml` для всего монорепо.

### Неверно или вводит в заблуждение

1. **`postgresql+asyncpg://...` «уже в шаблоне Railway»**  
   У плагина Postgres чаще всего выдаётся обычный **`postgresql://...`**. Для этого проекта драйвер должен быть **`asyncpg`**, то есть префикс **`postgresql+asyncpg://`**.  
   **Сделайте так:** после reference отредактируйте итоговое значение `DATABASE_URL` вручную: замените `postgresql://` на `postgresql+asyncpg://` (остальное — без изменений). При ошибках SSL добавьте к URL **`?ssl=require`** (или совместимый query для вашего клиента).

2. **`drainingSeconds` увеличит таймаут pre-deploy** — **нет.**  
   `drainingSeconds` в [config-as-code](https://docs.railway.com/reference/config-as-code) относится к **завершению старого деплоя** (SIGTERM → SIGKILL), а не к длительности **pre-deploy**. На жёсткий лимит ~30 с pre-deploy это не влияет.

3. **Pre-deploy «в том же контейнере»** — формально pre-deploy идёт в **отдельном контейнере**, но с **тем же образом** и **теми же env**; для миграций это нормально. Файловая система там не сохраняется между шагами — для `alembic` это не нужно.

### Если pre-deploy снова падает по таймауту

1. Убедитесь, что **`DATABASE_URL`** с `+asyncpg` реально доступен (сначала прогоните миграцию в **Shell** того же сервиса — если там ок, а pre-deploy нет, пишите в support Railway про лимит).
2. Временно **уберите** pre-deploy в dashboard, задеплойтесь, миграции — **один раз** из Shell.
3. Полный stderr обычно виден в **деталях шага Pre-deploy** в конкретном deployment (раскройте шаг).

---

## Полезные ссылки

- [Railway Docs](https://docs.railway.app/)  
- [Deploy with Docker](https://docs.railway.app/guides/dockerfiles)  
- [Variables and referencing](https://docs.railway.app/develop/variables)  
- [Pre-deploy command](https://docs.railway.com/deployments/pre-deploy-command)  
- [Config as code](https://docs.railway.com/reference/config-as-code)  
- [Clerk webhooks](https://clerk.com/docs/users/sync-data-to-your-backend)  
