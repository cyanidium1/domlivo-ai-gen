# Refactor according to `sanity-real-estate-query-contract.md`

## 1. Summary

Инструмент AI-интейка и слой справочников Sanity приведены к контракту: `property` как центральный документ, словари только из `city`, `district`, `propertyType`, `amenity`, `locationTag`, `agent`; цена — скаляр EUR; `propertyOffers` — только встроенные объекты с валидацией формы, локализованного `title` и allowlist `iconKey`; убраны глобальные «документы propertyOffer» и жёсткие enum-типы недвижимости; фильтры интейка и черновика соответствуют полям из контракта; для Prisma JSON добавлен сериализующий хелпер `prismaJson` в `service.ts`.

## 2. Contract Assumptions Fixed

- **Цена:** `money` с валютами заменён на число EUR (`priceEurSchema`, поле `draft.price`).
- **Статус сделки:** вынесен в `dealStatus` (`sale` | `rent` | `short-term`), соответствует `property.status` в контракте; убран `facts.dealType`.
- **Факты:** `facts` содержит `propertyType` (строка до резолва), `area`, опционально `bedrooms`, `bathrooms`, `yearBuilt`; удалены `rooms`, `hasElevator`, `furnished`, `distanceToSeaMeters`, `parkingSpots`, `energyClass` из схемы черновика.
- **Адрес:** `countryCode` не обязателен; `displayAddress` — loose localized object при редактировании.
- **Галерея:** `alt` — строка (с преобразованием из legacy объекта с `en` в `listingImageSchema`).
- **propertyOffers:** массив `{ title: localizedString, iconKey? }`, без глобального словаря Sanity.
- **Извлечённые факты:** добавлены `dealStatus`, `intakeHints` для неканонических эвристик; `normalizeExtractedFacts` маппит legacy `dealType`/`areaTotal`.

## 3. Reference Data Layer Changes

Файл `src/lib/sanity/reference-data.ts`:

- Запросы GROQ к `city`, `district`, `propertyType`, `amenity`, `locationTag`, `agent` (сырые `title`, `slug.current`).
- Удалены `*[_type == "propertyOffer"]` и `matchPropertyOfferByEn`, `filterDraftPropertyOffersToSanity`.
- Добавлены `matchPropertyType`, расширенный `formatReferenceContextForPrompt` (типы, теги, агенты, allowlist иконок).
- `sanitizeEmbeddedPropertyOffers` — валидация через `embeddedPropertyOfferSchema` и `PROPERTY_ICON_KEYS`.
- Типы: `SanityCity`, `SanityDistrict`, `SanityPropertyTypeDoc`, и т.д. с локализованными `title`.

Дополнительно: `src/lib/sanity/property-icon-keys.ts` — статический allowlist (синхронизировать со Studio `iconOptions`).

## 4. City / District Validation Changes

`applyReferenceResolutionToFacts`: город и район матчятся по `title.en` и `slug`; район только при совпадении `cityRef` с выбранным городом; при несоответствии поля очищаются и добавляются сообщения; для типа недвижимости — матч по каталогу `propertyTypes`, при несоответствии `blocksIntake`.

## 5. Property Offers Logic Changes

- Убрана выборка документов «property offer» из CMS и подстановка канонических заголовков из словаря.
- После генерации черновика вызывается `sanitizeEmbeddedPropertyOffers` (`reference-data.ts`), а не фильтрация по документам.

## 6. AI Context Changes

- `formatReferenceContextForPrompt` перечисляет реальные города, районы по городам, типы, amenities, location tags, agents и список icon keys; явно запрещает выдумывать скаляры вне схемы.
- `openai-intake-analyzer.ts` и `openai-draft-generator.ts`: схемы JSON и промпты обновлены под EUR, `dealStatus`, `area`, без currency/rooms как обязательных полей интейка.
- `prompt-templates.ts`: правила для `intakeHints` и запрета канонических «лишних» полей.

## 7. Draft Normalization Changes

- `draft-mapper.ts`: `DraftForm` без валюты и `rooms`; `dealStatus`, `area`; `createBaseDraftFromFacts` / `toListingDraft` под новую модель.
- `listing-session.ts`: `publishListingPayloadSchema` с `price: number`, `dealStatus`, `facts` через `propertyFactsPublishSchema`.
- `service.ts`: `prismaJson` для сохранения JSON в Prisma; `normalizeExtractedFacts` на этапах merge.

## 8. Filter / Query Assumption Changes

- Интейк требует: `price`, `dealStatus`, `city`, `propertyType`, `area`, `photo` (`field-requirements.ts`, `intake.ts`).
- Не используются как обязательные фильтры/поля: furnished, elevator, distance to sea, parking, energy class, combined rooms — только через `intakeHints` или будущий резолв в amenities/tags.

## 9. Public Detail / Card Query Expectations

Добавлен `src/lib/sanity/property-detail-contract.ts` с примечанием: `PROPERTY_FULL_FRAGMENT` может не включать `propertyOffers` — детальная страница должна расширять запрос по контракту §6.1 при необходимости.

## 10. Files Changed

- `src/lib/validation/listing-session.ts` — схемы цены, фактов, офферов, адреса, publish payload.
- `src/lib/validation/extracted-facts.ts` — факты интейка, нормализация.
- `src/lib/sanity/reference-data.ts` — словари, резолв, санитизация офферов.
- `src/lib/sanity/property-icon-keys.ts` — новый allowlist.
- `src/lib/sanity/property-detail-contract.ts` — заметка по GROQ detail.
- `src/lib/listing-session/property-field-support.ts` — классификация полей.
- `src/lib/listing-session/field-requirements.ts`, `intake.ts`, `draft-mapper.ts`, `confirmation.ts`, `preview-mapper.ts`, `readiness.ts`, `client.ts`.
- `src/lib/listing-session/service.ts` — merge фактов, `prismaJson`, `sanitizeEmbeddedPropertyOffers`, `sanityRef` в интейке.
- `src/lib/extraction/extract-facts.ts` — эвристики в `intakeHints`.
- `src/lib/intake/openai-intake-analyzer.ts`, `prompt-templates.ts`.
- `src/lib/ai/providers/openai-draft-generator.ts`, `stub-draft-generator.ts`.
- `src/components/listing-session/Form.tsx`, `AIQuestionsBlock.tsx`.
- `src/components/listing-preview/ListingPreviewPanel.tsx`.
- `scripts/ai-intake-debug.ts`.
- `docs/refactor-according-to-sanity-query-contract-report.md` (этот файл).

## 11. Remaining Mismatches or Blockers

- **Allowlist иконок** в репозитории статический; при расхождении со Studio `PROPERTY_ICON_KEYS` валидация `iconKey` может отклонять корректные ключи — нужна синхронизация файла с `schemaTypes/constants/iconOptions.ts` в проекте Studio.
- **Публикация в Sanity** (`SanityListingPublisher` в `src/lib/publish/providers/sanity-listing-publisher.ts`) по-прежнему заглушка: полный маппинг `PublishListingPayload` → мутация `property` (refs, EUR, вложенные offers) не реализован — **главный блокер** сквозной публикации.
- **`prisma generate`** мог не обновиться из-за EPERM на Windows; используется `prismaJson` для совместимости типов JSON.

### Manual Verification Checklist

- [ ] Интейк с включённым Sanity: неверный город блокирует draft и показывает список допустимых городов.
- [ ] Район не из списка выбранного города отклоняется с сообщением.
- [ ] Тип недвижимости не из каталога — блокировка и сообщение.
- [ ] Генерация черновика: цена числом EUR, `dealStatus` трёхзначный enum, `facts.area` заполнен.
- [ ] `propertyOffers` с неверным `iconKey` отбрасывают ключ или строку целиком по `embeddedPropertyOfferSchema`.
- [ ] Publish gate: подтверждение полей включает `price`, `dealStatus`, `facts.area` (не `price.amount`).
- [ ] Галерея: alt строкой, публикация блокируется без непустого alt.
- [ ] Загрузка старой сессии из БД: legacy `price: { amount, currency: EUR }` приводится к числу.
