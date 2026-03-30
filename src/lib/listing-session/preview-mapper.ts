import type { ListingDraft } from "@/lib/validation/listing-session";

import type { ListingSessionResponse } from "@/lib/listing-session/client";

import { SANITY_LOCALES, type SanityLocale, withEnglishFallback } from "@/lib/validation/property-i18n";



export const PREVIEW_MISSING = "— отсутствует";



export type PreviewLocale = "EN" | "UK" | "RU" | "SQ" | "IT";



export type PreviewImageItem =

  | { key: string; label: string; url: string; kind: "pending" }

  | { key: string; label: string; url: string; kind: "uploaded"; assetId: string; altEn: string; altEnMissing: boolean };



export type LocalizedPreviewRow = { locale: SanityLocale; value: string; isMissing: boolean };



export type FullListingPreviewModel = {

  titleRows: LocalizedPreviewRow[];

  shortDescriptionRows: LocalizedPreviewRow[];

  descriptionRows: LocalizedPreviewRow[];

  priceAmount: string;

  priceCurrency: string;

  priceMissing: boolean;

  dealStatusLine: string;

  factsRows: Array<{ key: string; value: string; missing: boolean }>;

  addressStructure: Array<{ key: string; value: string; missing: boolean }>;

  galleryRows: Array<{ ref: string; altEn: string; altMissing: boolean; sortOrder?: number }>;

  propertyOfferRows: LocalizedPreviewRow[][];

  seoRows: Array<{ key: string; value: string; missing: boolean }>;

  images: PreviewImageItem[];

  isLocaleFallback: boolean;

};



const FACT_KEYS = ["propertyType", "area", "bedrooms", "bathrooms", "yearBuilt"] as const;



function formatVal(v: unknown): string {

  if (v === undefined || v === null) return PREVIEW_MISSING;

  if (typeof v === "boolean") return v ? "yes" : "no";

  if (typeof v === "number") return String(v);

  if (typeof v === "string") return v.trim() || PREVIEW_MISSING;

  return String(v);

}



function galleryAltEn(g: { alt?: string | { en?: string } }): string {

  const a = g.alt;

  if (typeof a === "string") return a.trim();

  if (a && typeof a === "object" && typeof a.en === "string") return a.en.trim();

  return "";

}



function localizedRows(value: Partial<Record<SanityLocale, string | undefined>> | undefined): LocalizedPreviewRow[] {

  return SANITY_LOCALES.map((locale) => {

    const raw = value?.[locale];

    const str = typeof raw === "string" ? raw.trim() : "";

    return { locale, value: str || PREVIEW_MISSING, isMissing: !str };

  });

}



export function mapSessionToFullPreview(params: {

  session: ListingSessionResponse | null;

  draft: ListingDraft | null;

  locale: PreviewLocale;

  pendingImages?: Array<{ key: string; label: string; url: string }>;

}): FullListingPreviewModel {

  const { session, draft, locale, pendingImages = [] } = params;

  const localeKey = locale.toLowerCase() as SanityLocale;



  const titleRows = localizedRows(draft?.title);

  const shortDescriptionRows = localizedRows(draft?.shortDescription);

  const descriptionRows = localizedRows(draft?.description);



  const hasLocaleContent = Boolean(

    draft?.title?.[localeKey]?.trim() ||

      draft?.shortDescription?.[localeKey]?.trim() ||

      draft?.description?.[localeKey]?.trim() ||

      draft?.address?.displayAddress?.[localeKey]?.trim(),

  );

  const isLocaleFallback = locale !== "EN" && !hasLocaleContent;



  const eur = typeof draft?.price === "number" ? draft.price : undefined;

  const priceMissing = !(typeof eur === "number" && Number.isFinite(eur));



  const facts = draft?.facts;

  const factsRows = FACT_KEYS.map((key) => {

    const v = facts?.[key as keyof NonNullable<ListingDraft["facts"]>];

    const missing = v === undefined || v === null;

    return { key, value: missing ? PREVIEW_MISSING : formatVal(v), missing };

  });



  const dealStatusLine = draft?.dealStatus ? formatVal(draft.dealStatus) : PREVIEW_MISSING;



  const addr = draft?.address;

  const displayLines = SANITY_LOCALES.map((loc) => {

    const v = addr?.displayAddress?.[loc];

    const s = typeof v === "string" ? v.trim() : "";

    return `${loc}: ${s || PREVIEW_MISSING}`;

  }).join("\n");



  const addressStructure: FullListingPreviewModel["addressStructure"] = [

    { key: "countryCode", value: addr?.countryCode?.trim() || PREVIEW_MISSING, missing: !addr?.countryCode?.trim() },

    { key: "city", value: addr?.city?.trim() || PREVIEW_MISSING, missing: !addr?.city?.trim() },

    { key: "district", value: addr?.district?.trim() || PREVIEW_MISSING, missing: !addr?.district?.trim() },

    { key: "streetLine", value: addr?.streetLine?.trim() || PREVIEW_MISSING, missing: !addr?.streetLine?.trim() },

    { key: "postalCode", value: addr?.postalCode?.trim() || PREVIEW_MISSING, missing: !addr?.postalCode?.trim() },

    {

      key: "displayAddress (all locales)",

      value: displayLines,

      missing: !addr?.displayAddress || !Object.values(addr.displayAddress).some((x) => typeof x === "string" && x.trim()),

    },

    {

      key: "hideExactLocation",

      value: typeof addr?.hideExactLocation === "boolean" ? String(addr.hideExactLocation) : PREVIEW_MISSING,

      missing: typeof addr?.hideExactLocation !== "boolean",

    },

    {

      key: "location (lat/lng)",

      value:

        addr?.location && typeof addr.location.lat === "number" && typeof addr.location.lng === "number"

          ? `${addr.location.lat}, ${addr.location.lng}`

          : PREVIEW_MISSING,

      missing: !addr?.location,

    },

    {

      key: "sanityCityRef",

      value: draft?.sanityCityRef ?? PREVIEW_MISSING,

      missing: !draft?.sanityCityRef,

    },

    {

      key: "sanityDistrictRef",

      value: draft?.sanityDistrictRef ?? PREVIEW_MISSING,

      missing: !draft?.sanityDistrictRef,

    },

    {

      key: "sanityPropertyTypeRef",

      value: draft?.sanityPropertyTypeRef ?? PREVIEW_MISSING,

      missing: !draft?.sanityPropertyTypeRef,

    },

  ];



  const gallery = draft?.gallery ?? [];

  const galleryRows = gallery.map((g, index) => {

    const ref = g.image.asset._ref;

    const altEn = galleryAltEn(g);

    return {

      ref,

      altEn: altEn || PREVIEW_MISSING,

      altMissing: !altEn,

      sortOrder: g.sortOrder ?? index,

    };

  });



  const offers = draft?.propertyOffers ?? [];

  const propertyOfferRows = offers.map((offer) =>

    SANITY_LOCALES.map((loc) => {

      const raw = offer.title?.[loc];

      const str = typeof raw === "string" ? raw.trim() : "";

      return { locale: loc, value: str || PREVIEW_MISSING, isMissing: !str };

    }),

  );



  const seo = draft?.seo;

  const seoRows: FullListingPreviewModel["seoRows"] = [

    {

      key: "metaTitle.en",

      value: seo?.metaTitle?.en?.trim() || PREVIEW_MISSING,

      missing: !seo?.metaTitle?.en?.trim(),

    },

    {

      key: "metaDescription.en",

      value: seo?.metaDescription?.en?.trim() || PREVIEW_MISSING,

      missing: !seo?.metaDescription?.en?.trim(),

    },

    {

      key: "canonicalUrl",

      value: seo?.canonicalUrl?.trim() || PREVIEW_MISSING,

      missing: !seo?.canonicalUrl?.trim(),

    },

    {

      key: "noIndex",

      value: typeof seo?.noIndex === "boolean" ? String(seo.noIndex) : PREVIEW_MISSING,

      missing: typeof seo?.noIndex !== "boolean",

    },

  ];



  const uploadedImages: PreviewImageItem[] = gallery.map((g, index) => {

    const rawRef = g.image.asset._ref;

    const storageKey = rawRef.startsWith("temp:") ? rawRef.slice("temp:".length) : rawRef;

    const linked = (session?.assets ?? []).find((a) => a.storageKey === storageKey);

    const altEn = galleryAltEn(g);

    return {

      key: `${rawRef}-${index}`,

      label: altEn || `Image ${index + 1}`,

      url: `/api/temp-assets/${storageKey}`,

      kind: "uploaded" as const,

      assetId: linked?.id ?? storageKey,

      altEn,

      altEnMissing: !altEn,

    };

  });



  const pendingMapped: PreviewImageItem[] = pendingImages.map((img) => ({

    key: img.key,

    label: img.label,

    url: img.url,

    kind: "pending" as const,

  }));



  const images: PreviewImageItem[] = [...pendingMapped, ...uploadedImages];



  return {

    titleRows,

    shortDescriptionRows,

    descriptionRows,

    priceAmount: typeof eur === "number" ? String(eur) : PREVIEW_MISSING,

    priceCurrency: priceMissing ? PREVIEW_MISSING : "EUR",

    priceMissing,

    dealStatusLine,

    factsRows,

    addressStructure,

    galleryRows,

    propertyOfferRows,

    seoRows,

    images,

    isLocaleFallback,

  };

}



export function previewHeroTitle(draft: ListingDraft | null, locale: PreviewLocale): string {

  const localeKey = locale.toLowerCase() as SanityLocale;

  const s = withEnglishFallback(draft?.title, localeKey).trim();

  return s || PREVIEW_MISSING;

}


