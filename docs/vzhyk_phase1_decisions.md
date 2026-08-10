# ВЖИК — Product Decisions & Phase 1 Authorization

## Purpose

Цей документ містить фінальні Product Decisions після Phase 0 Discovery.

Використовуй ці рішення як обов'язкові бізнес-вимоги для подальшої розробки.

## 1. Product Decisions

### 1.1 Модерація «Робота» та «Нерухомість»

Для MVP не потрібна окрема глибока category-specific модерація для категорій:
- Робота
- Нерухомість

Використовувати загальну систему модерації. Спеціалізовану модерацію можна додати пізніше.

### 1.2 Зберігання персональних даних після видалення акаунта

Після видалення акаунта персональні дані можуть зберігатися протягом **6 місяців**.

Потрібно:
- зафіксувати retention period у документації;
- не використовувати видалені персональні дані у звичайних користувацьких сценаріях;
- передбачити автоматизований cleanup/anonymization job;
- не видаляти audit records без необхідності, якщо вони потрібні для безпеки та юридичної/операційної історії.

### 1.3 Ліміт оголошень

Для звичайного користувача: **максимум 5 активних оголошень одночасно**.

Це саме 5 ACTIVE listings, а не 5 оголошень на добу.

Коли оголошення переходить у SOLD, EXPIRED, ARCHIVED або BLOCKED, воно більше не займає слот активного оголошення, відповідно до статусної логіки.

Ліміт повинен бути configurable через Admin Panel.

У майбутньому передбачити різні ліміти для звичайних користувачів, verified users, business accounts і платних тарифів.

### 1.4 AI / Content Moderation

У MVP **не використовувати окремий AI/content-moderation сервіс для тексту**.

Використовувати:
- rule-based validation;
- базові security checks;
- стандартну moderation system;
- ручну модерацію там, де вона передбачена;
- user reports.

Архітектура повинна дозволяти додати AI moderation у майбутньому без значної перебудови системи.

### 1.5 Accessibility / WCAG

У MVP реалізувати **базову accessibility**.

Не потрібно проводити повний WCAG audit або сертифікацію на цьому етапі.

Обов'язково:
- семантичні HTML elements;
- правильні labels для form fields;
- `alt` для meaningful images;
- keyboard navigation;
- visible focus states;
- достатній color contrast;
- accessible buttons and controls;
- зрозумілі повідомлення про помилки;
- доступні modal/dialog components;
- коректна структура заголовків;
- базова підтримка screen readers.

Повний WCAG 2.1 AA audit залишити на наступний етап.

## 2. Phase 1 Authorization

Phase 0 Discovery завершено.

На підставі узгоджених Product Decisions переходь до **Phase 1 — Foundation**.

## 3. Перед початком Phase 1

Спочатку онови:
1. `/docs/product-requirements.md`
2. `/docs/architecture.md`, якщо рішення впливають на архітектуру
3. `/docs/database.md`
4. `/docs/security.md`
5. `/docs/moderation.md`
6. `/docs/roadmap.md`
7. `/docs/decisions.md`

Не створюй нових суперечностей із затвердженими Product Decisions.

## 4. Phase 1 — Foundation

Підготувати:

### Repository
Структуру проекту.

### Frontend
Next.js + TypeScript.

### Backend
NestJS + TypeScript.

### Database
PostgreSQL.

### Cache
Redis.

### Infrastructure
Docker + Docker Compose.

### Authentication foundation
- phone authentication;
- OTP architecture;
- Google OAuth architecture;
- session management;
- authorization;
- RBAC foundation.

### Database foundation
- migrations;
- base entities;
- indexes;
- constraints;
- timestamps;
- soft-delete strategy.

### Design System
Базові:
- buttons;
- inputs;
- forms;
- cards;
- modal;
- dropdown;
- tabs;
- badges;
- alerts;
- loading states;
- empty states;
- error states.

Одразу дотримуватися базових accessibility requirements.

### Development Environment
Підготувати:
- `.env.example`;
- Docker Compose;
- local development setup;
- database setup;
- Redis setup;
- linting;
- formatting;
- type checking;
- testing framework.

### CI
Підготувати базовий CI pipeline для:
- install;
- lint;
- typecheck;
- unit tests;
- build.

## 5. Правила роботи

Не переходь одразу до реалізації всього marketplace.

Працюй послідовно.

Після кожного значного етапу:
1. Запускай tests.
2. Запускай lint.
3. Запускай typecheck.
4. Перевіряй build.
5. Оновлюй документацію.
6. Перевіряй, що існуючий функціонал не зламався.

Не залишай критичні TODO замість реалізації.

## 6. Definition of Done для Phase 1

Phase 1 завершена, якщо:
- проект запускається локально;
- frontend запускається;
- backend запускається;
- PostgreSQL працює;
- Redis працює;
- migrations працюють;
- базова authentication architecture готова;
- RBAC foundation готовий;
- Docker setup працює;
- `.env.example` створений;
- lint проходить;
- typecheck проходить;
- tests запускаються;
- build проходить;
- базовий design system готовий;
- accessibility basics закладені;
- документація оновлена.

## 7. Відкладені функції

Не додавай у MVP:
- Nova Poshta integration;
- online payments;
- escrow;
- paid listings;
- subscriptions;
- business accounts;
- AI content moderation;
- глибоку спеціалізовану модерацію «Робота» та «Нерухомість»;
- повний WCAG audit.

Архітектурно можливість їх додавання повинна залишатися.

## 8. Наступний крок

Починай **Phase 1 — Foundation**.

Спочатку покажи короткий план Phase 1, після чого переходь до реалізації.

Не перепитуй уже затверджені вище рішення.
