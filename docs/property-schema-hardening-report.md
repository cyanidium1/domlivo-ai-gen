# 1. Summary

Выполнен production-hardening рефактор поверх schema-aligned модели `propertyListing`.  
Основной фокус: убрать небезопасные fallback-значения, добавить явное подтверждение критичных полей, запретить публикацию без валидного и подтвержденного payload, и сделать image-поток честным относительно временных ассетов.

# 2. Problems Found

- В `draft-mapper` и stub-generation присутствовали авто-дефолты для критичных полей (`currency`, `propertyType`, `dealType`, `areaTotal`, `rooms`, `address`), что создавало ложные данные.
- Публикация могла идти из `generatedDraft`, то есть AI-предложение фактически считалось финальными данными.
- На publish шаге автоматически достраивались `gallery` и `coverImage`, даже без подтвержденных alt/cover.
- Не было строгой модели разделения `AI suggested` vs `confirmed`.
- Readiness не разделял missing/invalid/unconfirmed критичные поля.
- В preview были fallback-подстановки на основе эвристик, скрывающие недостающие данные.

# 3. Unsafe Fallbacks Removed

Изменения:

- `src/lib/listing-session/draft-mapper.ts`
  - Убраны silent defaults для критичных business fields.
  - `price` теперь формируется только при наличии и `amount`, и `currency`.
  - `facts` создается только при наличии полного required core (`propertyType`, `dealType`, `areaTotal`, `rooms`).
  - `address` создается только при наличии required core (`countryCode`, `city`), `displayAddress` больше не фабрикуется из `city`.
- `src/lib/ai/providers/stub-draft-generator.ts`
  - Убраны fallback-заполнения критичных полей “для прохождения схемы”.
  - Currency больше не подставляется автоматически как EUR.
- `src/lib/listing-session/service.ts`
  - Убрано автопостроение `gallery` и `coverImage` на publish.
  - Publish больше не читает `generatedDraft`, только `editedDraft`.
- `src/lib/listing-session/preview-mapper.ts`
  - Убраны эвристические fallback values (`sourceHints`) из итогового отображения критичных полей.
- `src/lib/ai/providers/openai-draft-generator.ts`
  - Ужесточен prompt: запрет на fabrication currency/address/gallery/cover.

# 4. Confirmation Model Introduced

Добавлен field-level confirmation слой:

- `src/lib/listing-session/confirmation.ts`
  - Введен список `CRITICAL_CONFIRMATION_FIELDS`:
    - `internalRef`, `status`, `title`, `slug`, `description`,
    - `price.amount`, `price.currency`,
    - `facts.propertyType`, `facts.dealType`, `facts.areaTotal`, `facts.rooms`,
    - `address.countryCode`, `address.city`, `address.displayAddress`,
    - `gallery`, `coverImage`.
  - Реализованы:
    - `getConfirmationMap()`
    - `setFieldConfirmed()`
    - `isCriticalFieldValuePresent()`
    - `getUnconfirmedCriticalFields()`

Persistence-решение:

- Confirmation map сохраняется в `editedDraft.ai.rawExtractedFacts.__confirmation` (честно, детерминированно, без добавления новых DB колонок и без расширения schema payload вне разрешенного `rawExtractedFacts`).

# 5. Data Flow Changes

Новый явный lifecycle:

1. intake/extraction (`extractedFacts`)
2. AI suggestion generation (`generatedDraft`)
3. operator editing (`editedDraft`)
4. critical field confirmation (`editedDraft.ai.rawExtractedFacts.__confirmation`)
5. publish payload validation (`publishListingPayloadSchema` + confirmation gate)
6. publish

Ключевое изменение:

- `generatedDraft` больше не является publish-safe.
- Publish разрешен только из `editedDraft`, и только после explicit confirmation критичных полей.

# 6. Validation and Readiness Changes

- `src/lib/listing-session/readiness.ts`
  - Readiness разделен на:
    - `isSaveReady` (WIP-сохранение)
    - `isReady` (publish-safe)
  - Возвращаются отдельные категории:
    - `missingCritical`
    - `invalidCritical`
    - `unconfirmedCritical`
  - Publish-ready теперь требует одновременно:
    - schema-valid payload
    - zero unconfirmed critical fields.

- `src/lib/listing-session/service.ts`
  - Добавлен server-side gate на unconfirmed critical fields.
  - Добавлена проверка связи `coverImage` с `gallery`.

# 7. Image Workflow Changes

- `src/components/listing-session/Form.tsx`
  - Добавлен минимальный UI для image-hardening:
    - редактирование `alt` (EN) для каждого uploaded фото
    - явный выбор `coverImage`
  - Gallery строится из uploaded assets в явный draft shape:
    - `image.asset._ref = "temp:<storageKey>"`
    - `sortOrder` сохраняется детерминированно.

- `src/lib/listing-session/service.ts`
  - Publish больше не делает auto-gallery synthesis.
  - Если gallery/cover не подготовлены и не подтверждены — publish блокируется.

- `src/lib/listing-session/preview-mapper.ts`
  - Поддержан `temp:` префикс refs для честной временной модели.

# 8. Address / SEO / AI Metadata Changes

Address:

- Убрана автоматическая подстановка `displayAddress` как подтвержденного пользовательского адреса.
- Для publish address проходит только при реальном наличии required полей.

SEO:

- SEO остается schema-aligned (`localizedString`/`localizedText`), без принудительной фабрикации.

AI metadata:

- Провенанс сохраняется честно (`sourcePrompt`, `transcript`, `provider`, `model`, `rawExtractedFacts`, `generatedAt` при наличии).
- Confidence не подставляется “из воздуха”; в stub оставлен явно низкий synthetic confidence с предупреждением.

# 9. Files Changed

- `src/lib/listing-session/confirmation.ts` (new)
- `src/lib/listing-session/draft-mapper.ts`
- `src/lib/listing-session/service.ts`
- `src/lib/listing-session/readiness.ts`
- `src/lib/listing-session/preview-mapper.ts`
- `src/components/listing-session/Form.tsx`
- `src/lib/ai/providers/stub-draft-generator.ts`
- `src/lib/ai/providers/openai-draft-generator.ts`

# 10. Remaining Limitations

- Реальный upload в Sanity Assets API не реализован: refs `temp:<storageKey>` остаются временными.
- Паблишер `sanity` провайдер все еще заглушка (`SanityListingPublisher` not implemented).
- Минимальный UI подтверждений сделан для критичных полей и alt/cover; нет полного per-locale редактора image metadata.
- Confirmation map хранится внутри `editedDraft.ai.rawExtractedFacts.__confirmation` (рабочий и детерминированный, но это технический компромисс до выделения отдельного persisted session-field в БД).

# 11. Manual Verification Checklist

- [ ] Создать новую session и загрузить фото.
- [ ] Прогнать intake + generation, убедиться, что `generatedDraft` не считается publish-safe автоматически.
- [ ] В `Advanced Edit` заполнить критичные поля.
- [ ] Для всех фото заполнить `alt` (EN) и выбрать `coverImage`.
- [ ] Проставить confirmations в `Critical Confirmations`.
- [ ] Проверить, что при отсутствии любого critical confirmation publish блокируется.
- [ ] Проверить, что при отсутствии/невалидности required schema field publish блокируется.
- [ ] Проверить, что `coverImage` обязан ссылаться на image из `gallery`.
- [ ] Проверить, что payload publish идет только из `editedDraft`.
- [ ] Проверить, что preview не маскирует missing critical data эвристическими fallback-значениями.

