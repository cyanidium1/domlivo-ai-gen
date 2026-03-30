import test from "node:test";
import assert from "node:assert/strict";

import { canPublishDraft, canPublishProperty, actionButtonClass } from "@/lib/listing-session/publish-eligibility";
import { CRITICAL_CONFIRMATION_FIELDS } from "@/lib/listing-session/confirmation";

test("Case 1: empty form => both publish actions disabled (draft false)", () => {
  const ok = canPublishDraft({
    sourceText: "",
    draft: null,
    extractedFacts: null,
    assetsCount: 0,
  });
  assert.equal(ok, false);
});

test("Case 2: partial generated data => draft enabled", () => {
  const ok = canPublishDraft({
    sourceText: "",
    draft: {
      title: { en: "Nice apartment" },
      slug: { current: "x" },
      seo: { noIndex: false },
      gallery: [],
      amenities: [],
      locationTags: [],
      propertyOffers: [],
      sourceSessionId: "s",
      internalRef: "LS-123",
      status: "draft",
    } as any,
    extractedFacts: null,
    assetsCount: 0,
  });
  assert.equal(ok, true);
});

test("Case 3: all required property fields valid => property publish enabled", () => {
  const sessionId = "session-1";
  const draft = {
    internalRef: "LS-ABC",
    status: "draft",
    title: { en: "Apartment in Tirana" },
    slug: { current: "apartment-in-tirana" },
    description: { en: "Nice description" },
    price: 100000,
    dealStatus: "sale",
    facts: { propertyType: "apartment", area: 80 },
    address: {
      countryCode: "AL",
      city: "Tirana",
      displayAddress: { en: "Rruga e Kavajës 12" },
      hideExactLocation: true,
    },
    sanityPropertyTypeRef: "propertyType-1",
    sanityAgentRef: "agent-1",
    gallery: [
      {
        image: { _type: "image", asset: { _type: "reference", _ref: "temp:/photo/1.jpg" } },
        alt: "Front view",
      },
    ],
    coverImage: { _type: "image", asset: { _type: "reference", _ref: "temp:/photo/1.jpg" } },
    seo: { noIndex: false, metaTitle: { en: "x" }, metaDescription: { en: "y" } },
    amenities: [],
    locationTags: [],
    propertyOffers: [],
  } as any;

  const confirmation = Object.fromEntries(CRITICAL_CONFIRMATION_FIELDS.map((k) => [k, true]));
  const ok = canPublishProperty({ sessionId, editedDraft: draft, confirmation, galleryAltIssues: 0 });
  assert.equal(ok, true);
});

test("Case 8: disabled button uses not-allowed cursor", () => {
  const cls = actionButtonClass({ disabled: true, tone: "primary" });
  assert.match(cls, /disabled:cursor-not-allowed/);
  assert.match(cls, /\bcursor-pointer\b/);
});

