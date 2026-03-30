import { extractedFactsSchema, type ExtractedFacts } from "@/lib/validation/extracted-facts";

type ExtractFactsInput = {
  sourceText?: string | null;
  transcript?: string | null;
};

function text(input: ExtractFactsInput) {
  return `${input.sourceText ?? ""}\n${input.transcript ?? ""}`;
}

const ADDRESS_STOP_TOKENS = /\b(built|year|construction|bed|bedroom|bedrooms|bath|bathroom|bathrooms|price|eur|€)\b/i;

function toNumber(raw: string | undefined) {
  if (!raw) return undefined;
  const normalized = raw.replace(/,/g, ".").replace(/\s+/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function firstNumericCapture(match: RegExpMatchArray) {
  for (let i = 1; i < match.length; i += 1) {
    const n = toNumber(match[i]);
    if (n !== undefined) return n;
  }
  return undefined;
}

function matchNumber(re: RegExp, s: string): number | undefined {
  const m = s.match(re);
  if (!m) return undefined;
  return firstNumericCapture(m);
}

function matchInt(re: RegExp, s: string): number | undefined {
  const n = matchNumber(re, s);
  if (n === undefined) return undefined;
  return Math.trunc(n);
}

function extractAddressLikeText(s: string): string | undefined {
  const patterns = [
    /\baddress\s*[:=-]?\s*([^\n,]+(?:,\s*[^\n,]+){0,2})/i,
    /\b(apartment|house|villa)\s+at\s+([^\n,]+(?:,\s*[^\n,]+){0,2})/i,
    /\b(rruga[\w\u00C0-\u024F\u0400-\u04FF\s.'-]+(?:\d+[a-z]?)?)/i,
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (!m) continue;
    const candidate = String(m[m.length - 1] ?? "").trim();
    if (!candidate) continue;
    const compact = candidate.split(",")[0]?.trim() ?? candidate;
    const head = compact.split(/\s+/).slice(0, 10).join(" ");
    if (ADDRESS_STOP_TOKENS.test(head)) continue;
    return compact.replace(/[.;]+$/g, "").trim();
  }
  return undefined;
}

function cleanStreetLine(raw: string): string {
  const cutByComma = raw.split(",")[0]?.trim() ?? raw.trim();
  const cutByStop = cutByComma.replace(/\b(built|year|construction)\b.*$/i, "").trim();
  return cutByStop.replace(/[.;]+$/g, "").trim();
}

function extractYearBuiltFromText(s: string): number | undefined {
  const strongPatterns = [
    /\b(?:year built|built in|construction year|year of (?:the )?(?:house|apartment)|house from|year)\s*[:=-]?\s*((?:19|20)\d{2})\b/i,
    /\b(?:ndertuar[ea]?\s+n[ëe]|vit(?:i)?\s+i\s+ndërtimit)\s*[:=-]?\s*((?:19|20)\d{2})\b/i,
  ];
  for (const re of strongPatterns) {
    const m = s.match(re);
    if (!m) continue;
    const year = Number(m[1]);
    if (Number.isInteger(year) && year >= 1800 && year <= 2100) return year;
  }
  return undefined;
}

export async function extractFacts(input: ExtractFactsInput): Promise<ExtractedFacts> {
  const raw = text(input);

  const price =
    matchNumber(/\b(price|цена|cmimi)\s*[:=-]?\s*([0-9][0-9\s,.]*)\b/i, raw) ??
    matchNumber(/\b([0-9][0-9\s,.]*)\s*(€|eur|usd|\$|евро)\b/i, raw) ??
    // "к" (Russian thousand abbreviation): "120к евро", "150к €", "200k EUR"
    ((): number | undefined => {
      const m = raw.match(/\b([0-9]+(?:[.,][0-9]+)?)\s*[кk]\s*(€|eur|\$|евро)\b/i);
      if (!m) return undefined;
      const n = toNumber(m[1]);
      return n !== undefined ? n * 1000 : undefined;
    })();

  const area =
    matchNumber(/\b(area|surface|size|площадь)\s*[:=-]?\s*([0-9][0-9\s,.]*)\b/i, raw) ??
    matchNumber(/\b([0-9][0-9\s,.]*)\s*(sqm|sq\.?m|m2|m²|кв\.?м|квм)\b/i, raw) ??
    // Full-word forms: "100 квадратных метров", "85 квадратніх метрів" (RU/UK)
    matchNumber(/([0-9][0-9\s,.]*)\s*квадратн\w+\s+метр\w*/i, raw);

  const bedrooms =
    matchInt(/\b(bedrooms|beds|спальни)\s*[:=-]?\s*([0-9]{1,2})\b/i, raw) ??
    matchInt(/\b([0-9]{1,2})\s*(bed|beds|bedroom|bedrooms)\b/i, raw) ??
    (/\b(двухкомнатн\w*|2-комнатн\w*|2х-комнатн\w*)\b/i.test(raw) ? 2 : undefined) ??
    (/\b(трехкомнатн\w*|трёхкомнатн\w*|3-комнатн\w*)\b/i.test(raw) ? 3 : undefined) ??
    (/\b(однокомнатн\w*|1-комнатн\w*)\b/i.test(raw) ? 1 : undefined);

  const bathrooms =
    matchInt(/\b(bathrooms|baths|bathroom|санузел)\s*[:=-]?\s*([0-9]{1,2})\b/i, raw) ??
    matchInt(/\b([0-9]{1,2})\s*(bath|baths|bathrooms?)\b/i, raw);

  const yearBuilt =
    matchInt(/\b(year built|built in|built|construction year|year|построен[ао]?|год постройки)\s*[:=]?\s*((19|20)[0-9]{2})\b/i, raw) ??
    extractYearBuiltFromText(raw);

  const hasElevator = /\b(no elevator|without elevator|без лифта)\b/i.test(raw)
    ? false
    : /\b(elevator|lift|лифт)\b/i.test(raw)
      ? true
      : undefined;

  const furnished = /\b(unfurnished|not furnished|без мебели|немеблирован\w*)\b/i.test(raw)
    ? false
    : /\b(furnished|meubl[ée]|с мебелью|меблирован\w*)\b/i.test(raw)
      ? true
      : undefined;

  // dealStatus — full multilingual coverage; short-term checked first as it overlaps rent
  let dealStatus: ExtractedFacts["dealStatus"];
  if (/\bshort[\s-]?term|short stay|посуточн\w*|краткосрочн\w*|giornaliero|affitto breve/i.test(raw)) {
    dealStatus = "short-term";
  } else if (
    /\brent\b|\bдля аренды\b|\bаренд\w*|\bсдаю\b|\bсдается\b|\bсдаётся\b|\bна сдачу\b|\bоренд\w*|\bздаю\b|\bqira\b|\baffitto\b/i.test(raw)
  ) {
    dealStatus = "rent";
  } else if (
    /\bsale\b|\bпродаж\w*|\bпродаю\b|\bпродается\b|\bпродається\b|\bна продаж\w*|\bshitet\b|\bvendita\b|\bвыставлен на продажу\b/i.test(raw)
  ) {
    dealStatus = "sale";
  } else {
    dealStatus = undefined;
  }

  const distanceMetersDirect =
    matchInt(/\b(sea|coast|beach|море)\s*[:=-]?\s*([0-9]{1,6})\s*(m|метр\w*)\b/i, raw) ??
    matchInt(/\b([0-9]{1,6})\s*(m|метр\w*)\s*(to|from|до)?\s*(the\s*)?(sea|coast|beach|моря|море)\b/i, raw);
  const distanceKm = matchInt(/\b([0-9]{1,6})\s*km\s*(to|from|до)?\s*(the\s*)?(sea|coast|beach|моря|море)\b/i, raw);
  const distanceToSeaMeters = distanceMetersDirect ?? (distanceKm !== undefined ? distanceKm * 1000 : undefined);

  // City extraction — Cyrillic range (\u0400-\u04FF) added so Russian/Ukrainian names are captured
  const cityMatch =
    raw.match(/\b(city|qyteti|город)\s*[:=-]\s*([\w\u00C0-\u024F\u0400-\u04FF][\w\u00C0-\u024F\u0400-\u04FF\s-]{1,40})/i) ??
    raw.match(/\bв\s+городе\s+([\w\u00C0-\u024F\u0400-\u04FF-]{2,}(?:\s+[\w\u00C0-\u024F\u0400-\u04FF-]{2,}){0,2})\b/i) ??
    raw.match(/\bin\s+([\w\u00C0-\u024F\u0400-\u04FF-]{2,}(?:\s+[\w\u00C0-\u024F\u0400-\u04FF-]{2,}){0,2})\b/i);
  const districtMatch = raw.match(/\b(district|zone|area|район)\s*[:=-]\s*([\w\u00C0-\u024F\u0400-\u04FF\s-]{2,40})/i);
  const streetMatch = raw.match(/\b(street|ул\.?|улица|rruga)\s*[:=-]?\s*([\w\u00C0-\u024F\u0400-\u04FF\s.,-]{2,80})/i);
  const postalMatch = raw.match(/\b(postal code|zip|индекс|kod postar)\s*[:=-]?\s*([a-z0-9-]{3,12})\b/i);

  const addressLike = extractAddressLikeText(raw);

  const propertyTypeMatch =
    raw.match(/\b(property type|type|тип)\s*[:=-]\s*([a-z\s-]{2,})/i) ??
    raw.match(/\b(apartment|flat|villa|house|penthouse|studio|duplex|loft|townhouse)\b/i);

  // Deterministic property type synonym mapping — Russian/Ukrainian/Albanian/Italian.
  // NOTE: JavaScript \b word boundaries do not work with Cyrillic characters (Cyrillic is \W
  // in ASCII-based \w). We use Unicode \p{L} lookarounds (with u flag) to assert non-letter
  // boundaries, and bare Cyrillic stems for patterns where false positives are impossible.
  const paddedRaw = ` ${raw} `;
  const propertyTypeRu =
    /квартир|апартамент/i.test(raw)
      ? "apartment"
      : /студи[яию]|студії/i.test(raw)
        ? "studio"
        : /вилл|вілл/i.test(raw)
          ? "villa"
          : /пентхаус/i.test(raw)
            ? "penthouse"
            : /таунхаус|дуплекс/i.test(raw)
              ? "townhouse"
              : // "дом" needs boundary-like check to avoid matching "домашний", "дома" (at home), etc.
                // Use non-letter surrounding chars via paddedRaw (space prepended/appended).
                /котедж|коттедж|будинок/i.test(raw) ||
                /[^\p{L}]дом[^\p{L}]/u.test(paddedRaw)
                ? "house"
                : undefined;

  const hints: Record<string, unknown> = {};
  if (hasElevator !== undefined) hints.hasElevator = hasElevator;
  if (furnished !== undefined) hints.furnished = furnished;
  if (distanceToSeaMeters !== undefined) hints.distanceToSeaMeters = distanceToSeaMeters;
  if (/\b(rooms?|комнат)\b/i.test(raw) && bedrooms !== undefined) hints.inferredBedroomsFromText = true;

  const facts: ExtractedFacts = {
    ...(price !== undefined ? { price } : {}),
    ...(area !== undefined ? { area } : {}),
    ...(bedrooms !== undefined ? { bedrooms } : {}),
    ...(bathrooms !== undefined ? { bathrooms } : {}),
    ...(yearBuilt !== undefined ? { yearBuilt } : {}),
    ...(dealStatus !== undefined ? { dealStatus } : {}),
    ...(cityMatch?.[2] || cityMatch?.[1] ? { city: String(cityMatch[2] ?? cityMatch[1]).trim() } : {}),
    ...(districtMatch?.[2] ? { district: districtMatch[2].trim() } : {}),
    ...(streetMatch?.[2]
      ? (() => {
          const prefix = String(streetMatch[1] ?? "").trim();
          const value = cleanStreetLine(`${prefix} ${streetMatch[2]}`);
          return value ? { streetLine: value, displayAddress: value } : {};
        })()
      : addressLike
        ? { streetLine: addressLike, displayAddress: addressLike }
      : {}),
    ...(postalMatch?.[2] ? { postalCode: postalMatch[2].trim() } : {}),
    ...(propertyTypeRu
      ? { propertyType: propertyTypeRu }
      : propertyTypeMatch?.[2] || propertyTypeMatch?.[1]
        ? { propertyType: String(propertyTypeMatch[2] ?? propertyTypeMatch[1]).trim() }
        : {}),
    country: "Albania",
    ...(Object.keys(hints).length ? { intakeHints: hints } : {}),
  };

  return extractedFactsSchema.parse(facts);
}

export function recoverFactsFromText(input: ExtractFactsInput, facts: ExtractedFacts): ExtractedFacts {
  const raw = text(input);
  const recoveredAddress = extractAddressLikeText(raw);
  const recoveredYear = extractYearBuiltFromText(raw);

  return extractedFactsSchema.parse({
    ...facts,
    ...(facts.streetLine || !recoveredAddress ? {} : { streetLine: recoveredAddress }),
    ...(facts.displayAddress || !recoveredAddress ? {} : { displayAddress: recoveredAddress }),
    ...(facts.yearBuilt || !recoveredYear ? {} : { yearBuilt: recoveredYear }),
    country: "Albania",
  });
}
