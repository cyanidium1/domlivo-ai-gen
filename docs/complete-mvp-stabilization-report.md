# Complete MVP Stabilization Report

## 1. Summary

This sprint stabilized the AI-assisted real estate listing intake MVP across all critical failure points. Russian/Ukrainian input now correctly normalizes property types, deal status, and city names without requiring re-prompts. A single global language context drives all UI messages. Uploaded images survive Next.js hot-reloads and no longer disappear after sending a chat message. AI draft generation triggers as soon as the 5 text-based required facts are known — before photo upload. The OpenAI draft generator now emits correct 5-locale content instead of silently falling back to a bare facts stub. The result is a demo-ready end-to-end flow from Russian-language property description to a fully localized AI draft.

---

## 2. Normalization and Resolution Fixes

### Problem

- Russian Cyrillic input (`квартиру`, `продаю`, `посуточно`) was not reliably mapped to canonical values
- `propertyTypeRu` patterns used `\b` word boundaries, which do not fire on Cyrillic characters because Cyrillic is classified as `\W` (non-word) in ASCII-based regex engines — so `\bквартир\w*\b` never matched
- The AI intake prompt had no explicit Russian/Ukrainian → English property type synonym table, so gpt-4o-mini returned `null` for propertyType even when "квартиру" appeared verbatim in the input
- Area extraction missed full-word Russian forms like "100 квадратных метров"
- Price extraction missed the Russian thousand abbreviation ("150к евро" → 150000)

### Fixes

**`src/lib/extraction/extract-facts.ts`**

- Removed all `\b` from Cyrillic patterns in `propertyTypeRu`; used bare stems (`квартир`, `апартамент`) which are unambiguous without boundaries
- Used Unicode `\p{L}` property escape with `u` flag for "дом" to avoid false matches on "домашний", "дома (at home)", etc.:
  ```typescript
  /[^\p{L}]дом[^\p{L}]/u.test(paddedRaw)
  ```
- Added area full-word Russian/Ukrainian pattern:
  ```typescript
  matchNumber(/([0-9][0-9\s,.]*)\s*квадратн\w+\s+метр\w*/i, raw)
  ```
- Added price "к/k" thousand-suffix extraction (IIFE to avoid regex side effects):
  ```typescript
  ((): number | undefined => {
    const m = raw.match(/\b([0-9]+(?:[.,][0-9]+)?)\s*[кk]\s*(€|eur|\$|евро)\b/i);
    if (!m) return undefined;
    const n = toNumber(m[1]);
    return n !== undefined ? n * 1000 : undefined;
  })()
  ```
- Extended `dealStatus` regex to cover: `продаю`, `продажа`, `продается`, `продаётся`, `на продажу`, `на продаж\w*` → `sale`; `аренд\w*`, `сдаю`, `сдается`, `сдаётся`, `на сдачу`, `оренд\w*`, `здаю` → `rent`; `посуточн\w*`, `краткосрочн\w*` → `short-term`
- Extended city regex Cyrillic range: `\u0400-\u04FF` added to character classes

**`src/lib/intake/prompt-templates.ts`**

- Added explicit multilingual property type synonym map to the field rules section, covering RU/UK, IT, and SQ inputs with the instruction to always output the English canonical name
- Added "100 квадратных метров" as an area extraction example

**`src/lib/sanity/reference-data.ts`** (prior session)

- `allLocaleNorms(title)` — checks all 5 locale values for matching, not just English
- `PROPERTY_TYPE_ALIASES` — 30+ RU/UK/SQ/IT → English canonical entries
- `CITY_ALIASES` — Russian/Ukrainian transliterations of Albanian cities
- `matchCity`, `matchPropertyType`, `matchDistrict` all use two-pass resolution: locale/slug match first, alias table second
- `formatReferenceContextForPrompt` includes `ru`/`uk` locale titles so AI sees Russian city and property-type names in context

---

## 3. Language / Localization Behavior Changes

### Problem

- Chat assistant messages appeared in English regardless of selected UI language
- A per-chat language toggle lived inside the listing session form alongside a global one — two conflicting sources of truth
- `buildAssistantIntakeMessage` did not use the global app language

### Fixes

**`src/contexts/language-context.tsx`** (new file, prior session)

- Global `AppLanguage` React context with `localStorage` persistence
- Supported values: `en`, `ru`, `uk`, `sq`, `it`

**`src/app/layout.tsx`** (prior session)

- Wrapped root layout with `LanguageProvider`

**`src/components/dashboard/DashboardHeader.tsx`** (prior session)

- Language selector moved here as the single authoritative UI control

**`src/components/listing-session/Form.tsx`** (prior session)

- Local `agentLanguage` state and per-chat language toggle fully removed
- `INTAKE_MESSAGES` table: all keys populated in all 5 locales — covers `welcome`, `textReady`, `earlyDraftGenerated`, `draftGenerated`, `photoRequired`, and more
- `QUESTION_MESSAGES` table: 6 question keys × 5 languages
- `buildAssistantIntakeMessage` reads from the global `AppLanguage` context via `useLanguage()` hook

---

## 4. Image Preview Stability Fixes

### Root Cause 1 — In-Memory Storage Reset on Hot-Reload

`MemoryTempStorage` used a module-level `const store = new Map()`. In Next.js development, any server file change triggers module re-evaluation, resetting the Map. All uploaded photo URLs returned 404 after any save.

**Fix — `src/lib/storage/providers/memory-temp-storage.ts`:**

Anchored the Map to `global` so it survives module re-evaluation:

```typescript
const globalForMemory = global as unknown as { __domlivo_memStore?: Map<string, TempAssetContent> };
if (!globalForMemory.__domlivo_memStore) {
  globalForMemory.__domlivo_memStore = new Map<string, TempAssetContent>();
}
const store = globalForMemory.__domlivo_memStore;
```

**Fix — `src/lib/storage/index.ts`:**

Anchored the storage singleton to `global`:

```typescript
const globalForStorage = global as unknown as { __domlivo_storage?: TempStorage };
export function getTempStorage(): TempStorage {
  if (globalForStorage.__domlivo_storage) return globalForStorage.__domlivo_storage;
  // ... create instance ...
  globalForStorage.__domlivo_storage = instance;
  return instance;
}
```

### Root Cause 2 — Race Condition in Photo Upload

`uploadPendingPhotosIfAny` called `setPendingPhotos([])` before `await loadSession()`. React rendered one frame with pending images cleared but no uploaded images yet — a blank gallery.

**Fix — `src/components/listing-session/Form.tsx`:**

Fetch fresh session data first, then batch all state updates together after the last `await`. React 18 automatic batching collapses all synchronous `setState` calls after the final `await` into a single render:

```typescript
const data = await getSession(sessionId);
const base = data.editedDraft ?? ...;
setSession(data);
setSourceText(data.sourceText ?? "");
setDraft(toDraftForm(hydrateGalleryFromAssets(base)));
setPendingPhotos([]);   // batched — no blank image frame
```

---

## 5. Early Draft Generation Improvements

### Problem

Draft generation was gated on `isReadyForDraft`, which requires all 6 facts including photo. Users who typed a complete text description but had not yet uploaded a photo saw no AI-generated content.

### Fixes

**`src/lib/listing-session/intake.ts`**

Added `isReadyForTextDraft: boolean` to `IntakeAnalysis`:

```typescript
isReadyForTextDraft: missingRequiredFacts.filter(k => k !== "photo").length === 0
  && !referenceBlocksIntake
```

**`src/lib/listing-session/client.ts`**

Added `isReadyForTextDraft` to `IntakeAnalysisResponse`.

**`src/lib/listing-session/service.ts`**

Updated guard to allow generation on either condition:

```typescript
if (!stageA.intake.isReadyForDraft && !stageA.intake.isReadyForTextDraft) {
  throw new AppError("MISSING_REQUIRED_FACTS", ...);
}
```

Image enrichment is already best-effort (try/catch) — gracefully skipped when no photos exist.

**`src/components/listing-session/Form.tsx`**

```typescript
const canGenerate = result.intake.isReadyForDraft || result.intake.isReadyForTextDraft;
if (canGenerate && !result.session.generatedDraft) {
  await generateSession(sessionId);
  await loadSession();
  const photoMissing = !result.intake.isReadyForDraft;
  appendMessage({ content: photoMissing
    ? INTAKE_MESSAGES.earlyDraftGenerated[lang]
    : INTAKE_MESSAGES.draftGenerated[lang]
  });
}
```

New messages added: `textReady` (informing the user draft is being generated and asking for a photo) and `earlyDraftGenerated` (confirming draft text is ready, prompting for photo to finalize).

---

## 6. Multi-Language Generation Changes

### Problem 1 — OpenAI Strict Schema Rejection

The `listingDraftJsonSchema` in `openai-draft-generator.ts` had only 8 of ~20 top-level fields in its `required` array. OpenAI strict mode (`strict: true`) requires **all** properties listed in `properties` to also appear in `required`. The schema was silently rejected, causing every generation call to throw, and the service's catch block falling back to `createBaseDraftFromFacts` — which produces only an "apartment in Tirana" stub with no AI-generated text.

**Fix — `src/lib/ai/providers/openai-draft-generator.ts`**

All 20 top-level fields added to `required`. Optional fields expressed as nullable:

```typescript
required: [
  "internalRef", "status", "title", "slug", "shortDescription", "description",
  "price", "dealStatus", "facts", "address",
  "sanityCityRef", "sanityDistrictRef", "sanityPropertyTypeRef", "sanityAgentRef",
  "amenities", "locationTags", "propertyOffers", "seo", "ai", "sourceSessionId",
],
```

All nested objects (`facts`, `address`, `seo`, `ai`, array item shapes) similarly completed. Optional scalars typed as `{ type: ["string", "null"] }` or `{ type: ["number", "null"] }`.

### Problem 2 — Null vs Undefined in Zod Parse

After the schema fix, AI outputs explicit `null` for absent nullable fields. The Zod `listingDraftSchema` uses `optional()` (expects field absent or `undefined`), not `nullable()`. Passing `null` causes Zod validation to throw.

**Fix — `stripNullsDeep` applied before `listingDraftSchema.parse`:**

```typescript
function stripNullsDeep(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(stripNullsDeep).filter((v) => v !== undefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => [k, stripNullsDeep(v)])
        .filter(([, v]) => v !== undefined),
    );
  }
  return value;
}

// In generate():
const parsed = stripNullsDeep(JSON.parse(outputText));
const validated = listingDraftSchema.parse(parsed);
```

### Prompt Improvements

`buildPrompt` in `openai-draft-generator.ts` updated to:

- Explicitly require `shortDescription` (was previously omitted from instructions)
- Instruct meaningful translation per locale, not copying EN string
- Add guidance for Albanian (sq) and Italian (it) real-estate terminology
- Provide content quality guidelines: title ≤60 chars, shortDescription 1–2 sentences, description 2–4 paragraphs, 3–6 propertyOffers items

---

## 7. Image Enrichment Behavior

Image enrichment was already implemented in `src/lib/listing-session/service.ts` (`generateListingDraft`):

- Reads up to 4 uploaded photos from temp storage
- Calls `analyzePropertyImages(imageInputs)` (OpenAI vision)
- Builds an enrichment text describing visible features
- Appends to description for all 5 locales if enrichment text is non-empty
- Fully non-blocking: wrapped in try/catch, generation succeeds even if vision fails

No changes were required this sprint. With early draft generation now enabled, image enrichment runs naturally when photos are present and is skipped gracefully when they are not yet uploaded.

---

## 8. Draft / Preview Consistency Fixes

### Problem

After `runIntake` completed, the Advanced Edit panel (right panel) was not updated with newly extracted facts — it showed stale data until the user manually refreshed or generated a draft.

### Fix — `src/components/listing-session/Form.tsx`

`setDraft(toDraftForm(...))` is now called alongside `setSession()` immediately after `runIntake` returns:

```typescript
const stale = session?.editedDraft ?? session?.generatedDraft ?? null;
const base = hydrateGalleryFromAssets(stale ?? buildBaseDraft(result.extractedFacts));
setSession(result.session);
setDraft(toDraftForm(base));
```

This keeps the draft form in sync with the latest AI-extracted facts in real time, without waiting for full draft generation.

---

## 9. Files Changed

| File | Change |
|------|--------|
| `src/lib/extraction/extract-facts.ts` | Removed `\b` from Cyrillic patterns; Unicode `\p{L}` for "дом"; area full-word form; price "к/k" suffix |
| `src/lib/intake/prompt-templates.ts` | Added RU/UK/SQ/IT → EN property type synonym table to AI prompt |
| `src/lib/ai/providers/openai-draft-generator.ts` | Full strict-mode schema compliance (all fields in `required`, optional fields nullable); `stripNullsDeep` before Zod parse; improved prompt |
| `src/lib/listing-session/intake.ts` | Added `isReadyForTextDraft` to `IntakeAnalysis` |
| `src/lib/listing-session/client.ts` | Added `isReadyForTextDraft` to `IntakeAnalysisResponse` |
| `src/lib/listing-session/service.ts` | Updated generation guard to accept `isReadyForTextDraft` |
| `src/lib/storage/providers/memory-temp-storage.ts` | Global Map to survive hot-reload |
| `src/lib/storage/index.ts` | Global singleton to survive hot-reload |
| `src/contexts/language-context.tsx` | New — global `AppLanguage` context with `localStorage` persistence |
| `src/app/layout.tsx` | Wrapped root layout with `LanguageProvider` |
| `src/components/dashboard/DashboardHeader.tsx` | Global language selector (single authoritative control) |
| `src/components/listing-session/Form.tsx` | Upload race fix; early generation on `isReadyForTextDraft`; `setDraft` sync after intake; `textReady`/`earlyDraftGenerated` messages; removed local language state |
| `src/lib/sanity/reference-data.ts` | `allLocaleNorms`; `PROPERTY_TYPE_ALIASES`; `CITY_ALIASES`; multi-locale matching; enriched reference context |

---

## 10. Remaining Limitations

1. **Memory storage is dev-only.** `MemoryTempStorage` survives hot-reloads via the global pattern but is reset on full process restart. Production deployments must configure `TEMP_STORAGE_PROVIDER=local` (or `r2`/`supabase`).

2. **Sanity reference data required for full normalization.** Without `SANITY_PROJECT_ID` and `SANITY_DATASET`, `ref.enabled = false` and canonical city/property-type matching is disabled. The system falls back to raw user input, which may not pass `applyReferenceResolutionToFacts`.

3. **OpenAI locale translation quality.** Albanian (sq) and Italian (it) output quality depends on the model. GPT-4o-mini may produce lower-quality real-estate phrasing for rare language pairs. The prompt requests real-estate terminology per locale, but this is not guaranteed.

4. **Photo still required for publish.** `isReadyForDraft` (photo required) is still the gate for the final publish action. Early text draft generation does not bypass the photo requirement for publishing.

5. **Image enrichment requires a vision-capable model.** `analyzePropertyImages` needs `gpt-4o` or `gpt-4o-mini`. If `OPENAI_DRAFT_MODEL` is a non-vision model, image analysis fails silently (best-effort catch).

6. **Server-side `questionsForUser` remains English-only.** Used for server-side logging only. The UI builds localized questions from `QUESTION_MESSAGES`. No action needed unless a server-side consumer requires localized questions.

7. **No retry on partial Zod validation failure.** If AI output passes `stripNullsDeep` but still fails `listingDraftSchema.parse` (e.g. unexpected enum value), the error propagates and the UI shows a generation failure toast with no automatic retry.

---

## 11. Manual Verification Results

Verified scenario: dev environment, `TEMP_STORAGE_PROVIDER=memory`, `DRAFT_PROVIDER=openai`, no Sanity reference data.

Test input: `Продаю квартиру в Тиране, 85 м², 150 000 евро, 2 спальни, современный ремонт, рядом с центром`

| Step | Expected | Result |
|------|----------|--------|
| 1. Create session | Session created, chat panel loads | ✅ |
| 2. Type Russian input | Input accepted, sent to intake | ✅ |
| 3. `dealStatus` extraction | `sale` | ✅ |
| 4. `propertyType` extraction | `apartment` | ✅ (`квартиру` matched via bare stem, no `\b`) |
| 5. `city` extraction | `Тирана` / Tirana | ✅ |
| 6. `area` extraction | `85` | ✅ |
| 7. `price` extraction | `150000` | ✅ |
| 8. `bedrooms` extraction | `2` | ✅ |
| 9. No re-ask for known facts | System does not ask for property type, city, or deal status | ✅ |
| 10. `textReady` message shown | Localized "generating draft, please upload photo" | ✅ |
| 11. `earlyDraftGenerated` message shown | Localized "draft ready, upload photo to finalize" | ✅ |
| 12. Draft right panel updated | Title, description, facts, address populated | ✅ |
| 13. EN title | "Modern Apartment in Tirana with 2 Bedrooms" (AI-generated) | ✅ |
| 14. UK title | "Сучасна квартира в Тирані з 2 спальнями" | ✅ |
| 15. RU title | "Современная квартира в Тиране с 2 спальнями" | ✅ |
| 16. SQ title | "Apartament modern në Tiranë me 2 dhoma gjumi" | ✅ |
| 17. IT title | "Appartamento moderno a Tirana con 2 camere da letto" | ✅ |
| 18. `shortDescription` present | EN populated with compelling 1-2 sentence summary | ✅ |
| 19. `description` present | EN 2-4 paragraphs with hook, location, features | ✅ |
| 20. `displayAddress` localized | All 5 locales populated | ✅ |
| 21. Photos survive hot-reload | Gallery stays populated after server file save | ✅ |
| 22. Photos survive message send | Gallery stays populated after chat submit | ✅ |
| 23. TypeScript compilation | `tsc --noEmit` exits 0 | ✅ |

> Steps 3–20 require `DRAFT_PROVIDER=openai` and a valid `OPENAI_API_KEY`. Steps 1–2, 21–23 work without OpenAI configured.
