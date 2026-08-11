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
- [x] Auth foundation: Phone OTP (робочий), Google OAuth (лише strategy-каркас,
      **роутинг НЕ підключений** — див. "Не зроблено" в Phase 2/3), JWT sessions, RBAC guard.
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
- [ ] **"Мої оголошення" / профіль-сторінка** — API (`GET /profiles/me/listings`)
      готовий, UI нема. Без цього користувач не знайде свою чернетку без URL.
- [ ] **Favorites UI** — API готовий, кнопки "в обране"/сторінки списку нема.
- [ ] **Saved searches UI** — API готовий, UI нема.
- [ ] **Chat UI** — і REST, і WS готові на бекенді, фронтенд-сторінки нема взагалі.
- [ ] Редагування вже опублікованого оголошення (зараз `/listings/[id]/edit`
      лише допомагає добити чернетку до публікації, не для правок після).
- [ ] Google OAuth кнопка (бекенд-роутинг теж не готовий — див. Phase 1 нотатку).

## Phase 4 — Trust & Safety ⬜ не розпочато

- [ ] Reports (усі типи цілей: listing/user/chat) — `POST /reports`, `GET /reports/mine`.
- [ ] Moderation queue + ModerationCase + auto-rules (заборонені слова, дублікати).
- [ ] User blocking (адмін-рівень; chat-level block між двома юзерами вже є з Phase 3).
- [ ] Audit log (усі admin/moderation дії).
- [ ] Anti-fraud basics: RiskSignal/RiskScore.
- [ ] Реальний `ModerationProvider` замість поточного авто-approve у
      `ListingsService.publish()` (позначено `TODO(Phase 4)` прямо в коді).

## Phase 5 — Admin Panel ⬜ не розпочато

- [ ] Dashboard (метрики).
- [ ] Users: пошук/перегляд/блокування/історія.
- [ ] Listings: пошук/перегляд/редагування/блокування (адмінський, не власницький).
- [ ] Categories/Attributes: повний CRUD UI (API вже є з Phase 2, UI нема).
- [ ] Reports & Moderation UI.
- [ ] Audit Log UI.

## Phase 6 — SEO & Performance ⬜ не розпочато

- [ ] SSR/SSG, sitemap.xml, robots.txt, structured data, Open Graph.
- [ ] SEO-friendly URLs.
- [ ] Caching, image optimization, lazy loading.
- [ ] Аудит Core Web Vitals, N+1 запити, індекси.

## Phase 7 — Testing 🟡 частково (лише unit)

- [x] Unit tests на бізнес-логіку кожного backend-модуля (130+ тестів,
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

`auth`, `users`, `profiles`, `location`, `categories`, `attributes`, `settings`,
`listings` (+ `price-history` всередині), `media`, `search` (+ `providers/search`),
`favorites`, `saved-searches`, `chat`. Спільна інфраструктура: `providers/storage`
(S3), `providers/search`, `shared/guards` (`JwtAuthGuard`, `OptionalJwtAuthGuard`,
`RolesGuard`), `shared/pagination/cursor.ts` (keyset-пагінація, спільна для
Search і Chat).

## Наступний логічний крок

Судячи з того, що вже готове API-без-UI (Profiles listings, Favorites, Saved
Searches, Chat) — найбільша віддача зараз від **фронтенд-сторінок**, а не
нового бекенд-модуля. Або Phase 4 (Trust & Safety), якщо пріоритет — безпека
перед UI-повнотою.
