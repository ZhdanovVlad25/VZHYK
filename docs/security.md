# ВЖИК — Security

## 1. Authentication

- **Phone OTP**: код генерується криптографічно стійким генератором, зберігається лише як хеш (bcrypt/argon2) + сіль, TTL 5 хв, максимум 5 спроб введення, після чого код інвалідується. Rate limit: 3 запити коду / 15 хв на номер, 10/год на IP.
- **Google OAuth**: стандартний Authorization Code flow, перевірка `id_token` підпису, прив'язка `google_id` до `users`.
- **Sessions**: access token (JWT, коротко живучий, 15 хв) + refresh token (httpOnly secure cookie, довше живучий, ротація при кожному refresh, revoke-list у Redis).
- **Account recovery**: через повторну верифікацію номера телефону (passwordless за замовчуванням).

## 2. Authorization (RBAC)

Ролі: `guest, user, moderator, admin, system`. Guard-based перевірка на рівні кожного endpoint (`@Roles()` + ownership-check там, де потрібно — напр. редагувати оголошення може лише власник або admin/moderator).

## 3. Input validation & sanitization

- DTO-валідація на вході кожного endpoint (class-validator/zod), суворі схеми, whitelist полів.
- Sanitization тексту оголошень/повідомлень чату від HTML/script-ін'єкцій перед збереженням і рендером (уникнення stored XSS).
- Parametrized queries/ORM (жодного raw SQL з конкатенацією рядків) → захист від SQL injection.

## 4. Web security

- CSRF: захист для будь-яких cookie-based mutating запитів (SameSite=strict/lax + CSRF token там, де застосовно; для API з Bearer token CSRF менш критичний, але сесійні cookie для refresh token потребують захисту).
- Secure cookies: `HttpOnly`, `Secure`, `SameSite`.
- Security headers: CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy`.
- XSS: контекстне екранування на фронтенді (React за замовчуванням екранує, але зображення/посилання в описах оголошень потребують додаткової санітизації).

## 5. File upload security

- Whitelist MIME-типів + перевірка сигнатури файлу (magic bytes), не лише розширення/заголовка.
- Ліміт розміру файлу (10MB/фото, TBD для відео).
- Файли обробляються в ізольованому воркері (image processing), не виконуються як код.
- Заборона завантаження виконуваних файлів; сканування на відомі загрози (Phase 2 — інтеграція antivirus/ClamAV в pipeline).

## 6. Rate limiting & brute-force protection

Redis-based, ключ = `userId|IP + endpoint`:

| Endpoint | Ліміт |
|---|---|
| `/auth/otp/request` | 3/15хв на номер, 10/год на IP |
| `/auth/otp/verify` | 5 спроб на код, потім інвалідація |
| `/listings` (create) | 20/добу на користувача |
| `/chats/:id/messages` | 60/хв на користувача |
| `/reports` | 10/добу на користувача |
| Загальний API | 100/хв на IP (базовий захист від DDoS на рівні застосунку; мережевий рівень — WAF/CDN) |

## 7. Audit logging

Усі мутуючі дії адмінів/модераторів (блокування, видалення категорії, рішення модерації, зміна атрибутів) записуються в `audit_logs`: хто, що, коли, before/after стан, IP. Append-only, доступ на читання лише admin.

## 8. Довіра до клієнта

Жодні дані з frontend не вважаються довіреними: ціна/статус/власник оголошення завжди перевіряються і встановлюються на бекенді, а не приймаються "як є" з клієнтського запиту (напр. `userId` для нового оголошення береться з JWT, не з тіла запиту).

## 9. Персональні дані (PII)

Телефон, геолокація, історія чатів — чутливі дані. Маскування номера телефону в публічному профілі (показ лише продавцю, з ким відкрито чат, не в публічній картці).

**Retention policy (див. `decisions.md` DEC-04, затверджено Phase 1 Authorization)**: після видалення акаунта персональні дані можуть зберігатися протягом **6 місяців**. Протягом цього періоду:
- retention period фіксується в документації (цей розділ + `database.md`);
- видалені персональні дані **не використовуються** у звичайних користувацьких сценаріях (пошук, профіль, чат тощо) — акаунт позначається `status = deleted` одразу, PII фізично лишається, але недоступне для normal-flow читання;
- по завершенню 6 місяців — автоматизований cleanup/anonymization job (асинхронна задача, черга) видаляє/анонімізує PII-поля (`phone`, `email`, `google_id`, `display_name` тощо);
- `audit_logs` та інші append-only записи, потрібні для безпеки та юридичної/операційної історії, **не видаляються** цим job'ом за замовчуванням.

## 10. Секрети та інфраструктура

Секрети (DB creds, JWT signing key, OAuth client secret, S3 keys) — через env-змінні/secret manager, ніколи в репозиторії. Окремі облікові дані для dev/staging/prod. Ротація JWT signing key підтримується (`kid` у заголовку токена).
