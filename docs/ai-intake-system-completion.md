# AI Intake System — Completion Report

**Date:** 2026-03-28
**Scope:** Stabilize and complete the AI-driven listing intake, question, draft generation, image analysis, and multi-language flow.

---

## 1. Summary

The AI intake pipeline was already structurally sound. This task completed six missing capabilities:

1. **Partial draft during intake** — preview panel now updates after every message, not only after full generation.
2. **Context-aware questions** — city and propertyType questions now list allowed Sanity catalog values.
3. **Image analysis** — OpenAI vision analyzes uploaded photos and enriches the generated description.
4. **Agent language selector** — UI messages switch between EN / RU / UK / SQ / IT.
5. **Explicit multi-language generation** — the draft generator prompt mandates all 5 locales.
6. **Improved intake prompt** — extraction rules are more explicit, covering deal status aliases, multilingual inputs, and canonical field mapping.

`tsc --noEmit` passes with zero errors after all changes.

---

## 2. Intake Pipeline Fixes

### Partial draft on every intake round
**File:** `src/lib/listing-session/service.ts`

Previously, `analyzeListingIntake` only saved `extractedFacts` and `status` — the preview panel showed nothing until the user triggered full generation. Now, if no `editedDraft` exists yet, a partial draft is built from the known facts and saved immediately:

```typescript
const hasExistingDraft = session.editedDraft != null;
const partialDraft = hasExistingDraft ? undefined : prismaJson(createBaseDraftFromFacts(id, finalFacts));

await prisma.listingSession.update({
  data: {
    extractedFacts: prismaJson(finalFacts),
    status: intake.isReadyForDraft ? "ready" : "collecting",
    ...(partialDraft ? { editedDraft: partialDraft } : {}),
  },
});
```

The partial draft is not overwritten if the user has already saved an editedDraft.

---

## 3. Question Engine Improvements

### Context-aware city and propertyType questions
**Files:** `src/lib/listing-session/intake.ts`, `src/lib/listing-session/service.ts`

`buildIntakeAnalysis` now accepts `cityNames` and `propertyTypeNames` arrays:

```typescript
type BuildIntakeAnalysisParams = {
  ...
  cityNames?: string[];
  propertyTypeNames?: string[];
};
```

When provided, the questions include the allowed values:
- **Before:** `"What is the property type? It must match a Sanity propertyType (see reference list when configured)."`
- **After:** `"What is the property type? Allowed values: Apartment, Villa, Studio, House."`

`service.ts` extracts the names from `sanityRef` and passes them:

```typescript
const cityNames = sanityRef.enabled
  ? sanityRef.cities.map((c) => sanityTitleEn(c.title)).filter(Boolean)
  : [];
const propertyTypeNames = sanityRef.enabled
  ? sanityRef.propertyTypes.map((p) => sanityTitleEn(p.title)).filter(Boolean)
  : [];
```

Questions are still suppressed when fields are already satisfied — no repeated questions.

---

## 4. Draft Generation Changes

### Stub generator produces multi-language content
**File:** `src/lib/ai/providers/stub-draft-generator.ts`

The stub now fills all 5 locale slots (`en`, `uk`, `ru`, `sq`, `it`) with the same English text as a placeholder, so the preview panel shows content for all locales in stub mode.

### OpenAI generator mandates all 5 locales
**File:** `src/lib/ai/providers/openai-draft-generator.ts`

The prompt now explicitly requires all locales for every localized field:

```
LOCALIZATION REQUIREMENT — MANDATORY:
All localized string fields (title, shortDescription, description, address.displayAddress,
seo.metaTitle, seo.metaDescription, and every propertyOffers[].title) MUST be populated
in ALL 5 locales: en, uk, ru, sq, it.
```

The generator also now instructs the model to generate 3-6 `propertyOffers` and populate `seo` fields.

### Real-time draft during chat
**File:** `src/lib/listing-session/service.ts`

The existing `sendMessage → runIntake → if ready → generateSession` auto-generation flow was already correct. The new partial draft saves ensure the preview is useful from the very first message.

---

## 5. AI Generation Logic

### Prompt architecture (openai-draft-generator.ts)

Trust hierarchy:
1. `extractedFacts` — canonical facts, not overridden
2. `sourceText` / `transcript` — context for descriptions
3. Uncertain values are omitted rather than invented

Hard rules enforced in prompt:
- `price` is a single EUR number
- `dealStatus` is exactly `sale | rent | short-term`
- `facts.area` is m² only; non-schema hints belong in `intakeHints`
- Gallery/coverImage are not generated (filled from uploads)
- Canonical taxonomy values come from REFERENCE_DATA only

### Intake extraction prompt (prompt-templates.ts)

The intake prompt was rewritten to be more explicit about:
- `dealStatus` aliases: `'посуточно'→short-term`, `'аренда'→rent`
- Price extraction from `'100k'`, `'€200 000'`, `'150000 EUR'`
- Existing facts are NOT overridden unless new text contradicts them
- `intakeHints` is the correct slot for non-schema extras (elevator, furnished, sea distance)

---

## 6. Image Analysis Integration

**New file:** `src/lib/ai/image-analyzer.ts`

**Called from:** `src/lib/listing-session/service.ts` → `generateListingDraft`

### Behavior

1. Runs only when `DRAFT_PROVIDER=openai` (requires OpenAI API key).
2. Reads up to 4 photo assets from temp storage as bytes.
3. Sends each image to OpenAI with `detail: "low"` for efficiency.
4. Collects 1-2 sentence factual descriptions per image.
5. Appends combined descriptions to the draft `description` field in all 5 locales.
6. Never blocks: any failure is caught, logged, and skipped.

### What image analysis adds to descriptions

- Room type and layout observations
- Visible appliances, materials, finishes
- Views, balcony, garden, pool features
- Condition notes (new, renovated, etc.)

### What image analysis does NOT do

- Does not set structured fields from images
- Does not override extracted facts
- Does not block draft generation on failure

---

## 7. Multi-Language Implementation

### Storage

All content fields use the `localizedString` / `localizedText` schema with keys `en, uk, ru, sq, it`. This was unchanged.

### Generation

- The OpenAI draft generator now mandates all 5 locales in the prompt.
- The stub generator fills all 5 locale slots with the English text as a placeholder.

### Agent language (UI)

**File:** `src/components/listing-session/Form.tsx`

A language selector was added to the AI Intake Chat header. The selected language controls all system-generated UI messages (missing field labels, ready messages, draft-generated confirmations).

Languages: EN (default) / RU / UK / SQ / IT.

The selector stores state in `agentLanguage`. The `buildAssistantIntakeMessage` function uses `INTAKE_MESSAGES` and `FIELD_LABELS` translation tables keyed by `AgentLanguage`.

Note: the questions from `intake.ts` (`questionsForUser`) are in English because they come from the server — these are shown as-is in the chat regardless of the selected language.

---

## 8. Files Changed

| File | Change |
|---|---|
| `src/lib/ai/image-analyzer.ts` | **Created.** OpenAI vision analysis for property photos. |
| `src/lib/listing-session/intake.ts` | Added `cityNames`/`propertyTypeNames` params; context-aware question generation. |
| `src/lib/listing-session/service.ts` | Partial draft on intake; image analysis call in `generateListingDraft`; pass Sanity ref names to `buildIntakeAnalysis`. |
| `src/lib/ai/providers/openai-draft-generator.ts` | Explicit 5-locale requirement; SEO fields; propertyOffers instruction in prompt. |
| `src/lib/ai/providers/stub-draft-generator.ts` | Multi-language stub content via `fillAllLocales`; SEO fields populated. |
| `src/lib/intake/prompt-templates.ts` | Rewritten with explicit extraction rules, alias mapping, multilingual support notes. |
| `src/components/listing-session/Form.tsx` | Agent language selector (EN/RU/UK/SQ/IT); translated intake messages; all hardcoded Russian UI strings replaced. |

---

## 9. Remaining Limitations

### L1 — Questions from server are English-only
`questionsForUser` from `intake.ts` is generated server-side in English. The agent language setting only affects client-side wrapper messages, not the specific questions (e.g., "What is the living area in m²?"). Server-side i18n for questions would require the selected language to be sent in the intake request.

### L2 — Image analysis requires accessible temp storage bytes
Image analysis reads image bytes via `getTempStorage().read()`. For `TEMP_STORAGE_PROVIDER=r2` or `supabase`, the bytes may not be available server-side via the read path if only pre-signed URLs were stored. The code handles this gracefully — analysis is skipped if bytes are null.

### L3 — Image analysis only enriches `.description` (not alt text or property offers)
Image features are appended to description but not used to suggest specific `propertyOffers` or fill `alt` text on gallery items. A second pass could map detected features to amenity refs or generate per-image alt text.

### L4 — SanityPublisher still a stub (B2 from mutation-builder-report)
Publishing to Sanity is blocked by the unimplemented `SanityListingPublisher`. The full intake → draft flow is complete; publish remains the next task.

### L5 — `internalRef` auto-generation
`internalRef` is auto-generated as `LS-{8chars}` from session ID. Agents can override in Advanced Edit. There is no UI-level validation that it's unique.

### L6 — `field-requirements.ts` B4 still open
`PUBLISH_OPTIONAL_PATHS` still lists `sanityPropertyTypeRef` and `sanityAgentRef`. As noted in the mutation builder report, these should be in `PUBLISH_REQUIRED_PATHS` to keep field-requirements.ts in sync with `publishListingPayloadSchema`.

---

## 10. Manual Test Scenarios

### Scenario A — Basic intake flow
1. Create a new listing session.
2. Type: `"apartment for sale, 85m2, price 120000, Tirana"`.
3. Click Send.
4. **Expected:** Preview panel shows a partial draft with price, area, city. Chat shows which fields are still missing with allowed values.
5. Upload a photo.
6. Click Send again (or type `"3 bedrooms"`).
7. **Expected:** When all required fields are present, auto-generation triggers, full draft appears in preview.

### Scenario B — Context-aware city question
1. Create a session (Sanity reference data configured).
2. Send: `"villa for sale, 200m2, 500000 EUR"` (no city).
3. **Expected:** Response includes: `"Which city is this property in? Allowed values: Tirana, Durrës, Vlorë, ..."`.

### Scenario C — Language selector
1. Open a session.
2. Click `RU` in the language toggle.
3. Send any message.
4. **Expected:** "Не хватает: город, площадь (м²)..." (Russian labels).
5. Click `EN` — next response is in English.

### Scenario D — Image analysis enrichment (DRAFT_PROVIDER=openai)
1. Upload 2 property photos.
2. Complete all required fields.
3. Trigger generation.
4. **Expected:** Draft `description.en` contains photo-derived context ("Modern kitchen with stainless steel appliances...", etc.).

### Scenario E — Graceful failure: no AI key
1. Set `DRAFT_PROVIDER=stub`.
2. Complete intake and generate.
3. **Expected:** Stub draft generated with content in all 5 locales (same English text). No crash.

### Scenario F — Partial input: city mismatch
1. Send: `"apartment, 100m2, sale, 80000, UnknownCity"`.
2. **Expected:** Reference resolution returns a mismatch message: city `UnknownCity` not found in catalog. `isReadyForDraft` is false. Question asks to choose an allowed city.
