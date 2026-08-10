# ВЖИК — Testing Strategy

## 1. Unit tests

Покриття бізнес-логіки кожного модуля ізольовано (domain services, state machine переходи, validation rules, risk score calculation). Мокати зовнішні залежності через інтерфейси абстракцій (`SearchProvider`, `StorageProvider` тощо). Ціль покриття — критична бізнес-логіка (listings state machine, moderation rules, OTP flow) близько 100%, решта — за розсудом команди, без штучної гонитви за відсотком.

## 2. Integration tests

Проти реальної тестової БД (testcontainers/docker):

- **Database**: міграції застосовуються чисто, constraints/indexes працюють як очікується.
- **Authentication**: OTP request/verify/rate-limit, Google OAuth callback, refresh token rotation.
- **Listings**: create → publish → moderation → active, некоректні state transitions відхиляються.
- **Search**: фільтри повертають очікувані результати, пагінація стабільна при зміні даних між сторінками (cursor-based).
- **Chat**: доставка повідомлень, unread count, block flow.
- **Moderation**: auto-rules flag коректні кейси, ручне рішення змінює статус listing/media.

## 3. E2E (ключові сценарії, з розділу 48 вихідного документа)

1. Реєстрація (Phone OTP).
2. Login (Phone OTP + Google OAuth).
3. Створення оголошення (усі типи: продам/куплю/обміняю/віддам/послуга/оренда).
4. Модерація (авто-approve, авто-reject, ручний review).
5. Пошук з фільтрами та сортуванням.
6. Перегляд оголошення + збільшення views_count.
7. Favorite (додати/видалити, зміна ціни в обраному).
8. Chat (створення, повідомлення, unread, block).
9. Report (створення скарги, обробка модератором).
10. Admin moderation (черга, рішення, повідомлення користувачу).
11. Block user (адмін блокує → усі активні оголошення переходять у BLOCKED).

Інструменти: Playwright (web + admin), окремий CI job, запускається на staging перед production deploy.

## 4. Security testing

- Dependency audit (`npm audit`/Snyk) у CI.
- OWASP ZAP baseline scan на staging перед кожним production релізом.
- Ручний security review перед Phase 8 (production readiness) — окремий чекліст на базі `/docs/security.md`.
- Тести на rate limiting (перевірка, що ліміти справді блокують після порогу) та на authorization (заборонені переходи ролей/ownership).

## 5. Definition of Done (тестова частина)

Функція вважається завершеною лише якщо має unit tests на бізнес-логіку, integration test на щонайменше один "щасливий" і один "негативний" сценарій, і (для user-facing флоу) покрита відповідним E2E-сценарієм.
