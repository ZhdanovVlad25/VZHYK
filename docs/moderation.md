# ВЖИК — Moderation & Anti-Fraud

## 1. Пайплайн модерації медіа

```
Upload → Validation → Processing → Moderation → Published
```

1. **Validation**: MIME-тип (whitelist: jpeg/png/webp), розмір файлу (макс. 10MB/фото), перевірка сигнатури файлу (не лише розширення), захист від poliglot/malicious files.
2. **Processing**: compression, генерація thumbnails (напр. 200/600/1200px), запис у object storage через `StorageProvider`.
3. **Moderation**: авто-правила (nsfw/violence detection для фото — сторонній API або self-hosted модель, підключається як провайдер, не хардкодиться) + ручна черга для прапорців. Для **тексту** оголошень окремий AI/content-moderation сервіс у MVP **не використовується** (див. §3.1 нижче) — фото-модерація і текст-модерація незалежні pipeline.
4. **Published**: фото доступне публічно лише після проходження auto-rules (або ручного APPROVED, якщо auto flagged NEEDS_REVIEW).

## 2. ModerationCase

`target_type: listing | media | user | chat_message`
`status: PENDING | APPROVED | REJECTED | NEEDS_REVIEW`

Створюється автоматично при публікації оголошення (стандартна перевірка) та при надходженні скарги (`report → moderation_case`, поле `report_id`).

## 3. Модерація оголошень

Автоматичні правила (MVP, прості й прозорі — без ML-чорної скриньки на старті):

- заборонені слова/категорії товарів (зброя, наркотики, підробки тощо — довідник у Admin Panel);
- ціна = 0 для типу `sell` (підозріло, крім `give_away`);
- дублікат заголовка+ціни+фото від того ж користувача за короткий проміжок;
- відсутність фото для категорій, де воно обов'язкове.

Усе, що не проходить авто-правила однозначно → `NEEDS_REVIEW`, а не автоматичний `REJECTED` — уникнення false positive без участі людини для граничних випадків.

### 3.1 Чому без AI content-moderation сервісу в MVP (`decisions.md` DEC-08)

Рішення Phase 1 Authorization: жодного стороннього платного AI/content-moderation API для тексту в MVP. Замість цього — rule-based validation (заборонені слова/довідник), базові security checks, стандартна moderation queue вище, ручна модерація, user reports. `ModerationProvider`-подібна абстракція (за аналогією з `SearchProvider`/`StorageProvider` в `architecture.md`) закладається так, щоб AI-провайдер можна було підключити пізніше без перебудови pipeline.

## 4. Черга ручної модерації (Admin/Moderator)

Пріоритизація: спочатку `NEEDS_REVIEW` з активними скаргами → потім flagged auto-rules → потім вибіркова перевірка нових акаунтів. Модератор бачить: оголошення, фото, історію користувача, кількість попередніх скарг/блокувань, risk score.

Рішення: `APPROVED` (публікація) / `REJECTED` (з обов'язковою причиною, повідомляється користувачу) / `NEEDS_REVIEW` (ескалація старшому модератору — Phase 2, у MVP просто залишається в черзі).

## 5. Скарги (Reports)

Причини (enum, розширюваний з Admin Panel):
`fraud, prohibited_item, wrong_category, false_information, spam, duplicate, offensive_content, suspicious_activity, other`

Поля: `reason, description, evidence (media[]), reporter, target, status, createdAt, moderator_decision`.

Флоу: `new → in_review → resolved | rejected`. Кожна скарга створює або приєднується до `ModerationCase`.

## 6. Anti-Fraud (RiskScore / RiskSignal)

Сигнали (`risk_signals.signal_type`), кожен з вагою:

- багато оголошень за короткий час (`rapid_listing_creation`)
- багато однакових/схожих оголошень (`duplicate_listings`)
- багато скарг на користувача (`high_report_count`)
- масова відправка однакових повідомлень у чаті (`mass_messaging`)
- часті реєстрації з одного пристрою/IP (`multi_account_signal`)
- невідповідність номера телефону і геолокації активності (`location_mismatch`, Phase 2)

`RiskScore` — агрегована зважена сума активних сигналів, перераховується асинхронно (черга) при кожній тригер-події. Пороги (напр. `score > X → NEEDS_REVIEW`, `score > Y → авто-приховати з пошуку до перевірки`) конфігуруються в Admin Panel, не хардкодяться.

**Правило**: жоден одиничний слабкий сигнал не блокує користувача автоматично — потрібна комбінація сигналів або ручне підтвердження модератора для `BLOCKED`.

## 7. Блокування користувачів

`users.status: active | blocked | deleted`. Блокування — дія модератора/адміна з обов'язковою причиною → записується в `audit_logs` і `listing_status_history` (усі активні оголошення заблокованого користувача переходять у `BLOCKED`).

## 8. Категорії «Робота» та «Нерухомість» (вирішено, `decisions.md` DEC-02)

Модерація контенту для категорій «Робота» та «Нерухомість» потенційно вимагає інших перевірок (напр. заборона дискримінаційних формулювань у вакансіях, перевірка правовстановлюючих документів для нерухомості). **Рішення Phase 1 Authorization**: у MVP окрема глибока category-specific модерація для цих категорій не реалізується — застосовується generic pipeline (розділи 1–7 цього документа) без винятків. Спеціалізовані правила — Phase 2.
