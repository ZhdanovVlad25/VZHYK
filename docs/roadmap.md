# ВЖИК — Roadmap

## Phase 0 — Discovery ✅ завершено

PRD, ролі, user journeys, функціональні/нефункціональні вимоги, архітектура, ERD, API structure, roadmap, gap-аналіз. Результат — `/docs`. Усі питання з `decisions.md` («Questions Requiring Product Decision») закриті рішеннями Phase 1 Authorization (`vzhyk_phase1_decisions.md`).

## Phase 1 — Foundation (поточна фаза)

- Ініціалізація monorepo (apps/api, apps/web, apps/admin), Docker Compose (Postgres, Redis, MinIO для dev S3).
- Базова автентифікація (Phone OTP + Google OAuth), guards, RBAC каркас.
- Міграції БД: users, profiles, locations (seed областей/міст), categories, category_attributes, app_settings (seed: `listing.max_active_per_user=5`, `pii.retention_months=6`).
- Базовий frontend: layout, design system (типографіка, кольори, кнопки, inputs, картки), з базовою accessibility (DEC-09) з першого компонента.
- CI (lint, typecheck, unit tests на кожен PR), environment configuration (.env.example, secret management).

## Phase 2 — Marketplace Core

- Categories/Attributes CRUD (admin API + UI).
- Listings CRUD + state machine, форма створення з динамічними атрибутами.
- Media upload pipeline (validation → processing → moderation hooks).
- Profiles: «Мої оголошення» (активні/продані/архів/чернетки).
- Search: PostgreSQL FTS + фільтри + сортування, `SearchProvider` абстракція.
- Location: область/місто/район, radius search.

## Phase 3 — Communication

- Realtime chat (Socket.IO): текст, фото, unread/read, typing, online status.
- Notifications abstraction (in-app реалізовано, email/push — каркас).
- Favorites + price history.
- Saved searches (без активних сповіщень про збіг — це Phase 4+).

## Phase 4 — Trust & Safety

- Reports (усі типи цілей: listing/user/chat).
- Moderation queue + ModerationCase + auto-rules (заборонені слова, дублікати).
- User blocking (адмін), chat block (користувач).
- Audit log (усі admin/moderation дії).
- Anti-fraud basics: RiskSignal/RiskScore, базові сигнали.

## Phase 5 — Admin Panel

- Dashboard (метрики: users, listings, reports, moderation queue).
- Users: пошук, перегляд, блокування, історія.
- Listings: пошук, перегляд, редагування, блокування.
- Categories/Attributes: повний CRUD UI.
- Reports & Moderation UI.
- Audit Log UI.

## Phase 6 — SEO & Performance

- SSR/SSG для категорій/оголошень, sitemap.xml, robots.txt, structured data, Open Graph.
- SEO-friendly URLs (`/uk/{category}/{subcategory}/{slug}-{id}`).
- Caching (Redis для гарячих запитів/категорій), image optimization, lazy loading.
- Аудит Core Web Vitals, усунення N+1 запитів, database indexing pass.

## Phase 7 — Testing

- Unit tests на бізнес-логіку кожного модуля.
- Integration tests: auth, listings, search, chat, moderation.
- E2E (11 сценаріїв з розділу 48 вихідного документа): реєстрація, login, створення оголошення, модерація, пошук, перегляд, favorite, chat, report, admin moderation, block user.
- Базове security testing (dependency audit, OWASP ZAP baseline scan).

## Phase 8 — Production Readiness

- Deployment pipeline (staging → production), моніторинг (логи, метрики, alerting), error tracking (Sentry або аналог), backups (БД + object storage), production конфігурація (secrets, scaling policy), фінальний security review.

## Після MVP (Phase 2+ продуктово, поза межами цього roadmap)

Nova Poshta інтеграція, онлайн-оплата, escrow/безпечна угода, монетизація (платні оголошення/TOP/VIP/підписки/бізнес-акаунти/реклама/комісія), рейтинги на основі підтверджених transaction, нативні мобільні застосунки, локалізація (RU/EN), category-specific moderation rules (Робота/Нерухомість), сповіщення про збіг saved search з новим оголошенням.
