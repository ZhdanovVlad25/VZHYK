# ВЖИК

Україномовна платформа оголошень (marketplace). Phase 1 — Foundation.

## Стек

Frontend: Next.js + TypeScript · Backend: NestJS + TypeScript · DB: PostgreSQL · Cache: Redis · Infra: Docker + Docker Compose.

Деталі — `/docs` (`architecture.md`, `database.md`, `api.md`, `security.md`, `moderation.md`, `roadmap.md`, `decisions.md`).

## Швидкий старт (локально)

```bash
cp .env.example .env
docker compose up -d postgres redis minio
npm install
npm run migration:run --workspace=apps/api
npm run seed --workspace=apps/api
npm run dev
```

- Backend: http://localhost:3001/api/v1
- Frontend: http://localhost:3000

Або повністю через Docker:

```bash
cp .env.example .env
docker compose up --build
```

## Скрипти

| Команда | Опис |
|---|---|
| `npm run dev` | api + web у watch-режимі |
| `npm run lint` | ESLint для обох застосунків |
| `npm run typecheck` | `tsc --noEmit` для обох застосунків |
| `npm run test` | unit tests (Jest) для обох застосунків |
| `npm run build` | production build обох застосунків |
| `npm run migration:run` | застосувати міграції БД (apps/api) |
| `npm run migration:generate` | згенерувати нову міграцію з diff ентіті |
| `npm run seed` | seed locations + top-level categories |

## Структура

```
apps/
  api/     # NestJS backend (modular monolith, docs/architecture.md §3)
  web/     # Next.js frontend + design system (src/components/ui)
  admin/   # Admin Panel (route group у web або окремий застосунок — Phase 5)
packages/
  tsconfig/       # спільний базовий tsconfig
  eslint-config/  # спільний базовий eslint config
docs/    # Product & Architecture docs (перенесені й оновлені з Phase 0)
```

## Product Decisions (Phase 1 Authorization)

Затверджено `vzhyk_phase1_decisions.md`, деталі — `docs/decisions.md`:

- Модерація «Робота»/«Нерухомість» — generic pipeline у MVP (DEC-02)
- PII retention — 6 місяців після видалення акаунта (DEC-04)
- Ліміт оголошень — 5 ACTIVE listings на користувача, configurable (DEC-05)
- AI content-moderation — не використовується в MVP, rule-based замість неї (DEC-08)
- Accessibility — базова, без повного WCAG audit (DEC-09)

## Definition of Done — Phase 1

- [x] Monorepo structure (`apps/api`, `apps/web`, `packages/*`)
- [x] Docker Compose (postgres, redis, minio, api, web)
- [x] `.env.example`
- [x] Auth foundation: Phone OTP, Google OAuth architecture, JWT sessions, RBAC guard
- [x] DB foundation: entities, перша міграція (users, otp_codes, profiles, locations, categories, category_attributes, app_settings), seed
- [x] Design system: Button, Input, Form, Card, Modal, Dropdown, Tabs, Badge, Alert, Loading/Empty/Error states — з accessibility basics
- [x] CI workflow (install → lint → typecheck → unit tests → build)
- [x] Документація оновлена (`/docs`)
- [ ] **Не верифіковано в цьому середовищі**: реальний `npm install`/lint/typecheck/test/build запуск — немає мережевого доступу до npm registry в sandbox. Потрібно прогнати локально або в CI (workflow вже готовий).
