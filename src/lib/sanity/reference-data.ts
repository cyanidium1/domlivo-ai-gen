import "server-only";

import { createClient, type SanityClient } from "@sanity/client";

import { getServerEnv } from "@/lib/config/server";
import { isAllowedPropertyOfferIconKey, PROPERTY_ICON_KEYS } from "@/lib/sanity/property-icon-keys";
import type { ExtractedFacts } from "@/lib/validation/extracted-facts";
import { embeddedPropertyOfferSchema, type ListingDraft } from "@/lib/validation/listing-session";

/** Raw localized title from Sanity (resolve in app — do not flatten in GROQ). */
export type LocalizedTitle = Record<string, string | undefined> | null;

export type SanityCity = {
  _id: string;
  title: LocalizedTitle;
  slug: string | null;
};

export type SanityDistrict = {
  _id: string;
  title: LocalizedTitle;
  slug: string | null;
  cityRef: string | null;
};

export type SanityPropertyTypeDoc = {
  _id: string;
  title: LocalizedTitle;
  slug: string | null;
};

export type SanityAmenityDoc = {
  _id: string;
  title: LocalizedTitle;
  slug: string | null;
};

export type SanityLocationTagDoc = {
  _id: string;
  title: LocalizedTitle;
  slug: string | null;
};

export type SanityAgentDoc = {
  _id: string;
  name: string;
  email?: string;
};

export type SanityReferenceData = {
  enabled: boolean;
  fetchedAt: string;
  cities: SanityCity[];
  districts: SanityDistrict[];
  propertyTypes: SanityPropertyTypeDoc[];
  amenities: SanityAmenityDoc[];
  locationTags: SanityLocationTagDoc[];
  agents: SanityAgentDoc[];
  propertyOfferIconKeys: readonly string[];
};

const cityQuery = `*[_type == "city" && (!defined(isPublished) || isPublished == true) && !(_id in path("drafts.**"))] | order(coalesce(title.en, "") asc) {
  _id,
  title,
  "slug": slug.current
}`;

const districtQuery = `*[_type == "district" && !(_id in path("drafts.**"))] {
  _id,
  title,
  "slug": slug.current,
  "cityRef": city._ref
}`;

const propertyTypeQuery = `*[_type == "propertyType" && (!defined(active) || active == true) && !(_id in path("drafts.**"))] | order(coalesce(title.en, "") asc) {
  _id,
  title,
  "slug": slug.current
}`;

const amenityQuery = `*[_type == "amenity" && (!defined(active) || active == true) && !(_id in path("drafts.**"))] | order(coalesce(title.en, "") asc) {
  _id,
  title,
  "slug": slug.current
}`;

const locationTagQuery = `*[_type == "locationTag" && (!defined(active) || active == true) && !(_id in path("drafts.**"))] | order(coalesce(title.en, "") asc) {
  _id,
  title,
  "slug": slug.current
}`;

const agentsQuery = `*[_type == "agent" && !(_id in path("drafts.**"))] | order(name asc) {
  _id,
  name,
  email
}`;

let client: SanityClient | null = null;

function getSanityClient(): SanityClient | null {
  const env = getServerEnv();
  if (!env.SANITY_PROJECT_ID || !env.SANITY_DATASET) return null;
  if (!client) {
    client = createClient({
      projectId: env.SANITY_PROJECT_ID,
      dataset: env.SANITY_DATASET,
      apiVersion: env.SANITY_API_VERSION,
      useCdn: true,
      token: env.SANITY_READ_TOKEN || undefined,
    });
  }
  return client;
}

export function isSanityReferenceLookupConfigured(): boolean {
  const env = getServerEnv();
  return Boolean(env.SANITY_PROJECT_ID && env.SANITY_DATASET);
}

function labelEn(title: LocalizedTitle): string {
  if (!title || typeof title !== "object") return "";
  const en = title.en;
  return typeof en === "string" ? en.trim() : "";
}

/** Normalize for comparison: lowercase, trim, collapse whitespace. */
function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Extract all non-empty locale string values from a LocalizedTitle as normalized strings.
 * Used for multi-language reference matching (en, ru, uk, sq, it, etc.).
 */
function allLocaleNorms(title: LocalizedTitle): string[] {
  if (!title || typeof title !== "object") return [];
  return Object.values(title)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => norm(v));
}

// ---------------------------------------------------------------------------
// Deterministic alias tables
// Keys are normalized user inputs; values are canonical strings that match
// Sanity document title.en or slug (used as second-pass fallback).
// ---------------------------------------------------------------------------

/**
 * Property type aliases: common user wording in RU/UK/SQ/IT → English canonical.
 * Expand this table as new Sanity property types are added.
 */
const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  // Russian
  "квартира": "apartment",
  "квартиру": "apartment",
  "квартиры": "apartment",
  "квартире": "apartment",
  "апартамент": "apartment",
  "апартаменты": "apartment",
  "апартаментов": "apartment",
  "студия": "studio",
  "студию": "studio",
  "студии": "studio",
  "дом": "house",
  "дома": "house",
  "домов": "house",
  "вилла": "villa",
  "виллу": "villa",
  "виллы": "villa",
  "пентхаус": "penthouse",
  "пентхауса": "penthouse",
  "таунхаус": "townhouse",
  "таунхауса": "townhouse",
  "дуплекс": "duplex",
  "котедж": "cottage",
  "коттедж": "cottage",
  // Ukrainian
  "будинок": "house",
  "вілла": "villa",
  "студія": "studio",
  // Albanian
  "apartament": "apartment",
  "apartamente": "apartment",
  "shtëpi": "house",
  "vilë": "villa",
  "vilat": "villa",
  // Italian
  "appartamento": "apartment",
  "appartamenti": "apartment",
  "casa": "house",
  "monolocale": "studio",
};

/**
 * City aliases: common Russian/Ukrainian transliterations of Albanian city names.
 * Fallback only — if the Sanity city already has a Russian locale title, that
 * takes priority via the direct locale match in allLocaleNorms.
 */
const CITY_ALIASES: Record<string, string> = {
  "дуррес": "durrës",
  "дурресе": "durrës",
  "дурреса": "durrës",
  "дурресу": "durrës",
  "тирана": "tirana",
  "тиране": "tirana",
  "тираны": "tirana",
  "влёра": "vlorë",
  "влера": "vlorë",
  "влоре": "vlorë",
  "влора": "vlorë",
  "саранда": "sarandë",
  "сарандэ": "sarandë",
  "саранде": "sarandë",
  "шкодра": "shkodër",
  "шкодер": "shkodër",
  "эльбасан": "elbasan",
  "корча": "korçë",
  "корче": "korçë",
  "берат": "berat",
  "гирокастра": "gjirokastër",
  // Ukrainian
  "тіране": "tirana",
};

function resolvePropertyTypeAlias(input: string): string {
  return PROPERTY_TYPE_ALIASES[norm(input)] ?? input;
}

function resolveCityAlias(input: string): string {
  return CITY_ALIASES[norm(input)] ?? input;
}

export async function fetchSanityReferenceData(): Promise<SanityReferenceData> {
  const base: SanityReferenceData = {
    enabled: false,
    fetchedAt: new Date().toISOString(),
    cities: [],
    districts: [],
    propertyTypes: [],
    amenities: [],
    locationTags: [],
    agents: [],
    propertyOfferIconKeys: PROPERTY_ICON_KEYS,
  };

  if (!isSanityReferenceLookupConfigured()) {
    return base;
  }

  const c = getSanityClient();
  if (!c) return base;

  try {
    const [cities, districts, propertyTypes, amenities, locationTags, agents] = await Promise.all([
      c.fetch<SanityCity[]>(cityQuery).catch(() => []),
      c.fetch<SanityDistrict[]>(districtQuery).catch(() => []),
      c.fetch<SanityPropertyTypeDoc[]>(propertyTypeQuery).catch(() => []),
      c.fetch<SanityAmenityDoc[]>(amenityQuery).catch(() => []),
      c.fetch<SanityLocationTagDoc[]>(locationTagQuery).catch(() => []),
      c.fetch<SanityAgentDoc[]>(agentsQuery).catch(() => []),
    ]);

    return {
      enabled: true,
      fetchedAt: new Date().toISOString(),
      cities: cities ?? [],
      districts: districts ?? [],
      propertyTypes: propertyTypes ?? [],
      amenities: amenities ?? [],
      locationTags: locationTags ?? [],
      agents: agents ?? [],
      propertyOfferIconKeys: PROPERTY_ICON_KEYS,
    };
  } catch (e) {
    console.error("[sanity][reference-data] fetch failed", e);
    return base;
  }
}

/**
 * Match a city input against Sanity city documents.
 *
 * Pass 1 — exact: slug or any locale title value (en, ru, uk, sq, it, …)
 * Pass 2 — alias table: resolve Russian/Ukrainian transliterations → repeat pass 1
 */
export function matchCity(input: string | undefined, cities: SanityCity[]): SanityCity | null {
  if (!input?.trim() || !cities.length) return null;
  const n = norm(input);

  for (const c of cities) {
    if (c.slug && norm(c.slug) === n) return c;
    if (allLocaleNorms(c.title).includes(n)) return c;
  }

  // Alias fallback
  const aliased = resolveCityAlias(input);
  const an = norm(aliased);
  if (an !== n) {
    for (const c of cities) {
      if (c.slug && norm(c.slug) === an) return c;
      if (allLocaleNorms(c.title).includes(an)) return c;
    }
  }

  return null;
}

/**
 * Match a district input scoped to a city.
 *
 * Pass 1 — exact: slug or any locale title value
 */
export function matchDistrict(
  input: string | undefined,
  districts: SanityDistrict[],
  cityId: string | null,
): SanityDistrict | null {
  if (!input?.trim() || !districts.length || !cityId) return null;
  const n = norm(input);
  const scoped = districts.filter((d) => d.cityRef === cityId);

  for (const d of scoped) {
    if (d.slug && norm(d.slug) === n) return d;
    if (allLocaleNorms(d.title).includes(n)) return d;
  }

  return null;
}

/**
 * Match a property type input against Sanity propertyType documents.
 *
 * Pass 1 — exact: slug, any locale title, or slug-style EN title
 * Pass 2 — alias table: resolve RU/UK/SQ/IT synonyms → repeat pass 1
 */
export function matchPropertyType(
  input: string | undefined,
  types: SanityPropertyTypeDoc[],
): SanityPropertyTypeDoc | null {
  if (!input?.trim() || !types.length) return null;
  const n = norm(input);

  for (const t of types) {
    if (t.slug && norm(t.slug) === n) return t;
    if (allLocaleNorms(t.title).includes(n)) return t;
    const en = labelEn(t.title);
    if (en && norm(en.replace(/\s+/g, "-")) === n) return t;
  }

  // Alias fallback
  const aliased = resolvePropertyTypeAlias(input);
  const an = norm(aliased);
  if (an !== n) {
    for (const t of types) {
      if (t.slug && norm(t.slug) === an) return t;
      if (allLocaleNorms(t.title).includes(an)) return t;
      const en = labelEn(t.title);
      if (en && (norm(en) === an || norm(en.replace(/\s+/g, "-")) === an)) return t;
    }
  }

  return null;
}

export type ReferenceResolutionResult = {
  facts: ExtractedFacts;
  messages: string[];
  blocksIntake: boolean;
};

export function applyReferenceResolutionToFacts(
  facts: ExtractedFacts,
  ref: SanityReferenceData,
): ReferenceResolutionResult {
  const messages: string[] = [];
  if (!ref.enabled || ref.cities.length === 0) {
    return { facts, messages, blocksIntake: false };
  }

  let next: ExtractedFacts = { ...facts };
  let blocksIntake = false;

  if (facts.city?.trim()) {
    const m = matchCity(facts.city, ref.cities);
    if (m) {
      const label = labelEn(m.title) || facts.city.trim();
      next = { ...next, city: label, sanityCityRef: m._id };
    } else {
      blocksIntake = true;
      const allowed = ref.cities.map((c) => labelEn(c.title)).filter(Boolean).slice(0, 24);
      messages.push(
        `City "${facts.city}" is not in the Sanity catalog. Choose one of: ${allowed.join(", ")}${ref.cities.length > allowed.length ? ", …" : ""}.`,
      );
      delete next.city;
      delete next.sanityCityRef;
    }
  }

  const cityId = next.sanityCityRef ?? null;
  if (facts.district?.trim() && cityId) {
    const dm = matchDistrict(facts.district, ref.districts, cityId);
    if (dm) {
      next = { ...next, district: labelEn(dm.title) || facts.district.trim(), sanityDistrictRef: dm._id };
    } else {
      const scoped = ref.districts.filter((d) => d.cityRef === cityId);
      const allowed = scoped.map((d) => labelEn(d.title)).filter(Boolean);
      messages.push(
        allowed.length
          ? `District "${facts.district}" is not valid for this city. Valid districts: ${allowed.join(", ")}.`
          : `District "${facts.district}" is not valid for this city (no districts configured for this city in Sanity).`,
      );
      delete next.district;
      delete next.sanityDistrictRef;
    }
  } else if (facts.district?.trim() && !cityId) {
    messages.push("Resolve a valid city before district can be validated.");
    delete next.district;
    delete next.sanityDistrictRef;
  }

  if (facts.propertyType?.trim() && ref.propertyTypes.length > 0) {
    const pt = matchPropertyType(facts.propertyType, ref.propertyTypes);
    if (pt) {
      next = {
        ...next,
        propertyType: labelEn(pt.title) || facts.propertyType.trim(),
        sanityPropertyTypeRef: pt._id,
      };
    } else {
      blocksIntake = true;
      const allowed = ref.propertyTypes.map((t) => labelEn(t.title)).filter(Boolean).slice(0, 20);
      messages.push(
        `Property type "${facts.propertyType}" is not in Sanity. Use one of: ${allowed.join(", ")}${ref.propertyTypes.length > allowed.length ? ", …" : ""}.`,
      );
      delete next.propertyType;
      delete next.sanityPropertyTypeRef;
    }
  }

  return { facts: next, messages, blocksIntake };
}

export function formatReferenceContextForPrompt(ref: SanityReferenceData): string {
  if (!ref.enabled) {
    return "Sanity reference catalogs: not configured or empty — use only explicit facts from the user; do not invent taxonomy or schema fields.";
  }

  const cityLines = ref.cities
    .map((c) => {
      const en = labelEn(c.title);
      const ru = c.title?.ru ? ` / ru: ${c.title.ru}` : "";
      const uk = c.title?.uk ? ` / uk: ${c.title.uk}` : "";
      return `- ${en || c._id}${c.slug ? ` (slug: ${c.slug})` : ""}${ru}${uk}`;
    })
    .join("\n");

  const distByCity = new Map<string, SanityDistrict[]>();
  for (const d of ref.districts) {
    if (!d.cityRef) continue;
    const list = distByCity.get(d.cityRef) ?? [];
    list.push(d);
    distByCity.set(d.cityRef, list);
  }

  let districtBlock = "";
  for (const c of ref.cities) {
    const ds = distByCity.get(c._id) ?? [];
    if (!ds.length) continue;
    districtBlock += `\nDistricts for "${labelEn(c.title)}":\n${ds.map((x) => `  - ${labelEn(x.title)}`).join("\n")}\n`;
  }

  const typeLines = ref.propertyTypes
    .map((t) => {
      const en = labelEn(t.title);
      const ru = t.title?.ru ? ` / ru: ${t.title.ru}` : "";
      return `- ${en}${t.slug ? ` (slug: ${t.slug})` : ""}${ru}`;
    })
    .join("\n");

  const amenityLines = ref.amenities
    .map((a) => `- ${labelEn(a.title)}${a.slug ? ` [slug: ${a.slug}]` : ""}`)
    .join("\n");

  const tagLines = ref.locationTags
    .map((t) => `- ${labelEn(t.title)}${t.slug ? ` [slug: ${t.slug}]` : ""}`)
    .join("\n");

  const agentLines = ref.agents.map((a) => `- ${a.name} (_id: ${a._id})`).join("\n");

  return [
    "Sanity reference rules (sanity-real-estate-query-contract.md):",
    "- ONLY use cities, districts, property types, amenities, and location tags listed below for reference-backed fields.",
    "- If no match, leave city/district/propertyType unset in JSON — do not guess.",
    "- property.price is EUR only (no currency field).",
    "- propertyOffers are EMBEDDED objects on the listing (no CMS document list). Use free-text titles per locale; iconKey must be from ICON_KEYS or empty.",
    "- Do NOT output furnished, elevator, distanceToSeaMeters, parkingSpots, energyClass, or combined rooms as canonical property fields.",
    "",
    "Allowed cities (en / slug / ru and uk locale if available):",
    cityLines || "(none)",
    districtBlock || "",
    "",
    "Property types (en / slug / ru locale if available):",
    typeLines || "(none)",
    "",
    "Amenities (reference by slug/title when resolving later):",
    amenityLines || "(none)",
    "",
    "Location tags:",
    tagLines || "(none)",
    "",
    "Agents:",
    agentLines || "(none)",
    "",
    `propertyOffer iconKey allowlist: ${ref.propertyOfferIconKeys.join(", ")}`,
  ].join("\n");
}

/**
 * Validate embedded property offers: shape, localized title, icon allowlist.
 * Does NOT query CMS — offers are not a document taxonomy.
 */
export function sanitizeEmbeddedPropertyOffers(draft: ListingDraft): ListingDraft {
  const raw = draft.propertyOffers;
  if (!raw?.length) return { ...draft, propertyOffers: [] };

  const kept = raw
    .map((row) => {
      const parsed = embeddedPropertyOfferSchema.safeParse(row);
      if (!parsed.success) return null;
      const iconKey =
        parsed.data.iconKey && isAllowedPropertyOfferIconKey(parsed.data.iconKey) ? parsed.data.iconKey : undefined;
      return { title: parsed.data.title, ...(iconKey ? { iconKey } : {}) };
    })
    .filter(Boolean) as ListingDraft["propertyOffers"];

  return { ...draft, propertyOffers: kept };
}

export function alignDraftAddressFromExtractedFacts(draft: ListingDraft, facts: ExtractedFacts): ListingDraft {
  if (!draft.address && !facts.city) return draft;
  const display =
    draft.address?.displayAddress ??
    {
      en: undefined,
      uk: undefined,
      ru: undefined,
      sq: undefined,
      it: undefined,
    };
  return {
    ...draft,
    ...(facts.sanityCityRef ? { sanityCityRef: facts.sanityCityRef } : {}),
    ...(facts.sanityDistrictRef ? { sanityDistrictRef: facts.sanityDistrictRef } : {}),
    ...(facts.sanityPropertyTypeRef ? { sanityPropertyTypeRef: facts.sanityPropertyTypeRef } : {}),
    address: {
      countryCode: "AL",
      city: facts.city?.trim() || draft.address?.city,
      district: typeof facts.district === "string" && facts.district.trim() ? facts.district.trim() : draft.address?.district,
      streetLine: draft.address?.streetLine,
      postalCode: draft.address?.postalCode,
      displayAddress: {
        ...display,
        ...(facts.displayAddress?.trim() ? { en: facts.displayAddress.trim() } : {}),
      },
      location: draft.address?.location,
      hideExactLocation: draft.address?.hideExactLocation ?? true,
    },
  };
}
