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

function req(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

async function main() {
  console.log("Starting Sanity debug test...");

  const projectId = req("SANITY_PROJECT_ID");
  const dataset = req("SANITY_DATASET");
  const token = optional("SANITY_WRITE_TOKEN") ?? optional("SANITY_API_TOKEN");
  if (!token) throw new Error("SANITY_WRITE_TOKEN or SANITY_API_TOKEN is required");
  const apiVersion = optional("SANITY_API_VERSION") ?? "2024-01-01";
  const publishProvider = optional("PUBLISH_PROVIDER") ?? "(unset)";

  console.log(`Using projectId: ${projectId}`);
  console.log(`Using dataset: ${dataset}`);
  console.log(`Using apiVersion: ${apiVersion}`);
  console.log(`PUBLISH_PROVIDER: ${publishProvider}`);
  console.log('Document type under test: "property"');

  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
  });

  const testBaseId = `debug-property-${Date.now()}`;
  const draftId = `drafts.${testBaseId}`;

  const draftDoc = {
    _id: draftId,
    _type: "property",
    title: { en: "Debug Draft Listing" },
    slug: { _type: "slug", current: `debug-draft-${Date.now()}` },
    status: "sale",
    price: 123456,
    lifecycleStatus: "draft",
    isPublished: false,
    gallery: [],
    featured: false,
    investment: false,
    createdAt: new Date().toISOString(),
  };

  let created = false;
  try {
    console.log("Creating draft test listing...");
    await client.create(draftDoc as any);
    created = true;
    console.log(`Create success, ID: ${draftId}`);

    console.log("Fetching by ID...");
    const fetchedById = await client.getDocument(draftId);
    if (!fetchedById) {
      throw new Error("Fetch by ID failed: document is missing right after create");
    }
    console.log("Fetch by ID success");
    console.log(
      JSON.stringify(
        {
          _id: fetchedById._id,
          _type: fetchedById._type,
          lifecycleStatus: (fetchedById as any).lifecycleStatus,
          isPublished: (fetchedById as any).isPublished,
          title: (fetchedById as any).title,
        },
        null,
        2,
      ),
    );

    // Simulate published-only list visibility path used in many dashboards.
    console.log("Checking dashboard-like published query visibility...");
    const publishedQuery = `*[_type == "property" && !(_id in path("drafts.**"))] | order(_updatedAt desc)[0...50]{_id, _type, title, isPublished, lifecycleStatus}`;
    const publishedRows = await client.fetch<Array<{ _id: string }>>(publishedQuery);
    const inPublishedList = publishedRows.some((row) => row._id === testBaseId || row._id === draftId);
    console.log(`Dashboard query match (published list): ${inPublishedList ? "YES" : "NO"}`);

    console.log("Checking raw query visibility (includes drafts)...");
    const rawQuery = `*[_type == "property" && _id == $draftId][0]{_id, _type, title, isPublished, lifecycleStatus}`;
    const rawRow = await client.fetch(rawQuery, { draftId });
    console.log(`Raw query match (draft by id): ${rawRow ? "YES" : "NO"}`);
  } finally {
    if (created) {
      console.log("Deleting test listing...");
      await client.delete(draftId);
      console.log("Delete success");

      const afterDelete = await client.getDocument(draftId);
      console.log(`Post-delete fetch: ${afterDelete ? "FOUND (unexpected)" : "not found (expected)"}`);
    } else {
      console.log("Create step failed; skipping delete.");
    }
  }
}

main().catch((err) => {
  console.error("Sanity debug test FAILED");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});

