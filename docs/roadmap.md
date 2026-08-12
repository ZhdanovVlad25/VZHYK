# ВЖИК — Roadmap & Progress

> Цей файл — джерело правди про те, що вже зроблено, а що ні. Оновлюється по ходу
> роботи. Якщо починаєш нову сесію "з нуля" — читай спершу розділ **"Швидкий старт
> для нової сесії"**, потім чекбокси нижче.

## Швидкий старт для нової сесії

### Запустити проєкт локально

```bash
cp .env.example .env          # якщо .env ще нема в корені
docker compose up -d postgres redis minio
npm install
npm run migration:run --workspace=apps/api
npm run seed --workspace=apps/api
```

Далі API і web треба піднімати **окремо** (не через кореневий `npm run dev`,
бо той скрипт використовує `&` для фону, що на Windows/cmd.exe виконується
послідовно, а не паралельно):

```bash
npm run dev --workspace=apps/api    # :3001, окремий термінал/фон
npm run dev --workspace=apps/web    # :3000, окремий термінал/фон, потребує apps/web/.env.local
```

`apps/web/.env.local` (не в git, треба створити самому, якщо його нема):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

**⚠️ Ніколи не запускай `npm run build` для api/web, поки паралельно працює
`npm run dev` для того самого застосунку** — `next build`/`nest build` конфліктує
з watch-процесом за той самий `dist/`/`.next/`, ламає його (chunk 404 / "Cannot
find module main.js"). Якщо треба build — спочатку зупини dev-процес, або просто
довірся `typecheck` (він безпечний і достатній для перевірки компільованості).

### Поточний стан (на момент останнього оновлення цього файлу)

- Docker: `postgres`, `redis`, `minio` — healthy, дані персистентні у volumes.
- У БД лишено 4-5 demo-оголошень із реальними завантаженими фото (власник —
  тестовий юзер з телефоном `+380671112233`) — навмисно, щоб було на чому дивитись
  UI одразу, не з порожнього стану.
- `.claude/launch.json` налаштований для Browser-прев'ю (`preview_start {name:"web"}`).

### Відомі граблі (щоб не наступати повторно)

1. **`.env` не підхоплюється в NestJS/Next.js воркспейсах "з коробки".**
   `ConfigModule`/`next dev` шукають `.env*` у `process.cwd()`, а при
   `npm run <script> --workspace=X` це `apps/X/`, не корінь монорепо. Для API це
   виправлено явним `envFilePath` в `AppModule` (`apps/api/src/app.module.ts`).
   Для web — окремий `apps/web/.env.local`.
2. **`ConfigService.get(key, default)` НЕ підставляє default, якщо ключ існує
   але порожній рядок** (`GOOGLE_OAUTH_CLIENT_ID=` у `.env.example`) — лише коли
   ключа взагалі нема. Треба `config.get(key) || fallback`, не другий аргумент
   `get()`. Наступило на цьому в `google.strategy.ts`.
3. **`RolesGuard` не можна вішати глобально через `APP_GUARD`, якщо десь поряд
   є контролер з локальним `@UseGuards(JwtAuthGuard, RolesGuard)`** — глобальний
   guard виконується РАНІШЕ будь-якого локального, тож бачить `request.user`
   ще не заповненим і завжди кидає 403 замість 401 (і блокує навіть валідні
   токени). Рішення: RBAC лише через `@UseGuards(JwtAuthGuard, RolesGuard)`
   на кожному захищеному контролері, без глобальної реєстрації.
4. **`FileInterceptor` без `{ storage: memoryStorage() }` лишає `file.buffer`
   `undefined`** (Multer за замовчуванням пише на диск). Завжди явно
   `storage: memoryStorage()` для будь-якого нового upload-ендпоінта.
5. **TypeORM `@ManyToOne` без явного `@JoinColumn({ name: '...' })` вгадує
   назву FK-колонки з імені властивості** (`owner` → `ownerId`), і якщо
   реальна колонка називається інакше (`ownerUserId`) — падає з рантайм-помилкою
   "column does not exist", яку типізація не ловить. Завжди пиши явний
   `@JoinColumn` на нових зв'язках.
6. **`next build`/`nest build` паралельно з `--watch`/`next dev` б'ються за
   один і той самий output dir** — див. попередження вище.
7. Windows/Git Bash: `python3` у PATH — неробочий Windows Store stub (мовчки
   нічого не робить). Для масових текстових замін використовуй `Edit` tool з
   `replace_all`, не `python3 -c`.
8. Windows/Git Bash: inline кирилиця в `curl -d '...'` б'ється кодуванням
   консолі. Для запитів з кирилицею — пиши payload у файл (`Write` tool) і
   передавай `--data-binary @file.json`.
9. `AllExceptionsFilter` (`apps/api/src/shared/filters/all-exceptions.filter.ts`)
   логує неочікувані (не-`HttpException`) помилки через `Logger` — дивись
   термінал API при "порожньому" 500 без деталей.
10. **`JwtStrategy.validate()` бере `role` з payload JWT, не з БД** (лише
    `status` перевіряється живим DB-запитом, для миттєвого блокування — див.
    граблі вище). Якщо вручну міняєш роль юзера в БД для ручного тестування
    admin-функціоналу (`UPDATE users SET role='admin' WHERE ...`), стара
    сесія в браузері/localStorage далі несе стару роль у токені — потрібен
    новий логін (нова пара токенів), інакше `RolesGuard` кине 403/401 навіть
    для щойно призначеного admin. Той самий трюк, спакований у
    `e2e/helpers/auth.ts` `loginAsPrivileged()` для Playwright-тестів.
11. **Guards із перевизначеним `getTracker()`/`generateKey()` не можна
    стекати кілька класів на одному маршруті, якщо вони читають ту саму
    `@Throttle()` метадату** — кожен guard незалежно викликає
    `Reflector.getAllAndOverride()` і застосовує ліміт по-своєму; глобальний
    (`APP_GUARD`) виконується першим і, якщо він IP-tracked (дефолт),
    "з'їдає" ліміт раніше кастомного per-route guard'а з іншим трекером.
    Якщо потрібне нестандартне трекування (не по IP) для конкретних
    маршрутів — робити ЄДИНИЙ guard, що розрізняє маршрути всередині
    `getTracker()` (напр. за `body.phone`, коли є), і реєструвати лише його
    глобально, а не додавати другий клас поверх (`OtpPhoneThrottlerGuard`,
    `apps/api/src/modules/auth/guards/`).
12. `test:integration`/E2E Jest-прогони не завершуються самі —
    NestJS/TypeORM/ioredis не завжди звільняють усі handle на `app.close()`.
    `jest-integration.config.js` має `forceExit: true`, інакше процес висить
    нескінченно замість повернути exit code (на це наступили в цій сесії —
    команда "завершилась" лише через 10 годин після вбивства процесу вручну).
13. **`apps/api/Dockerfile`/`apps/web/Dockerfile` не копіювали `packages/`
    (npm workspaces `packages/tsconfig`, `packages/eslint-config`) у
    build-контекст** — `tsc` мовчки падав на дефолтний ES5-таргет замість
    `packages/tsconfig/base.json` (`extends` на неіснуючий у контейнері файл
    не кидає помилку, просто ігнорується), `nest build` валився з
    незрозумілими TS2802/TS1192. Був ще з Phase 1, ніхто не помічав, бо
    жодного `docker build` кроку в CI не було до Phase 8. Фікс: `COPY packages
    ./packages` у base-стадії обох Dockerfile.
14. **npm workspaces хоїстить частину залежностей у корінь `/app/node_modules`**
    (напр. `reflect-metadata` для api) — production-стадія Dockerfile, що
    копіює лише `apps/api/node_modules` (без кореневого рівня), падає рантайм
    з `MODULE_NOT_FOUND` одразу при старті контейнера. Потрібно копіювати
    ОБИДВА рівні `node_modules` (корінь + workspace) у production-стадію.
15. `ConfigService.get(key, default)` з другим аргументом-fallback — та сама
    пастка, що grabli #2, але гостріша для секретів: якщо забути прибрати
    default при переході на production, застосунок мовчки стартує з
    публічним/тестовим значенням замість падати. Для будь-якого
    production-обов'язкового секрету (JWT, тощо) — `requireEnv()`
    (`apps/api/src/shared/env.ts`), без default, throw якщо відсутній.
16. **npm workspaces хоїстинг маскує відсутні залежності одного workspace,
    якщо той самий пакет є в іншому** — `apps/web` мав тестовий файл
    (`Button.test.tsx`) з Jest-глобалами (`describe`/`it`/`expect`), але без
    `@types/jest` у власному `apps/web/package.json` (лише `apps/api` його
    мав). Локально `npm run typecheck --workspace=apps/web` завжди проходив,
    бо кореневий `npm install` хоїстив `@types/jest` з `apps/api` в корінь
    `node_modules`, і `tsc` знаходив його там. **Перший реальний CI-прогін
    на GitHub Actions це показав**: там кожен job робить `npm ci
    --workspace=X` ізольовано, без хоїстингу з інших workspace, і typecheck
    впав з "Cannot find name 'expect'"/"'it'"/"'describe'". Урок: `npm run
    X --workspace=Y` локально не гарантує, що `Y` реально самодостатній —
    треба або довіряти лише CI (ізольований install), або періодично
    прибирати кореневий `node_modules` і ставити один workspace окремо.
17. **`DEV_FIXED_OTP_PHONE`/`DEV_FIXED_OTP_CODE`** (`.env`, не в git) —
    опційний сталий OTP-код для ручного тестування логіну (`auth.service.ts`
    `requestOtp()`), діє лише поза production. Без нього кожен вхід вимагає
    читати код із console.log процесу, що обслуговує запит, а npm workspaces
    + кілька паралельних dev-процесів (Phase 8/дизайн-сесія) роблять це
    негарантованим — SMS_PROVIDER=console пише в stdout ТОГО конкретного
    процесу, який обробив запит, а не якогось єдиного джерела правди.
    Побічний нюанс: `TaskStop` на фоновому `npm run dev` НЕ вбиває сам
    Node-процес (лише знімає його з-під нагляду harness) — порт лишається
    зайнятим (EADDRINUSE при спробі перезапуску), треба `taskkill //PID X //F`
    вручну, інакше новий процес одразу падає, а старий (зі старим `.env` у
    пам'яті) далі відповідає на запити.

---

## Phase 0 — Discovery ✅ завершено

PRD, ролі, user journeys, вимоги, архітектура, ERD, API structure, roadmap,
gap-аналіз. Результат — `/docs`. Усі відкриті питання закриті рішеннями
Phase 1 Authorization (`vzhyk_phase1_decisions.md`, `docs/decisions.md`).

## Phase 1 — Foundation ✅ завершено

- [x] Monorepo (apps/api, apps/web, packages/*), Docker Compose (Postgres, Redis, MinIO).
- [x] Auth foundation: Phone OTP (робочий), Google OAuth (роутинг підключено —
      див. окремий пункт нижче після Frontend-секції), JWT sessions, RBAC guard.
- [x] DB foundation: users, otp_codes, profiles, locations, categories,
      category_attributes, app_settings + seed (області/міста, топ-категорії).
- [x] Design system: Button, Input, Form, Card, Modal, Dropdown, Tabs, Badge,
      Alert, Loading/Empty/Error states (`apps/web/src/components/ui`).
- [x] CI workflow (lint → typecheck → test → build).
- [x] Реально прогнано локально (install/lint/typecheck/test/build, docker,
      міграції, seed, dev-сервери) — комміт `f7bdf7d`.

## Phase 2 — Marketplace Core ✅ завершено (backend), 🟡 частково (frontend)

- [x] **Categories/Attributes CRUD** — admin API + публічне читання. `d94cd0e`.
      `GET /categories`, `GET /categories/:slug`, `GET /categories/:id/attributes`,
      `POST/PATCH/DELETE /admin/categories`, `POST /admin/categories/:id/attributes`,
      `PATCH /admin/attributes/:id`. Redis-кеш дерева, cycle-detection при переміщенні.
- [x] **Listings CRUD + state machine** — `5eee568`. Повна state machine
      (DRAFT→PENDING_MODERATION→ACTIVE→RESERVED→SOLD, ARCHIVED, BLOCKED, EXPIRED).
      Динамічні атрибути з валідацією за `data_type`. DEC-05 ліміт 5 активних
      оголошень. Optimistic locking (VersionColumn). **Не зроблено**: список
      "усі оголошення" з фільтрами (`GET /listings`) — це відповідальність
      Search-модуля (нижче), окремого проксі-ендпоінта нема; `/listings/:id/similar` нема.
- [x] **Media upload pipeline** — `e2fbcd6`, доповнено `bb9e705`. S3/MinIO
      через `StorageProvider`, magic-byte валідація (jpeg/png/webp), ліміт 10MB,
      `POST/GET/PATCH/DELETE /listings/:id/media`. **Не зроблено**: width/height
      екстракція, генерація thumbnails/стиснення (немає image-processing кроку/черги).
- [x] **Profiles module** — `78df0bd`. `GET/PATCH /profiles/me`,
      `GET /profiles/me/listings?status=`, `GET /users/:id/public-profile`
      (lazy-create профілю, публічний перегляд без side-effects).
- [x] **Search (PostgreSQL FTS)** — `eb79d42`, доповнено `058585c`
      (`mainMediaUrl` у результатах). `GET /search`, `GET /search/suggestions`.
      Keyset-пагінація курсором. **Не зроблено**: фільтри region/city/district
      (потрібне розгортання дерева locations), `attrs[]` фільтр за динамічними
      атрибутами, категорія фільтрує лише точний `categoryId` без рекурсії в підкатегорії.
- [ ] **Location: область/місто/район, radius search** — locations є в схемі й
      seed (Україна→область→Київ), але **пошук за радіусом і UI вибору
      локації не реалізовані**.

## Phase 3 — Communication ✅ завершено (backend), 🟡 частково (frontend)

- [x] **Favorites** — `2c2e663`. `POST/DELETE /favorites/:listingId` (ідемпотентні),
      `GET /favorites` з прапорцями `isUnavailable`/`priceChanged`.
- [x] **Price history** — `eee58c5`. Автозапис при реальній зміні ціни,
      `GET /listings/:id/price-history`.
- [x] **Saved searches** — `fa3e74a`. `POST/GET/DELETE /saved-searches`.
      **Свідомо без**: рушія сповіщень про новий збіг (це "Після MVP" за
      product-roadmap, не Phase 3).
- [x] **Realtime chat (Socket.IO)** — `601b14a`. `POST/GET /chats`,
      `GET/POST /chats/:id/messages`, `POST /chats/:id/block`, WS-гейтвей
      `/ws/chat` (JWT-auth на handshake, presence online/offline, typing,
      realtime push нових повідомлень через REST→WS event bridge). **Не зроблено**:
      фото в повідомленнях (`mediaIds` завжди порожній — нема chat-специфічного
      upload-ендпоінта), `POST /chats/:id/report` (потребує Reports/Phase 4),
      Redis adapter для горизонтального масштабування Socket.IO, окремий
      WS read-receipt broadcast (читання зараз скидає `unreadCount` лише через REST).
- [ ] **Notifications abstraction** (in-app) — **не реалізовано взагалі**.
      Email/push теж не робились (мали бути лише каркасом).

## Frontend (`apps/web`) — 🟡 в процесі

Стан на момент запису: реальний API-клієнт + перші робочі сторінки замість
дизайн-системи-в-вакуумі.

- [x] `lib/api.ts` — типізований fetch-клієнт, `ApiError` з envelope-парсингом.
- [x] `lib/auth-context.tsx` — client-side auth (localStorage; **нема
      `/auth/refresh` на бекенді**, сесія просто спливає через 15 хв TTL access-токена).
- [x] `/login` — Phone OTP флоу (запит коду → підтвердження → редірект).
- [x] `/` (home) — категорії + нові оголошення (Server Component).
- [x] `/search` — query/sort/фільтри, курсорна пагінація "завантажити ще" (Client Component).
- [x] `/listings/[id]` — деталі оголошення, фото, атрибути, лічильник переглядів.
- [x] `/listings/new` + `/listings/[id]/edit` — створення чернетки з динамічними
      атрибутами → фото → публікація. Комміт `1b8646e`.
- [x] **"Мої оголошення"** — `apps/web/src/app/my-listings/page.tsx`. Список
      власних оголошень з фільтром за статусом (Dropdown), status-badge,
      ціна/перегляди/дата створення. DRAFT → лінк на `/listings/[id]/edit`,
      решта статусів → на публічну сторінку оголошення. Лінк у Header.
      Профіль-сторінка (редагування `GET/PATCH /profiles/me`) окремо не робилась.
- [x] **Favorites UI** — `FavoriteButton` (`apps/web/src/components/listings/FavoriteButton.tsx`)
      на сторінці оголошення (toggle, стан вичитується з `GET /favorites`, окремого
      "чи в обраному один listing" ендпоінта нема), сторінка `/favorites` зі списком
      і прапорцями "Недоступне"/"Ціна змінилась". Лінк у Header.
- [x] **Saved searches UI** — кнопка "Зберегти пошук" на `/search` (queryText +
      categoryId + `{sort}` у filters), сторінка `/saved-searches` зі списком,
      резолвом назви категорії з дерева категорій, "Знайти" (повертає на
      `/search?q=&category=`), "Видалити". Лінк у Header. **Не переносить**
      priceMin/priceMax/condition/hasPhoto — на `/search` немає UI для цих
      фільтрів узагалі (лише q/category/sort), тож зберігати нічого.
- [x] **Chat UI** — `apps/web/src/app/chats/*` (layout з сайдбаром + `ChatProvider`
      контекст для спільного Socket.IO-з'єднання, `/chats/[id]` тред). Список
      чатів збагачується client-side (`GET /users/:id/public-profile` +
      `GET /listings/:id`, бо `GET /chats` повертає лише ID). `StartChatButton`
      на сторінці оголошення. Typing-індикатор, presence (online/offline),
      блокування — все підключено. Повідомлення: історія + курсорна
      пагінація "старіші", live push через `message:new`. **Відомі обмеження
      (успадковані з бекенду, не з фронтенду)**: presence — лише push при
      зміні статусу, немає snapshot при конекті (partner онлайн до твого
      конекту — не побачиш, поки не буде наступного connect/disconnect);
      read-receipts не існують (`Message.readAt` ніде не пишеться); фото в
      повідомленнях нема. **Не зроблено**: бейдж непрочитаних у Header
      (потребував би глобального WS-провайдера, а не лише в межах `/chats`).
- [x] Редагування вже опублікованого оголошення — `/listings/[id]/edit`
      тепер повноцінна форма (тип/назва/опис/ціна/торг/стан/атрибути),
      попередньо заповнена поточними значеннями, працює для будь-якого
      статусу крім SOLD/ARCHIVED/BLOCKED (межа з `PATCH /listings/:id` на
      бекенді — категорія незмінна). Кнопка "Редагувати оголошення" на
      сторінці оголошення видна лише власнику.
- [x] **Google OAuth** — `GET /auth/google` (`AuthGuard('google')`, ініціює
      redirect на consent screen), `GET /auth/google/callback` видає JWT
      і редіректить на фронтенд `${WEB_ORIGIN}/auth/google/callback?accessToken=&refreshToken=`
      (query-параметри, не httpOnly cookie — узгоджено з існуючим
      localStorage-based `AuthContext`; продакшн вимагав би короткоживучого
      exchange-коду замість сирих токенів в URL). `AuthService.loginWithGoogle()`:
      шукає за `googleId`, за відсутності — прив'язує до існуючого акаунту за
      `email` (якщо юзер вже реєструвався через Phone OTP і має той самий
      email), інакше створює OAuth-only користувача. Кнопка "Увійти через
      Google" на `/login`, сторінка `/auth/google/callback` (парсить токени
      з query, `GET /auth/me` для user-даних, бо callback віддає лише
      токени). 5 unit-тестів (`apps/api/test/auth.service.spec.ts`).
      **Перевірено частково**: `.env` містить лише dev-заглушку
      `GOOGLE_OAUTH_CLIENT_ID` (нема реальних Google-креденшлів), тож повний
      consent-флоу з реальним акаунтом не пройдено — підтверджено лише сам
      redirect-ланцюжок (`GET /auth/google` → реальний `accounts.google.com`
      з правильними `redirect_uri`/`scope`/`client_id`) і callback-сторінка
      (симуляція валідною парою токенів з іншого флоу). Щоб запрацювало
      по-справжньому — потрібні реальні `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET` в `.env`.

## Phase 4 — Trust & Safety ✅ завершено (backend + мінімальний admin frontend)

- [x] **Reports (громадянське репортування)** — `apps/api/src/modules/reports`,
      міграція `1754800800000-AddReports`. `POST /reports` (targetType
      LISTING/USER/CHAT + targetId + reason + опційний description),
      `GET /reports/mine`. Перевірка існування цілі перед створенням
      (для CHAT — ще й що репортер є учасником, як і решта chat-ендпоінтів).
      Статус завжди стартує `PENDING` і нічим не змінюється — `GET /admin/reports`
      (обробка скарг модератором) не реалізовано. **Це окрема черга від
      moderation queue нижче**: `ModerationCase` — про публікацію оголошень
      (`publish()` → PENDING_MODERATION), `Report` — про скарги користувачів;
      різні таблиці, різні ендпоінти, спільного немає. 7 unit-тестів
      (`apps/api/test/reports.service.spec.ts`). Фронтенд: `ReportButton`
      (`apps/web/src/components/shared/ReportButton.tsx`) — на сторінці
      оголошення (LISTING) і в треді чату (CHAT). **Не зроблено**: UI для
      репорту USER (нема сторінки публічного профілю, звідки його викликати),
      `evidence`-поле з docs/api.md §10 (без upload-флоу для скарг), сторінка
      "Мої скарги" (`GET /reports/mine` є, списку в UI нема).
- [x] **Moderation queue** — `apps/api/src/modules/moderation`, міграція
      `1754800900000-AddModerationCases`. `ListingsService.publish()` більше
      **не авто-схвалює**: переводить у `PENDING_MODERATION` і створює
      `ModerationCase` (пряма DI-залежність ListingsModule→ModerationModule,
      не подія — рішення модератора має синхронно міняти статус listing в
      межах одного HTTP-запиту). Auto-rule: короткий стоп-словник
      (`BANNED_WORDS` у `moderation.constants.ts`, свідомо демонстраційний,
      не production-словник) флагає `NEEDS_REVIEW` при збігу в title/description,
      інакше `PENDING`. `GET /admin/moderation/queue?status=`,
      `POST /admin/moderation/:caseId/decide` (APPROVED → listing ACTIVE +
      publishedAt + search.index; REJECTED → listing REJECTED; NEEDS_REVIEW —
      лише фіксує рішення, listing не займає). Захист `@UseGuards(JwtAuthGuard,
      RolesGuard)` + `@Roles('moderator','admin')` **локально на контролері**
      (не глобально — grabli #3 вище). 10 unit-тестів
      (`apps/api/test/moderation.service.spec.ts`), existing `listings.service.spec.ts`
      оновлено під новий контракт `publish()`. Дублікати — **не реалізовано**
      (потребує fuzzy-порівняння заголовків, окрема задача).
      Фронтенд: `/admin/moderation` — черга з фільтром за статусом,
      Схвалити/Відхилити/Потребує уваги, видима в Header лише moderator/admin
      (client-side гейт — реальна межа лишається на бекенді, підтверджено
      403 FORBIDDEN_ROLE напряму через RolesGuard). **Не зроблено**: решта
      Phase 5 Admin Panel (дашборд, users, listings admin CRUD, audit log UI) —
      ця сторінка лише мінімально розблоковує чергу модерації, не весь Phase 5.
- [x] **User blocking (адмін-рівень)** — `apps/api/src/modules/users/admin-users.*`.
      `GET /admin/users?search=` (ILIKE по phone/email, макс. 50, без пагінації —
      як і решта MVP list-ендпоінтів), `POST /admin/users/:id/block`,
      `POST /admin/users/:id/unblock`. Лише `@Roles('admin')` (не moderator —
      блокування облікових записів чутливіше за модерацію контенту). Захист
      від самоблокування (`USER_CANNOT_SELF_BLOCK`). **Реальний enforcement,
      не просто прапорець**: `JwtStrategy.validate()` тепер робить DB-запит
      статусу на кожен захищений виклик (раніше — суто stateless JWT-декод
      без DB) — заблокований юзер втрачає доступ **одразу**, а не аж через
      15 хв, коли спливе TTL access-токена. `AuthService.issueTokens()`
      (спільна точка для OTP і Google-логіну) відмовляє заблокованому/
      видаленому юзеру видачею нових токенів кодом `USER_BLOCKED`.
      Фронтенд: `/admin/users` (пошук + Заблокувати/Розблокувати), лінк у
      Header лише для `role==='admin'`. **Доповнено в Phase 7**: `block()`
      тепер каскадно переводить `ACTIVE`/`RESERVED` оголошення юзера в
      `BLOCKED` + знімає з пошукового індексу (docs/moderation.md §7 — цей
      розрив між docs і кодом виявився під час підготовки E2E-сценарію 11).
      Unblock свідомо НЕ відновлює їх автоматично.
- [x] **Audit log** — `apps/api/src/modules/audit-log`, міграція
      `1754801000000-AddAuditLogs`, схема точно за `docs/database.md`
      (`actorUserId, action, targetType, targetId, before, after, ip,
      createdAt`, append-only). **Відхилення від docs/architecture.md
      "інтерцептор на всіх admin/moderation mutating endpoints"**: замість
      generic-інтерцептора — явний виклик `AuditLogService.record()` у
      кожній мутації (`ModerationService.decide()`, `AdminUsersService.block()/
      unblock()`); свідомий вибір, бо 3 call-сайти — інтерцептор, що
      інтроспектує довільні контролери, був би передчасною абстракцією
      для такої кількості. `GET /admin/audit-log` (лише admin, останні 100).
      Фронтенд: `/admin/audit-log` — таблиця з before/after diff.
      **Не зроблено**: списки Reports (`GET /admin/reports` не існує) й
      admin-редагування listings (`PATCH /admin/listings/:id`) поки що не
      логуються, бо самих цих ендпоінтів ще нема.
- [x] **Anti-fraud basics (RiskSignal/RiskScore)** — `apps/api/src/modules/risk`,
      міграція `1754801100000-AddRiskSignals`, схема точно за
      `docs/database.md`/`docs/moderation.md` §6. `RiskScore` = сума ваг усіх
      `RiskSignal` юзера (без decay/expiry — "basics", не production-калібрована
      формула). **Задетектовано 3 з 6 сигналів** з переліку docs (кожен зі своїм
      реальним тригером):
      - `rapid_listing_creation` (вага 5) — `ListingsService.create()`, >5
        оголошень за 1 годину;
      - `duplicate_listings` (вага 8) — `ModerationService.createCaseForListing()`,
        точний збіг title+price від того ж юзера за 24 години (без фото —
        спрощення); подвійно корисний: той самий виклик і пише RiskSignal, і
        авто-флагає ModerationCase у `NEEDS_REVIEW` (docs §3 auto-rule "дублікат");
      - `high_report_count` (вага 15) — `ReportsService.create()`, ≥3 скарги на
        юзера (напряму або через його listings; CHAT-скарги пропускаються —
        двоє учасників, неоднозначно хто винен).
      **Не задетектовано** (заведені в enum, без тригера): `mass_messaging`
      (треба аналіз вмісту чат-повідомлень), `multi_account_signal` (треба
      IP-трекінг на реєстрації — зараз IP пробрасывается лише в
      `otp/request`, не в `verify`/Google callback); `location_mismatch` —
      явно "Phase 2" за `docs/moderation.md` §6, поза MVP.
      **RiskScore ніколи не блокує юзера автоматично** (docs: "для BLOCKED
      потрібне ручне підтвердження модератора") — лише форсує `NEEDS_REVIEW`
      при створенні `ModerationCase`, якщо score власника перевищує поріг
      (`risk.needs_review_threshold` app_setting, default 10; той самий
      `SettingsService`-патерн, що й `listing.max_active_per_user`).
      **Не реалізовано**: "score > Y → авто-приховати з пошуку" (docs §6,
      друга половина порогової логіки) — свідомо, це вже про ретроактивне
      зняття з публікації живого оголошення, ризикованіше за вплив лише на
      нові рішення модерації. Модератор бачить risk score власника прямо в
      черзі (`GET /admin/moderation/queue` → `listing.ownerRiskScore`,
      docs §4). 21 unit-тест (`apps/api/test/risk.service.spec.ts` +
      оновлення `listings`/`reports`/`moderation` spec під нові DI-залежності).
      Фронтенд: бейдж "Risk score: N" у `/admin/moderation` (danger-тон від 15).
      **Перевірено живцем**: 6 оголошень підряд → сигнал+score=5; два
      однакових title+price → `NEEDS_REVIEW`/`DUPLICATE_LISTING` в
      moderation_cases + score=33; 3 скарги на юзера → `high_report_count`.
      Каскадне видалення тестового юзера прибрало всі пов'язані
      risk_signals/listings автоматично (перевірено), скарги (без FK на
      targetId, поліморфні) прибрані вручну.

## Phase 5 — Admin Panel ✅ завершено (для MVP)

- [x] **Dashboard (метрики)** — `apps/api/src/modules/dashboard`,
      `GET /admin/dashboard` (лише admin). Паралельні `count()` по
      User/Listing/ModerationCase/Report/RiskScore (немає `groupBy`-прецеденту
      в кодовій базі — той самий підхід, що й у `RiskService`). Метрики: users
      (total/active/blocked), listings (total + розбивка по кожному
      `ListingStatus`), moderation (pending/needsReview), reports
      (pending/reviewing), risk-flagged users (score понад поріг). **Без**
      графіків/трендів у часі — лише поточні числа картками. 3 unit-тести
      (`dashboard.service.spec.ts`). Фронтенд: `/admin/dashboard`, лінк у
      Header лише для admin.
- [x] Users: пошук + блокування/розблокування — `/admin/users` (див. Phase 4
      вище) + **детальний перегляд** — `GET /admin/users/:id`
      (`AdminUsersService.getDetail()`) повертає профіль (перевикористовує
      `ProfilesService.getPublicProfile()`, вже імпортований у `UsersModule`),
      останні 20 оголошень, останні 20 скарг (на самого юзера напряму АБО на
      будь-яке з усіх його оголошень — той самий listingIds-патерн, що
      `RiskService.checkHighReportCount()`, але повертає рядки, а не лічильник),
      risk score + останні 20 risk-сигналів. Репозиторії Listing/Report/
      RiskSignal/RiskScore інжектяться напряму в `AdminUsersService` (як і в
      `DashboardService` — без імпорту цілих модулів заради кількох read-запитів).
      4 нові unit-тести. Фронтенд: `/admin/users/[id]` — секції профіль/
      оголошення/скарги/risk-сигнали, кнопка блокування, лінк з рядка
      `/admin/users`.
- [x] **Listings: пошук/перегляд/редагування/блокування (адмінський)** —
      `apps/api/src/modules/listings/admin-listings.*`,
      `GET/PATCH /admin/listings` (лише admin, як і `admin/users`/
      `admin/audit-log`). `GET` — ILIKE по title + фільтр за статусом, take 50.
      `PATCH` — редагування title/description/price/currency незалежно від
      статусу (адмін не обмежений власницькою забороною "SOLD/ARCHIVED/BLOCKED
      не редагувати") + окремий `status`-перехід лише `BLOCKED`↔`ACTIVE`
      (розблокування дозволене тільки з `BLOCKED` — це не повна власницька
      state machine, а буквально docs' "Редагування/блокування"). Кожен виклик
      пише `audit_logs` (`listing.admin_update`, before/after). 7 unit-тестів
      (`admin-listings.service.spec.ts`). Фронтенд: `/admin/listings` — пошук
      за назвою, фільтр статусу, кнопки Заблокувати/Розблокувати, модалка
      редагування (назва/опис/ціна/валюта).
- [x] **Categories/Attributes: CRUD UI** — API існував ще з Phase 2, додано
      лише один бекенд-ендпоінт (`GET /admin/categories` — адмінська версія
      дерева з неактивними категоріями включно, без Redis-кешу; публічний
      `GET /categories` кешується і ховає неактивні — для адмінки це
      неправильна поведінка). Фронтенд: `/admin/categories` — рекурсивне
      дерево з відступами, модалка створення/редагування з вкладками (`Tabs`,
      перше реальне використання цього компонента в проєкті) "Категорія"
      (nameUk/slug/icon/sortOrder/isActive) і "Атрибути" (список з
      inline-редагуванням labelUk/isRequired/isFilterable + форма додавання
      нового атрибута) + **дропдаун "Батьківська категорія"** (переміщення
      в дереві) — жодних змін на бекенді не знадобилось
      (`UpdateCategoryDto.parentId` + `CategoriesService.assertNoCycle()` вже
      існували з Phase 2). `flattenForParentPicker()` на фронтенді виключає
      з переліку саму категорію, що редагується, і все її піддерево
      (клієнтський UX-guard; реальна перевірка циклів лишається на бекенді).
- [x] Moderation queue UI — `/admin/moderation` (див. Phase 4 вище), тепер з
      risk score власника.
- [x] **Reports UI** — `apps/api/src/modules/reports` доповнено
      `GET /admin/reports` (moderator/admin, фільтри status/targetType) та
      `POST /admin/reports/:id/resolve` (не буквально в docs/api.md §12 — там
      лише GET — але потрібен, щоб чергу можна було реально "обробляти" за
      флоу `new → in_review → resolved | rejected` з docs/moderation.md §5;
      той самий парний патерн GET queue + POST decide, що в moderation).
      Кожне рішення пише `audit_logs` (`report.resolve`). 8 нових unit-тестів
      у `reports.service.spec.ts`. Фронтенд: `/admin/reports` — фільтри
      статус/тип цілі, дії В обробці/Вирішено/Відхилено, лінк у Header для
      moderator+admin.
- [x] **Audit Log UI з фільтрами** — `/admin/audit-log` (див. Phase 4 вище).
      `AuditLogService.list()` тепер приймає опційні `targetType`/`action`/
      `actorUserId` (звичайні varchar-колонки, не Postgres enum — без
      `@IsIn`-валідації, пряма рівність у `where`). Фронтенд: два `Dropdown`
      (тип цілі, дія — опції вручну виписані зі списку реальних значень, з
      якими `record()` викликається по кодовій базі, енуму для них нема) +
      пошук за `actorUserId`. 5 нових unit-тестів у `audit-log.service.spec.ts`.

## Phase 6 — SEO & Performance ✅ завершено (для MVP)

- [x] **SSR/SSG, sitemap.xml, robots.txt, structured data, Open Graph.**
      `apps/web/src/app/sitemap.ts` — home + `/search` + до 500 найновіших ACTIVE
      оголошень (10 сторінок courser-пагінації search API по 50, `docs/roadmap.md`
      MAX_LIMIT бекенду). `apps/web/src/app/robots.ts` — дозволяє все, крім
      автентифікованих/приватних маршрутів (`/admin`, `/login`, `/my-listings`,
      `/favorites`, `/saved-searches`, `/chats`, `/listings/new`,
      `/listings/*/edit`), лінкує sitemap. Обидва вже були server-only (домашня
      і сторінка оголошення — Server Components з `Promise.all`-фетчем, без
      конверсії — уся інша навігація лишається client-side, як і була).
      `generateMetadata` на `/listings/[id]` — title/description/OG (title/
      description/url/image) + `<link rel="canonical">` на slug-версію URL.
      JSON-LD `Product`/`Offer` schema там само (наявність/ціна/валюта).
      `apps/web/src/app/search/layout.tsx` — статичний title/description
      (сторінка client-компонент, `generateMetadata` неможливий безпосередньо
      на ній). Кореневий layout: `metadataBase`, title template `%s — Вжик`,
      дефолтний Open Graph. `NEXT_PUBLIC_SITE_URL` (apps/web/.env.local,
      дефолт `http://localhost:3000`) — продакшн деплой має виставити реальний
      домен, інакше sitemap/OG/canonical лишаться на localhost.
- [x] **SEO-friendly URLs.** Без міграції БД: `listings` не має колонки `slug`
      (є лише в `categories`/`locations`), додавати її заради косметики URL —
      зайва складність. Замість цього суто фронтенд-трюк:
      `apps/web/src/lib/slugify.ts` — `buildListingHref(id, title)` формує
      `/listings/{uuid}-{транслітерований-slug}`, `parseListingIdParam()` бере
      перші 36 символів параметра (довжина UUID) незалежно від хвоста —
      **старі "голі" UUID-посилання лишаються робочими без змін** (перевірено
      живцем, обидва варіанти віддають 200). Застосовано лише на публічній
      /SEO-критичній поверхні (`ListingCard` — головна + пошук); адмінка,
      чати, "Мої оголошення", "Обране" лишились на голому `id` — там SEO не
      має значення (`robots.txt` однаково їх забороняє).
- [x] **Caching, image optimization, lazy loading.**
      `next/image` замість `<img>` у `ListingCard` і `/listings/[id]`
      (`fill` + `sizes`, автоматичний lazy-loading для non-priority картинок,
      responsive srcset — перевірено живцем через `/_next/image?...`, 200
      image/jpeg). `next.config.js` `images.remotePatterns` для dev MinIO
      (`localhost:9000`) — **продакшн деплой має додати сюди реальний S3/CDN
      хост**, інакше next/image відмовиться оптимізувати. `apiFetch()`
      (`apps/web/src/lib/api.ts`) отримав опційний `revalidate` — за
      замовчуванням усе лишається `cache: 'no-store'` (без зміни поведінки),
      опт-ін лише для головної сторінки (`getCategoryTree` 300с,
      `search()` 60с — жодних побічних ефектів на цих GET, не персоналізовано).
      **Свідомо НЕ кешовано** `getListing()` на сторінці оголошення — бекенд
      інкрементує `viewsCount` при кожному GET від не-власника
      (`ListingsService.findVisible()`), ISR "заморозив" би лічильник на
      вікно кешу.
- [x] **Аудит Core Web Vitals, N+1 запити, індекси.** N+1: пройдено
      `listings.service.ts`/`admin-listings.service.ts`/`favorites.service.ts`
      — відвертих patterns "цикл → запит на рядок" не знайдено (`FavoritesService.list()`
      вже коректно батчить через `find()` зі списком id). Корельовані підзапити
      `mainMediaId`/`mainMediaStorageKey` у `PostgresFtsSearchProvider.search()`
      виконуються всередині одного SQL-запиту (не app-level N+1) — залишено
      як є, ризик регресії від переписування на `LEFT JOIN LATERAL` не
      виправдав виграш для MVP-масштабу. Індекси: міграція
      `1754801200000-AddPerformanceIndexes` — `idx_listings_price` (сортування
      `price_asc`/`price_desc` в keyset-пагінації йшло без індексу) і
      `idx_media_listing_is_main` (композитний, замінює filter-after-scan на
      `isMain` поверх наявного `idx_media_listing`). Прогнано локально
      (`npm run migration:run`), обидва індекси створені без помилок.
      **Full Lighthouse/CrUX Core Web Vitals прогін — свідомо НЕ виконано**:
      немає production-збірки на staging (той самий аргумент, що OWASP ZAP
      у Phase 7 — dev-режим Next.js дає нерепрезентативні цифри), відкладено
      до Phase 8.

## Phase 7 — Testing ✅ завершено

- [x] Unit tests на бізнес-логіку кожного backend-модуля (206 тестів,
      `npm run test --workspace=apps/api`).
- [x] **Integration tests** — `apps/api/test/integration/`, окрема тестова БД
      `vzhyk_test` (не чіпає demo-дані в `vzhyk`) на тому самому `docker
      compose` postgres, окремий Redis DB-індекс (`/1`). `test-app.ts`:
      `createTestApp()` (справжній Nest app + supertest, той самий bootstrap,
      що `main.ts`), `resetDb()` (truncate всіх таблиць між тестами),
      `requestOtpAndCaptureCode()` — перехоплює `console.log` замість
      підміни БД (той самий процес, що й app). `global-setup.ts` створює БД +
      ганяє реальні міграції перед прогоном. `npm run test:integration`
      (`--workspace=apps/api` або з кореня), окремий `jest-integration.config.js`
      (`forceExit: true` — NestJS/TypeORM/ioredis не завжди звільняють усі
      handle на `app.close()`, без цього Jest висить нескінченно замість
      завершитись з exit code). 7 сюїтів за розділами docs/testing.md §2
      (database/auth/listings/search/chat/moderation + user-blocking для
      Part A2 cascade-фіксу нижче) + 2 security-сюїти (rate-limiting,
      authorization — див. Security testing нижче), 24 тести, ≥1 happy+1
      negative кожен. Новий CI job `integration` (`.github/workflows/ci.yml`)
      з postgres+redis service containers.
- [x] **E2E (усі 11 сценаріїв з docs/testing.md §3)** — Playwright,
      кореневий `playwright.config.ts` + `e2e/`. **Без `webServer` auto-start**
      — прогін проти вже запущених `docker compose` + `npm run dev` (api+web
      окремими терміналами, як і в "Швидкий старт" вище), не окрема
      E2E-БД/стейджинг (staging не існує, Phase 8 не розпочато). Ізоляція між
      сценаріями — випадковий телефон на кожен (`e2e/helpers/fixtures.ts`
      `uniquePhone()`), не спільна БД-транзакція. `e2e/helpers/auth.ts`
      `loginViaOtp()` — Playwright є окремим OS-процесом від API, тож
      `console.log`-перехоплення (як в integration tests) недоступне;
      замість цього підміна argon2-хешу коду напряму в БД (`pg` + `argon2` як
      root devDependencies) — той самий трюк, що ганявся вручну цю сесію
      (grabli #10 на початку файлу). `loginAsPrivileged()` — реєстрація → logout →
      промоушен ролі в БД → повторний логін (роль у payload JWT, не
      перевіряється з БД на кожен запит). 12 тестів (сценарій 2 — Login —
      містить 2: OTP-логін і поверхнева перевірка Google OAuth redirect,
      повний consent-флоу і тут неможливий без реальних
      `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`). Сценарій 3 (створення оголошення)
      свідомо закінчується на `PENDING_MODERATION` — `publish()` не
      авто-схвалює з Phase 4, доведення до `ACTIVE` — сценарії 4/5/10
      (moderator/admin-декейди). **Не** wired у CI (docs/testing.md §3 сам
      каже "на staging перед production deploy" — staging не існує).
- [x] **Security testing** — dependency audit + rate-limiting/authorization
      тести з наявного, OWASP ZAP свідомо відкладено:
      - **Per-user rate limits** (docs/security.md §6) — три ліміти з таблиці
        не мали жодного `@Throttle()` (`grep` підтвердив: лише OTP-маршрути).
        Не через `ThrottlerGuard` (global `APP_GUARD` виконується до
        `JwtAuthGuard`, `req.user` ще не заповнений — та сама причина, що
        grabli #3/#11), а явний `RateLimitService` (`apps/api/src/shared/`,
        Redis `INCR`+`EXPIRE`, той самий прямий доступ до `REDIS_CLIENT`, що
        `SettingsService`) у сервісному шарі: `ListingsService.create()`
        20/добу, `ChatsService.sendMessage()` 60/хв, `ReportsService.create()`
        10/добу. Unit-тести + 3 integration-кейси
        (`rate-limiting.integration-spec.ts`, N+1-й виклик → 429).
      - **Security headers** — жодного `helmet`/ручних заголовків не було.
        Додано `app.use(helmet())` у `main.ts` (CSP, X-Frame-Options,
        X-Content-Type-Options, Referrer-Policy тощо, docs/security.md §4).
        Перевірено живцем: `curl -sI` на dev API показує всі заголовки.
      - **Dependency audit** — `npm audit --workspaces` знайшов 35 advisories.
        `next` `14.2.5→14.2.35` (safe patch bump) закрив ~10 реальних
        high-severity (SSRF, cache poisoning, middleware bypass) — підтверджено
        повторним `npm audit` (ці конкретні advisory зникли зі списку для
        `next`). Решта — dev-only tooling (`@nestjs/cli`/`picomatch`/`tmp`/
        `webpack`, ніколи не потрапляють у прод) або потребують breaking
        upgrade (`qs`/`uuid` через `@nestjs/platform-express`/`typeorm` мажори)
        — свідомо залишено, не силувано `--force`. Новий CI-крок `npm audit
        --audit-level=high` в `api`-job, **інформаційний** (`|| true`, не
        валить білд) — деякі findings свідомо в переліку "відкладено".
      - **Authorization adversarial tests** — новий
        `authorization.integration-spec.ts`: неавтентифікований запит → 401,
        plain `user` на `/admin/dashboard`/`/admin/moderation/queue` → 403,
        чужий `PATCH /listings/:id` → 403 `LISTING_NOT_OWNER`, не-учасник
        чату на `GET /chats/:id/messages` → 404 (existence-hiding, не 403).
      - **OWASP ZAP** — свідомо НЕ прогнано: `docs/testing.md §3` сам каже
        "на staging перед production deploy", staging не існує (Phase 8 не
        розпочато), а скан dev-режиму Next.js без production security-config
        дав би переважно шум, не сигнал. Відкладено до Phase 8.
      - **XSS-санітизація тексту оголошень/чату** (docs/security.md §3) —
        перевірено: `dangerouslySetInnerHTML` у `apps/web/src` не
        використовується жодного разу, тож React-дефолтне екранування вже
        покриває кожен поточний render-шлях без бекенд-санітизації. Задокументовано
        як залишковий ризик (переглянути, якщо колись з'явиться non-React
        рендер тексту оголошень/чату), нову залежність не додано без
        продемонстрованої вразливості.
      - **CORS** (`cors: true`, дозволяє всі origin) — не в MVP-критичному
        переліку docs/security.md, звуження ризикує зламати локальний
        dev/Playwright без прямого запиту — залишено як Phase 8 hardening
        кандидат.

### Виявлено й полагоджено під час Phase 7 (не було в докорінному коді)

1. **`ThrottlerGuard` ніде не був зареєстрований** — `ThrottlerModule.forRoot()`
   в `app.module.ts` існував з Phase 1, але без `providers: [{provide:
   APP_GUARD, useClass: ...}]` жоден `@Throttle()` decorator по контролерам
   (otp/request 3/15хв, otp/verify 5/5хв) фактично нічого не блокував.
   Полагоджено: `OtpPhoneThrottlerGuard extends ThrottlerGuard`
   (`apps/api/src/modules/auth/guards/`) — єдиний глобальний `APP_GUARD`,
   `getTracker()` повертає `body.phone` для OTP-маршрутів (докладно матчить
   docs/security.md "3/15хв на номер", не на IP) і падає назад на
   `req.ip` для решти. **Свідомо один клас, не стек із двох**: спроба
   повісити окремий phone-tracking guard локально на маршрут ПОВЕРХ
   глобального `ThrottlerGuard` не працює — обидва класи незалежно читають
   ту саму `@Throttle()` метадату, тож звичайний IP-tracked глобальний guard
   душить маршрут своїм лічильником раніше, ніж встигає відпрацювати
   кастомний (виявлено й підтверджено integration-тестами).
2. **Блокування юзера не каскадувало на оголошення** — див. запис вище в
   Phase 4 "User blocking".
3. **Три per-user rate limits з docs/security.md §6 не мали жодної
   реалізації** — `RateLimitService`, див. Security testing вище.
4. **Жодних security headers** — `helmet()`, див. Security testing вище.
5. **`next@14.2.5` мав ~10 реальних high-severity CVE** з готовим
   non-breaking фіксом (`14.2.35`) — див. Security testing вище.

(Деталі 1 і 3 — тепер у "Відомі граблі" на початку файлу, пункти 11–12.)

## Phase 8 — Production Readiness ✅ завершено (deploy-ready артефакти; реальної інфраструктури нема)

Немає реального сервера/домену/хмарного акаунту/Sentry-акаунту — ціль цієї фази була
підготувати все, що можна перевірити й задеплоїти без них, а не власне задеплоїти.
**Усе нижче перевірено живцем** (докер build + запуск контейнерів проти реальних
postgres/redis/minio з `docker-compose.yml`), не лише написано.

- [x] **Deployment pipeline**. `docker-compose.prod.yml` — production-оверлей
      (без hot-reload volumes, health checks для api/web, БД/Redis/MinIO без
      прокинутих портів назовні). `.github/workflows/ci.yml` — новий job `docker`
      (build обох production-образів на кожен PR/push, раніше такого кроку не
      було жодного). `.github/workflows/release.yml` — build+push у GHCR на
      merge в main, тег = git SHA + `latest`, вбудований `GITHUB_TOKEN`.
      **Не запускався по-справжньому**: в репозиторії немає GitHub remote —
      workflow валідний і готовий, спрацює одразу, як з'явиться push у GitHub.
      **Виявлено й полагоджено 2 реальні баги в Dockerfile'ах** (існували з
      Phase 1, ніколи не тестувались — жодного docker-build кроку в CI не було):
      1. `packages/tsconfig`/`packages/eslint-config` (npm workspaces `packages/*`)
         не копіювались у build-контекст → `tsc` мовчки падав на дефолтний
         ES5-таргет замість `packages/tsconfig/base.json` → `nest build` валився
         з десятком TS-помилок.
      2. `apps/api` production-стадія копіювала лише `apps/api/node_modules`, а
         частина залежностей (`reflect-metadata`) хоїститься npm workspaces в
         корінь `/app/node_modules` → контейнер падав одразу з `MODULE_NOT_FOUND`.
      Заодно `apps/web/next.config.js` отримав `output: 'standalone'`
      (225MB→менший, трасовані залежності замість повного `node_modules`) і
      `apps/web/public/` (раніше не існував — Dockerfile копіював неіснуючу
      директорію, теж падало).
- [x] **Моніторинг та error tracking**. `GET /health` (поза `/api/v1`, пінгує
      Postgres+Redis, 503 при недоступності) — `apps/api/src/modules/health`.
      Структуровані JSON-логи в production (`apps/api/src/shared/json-logger.ts`,
      підключається лише при `NODE_ENV=production`). `@sentry/node` (api) і
      `@sentry/nextjs` (web) — опційно, без `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`
      повний no-op, реального акаунту не потрібно. Метрики (Prometheus/Grafana)
      і alerting — свідомо не реалізовано, потребують реальної observability-
      інфраструктури, якої нема; health-check + Sentry вже покривають
      MVP-мінімум ("сервіс живий" + "про помилку дізнаємось").
- [x] **Backups**. `scripts/backup-db.sh` — `pg_dump` через `docker compose exec`,
      gzip, ротація за `BACKUP_RETENTION_DAYS` (дефолт 14 днів), cron-приклад і
      команда відновлення в коментарях. **Перевірено живцем**: сам механізм
      `pg_dump | gzip` проти реальної dev-БД (29.7KB дамп з demo-даними).
      Point-in-time recovery, реплікація object storage, задокументовані
      RTO/RPO — не зроблено, це рішення разом із бізнесом на реальному
      продакшні, а не щось, що можна визначити наперед у MVP.
- [x] **Production конфіг**. `.env.production.example` (реальний
      `.env.production` у `.gitignore`, лише placeholder'и в git) —
      `POSTGRES_USER/PASSWORD/DB` для docker-compose підстановки, реальні
      домени замість localhost, `SMS_PROVIDER` попереджає не лишати `console`.
      CORS звужено до `WEB_ORIGIN` у production (`main.ts`) — **fail fast**,
      якщо не задано (перевірено живцем: контейнер падає з чітким повідомленням
      замість мовчазного відкату на дозвіл усіх origin).
- [x] **Фінальний security review**. Пройдено: hardcoded secrets (немає —
      `.env`/`.env.local`/`.env.production` в `.gitignore`, у git лише
      placeholder'и), auth (OTP хешується argon2, не plaintext), raw SQL
      (`PostgresFtsSearchProvider` — усе параметризовано `$1/$2`, жодної
      конкатенації user input у SQL-текст), media upload (шлях завжди
      `listings/{uuid з БД}/{randomUUID()}.{ext з MIME-whitelist}` — user input
      ніколи не потрапляє в storage key), XSS (єдиний
      `dangerouslySetInnerHTML` — JSON-LD на сторінці оголошення, Phase 6,
      server-generated дані, не user input).
      **Знайдено й полагоджено одну реальну діру**: `JWT_ACCESS_SECRET` мав
      хардкодний fallback (`'dev_only_secret'`, буквальний рядок у коді, не
      навіть значення з `.env.example`) в `auth.module.ts` і `jwt.strategy.ts`
      — якщо змінну забудуть задати в production, застосунок мовчки
      підписував/перевіряв токени публічним, легко вгадуваним секретом замість
      відмови стартувати. Виправлено: `apps/api/src/shared/env.ts`
      `requireEnv()`, той самий fail-fast принцип, що й `WEB_ORIGIN` для CORS
      (перевірено живцем в обидва боки — з секретом стартує, без нього падає
      з чітким повідомленням). **Задокументовано, не виправлено**:
      `JWT_REFRESH_SECRET` задекларовано в `.env.example`, але
      `AuthService.issueTokens()` підписує і access, і refresh одним і тим
      самим `JwtService`/`JWT_ACCESS_SECRET` (лише різний `expiresIn`) —
      refresh-токен видається, але ніде не приймається назад (`POST /auth/refresh`
      не існує, roadmap Phase 1 вже це фіксував). Не нова вразливість (обидва
      токени й так під одним секретом), а розбіжність між заявленим і реальним
      дизайном — виправляти має сенс разом із появою `/auth/refresh`, не
      ізольовано зараз.
      **OWASP ZAP і повний Lighthouse/CWV прогін — досі свідомо відкладені**
      (той самий аргумент, що в Phase 6/7: немає staging, dev-режим дав би шум,
      не сигнал).

## Після MVP (поза межами roadmap)

Nova Poshta, онлайн-оплата, escrow, монетизація, рейтинги, мобільні застосунки,
локалізація (RU/EN), category-specific модерація, сповіщення про збіг saved search.

---

## Карта модулів бекенду (`apps/api/src/modules`)

`auth` (+ `guards/otp-phone-throttler.guard.ts` всередині), `users`
(+ `admin-users.*` всередині), `profiles`, `location`, `categories`,
`attributes`, `settings`, `listings` (+ `price-history` та
`admin-listings.*` всередині), `media`, `search` (+ `providers/search`),
`favorites`, `saved-searches`, `chat`, `reports` (+ `admin-reports.controller.ts`
всередині), `moderation`, `audit-log`, `risk`, `dashboard`.
Спільна інфраструктура: `providers/storage` (S3), `providers/search`,
`shared/guards` (`JwtAuthGuard`, `OptionalJwtAuthGuard`, `RolesGuard`),
`shared/pagination/cursor.ts` (keyset-пагінація, спільна для Search і Chat),
`shared/rate-limit.service.ts` (per-user Redis rate limiting, реєструється
через `@Global() RedisModule`).
Тести: `apps/api/test/*.spec.ts` (unit), `apps/api/test/integration/*.integration-spec.ts`
(`npm run test:integration`), `e2e/*.spec.ts` у корені (`npm run test:e2e`,
Playwright, окремо від workspace-структури — стосується і api, і web).

## Наступний логічний крок

**Усі фази roadmap завершені, включно з Phase 8.** MVP-скоуп цього документа
закритий повністю:

- **Phase 0–5, 7** (Discovery → Testing): Trust & Safety, Admin Panel,
  rate limiting, security headers, dependency audit, 9 integration-сюїтів
  (24 тести), усі 11 E2E-сценаріїв (12 тестів). Google OAuth підключено
  (повний live-тест потребує реальних `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`).
- **Phase 6** (SEO & Performance): sitemap.xml/robots.txt, per-listing
  metadata + OG + JSON-LD, SEO-friendly slug URLs, `next/image`, опт-ін
  ISR-кешування, нові DB-індекси.
- **Phase 8** (Production Readiness): production Docker-образи (перевірені
  живцем — знайдено й полагоджено 2 реальні баги, яких CI не ловив),
  `docker-compose.prod.yml`, CI docker-build job + GHCR release workflow,
  `/health`, JSON-логи, опційний Sentry, DB-backup скрипт, `.env.production.example`,
  фінальний security review (знайдено й полагоджено хардкодний JWT-secret
  fallback — була б реальна production-вразливість).

206 unit + 24 integration + 12 E2E тестів, усі проходять. Свідомо відкладено
до появи реальної інфраструктури (staging/production hosts, GitHub remote,
хмарні акаунти) — не бракує коду, бракує середовища, де його застосувати:
OWASP ZAP, повний Lighthouse/CWV прогін, кілька breaking-change dependency
upgrades, реальний запуск `release.yml` (workflow готовий, але в репозиторії
немає GitHub remote), підключення реального Sentry/managed Postgres/CDN.

**Далі — поза межами цього roadmap**: розділ "Після MVP" нижче (Nova Poshta,
онлайн-оплата, escrow, монетизація, рейтинги, мобільні застосунки,
локалізація RU/EN, category-specific модерація, сповіщення про збіг saved
search), або власне підняття реальної production-інфраструктури й прогін
усього підготовленого в Phase 8 живцем.
