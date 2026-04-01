import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@sanity/client";

if (existsSync(resolve(process.cwd(), ".env.local"))) {
  loadEnv({ path: resolve(process.cwd(), ".env.local"), override: false });
}
if (existsSync(resolve(process.cwd(), ".env"))) {
  loadEnv({ path: resolve(process.cwd(), ".env"), override: false });
}

type SessionResponse = {
  id: string;
  sanityDocumentId: string | null;
  assets: Array<{ id: string; storageKey: string; fileName: string }>;
};

const CRITICAL_CONFIRMATION_FIELDS = [
  "internalRef",
  "status",
  "title",
  "slug",
  "description",
  "price",
  "dealStatus",
  "facts.propertyType",
  "facts.area",
  "address.city",
  "address.displayAddress",
  "gallery",
  "coverImage",
] as const;

function req(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function opt(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

async function parseJsonSafe(res: Response) {
  return res.json().catch(() => null);
}

async function main() {
  console.log("Starting app-path publish debug...");
  const baseUrl = opt("APP_BASE_URL") ?? "http://localhost:3000";
  const publishProvider = opt("PUBLISH_PROVIDER") ?? "(unset)";
  console.log(`Using app base URL: ${baseUrl}`);
  console.log(`PUBLISH_PROVIDER from env: ${publishProvider}`);

  const sanityProjectId = req("SANITY_PROJECT_ID");
  const sanityDataset = req("SANITY_DATASET");
  const sanityToken = opt("SANITY_WRITE_TOKEN") ?? opt("SANITY_API_TOKEN");
  if (!sanityToken) throw new Error("SANITY_WRITE_TOKEN or SANITY_API_TOKEN is required");
  const sanityClient = createClient({
    projectId: sanityProjectId,
    dataset: sanityDataset,
    apiVersion: opt("SANITY_API_VERSION") ?? "2024-01-01",
    token: sanityToken,
    useCdn: false,
  });

  console.log("0) Resolving real Sanity reference IDs (agent/propertyType/city/district)...");
  const refs = await sanityClient.fetch<{
    agents: Array<{ _id: string }>;
    propertyTypes: Array<{ _id: string; title?: { en?: string } }>;
    cities: Array<{ _id: string; title?: { en?: string } }>;
    districts: Array<{ _id: string; cityRef?: string }>;
  }>(
    `{
      "agents": *[_type == "agent" && !(_id in path("drafts.**"))][0...5]{_id},
      "propertyTypes": *[_type == "propertyType" && !(_id in path("drafts.**"))][0...5]{_id, title},
      "cities": *[_type == "city" && !(_id in path("drafts.**"))][0...5]{_id, title},
      "districts": *[_type == "district" && !(_id in path("drafts.**"))][0...20]{_id, "cityRef": city._ref}
    }`,
  );
  const agentRef = refs.agents[0]?._id;
  const propertyTypeRef = refs.propertyTypes[0]?._id;
  const cityRef = refs.cities[0]?._id;
  const districtRef = refs.districts.find((d) => d.cityRef === cityRef)?._id;
  if (!agentRef || !propertyTypeRef || !cityRef) {
    throw new Error(
      `Missing required reference data in Sanity (agent=${agentRef ?? "none"}, propertyType=${propertyTypeRef ?? "none"}, city=${cityRef ?? "none"})`,
    );
  }
  console.log(
    `Resolved refs: agent=${agentRef}, propertyType=${propertyTypeRef}, city=${cityRef}, district=${districtRef ?? "(none)"}`,
  );

  console.log("1) Creating listing session via app API...");
  const createRes = await fetch(`${baseUrl}/api/listing-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "agent-mvp" }),
  });
  const createdSession = (await parseJsonSafe(createRes)) as SessionResponse | { error?: unknown } | null;
  if (!createRes.ok || !createdSession || !("id" in createdSession)) {
    throw new Error(`Session create failed: status=${createRes.status}, body=${JSON.stringify(createdSession)}`);
  }
  const sessionId = createdSession.id;
  console.log(`Session created: ${sessionId}`);

  console.log("2) Uploading one photo via real app photo API...");
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO8B9p8AAAAASUVORK5CYII=",
    "base64",
  );
  const formData = new FormData();
  formData.append("files", new File([tinyPng], "debug.png", { type: "image/png" }));
  const photoRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/photos`, {
    method: "POST",
    body: formData,
  });
  const photoBody = await parseJsonSafe(photoRes);
  if (!photoRes.ok) {
    throw new Error(`Photo upload failed: status=${photoRes.status}, body=${JSON.stringify(photoBody)}`);
  }
  console.log("Photo upload success");

  console.log("3) Reading session to get uploaded asset key...");
  const getRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, { cache: "no-store" });
  const getBody = (await parseJsonSafe(getRes)) as SessionResponse | { error?: unknown } | null;
  if (!getRes.ok || !getBody || !("id" in getBody)) {
    throw new Error(`Session fetch failed: status=${getRes.status}, body=${JSON.stringify(getBody)}`);
  }
  const session = getBody as SessionResponse;
  const photo = session.assets.find((a) => a.storageKey.includes("/photo/"));
  if (!photo) throw new Error("No uploaded photo asset found in session");
  const tempRef = `temp:${photo.storageKey}`;
  console.log(`Using temp gallery ref: ${tempRef}`);

  console.log("4) Patching editedDraft + confirmations (same path as UI draft save)...");
  const editedDraft = {
    internalRef: `DBG-${Date.now()}`,
    status: "draft",
    title: { en: "Debug App Path Listing" },
    slug: { current: `debug-app-path-${Date.now()}` },
    description: { en: "Created from debug script through app API path." },
    shortDescription: { en: "Debug short text" },
    price: 100000,
    dealStatus: "sale",
    facts: {
      propertyType: "apartment",
      area: 85,
      bedrooms: 2,
      bathrooms: 1,
    },
    address: {
      countryCode: "AL",
      city: "Tirana",
      displayAddress: { en: "Rruga e Kavajes 12" },
      hideExactLocation: true,
    },
    sanityCityRef: cityRef,
    ...(districtRef ? { sanityDistrictRef: districtRef } : {}),
    sanityPropertyTypeRef: propertyTypeRef,
    sanityAgentRef: agentRef,
    amenities: [],
    locationTags: [],
    propertyOffers: [],
    gallery: [
      {
        image: { _type: "image", asset: { _type: "reference", _ref: tempRef } },
        alt: "Debug image",
      },
    ],
    coverImage: { _type: "image", asset: { _type: "reference", _ref: tempRef } },
    seo: {
      metaTitle: { en: "Debug SEO title" },
      metaDescription: { en: "Debug SEO description" },
      noIndex: false,
    },
  };

  const patchRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      editedDraft,
      confirmationSet: [...CRITICAL_CONFIRMATION_FIELDS],
    }),
  });
  const patchBody = await parseJsonSafe(patchRes);
  if (!patchRes.ok) {
    throw new Error(`Patch editedDraft failed: status=${patchRes.status}, body=${JSON.stringify(patchBody)}`);
  }
  console.log("Patch editedDraft success");

  console.log("5) Calling dedicated publish-as-draft endpoint...");
  const appDraftPublishRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/publish-draft`, { method: "POST" });
  const appDraftPublishBody = await parseJsonSafe(appDraftPublishRes);
  console.log(`Draft publish endpoint status: ${appDraftPublishRes.status}`);
  console.log(`Draft publish response: ${JSON.stringify(appDraftPublishBody)}`);

  console.log("6) Calling publish-as-property endpoint (real UI publish path)...");
  const appPublishRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/publish`, { method: "POST" });
  const appPublishBody = await parseJsonSafe(appPublishRes);
  console.log(`Property publish endpoint status: ${appPublishRes.status}`);
  console.log(`Property publish response: ${JSON.stringify(appPublishBody)}`);

  console.log("7) Reading session after publish calls...");
  const postGetRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, { cache: "no-store" });
  const postGetBody = (await parseJsonSafe(postGetRes)) as SessionResponse | { error?: unknown } | null;
  if (!postGetRes.ok || !postGetBody || !("id" in postGetBody)) {
    throw new Error(`Post-publish session fetch failed: status=${postGetRes.status}, body=${JSON.stringify(postGetBody)}`);
  }
  const postSession = postGetBody as SessionResponse;
  console.log(`Session.sanityDocumentId: ${postSession.sanityDocumentId ?? "(null)"}`);

  const sanityIdFromResponse =
    (appPublishBody && typeof appPublishBody === "object" && "sanityDocumentId" in appPublishBody
      ? (appPublishBody as { sanityDocumentId?: string | null }).sanityDocumentId
      : null) ??
    postSession.sanityDocumentId;

  let createdSanityDocId: string | null = sanityIdFromResponse ?? null;
  if (createdSanityDocId) {
    console.log(`8) Verifying in Sanity by ID: ${createdSanityDocId}`);
    const sanityDoc = await sanityClient.getDocument(createdSanityDocId);
    console.log(`Sanity lookup result: ${sanityDoc ? "FOUND" : "NOT FOUND"}`);
    if (sanityDoc) {
      console.log(
        JSON.stringify(
          {
            _id: sanityDoc._id,
            _type: sanityDoc._type,
            isPublished: (sanityDoc as any).isPublished,
            lifecycleStatus: (sanityDoc as any).lifecycleStatus,
            title: (sanityDoc as any).title,
          },
          null,
          2,
        ),
      );
    }
  } else {
    console.log("8) No sanityDocumentId returned by app path.");
  }

  // Case B: update same session and republish, expect SAME sanity id with updated fields.
  let updatedSameDocument = false;
  if (createdSanityDocId) {
    console.log("8.1) Case B: patch title/price and publish-as-property again (update path)...");
    const updatedDraft = {
      ...editedDraft,
      title: { en: "Debug App Path Listing Updated" },
      price: 110000,
      description: { en: "Updated by second publish cycle." },
    };
    const patch2Res = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editedDraft: updatedDraft, confirmationSet: [...CRITICAL_CONFIRMATION_FIELDS] }),
    });
    const patch2Body = await parseJsonSafe(patch2Res);
    if (!patch2Res.ok) {
      throw new Error(`Second patch failed: status=${patch2Res.status}, body=${JSON.stringify(patch2Body)}`);
    }
    const publish2Res = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/publish`, { method: "POST" });
    const publish2Body = await parseJsonSafe(publish2Res);
    console.log(`Second property publish status: ${publish2Res.status}`);
    console.log(`Second property publish response: ${JSON.stringify(publish2Body)}`);

    const afterSecond = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, { cache: "no-store" }).then((r) =>
      parseJsonSafe(r),
    );
    const secondId = (afterSecond as SessionResponse | null)?.sanityDocumentId ?? null;
    updatedSameDocument = secondId === createdSanityDocId;
    console.log(`Case B same document ID reused: ${updatedSameDocument ? "YES" : "NO"} (${secondId ?? "null"})`);

    const sanityUpdated = await sanityClient.getDocument(createdSanityDocId);
    const updatedTitle = (sanityUpdated as any)?.title?.en ?? null;
    const updatedPrice = (sanityUpdated as any)?.price ?? null;
    console.log(`Case B Sanity updated title: ${updatedTitle ?? "(null)"}`);
    console.log(`Case B Sanity updated price: ${updatedPrice ?? "(null)"}`);
  }

  console.log("9) Dashboard-like query check...");
  const dashboardPublishedRows = await sanityClient.fetch<Array<{ _id: string }>>(
    `*[_type == "property" && !(_id in path("drafts.**"))] | order(_updatedAt desc)[0...100]{_id}`,
  );
  const inDashboardPublished =
    createdSanityDocId !== null ? dashboardPublishedRows.some((row) => row._id === createdSanityDocId) : false;
  console.log(`Dashboard published query match: ${inDashboardPublished ? "YES" : "NO"}`);

  if (createdSanityDocId) {
    console.log("10) Cleanup: deleting Sanity document created by app path...");
    await sanityClient.delete(createdSanityDocId);
    const afterDelete = await sanityClient.getDocument(createdSanityDocId);
    console.log(`Cleanup delete result: ${afterDelete ? "FAILED (still found)" : "SUCCESS (not found)"}`);
  } else {
    console.log("10) Cleanup skipped: no Sanity document id from app path.");
  }

  console.log(`Case A create (draft) via app path: ${createdSanityDocId ? "PASS" : "FAIL"}`);
  console.log(`Case B update existing doc (no duplicate): ${updatedSameDocument ? "PASS" : "FAIL"}`);
  console.log(`Case C draft->property same doc: ${createdSanityDocId && inDashboardPublished ? "PASS" : "CHECK OUTPUT"}`);
  console.log("App-path publish debug completed.");
}

main().catch((err) => {
  console.error("App-path publish debug FAILED");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

