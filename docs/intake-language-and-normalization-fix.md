# Intake Language and Normalization Fix

## 1. Summary

This fix adds full multilingual support to the AI intake chat: the assistant now responds in the user's selected UI language (EN/RU/UK/SQ/IT), questions are generated from localized lookup tables with city/property-type hints, Russian and Ukrainian input is correctly extracted and mapped to canonical Sanity values, and duplicate questions for already-provided facts are never asked.

---

## 2. Language Source of Truth Changes

**Before:** Each chat session had a local `agentLanguage` state with EN/RU/UK/SQ/IT buttons inside the chat panel header. Language was per-session and not persisted.

**After:**
- A global `LanguageProvider` context lives at the app root (`src/app/layout.tsx`).
- Language is persisted in `localStorage` (`domlivo_app_language`).
- The language selector was moved to `DashboardHeader` so it applies to the whole UI.
- `Form.tsx` reads `appLanguage` from `useAppLanguage()` — no local state.
- Files changed:
  - `src/contexts/language-context.tsx` — created; exports `AppLanguage`, `LanguageProvider`, `useAppLanguage`
  - `src/app/layout.tsx` — wraps `DashboardShell` with `LanguageProvider`
  - `src/components/dashboard/DashboardHeader.tsx` — converted to `"use client"`, added language selector
  - `src/components/listing-session/Form.tsx` — removed local `agentLanguage` state and chat-panel buttons

---

## 3. Server Question Localization Changes

**Before:** `questionsForUser` from the server was an English-only array of strings built by `questionForRequired()`. The UI displayed `questionsForUser[0]` directly.

**After:**
- The server still populates `questionsForUser` for backward compatibility and logging, but the UI no longer uses it for display.
- `Form.tsx` has a new `QUESTION_MESSAGES` table — `Record<RequiredFactKey, Record<AppLanguage, string>>` — covering all 6 required fact keys × 5 languages.
- `buildAssistantIntakeMessage()` picks the question from `QUESTION_MESSAGES[firstMissing][appLanguage]` and appends allowed-value hints for `city` and `propertyType` from the `cityNames`/`propertyTypeNames` arrays returned by the intake API.
- The `IntakeAnalysis` type and API response now include `cityNames: string[]` and `propertyTypeNames: string[]`.

Files changed:
- `src/lib/listing-session/intake.ts` — `IntakeAnalysis` type extended; `buildIntakeAnalysis` passes these arrays through
- `src/lib/listing-session/client.ts` — `IntakeAnalysisResponse` type extended
- `src/components/listing-session/Form.tsx` — `QUESTION_MESSAGES` added; `buildAssistantIntakeMessage` rewritten

---

## 4. Synonym/Alias Normalization

Added deterministic alias tables in `src/lib/sanity/reference-data.ts`:

**`PROPERTY_TYPE_ALIASES`** — maps Russian/Ukrainian/Albanian/Italian synonyms to English canonical slugs:
- `квартира`, `апартаменты` → `apartment`
- `студия` → `studio`
- `вилла` → `villa`
- `пентхаус` → `penthouse`
- `таунхаус`, `дуплекс` → `townhouse`
- `дом`, `коттедж`, `котедж` → `house`
- (+ Albanian and Italian equivalents)

**`CITY_ALIASES`** — maps Russian/Ukrainian transliterations of Albanian cities to canonical names:
- `дуррес` → `durrës`
- `тирана` → `tirana`
- `влера`, `влёра` → `vlorë`
- `саранда` → `sarandë`
- (and others)

The rule-based extractor `src/lib/extraction/extract-facts.ts` was also updated:
- `propertyTypeRu` synonym detection covers `апартаменты`, `студия`, `пентхаус`, `таунхаус`, `коттедж`
- `dealStatus` patterns include all Russian/Ukrainian verb forms: `продаю/продажа/продается → sale`, `сдаю/аренда/сдается → rent`, `посуточно → short-term`
- City regex includes Cyrillic range `\u0400-\u04FF` so Russian city names are captured

---

## 5. Reference Matching Changes

`matchCity`, `matchPropertyType`, and `matchDistrict` in `src/lib/sanity/reference-data.ts` were extended to match across all locales, not just English.

**New `allLocaleNorms(title)` helper** — extracts every locale value from a `LocalizedTitle` object (`en`, `ru`, `uk`, `sq`, `it`) and normalizes them for comparison.

**`matchCity` — two-pass logic:**
1. Pass 1: try slug match, then check if the normalized input matches any locale title
2. Pass 2: apply `CITY_ALIASES` to the input, then repeat pass 1

**`matchPropertyType` — two-pass logic:**
1. Pass 1: slug match → any locale title match → slug-style EN match (e.g. `"apartment"` → `apartment`)
2. Pass 2: apply `PROPERTY_TYPE_ALIASES`, then repeat pass 1

**`matchDistrict`:** now checks any locale title, not just English.

---

## 6. Canonical Value Expansion from Sanity

`formatReferenceContextForPrompt` was updated to include `ru`/`uk` locale titles in the context block sent to OpenAI, so the model can recognize Russian/Ukrainian property type and city names in user input and map them to the correct Sanity references.

Example prompt context (before fix): `city: tirana (Tirana)`
Example prompt context (after fix): `city: tirana (Tirana / Тирана / Тирана)`

---

## 7. Duplicate Question Prevention

The intake analysis already prevents re-asking provided facts: `missingRequiredFacts` only lists keys where the value is absent. As long as the user's previous messages were saved to `sourceText` and re-analyzed with `runIntake`, already-provided facts are not included in `missingRequiredFacts` and no question is generated for them.

`buildAssistantIntakeMessage` only asks about `missingRequiredFacts[0]` (the first unresolved required fact in priority order), so it never repeats a question already answered.

---

## 8. Files Changed

| File | Change |
|------|--------|
| `src/contexts/language-context.tsx` | Created — global `AppLanguage` context with localStorage |
| `src/app/layout.tsx` | Wrapped with `LanguageProvider` |
| `src/components/dashboard/DashboardHeader.tsx` | Added global language selector |
| `src/components/listing-session/Form.tsx` | Removed local language state; uses `useAppLanguage()`; added `QUESTION_MESSAGES`; updated `buildAssistantIntakeMessage` |
| `src/lib/listing-session/intake.ts` | Added `cityNames`/`propertyTypeNames` to `IntakeAnalysis` |
| `src/lib/listing-session/client.ts` | Added `cityNames`/`propertyTypeNames` to `IntakeAnalysisResponse` |
| `src/lib/extraction/extract-facts.ts` | Extended Russian/multilingual `dealStatus`, `propertyTypeRu`, city regex Cyrillic range |
| `src/lib/sanity/reference-data.ts` | Added `allLocaleNorms`, `PROPERTY_TYPE_ALIASES`, `CITY_ALIASES`; updated `matchCity`/`matchPropertyType`/`matchDistrict`; expanded prompt context |
| `src/lib/intake/openai-intake-analyzer.ts` | Removed `intakeHints` from strict JSON schema; added all fields to `required` (fixes 400 error) |

---

## 9. Remaining Limitations

- The `questionsForUser` array from the server remains English-only (used only for logging/backward compat). If any server-side consumer needs localized questions, it would need the language preference passed as a parameter.
- City and property type name lists sent as allowed-value hints to the user are in the primary locale of each Sanity document (typically English). A future improvement could send the names in the app's selected language.
- `displayAddress` and `streetLine` are not localized in questions — they are optional facts and users typically type them in their own language anyway.
- Voice transcription language detection is not set; the Whisper API is multilingual by default and handles Russian/Ukrainian automatically.

---

## 10. Manual Verification Checklist

- [ ] Set UI language to **RU** in the header selector
- [ ] Open a new listing session
- [ ] Type `продаю квартиру в Тиране 85 м² 150000 евро` in the chat
- [ ] Confirm: assistant responds in Russian
- [ ] Confirm: `dealStatus = sale`, `propertyType = apartment`, `city` matched to Tirana, `price = 150000`, `area = 85`
- [ ] Confirm: only missing fields are asked (photo is the only one left)
- [ ] Upload a photo and send again
- [ ] Confirm: "Данные получены. Обязательные поля заполнены — можно генерировать листинг." message appears
- [ ] Switch to **EN** in the header
- [ ] Send a follow-up message and confirm: next assistant response is in English
- [ ] Set language to **SQ** and confirm questions are in Albanian
- [ ] Verify `Generate Full Listing` still works end-to-end
- [ ] Verify `Publish Listing` still requires confirmation checkboxes and photo alt text
