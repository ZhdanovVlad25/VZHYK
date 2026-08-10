# ВЖИК — API Structure

REST API, документація — OpenAPI/Swagger (`/api/docs`), версіонування через префікс `/api/v1`.

## 1. Єдиний формат помилок

```json
{
  "error": {
    "code": "LISTING_NOT_FOUND",
    "message": "Оголошення не знайдено",
    "details": null,
    "traceId": "..."
  }
}
```

## 2. Auth

| Method | Path | Auth | Опис |
|---|---|---|---|
| POST | /auth/otp/request | public | Запит SMS OTP на номер телефону (rate limited) |
| POST | /auth/otp/verify | public | Підтвердження OTP → tokens |
| POST | /auth/google | public | Google OAuth callback → tokens |
| POST | /auth/refresh | public (refresh token) | Оновлення access token |
| POST | /auth/logout | user | Інвалідація сесії |
| GET | /auth/me | user | Поточний користувач |

## 3. Users & Profiles

| Method | Path | Auth | Опис |
|---|---|---|---|
| GET | /users/:id/public-profile | public | Публічний профіль продавця |
| GET | /profiles/me | user | Власний профіль |
| PATCH | /profiles/me | user | Оновлення профілю |
| GET | /profiles/me/listings?status= | user | Мої оголошення (active/sold/archived/draft) |

## 4. Categories & Attributes

| Method | Path | Auth | Опис |
|---|---|---|---|
| GET | /categories | public | Дерево категорій (з кешем) |
| GET | /categories/:slug | public | Категорія + підкатегорії + атрибути |
| GET | /categories/:id/attributes | public | Список атрибутів для форми оголошення |
| POST | /admin/categories | admin | Створення категорії |
| PATCH | /admin/categories/:id | admin | Редагування/переміщення/сортування |
| DELETE | /admin/categories/:id | admin | Видалення (soft) |
| POST | /admin/categories/:id/attributes | admin | Створення атрибута |
| PATCH | /admin/attributes/:id | admin | Редагування атрибута |

## 5. Listings

| Method | Path | Auth | Опис |
|---|---|---|---|
| POST | /listings | user | Створення чернетки |
| PATCH | /listings/:id | user (owner) | Редагування |
| POST | /listings/:id/publish | user (owner) | Відправка на модерацію/публікація |
| POST | /listings/:id/archive | user (owner) | Архівувати |
| POST | /listings/:id/mark-sold | user (owner) | Позначити проданим |
| DELETE | /listings/:id | user (owner) | Видалення (soft) |
| GET | /listings/:id | public | Картка оголошення (+ views_count increment) |
| GET | /listings | public | Список з фільтрами (проксі до Search) |
| GET | /listings/:id/similar | public | Схожі оголошення |

Валідація: `listing_type` визначає обов'язковість `price` (не обов'язкове для `buy`/`give_away`), `category_id` має існувати і бути listable (leaf-категорія), `attributes[]` валідуються проти `category_attributes.data_type`/`is_required`.

`POST /listings/:id/publish` додатково перевіряє ліміт активних оголошень (`decisions.md` DEC-05): якщо `profiles.active_listings_count >= app_settings['listing.max_active_per_user']` (за замовчуванням 5) — публікація відхиляється з кодом `LISTING_ACTIVE_LIMIT_REACHED`, користувач повинен спершу перевести інше оголошення в `SOLD`/`ARCHIVED`. Цей ліміт незалежний від rate limit на створення (розділ 13) — один регулює кількість одночасно активних оголошень, інший — швидкість створення нових.

## 6. Media

| Method | Path | Auth | Опис |
|---|---|---|---|
| POST | /listings/:id/media | user (owner) | Завантаження фото (multipart, MIME/size guard) |
| PATCH | /listings/:id/media/:mediaId | user (owner) | Позначити головним / sort_order |
| DELETE | /listings/:id/media/:mediaId | user (owner) | Видалення фото |

## 7. Search

| Method | Path | Auth | Опис |
|---|---|---|---|
| GET | /search | public | `q, category, subcategory, priceMin, priceMax, region, city, district, condition, attrs[], hasPhoto, sort, page, cursor` |
| GET | /search/suggestions | public | Автодоповнення запиту |

## 8. Favorites & Saved Searches

| Method | Path | Auth | Опис |
|---|---|---|---|
| POST | /favorites/:listingId | user | Додати в обране |
| DELETE | /favorites/:listingId | user | Видалити з обраного |
| GET | /favorites | user | Список обраного (+ прапорець "недоступне"/"ціна змінилась") |
| POST | /saved-searches | user | Зберегти пошук |
| GET | /saved-searches | user | Список збережених пошуків |
| DELETE | /saved-searches/:id | user | Видалити |

## 9. Chat

| Method | Path | Auth | Опис |
|---|---|---|---|
| POST | /chats | user | Створити/отримати чат за listingId + otherUserId |
| GET | /chats | user | Список чатів (з unread) |
| GET | /chats/:id/messages?cursor= | user (participant) | Історія повідомлень |
| POST | /chats/:id/messages | user (participant) | Надіслати повідомлення (текст/media) |
| POST | /chats/:id/block | user (participant) | Заблокувати співрозмовника |
| POST | /chats/:id/report | user (participant) | Поскаржитися на чат |
| WS | /ws/chat | user | typing, online status, delivery/read events |

## 10. Reports

| Method | Path | Auth | Опис |
|---|---|---|---|
| POST | /reports | user | Створити скаргу (targetType, targetId, reason, description, evidence) |
| GET | /reports/mine | user | Мої скарги і статуси |

## 11. Notifications

| Method | Path | Auth | Опис |
|---|---|---|---|
| GET | /notifications | user | Список (з пагінацією) |
| POST | /notifications/:id/read | user | Позначити прочитаним |
| GET | /notifications/unread-count | user | Лічильник |

## 12. Admin

| Method | Path | Auth | Опис |
|---|---|---|---|
| GET | /admin/dashboard | admin | Агреговані метрики |
| GET | /admin/users | admin | Пошук/список користувачів |
| POST | /admin/users/:id/block | admin | Блокування |
| POST | /admin/users/:id/unblock | admin | Розблокування |
| GET | /admin/listings | admin | Список з фільтрами модерації |
| PATCH | /admin/listings/:id | admin | Редагування/блокування |
| GET | /admin/moderation/queue | moderator/admin | Черга ручної перевірки |
| POST | /admin/moderation/:caseId/decide | moderator/admin | APPROVED/REJECTED/NEEDS_REVIEW |
| GET | /admin/reports | moderator/admin | Обробка скарг |
| GET | /admin/audit-log | admin | Журнал дій |

## 13. Загальні правила

- Усі list-endpoints підтримують cursor-based пагінацію (`?cursor=&limit=`), максимум `limit=50`.
- Мутуючі admin/moderation endpoints обов'язково логуються в `audit_logs` через interceptor.
- Rate limits (приклади): `/auth/otp/request` — 3/15хв на номер, 10/год на IP; `/listings` create — 20/добу на користувача (до перегляду продукту); `/chats/:id/messages` — 60/хв на користувача.
- Ідемпотентність для `POST /listings/:id/publish` та `POST /chats` через `Idempotency-Key` header.
