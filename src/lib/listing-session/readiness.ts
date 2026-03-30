import type { ListingSessionResponse } from "@/lib/listing-session/client";
import { buildPublishPayload } from "@/lib/listing-session/publish-payload";
import { withEnglishFallback } from "@/lib/validation/property-i18n";
import type { ListingDraft } from "@/lib/validation/listing-session";

export type PublishReadiness = {
  isSaveReady: boolean;
  isReady: boolean;
  missingCritical: string[];
  invalidCritical: string[];
  unconfirmedCritical: string[];
  recommendedFixes: string[];
  optionalSuggestions: string[];
  saveMissing: string[];
};

function hasText(value?: string | null) {
  return Boolean(value && value.trim().length > 0);
}

/**
 * @param draftOverride — локальный merged edited draft (форма + гидрация галереи), иначе только session.editedDraft.
 */
export function evaluatePublishReadiness(
  session: ListingSessionResponse | null,
  draftOverride?: ListingDraft | null,
): PublishReadiness {
  const edited = draftOverride ?? session?.editedDraft ?? null;
  const draftForHints = edited ?? session?.generatedDraft ?? null;

  const saveMissing: string[] = [];
  if (!draftForHints?.title?.en?.trim()) saveMissing.push("title.en");
  if (!draftForHints?.description?.en?.trim()) saveMissing.push("description.en");
  if (!draftForHints?.facts?.propertyType) saveMissing.push("facts.propertyType");
  if (draftForHints?.facts?.area === undefined) saveMissing.push("facts.area");
  if (!draftForHints?.dealStatus) saveMissing.push("dealStatus");
  if (!draftForHints?.address?.city?.trim()) saveMissing.push("address.city");

  const recommendedFixes: string[] = [];
  const optionalSuggestions: string[] = [];

  if (draftForHints) {
    const shortDesc = withEnglishFallback(draftForHints.shortDescription, "en");
    if (!hasText(shortDesc) || shortDesc.trim().length < 30) {
      recommendedFixes.push("Добавьте shortDescription.en (рекомендуется ≥ 30 символов).");
    }
    if (!draftForHints.seo?.metaTitle?.en) {
      recommendedFixes.push("Укажите seo.metaTitle.en.");
    }
    if (!draftForHints.seo?.metaDescription?.en) {
      recommendedFixes.push("Укажите seo.metaDescription.en.");
    }
    if (!draftForHints.propertyOffers?.length) {
      optionalSuggestions.push("Можно добавить propertyOffers для качества листинга.");
    }
    if (!draftForHints.amenities?.length) {
      optionalSuggestions.push("При необходимости привяжите amenities (ссылки).");
    }
  }

  if (!session) {
    return {
      isSaveReady: false,
      isReady: false,
      missingCritical: [],
      invalidCritical: [],
      unconfirmedCritical: [],
      recommendedFixes,
      optionalSuggestions,
      saveMissing,
    };
  }

  const gate = buildPublishPayload({
    id: session.id,
    editedDraft: edited,
    confirmation: session.confirmation,
  });

  if (gate.ok) {
    return {
      isSaveReady: saveMissing.length === 0,
      isReady: true,
      missingCritical: [],
      invalidCritical: [],
      unconfirmedCritical: [],
      recommendedFixes,
      optionalSuggestions,
      saveMissing,
    };
  }

  return {
    isSaveReady: saveMissing.length === 0,
    isReady: false,
    missingCritical: gate.errors.missing,
    invalidCritical: gate.errors.invalid,
    unconfirmedCritical: gate.errors.unconfirmed,
    recommendedFixes,
    optionalSuggestions,
    saveMissing,
  };
}
