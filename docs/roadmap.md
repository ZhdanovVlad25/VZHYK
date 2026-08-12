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

## Phase 6 — SEO & Performance ⬜ не розпочато

- [ ] SSR/SSG, sitemap.xml, robots.txt, structured data, Open Graph.
- [ ] SEO-friendly URLs.
- [ ] Caching, image optimization, lazy loading.
- [ ] Аудит Core Web Vitals, N+1 запити, індекси.

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

## Phase 8 — Production Readiness ⬜ не розпочато

- [ ] Deployment pipeline, моніторинг, error tracking, backups, production
      конфіг, фінальний security review.

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

**Phase 4, 5 і 7 (Trust & Safety, Admin Panel, Testing) повністю завершені**:
Reports, Moderation queue, User blocking (+ каскад на оголошення,
+ детальний перегляд юзера), Audit log (+ фільтри), Anti-fraud
(RiskSignal/RiskScore), Dashboard, Listings admin CRUD, Categories/Attributes
CRUD UI (+ переміщення в дереві), rate limiting (OTP за phone + три per-user
ліміти з docs/security.md §6, усі нарешті реально enforced), security headers
(`helmet`), dependency audit (`next` CVE-патч), 9 integration-сюїтів
(24 тести), усі 11 E2E-сценаріїв (12 тестів, Playwright) — усе перевірено
живцем. Google OAuth підключено (роутинг+логіка+тести; повний live-тест
потребує реальних `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`, яких немає в `.env`).
206 unit + 24 integration + 12 E2E тестів. OWASP ZAP і кілька
breaking-change dependency upgrades свідомо відкладені до Phase 8 (staging
не існує). Далі логічно: **Phase 6 SEO & Performance** (не розпочато,
єдина нерозпочата фаза перед Phase 8) або сама **Phase 8 Production
Readiness**.
