# Отчёт: справочники Sanity в intake / валидации / генерации черновика

## 1. Summary

Добавлен **единый слой загрузки справочных данных из Sanity** (`src/lib/sanity/reference-data.ts`) и **централизованные уровни обязательности полей** (`src/lib/listing-session/field-requirements.ts`). Intake больше не требует от OpenAI обязательного ответа по опциональным фактам (см. суженный `required` в `src/lib/intake/openai-intake-analyzer.ts`). Город, район и тип объекта проверяются и нормализуются по данным Sanity (если заданы `SANITY_PROJECT_ID` / `SANITY_DATASET` и в проекте есть документы). `propertyOffers` в сгенерированном черновике фильтруются до **точных совпадений** с `title.en` документов `propertyOffer`. AI intake и draft получают блок **REFERENCE_DATA** в промпт. Переменные окружения описаны в `.env.example`.

## 2. Required vs Optional Logic Changes

| Файл | Изменение |
|------|-----------|
| `src/lib/listing-session/field-requirements.ts` | **Новый** SSoT: `INTAKE_REQUIRED_FACT_KEYS`, `INTAKE_OPTIONAL_FACT_KEYS`, `PUBLISH_REQUIRED_PATHS`, `PUBLISH_OPTIONAL_PATHS`. |
| `src/lib/listing-session/intake.ts` | Импортирует ключи из `field-requirements`; блокирующие вопросы только по required; добавлено поле `referenceMessages`. |
| `src/lib/intake/openai-intake-analyzer.ts` | `required` в JSON Schema для модели сужен до полей intake-блокеров; опциональные факты остаются в `properties` как nullable, но **не** в `required`. |

Опциональные поля (`parkingSpots`, `hasElevator`, `furnished`, `distanceToSeaMeters`, `bathrooms`, `floor`, и т.д.) **не** блокируют готовность к черновику и **не** обязаны в ответе модели.

## 3. Sanity Reference Data Layer

| Файл | Назначение |
|------|------------|
| `src/lib/sanity/reference-data.ts` | `fetchSanityReferenceData()`, GROQ к `_type == "city"`, `"district"`, `"propertyOffer"`, `"amenity"`; `matchCity`, `matchDistrict`, `matchPropertyOfferByEn` (только exact по нормализованной строке); `formatReferenceContextForPrompt()`; `applyReferenceResolutionToFacts()`; `filterDraftPropertyOffersToSanity()`; `alignDraftAddressFromExtractedFacts()`. |
| `src/lib/config/server.ts` | `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION`, `SANITY_READ_TOKEN` (опционально). |

Ожидаемые поля в Sanity (проецируются через `coalesce` для совместимости):

- **city**: `name.en` или `title`, `slug.current`
- **district**: то же + `city` → reference `_ref`
- **propertyOffer**: `title` (localized), `slug.current`
- **amenity**: как в текущей схеме (`title.en`)

Если проект/датасет не настроены или каталоги пусты, `enabled: false` — приложение ведёт себя как раньше (без жёсткой проверки города).

## 4. City / District Validation

Реализация: `applyReferenceResolutionToFacts()` в `reference-data.ts`.

- При непустом каталоге городов: ввод сопоставляется с `nameEn` или `slug` (без fuzzy).
- Несовпадение → сообщение со списком разрешённых (до 24 имён), поле `city` из фактов **удаляется**, `blocksIntake = true`.
- Район: только при успешном `sanityCityRef`; иначе район сбрасывается и выдаётся пояснение.
- Канонические строки: `city` / `district` в `ExtractedFacts` заменяются на **Sanity `nameEn`**; в факты пишутся `sanityCityRef` / `sanityDistrictRef` (`src/lib/validation/extracted-facts.ts`).

## 5. Property Offers / Advantages Validation

- Справочник: документы `propertyOffer` (GROQ в `reference-data.ts`).
- После генерации черновика: `filterDraftPropertyOffersToSanity()` оставляет только те элементы `draft.propertyOffers`, у которых `en` **точно** совпадает с `title.en` одного из загруженных документов; в черновик подставляется **полный объект `title`** с Sanity (канонические локали).
- Лог: `[sanity][reference] propertyOffer matched` с `id` документа.

## 6. AI Prompt Context Changes

| Файл | Изменение |
|------|-----------|
| `src/lib/intake/prompt-templates.ts` | Блок `REFERENCE_DATA (Sanity)` при наличии `referenceContext`. |
| `src/lib/intake/openai-intake-analyzer.ts` | Передаётся `referenceContext: formatReferenceContextForPrompt(sanityRef)`. |
| `src/lib/ai/types.ts` | `DraftGeneratorInput.referenceContextText?: string`. |
| `src/lib/ai/providers/openai-draft-generator.ts` | В промпт добавлен блок `REFERENCE_DATA` для черновика. |

## 7. Draft Normalization Changes

| Файл | Изменение |
|------|-----------|
| `src/lib/listing-session/service.ts` | После `listingDraftSchema.parse`: `filterDraftPropertyOffersToSanity`, `alignDraftAddressFromExtractedFacts` (город/район как в нормализованных фактах). |

## 8. Files Changed

- `package.json` / `package-lock.json` — зависимость `@sanity/client`.
- `src/lib/config/server.ts` — переменные Sanity.
- `.env.example` — пример Sanity.
- `src/lib/listing-session/field-requirements.ts` — **новый**.
- `src/lib/sanity/reference-data.ts` — **новый**.
- `src/lib/listing-session/intake.ts`
- `src/lib/listing-session/service.ts`
- `src/lib/validation/extracted-facts.ts`
- `src/lib/intake/openai-intake-analyzer.ts`
- `src/lib/intake/prompt-templates.ts`
- `src/lib/ai/types.ts`
- `src/lib/ai/providers/openai-draft-generator.ts`
- `src/lib/listing-session/client.ts`
- `src/components/listing-session/Form.tsx` — только текст ассистента (reference messages + `displayAddress` в списке «не хватает»).
- `docs/sanity-reference-intake-report.md` — этот файл.

## 9. Remaining Limitations

- В репозитории `sanity-real-estate-schema.ts` описаны **amenity** и листинг, но **не** добавлены типы документов `city`, `district`, `propertyOffer` — их нужно завести в Sanity Studio (или отдельной схемой), иначе GROQ вернёт пустые массивы и проверка не активируется.
- Сопоставление города/района/офферов — **без fuzzy**; опечатки не исправляются автоматически.
- `next build` по-прежнему может падать из-за корневого `sanity-real-estate-schema.ts` без пакета `sanity` (см. прошлые отчёты).
- Клиент Prisma должен соответствовать схеме с `confirmation` и т.д. (миграции на стороне окружения).

## 10. Manual Verification Steps

1. Заполнить `.env`: `SANITY_PROJECT_ID`, `SANITY_DATASET`, при необходимости `SANITY_READ_TOKEN` для приватного датасета.
2. В Sanity создать тестовые документы `city`, `district` (с ссылкой на город), `propertyOffer` с `title.en`.
3. Запустить intake с текстом с **неверным** городом — в ответе `intake.referenceMessages` и блокировка до исправления; в БД в `extractedFacts` не должно остаться невалидного города.
4. Запустить генерацию черновика с валидным городом и проверить `editedDraft.address.city` и `propertyOffers` после фильтрации.
5. Убедиться в логах сервера `[sanity][reference] propertyOffer matched` при совпадении `en`.
