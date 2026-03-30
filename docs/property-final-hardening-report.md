# 1. Summary

Финализирован слой целостности данных для publish-пайплайна:

- confirmation вынесен из `ai.rawExtractedFacts` в отдельный слой `session.confirmation`
- добавлена авто-инвалидация подтверждений при изменении подтвержденных значений
- добавлен обязательный builder-слой `buildPublishPayload(session)`
- publish разрешается только после strict gate (missing + invalid + unconfirmed)
- отключены auto-assumptions на publish (нет авто-gallery/cover в сервисе)
- закреплен поток: `generatedDraft -> editedDraft -> confirmation -> publishPayload -> publish`

# 2. Confirmation Refactor

## Что сделано

- Добавлен отдельный confirmation-модуль:
  - `src/lib/listing-session/confirmation.ts`
  - функции:
    - `getConfirmation(session)`
    - `setConfirmed(map, field)`
    - `unsetConfirmed(map, field)`
    - `isConfirmed(map, field)`
- Удалено хранение `__confirmation` в `ai.rawExtractedFacts`.
- Добавлено новое поле в session-модель:
  - `prisma/schema.prisma`: `ListingSession.confirmation Json?`
- `ListingSessionResponse` расширен:
  - `src/lib/listing-session/client.ts`: `confirmation: Record<string, boolean> | null`

# 3. Invalidation Logic

## Что сделано

- Реализована серверная invalidation-функция:
  - `invalidateConfirmationOnDraftChange(previousDraft, nextDraft, confirmation)`
  - файл: `src/lib/listing-session/confirmation.ts`
- Логика встроена в PATCH сервиса:
  - `src/lib/listing-session/service.ts` (`patchListingSession`)
  - если изменилось значение подтвержденного critical-поля — confirmation для него снимается автоматически
- Применение неизбежно (server-side gate), не зависит от UI клиента.

# 4. Payload Builder Design

## Что сделано

- Добавлен выделенный слой подготовки publish payload:
  - `src/lib/listing-session/publish-payload.ts`
  - функция: `buildPublishPayload(session): PublishGateResult`
- Builder:
  - читает только `session.editedDraft`
  - выполняет schema-валидацию
  - проверяет `coverImage` связь с `gallery`
  - проверяет unconfirmed critical поля через отдельный confirmation layer
  - возвращает структурированный результат:
    - `{ ok: true, payload }`
    - `{ ok: false, errors: { missing, invalid, unconfirmed } }`

# 5. Publish Gate Changes

## Что сделано

- `src/lib/listing-session/service.ts` (`publishListingSession`)
  - удалена публикация из `generatedDraft`
  - удалена прямая публикация из draft без builder
  - теперь flow:
    - `buildPublishPayload({id, editedDraft, confirmation})`
    - если gate fail -> `AppError` с `details: {missing, invalid, unconfirmed}`
    - если ok -> publish provider

- Структура ошибок publish стала явной и машинно-читаемой:
  - `missing[]`
  - `invalid[]`
  - `unconfirmed[]`

# 6. Image Handling Changes

## Что сделано

- Убран авто-build gallery/cover на publish в сервисе.
- Сохранена строгая проверка:
  - `gallery >= 1`
  - `listingImage` валиден
  - `alt` проходит schema validation (локализованный объект)
  - `coverImage` существует и ссылается на элемент gallery
- В минимальном UI добавлены:
  - редактирование `alt` для изображения
  - явный выбор `coverImage`
  - файлы: `src/components/listing-session/Form.tsx`

# 7. Files Changed

- `prisma/schema.prisma`
- `src/lib/validation/listing-session.ts`
- `src/lib/listing-session/confirmation.ts`
- `src/lib/listing-session/publish-payload.ts`
- `src/lib/listing-session/service.ts`
- `src/lib/listing-session/client.ts`
- `src/lib/listing-session/readiness.ts`
- `src/components/listing-session/Form.tsx`

# 8. Remaining Risks

- Prisma client / DB migration ещё не выполнены в рантайме:
  - добавлено поле `confirmation` в схему, требуется миграция БД и regen Prisma client.
- Реальный Sanity publisher по-прежнему не реализован:
  - conversion `temp:` image refs -> реальные Sanity asset refs отсутствует.
- UI подтверждений минимальный:
  - нет отдельного детального confirm UX по каждому локализованному подполю.

# 9. Manual Test Steps

- [ ] Применить Prisma migration для поля `ListingSession.confirmation`
- [ ] Сгенерировать Prisma client
- [ ] Создать session, сгенерировать `generatedDraft`
- [ ] Отредактировать `editedDraft`
- [ ] Подтвердить critical поля через confirmation actions
- [ ] Изменить одно подтвержденное поле (например `price.amount`) и проверить авто-сброс confirmation
- [ ] Проверить publish fail с `details.unconfirmed` при неполных confirmations
- [ ] Проверить publish fail с `details.missing`/`details.invalid` при невалидном payload
- [ ] Проверить, что publish не использует `generatedDraft`
- [ ] Проверить, что `coverImage` вне `gallery` блокирует publish

