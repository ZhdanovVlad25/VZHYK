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

## Phase 4 — Trust & Safety 🟡 частково

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
      Header лише для `role==='admin'`.
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
- [ ] Anti-fraud basics: RiskSignal/RiskScore.

## Phase 5 — Admin Panel 🟡 частково

- [ ] Dashboard (метрики).
- [ ] Users: пошук/перегляд/блокування/історія.
- [ ] Listings: пошук/перегляд/редагування/блокування (адмінський, не власницький).
- [ ] Categories/Attributes: повний CRUD UI (API вже є з Phase 2, UI нема).
- [x] Moderation queue UI — `/admin/moderation` (див. Phase 4 вище). 🟡 лише
      queue; **не зроблено**: Reports UI (`GET /admin/reports` навіть не
      реалізований на бекенді).
- [ ] Audit Log UI.

## Phase 6 — SEO & Performance ⬜ не розпочато

- [ ] SSR/SSG, sitemap.xml, robots.txt, structured data, Open Graph.
- [ ] SEO-friendly URLs.
- [ ] Caching, image optimization, lazy loading.
- [ ] Аудит Core Web Vitals, N+1 запити, індекси.

## Phase 7 — Testing 🟡 частково (лише unit)

- [x] Unit tests на бізнес-логіку кожного backend-модуля (154 тести,
      `npm run test --workspace=apps/api`).
- [ ] Integration tests.
- [ ] E2E (11 сценаріїв з вихідного документа).
- [ ] Security testing (dependency audit, OWASP ZAP baseline).

## Phase 8 — Production Readiness ⬜ не розпочато

- [ ] Deployment pipeline, моніторинг, error tracking, backups, production
      конфіг, фінальний security review.

## Після MVP (поза межами roadmap)

Nova Poshta, онлайн-оплата, escrow, монетизація, рейтинги, мобільні застосунки,
локалізація (RU/EN), category-specific модерація, сповіщення про збіг saved search.

---

## Карта модулів бекенду (`apps/api/src/modules`)

`auth`, `users` (+ `admin-users.*` всередині), `profiles`, `location`,
`categories`, `attributes`, `settings`, `listings` (+ `price-history`
всередині), `media`, `search` (+ `providers/search`), `favorites`,
`saved-searches`, `chat`, `reports`, `moderation`, `audit-log`. Спільна
інфраструктура: `providers/storage` (S3), `providers/search`, `shared/guards`
(`JwtAuthGuard`, `OptionalJwtAuthGuard`, `RolesGuard`),
`shared/pagination/cursor.ts` (keyset-пагінація, спільна для Search і Chat).

## Наступний логічний крок

Phase 4 (Trust & Safety) фактично завершено: Reports, Moderation queue,
User blocking, Audit log — усе є. Лишився лише Anti-fraud (RiskSignal/
RiskScore) — найменш конкретний пункт списку, немає чіткого критерію
"score за чим", варто спершу уточнити з продуктом, що саме рахувати.
Google OAuth підключено (роутинг+логіка+тести; повний live-тест потребує
реальних `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`, яких немає в `.env`). Далі
логічно: решта **Phase 5 Admin Panel** (dashboard, listings admin CRUD,
Reports UI — зараз є лише moderation queue + users + audit-log), або
**Phase 7 Integration/E2E tests** (зараз лише unit).
