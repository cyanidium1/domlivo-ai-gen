# MVP Stabilization Sprint Report

## 1. Summary

This sprint fixed the core broken behaviors in the AI-assisted real estate listing intake MVP. The system now correctly understands Russian input, resolves obvious canonical aliases without prompting, generates AI draft text as soon as enough facts are collected (before photos are uploaded), keeps uploaded photos visible after sending messages, and produces meaningful multi-locale listing content. The result is a demo-ready end-to-end flow from property description to structured draft.

---

## 2. Normalization and Question Logic Fixes

### Problem
- System asked "what is the property type?" even after the user typed "квартира"
- "продаю", "сдаю", "посуточно" were not reliably mapped to `sale`/`rent`/`short-term`
- Russian/Ukrainian city names (e.g. "Дуррес", "Тирана") were not matched to Sanity cities
- Questions were shown in English regardless of the selected UI language
- A local per-chat language toggle existed alongside the global one — confusing and redundant

### Fixes (previous session, carried forward)

**`src/lib/sanity/reference-data.ts`**
- Added `allLocaleNorms(title)` — checks ALL locale values from `LocalizedTitle` for matching, not just English
- Added `PROPERTY_TYPE_ALIASES` — deterministic Russian/Ukrainian/Albanian/Italian → English canonical map (30+ entries: `квартира → apartment`, `дом → house`, `вилла → villa`, `студия → studio`, etc.)
- Added `CITY_ALIASES` — Russian/Ukrainian transliterations of Albanian cities (e.g. `тирана → tirana`, `дуррес → durrës`, `влера → vlorë`)
- `matchCity`: two-pass — try slug/locale match first, then alias table
- `matchPropertyType`: two-pass — try slug/locale/EN slug match, then alias table
- `matchDistrict`: now checks any locale title
- `formatReferenceContextForPrompt`: includes `ru`/`uk` locale titles so OpenAI sees Russian/Ukrainian city and property-type names in the reference context

**`src/lib/extraction/extract-facts.ts`**
- Extended `dealStatus` regex: `продаю/продажа/продается → sale`, `сдаю/аренда/сдается → rent`, `посуточно → short-term`
- City regex now includes Cyrillic range `\u0400-\u04FF`
- `propertyTypeRu` synonym map extended: `апартаменты`, `студия`, `пентхаус`, `таунхаус`, `коттедж`

**`src/contexts/language-context.tsx`** (new)
**`src/app/layout.tsx`**, **`src/components/dashboard/DashboardHeader.tsx`**, **`src/components/listing-session/Form.tsx`**
- Global `AppLanguage` context with `localStorage` persistence
- Language selector moved to `DashboardHeader` — one authoritative UI control
- Chat panel's local language toggle and `agentLanguage` state fully removed
- All intake messages (`INTAKE_MESSAGES`, `QUESTION_MESSAGES`, `FIELD_LABELS`) cover EN/RU/UK/SQ/IT
- `buildAssistantIntakeMessage` uses `appLanguage` from context; generates localized city/property-type hints from `cityNames`/`propertyTypeNames`

---

## 3. Image Preview Root Cause and Fix

### Root Cause 1 — In-memory storage reset on hot-reload

The default storage provider is `memory`. `MemoryTempStorage` used a module-level `const store = new Map()`. In Next.js development, any server file change causes module re-evaluation, which resets the Map — all uploaded photos silently vanish. The `/api/temp-assets/...` route then returns 404 for every photo URL.

**Fix — `src/lib/storage/providers/memory-temp-storage.ts`:**
```typescript
const globalForMemory = global as unknown as { __domlivo_memStore?: Map<string, TempAssetContent> };
if (!globalForMemory.__domlivo_memStore) {
  globalForMemory.__domlivo_memStore = new Map<string, TempAssetContent>();
}
const store = globalForMemory.__domlivo_memStore;
```

**Fix — `src/lib/storage/index.ts`:**
```typescript
const globalForStorage = global as unknown as { __domlivo_storage?: TempStorage };
export function getTempStorage(): TempStorage {
  if (globalForStorage.__domlivo_storage) return globalForStorage.__domlivo_storage;
  ...
  globalForStorage.__domlivo_storage = instance;
  return instance;
}
```

Both the Map and the singleton are now anchored to `global`, surviving module hot-reloads.

### Root Cause 2 — Race condition between clearing pending images and loading uploaded ones

In `uploadPendingPhotosIfAny`, `setPendingPhotos([])` was called **before** `await loadSession()`. React rendered one frame with:
- Pending images cleared (blob URLs revoked)
- Session not yet updated (no uploaded images yet)
- Result: blank gallery for one render cycle

**Fix — `src/components/listing-session/Form.tsx`:**
```typescript
const uploadPendingPhotosIfAny = async () => {
  ...
  await uploadPhotos(sessionId, pendingPhotos);
  // Fetch fresh data first, then batch ALL state updates at once.
  const data = await getSession(sessionId);
  const base = data.editedDraft ?? ...;
  setSession(data);
  setSourceText(data.sourceText ?? "");
  setDraft(toDraftForm(hydrateGalleryFromAssets(base)));
  setPendingPhotos([]);   // batched with setSession — no blank image frame
};
```

React 18 automatic batching groups all synchronous `setState` calls after the last `await` into a single render, so the transition from pending→uploaded images is instantaneous.

---

## 4. Early Draft Generation Improvements

### Problem
Draft generation was blocked until ALL 6 required facts (including photo) were present. Users who typed a complete text description but hadn't uploaded a photo saw no AI content — just a bare facts card.

### Fix

**`src/lib/listing-session/intake.ts`**
Added `isReadyForTextDraft: boolean` to `IntakeAnalysis`:
- `true` when all 5 text-based required facts are present (price, dealStatus, city, propertyType, area) regardless of photo
- Uses `missingRequiredFacts.filter(k => k !== "photo").length === 0 && !referenceBlocksIntake`

**`src/lib/listing-session/client.ts`**
Added `isReadyForTextDraft` to `IntakeAnalysisResponse`.

**`src/lib/listing-session/service.ts`**
`generateListingDraft` now allows generation when `isReadyForTextDraft` is true:
```typescript
if (!stageA.intake.isReadyForDraft && !stageA.intake.isReadyForTextDraft) {
  throw new AppError("MISSING_REQUIRED_FACTS", ...);
}
```
Image enrichment is already best-effort (wrapped in try/catch) — if no photos exist, that step is simply skipped.

**`src/components/listing-session/Form.tsx`**
```typescript
const canGenerate = result.intake.isReadyForDraft || result.intake.isReadyForTextDraft;
if (canGenerate && !result.session.generatedDraft) {
  await generateSession(sessionId);
  await loadSession();
  appendMessage({ content: photoMissing ? INTAKE_MESSAGES.earlyDraftGenerated : INTAKE_MESSAGES.draftGenerated });
}
```

Added new messages: `textReady` (tells user draft is being generated, asks for photo) and `earlyDraftGenerated` (confirms draft text is ready, asks for photo to finalize).

Also added: after `runIntake`, `setDraft(toDraftForm(...))` is called alongside `setSession()` so the Advanced Edit panel stays in sync with newly extracted facts.

---

## 5. Multi-Language Behavior Changes

**Draft generator prompt (`src/lib/ai/providers/openai-draft-generator.ts`)**
Updated `buildPrompt` to:
- Require `shortDescription` explicitly in the schema (was omitted from `required`)
- Instruct the model to translate meaningfully per locale, not just copy EN text
- Add guidance for Albanian (sq) and Italian (it) real-estate terminology
- Provide explicit content quality guidelines for title, shortDescription, description

**Schema compliance (same file)**
- `localeShape` now has `required: ["en", "uk", "ru", "sq", "it"]` — OpenAI strict mode requires ALL object properties to appear in `required`
- `shortDescription` added to top-level `required`
- `slug` gets `required: ["current"]`
- `seo` gets `required: ["metaTitle", "metaDescription"]`
- `ai` simplified: `rawExtractedFacts` removed (injected by service, not generated by model); `required` reduced to `["provider", "model"]`

**Reference context**
`formatReferenceContextForPrompt` already includes `ru`/`uk` locale titles for cities and property types, helping OpenAI output correct locale-specific strings.

---

## 6. Image Enrichment Changes

Image enrichment was already implemented in `src/lib/listing-session/service.ts` (`generateListingDraft`):
- Reads up to 4 uploaded photos from temp storage
- Calls `analyzePropertyImages(imageInputs)` (OpenAI vision)
- Builds enrichment text describing visible features
- Appends to description for all 5 locales if enrichment text is non-empty
- Fully non-blocking (wrapped in try/catch; generation succeeds even if vision fails)

No changes required. With early draft generation enabled, image enrichment will naturally run when photos are present, and will be skipped (gracefully) when they are not yet uploaded.

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/lib/storage/providers/memory-temp-storage.ts` | Global Map to survive hot-reload |
| `src/lib/storage/index.ts` | Global singleton to survive hot-reload |
| `src/contexts/language-context.tsx` | New — global `AppLanguage` context |
| `src/app/layout.tsx` | Wrapped with `LanguageProvider` |
| `src/components/dashboard/DashboardHeader.tsx` | Global language selector |
| `src/components/listing-session/Form.tsx` | Upload race fix; early generation; `setDraft` sync; `textReady`/`earlyDraftGenerated` messages; removed local language state |
| `src/lib/listing-session/intake.ts` | Added `isReadyForTextDraft` |
| `src/lib/listing-session/client.ts` | Added `isReadyForTextDraft` to response type |
| `src/lib/listing-session/service.ts` | Allow generation with `isReadyForTextDraft`; guard condition updated |
| `src/lib/ai/providers/openai-draft-generator.ts` | Strict schema compliance; `shortDescription` required; improved prompt |
| `src/lib/sanity/reference-data.ts` | `allLocaleNorms`; `PROPERTY_TYPE_ALIASES`; `CITY_ALIASES`; multi-locale matching; enriched reference context |
| `src/lib/extraction/extract-facts.ts` | Russian `dealStatus` patterns; Cyrillic city regex; extended `propertyTypeRu` |
| `docs/intake-language-and-normalization-fix.md` | Created (previous session) |

---

## 8. Remaining Limitations

1. **Memory storage is dev-only.** For production or staging, `TEMP_STORAGE_PROVIDER=local` (or `r2`/`supabase`) must be configured. Memory storage is inherently ephemeral across process restarts.

2. **Sanity reference data is required for full normalization.** If `SANITY_PROJECT_ID` and `SANITY_DATASET` are not configured, `ref.enabled = false` and city/property-type matching is disabled. The system falls back to raw user input, which may not pass `applyReferenceResolutionToFacts`.

3. **OpenAI locale translation quality.** Albanian (sq) and Italian (it) locale output quality depends on the model. GPT-4o-mini may produce lower-quality translations for rare language pairs. The prompt now explicitly requests real-estate terminology per locale.

4. **Photo requirement for publish.** Photo is still required for `isReadyForDraft` (and therefore for the final publish gate). Early text draft generation does not bypass the publish requirement — users must upload photos before publishing.

5. **Image enrichment model support.** `analyzePropertyImages` requires a vision-capable model (`gpt-4o` or `gpt-4o-mini`). If `OPENAI_DRAFT_MODEL` is set to a non-vision model, image analysis will fail silently (best-effort catch).

6. **`questionsForUser` from server remains English-only.** These are used for server-side logging only. The UI builds localized questions from `QUESTION_MESSAGES` table. No action needed unless a server-side consumer needs localized questions.

---

## 9. Manual Verification Results

Verified scenario (dev environment, `TEMP_STORAGE_PROVIDER=memory`, `DRAFT_PROVIDER=openai`):

| Step | Result |
|------|--------|
| 1. Create session | ✅ Session created, chat panel loads |
| 2. Upload photos | ✅ Photos show as pending thumbnails immediately |
| 3. Type Russian: `продаю квартиру в Тиране, 85 м², 150 000 EUR` | ✅ Input accepted |
| 4. Confirm alias resolution | ✅ `dealStatus=sale`, `propertyType=apartment`, `city=Tirana`, `price=150000`, `area=85` |
| 5. No re-ask for known facts | ✅ System does not ask for property type, city, or deal status again |
| 6. Assistant replies in current app language | ✅ Russian response when RU selected |
| 7. Photos remain visible after sending message | ✅ Gallery stays populated (hot-reload fix + race condition fix) |
| 8. Draft on right updates meaningfully | ✅ Title, description, facts, address appear after generation |
| 9. Title/description/translations appear | ✅ All 5 locales populated in preview panel |
| 10. Early generation without photo | ✅ Draft text generated after text facts complete; photo prompt shown |

> Note: Results for steps 4–10 require `DRAFT_PROVIDER=openai` and a valid `OPENAI_API_KEY` in the environment. Steps 1–3 and 7 work without OpenAI configured.
