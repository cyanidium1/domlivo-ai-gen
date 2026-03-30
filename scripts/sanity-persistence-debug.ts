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

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const projectId = required("SANITY_PROJECT_ID");
  const dataset = required("SANITY_DATASET");
  const token = process.env.SANITY_WRITE_TOKEN?.trim() || process.env.SANITY_API_TOKEN?.trim();
  if (!token) throw new Error("SANITY_WRITE_TOKEN or SANITY_API_TOKEN is required");
  const apiVersion = process.env.SANITY_API_VERSION?.trim() || "2024-01-01";

  const idArg = process.argv.find((x) => x.startsWith("--id="));
  const baseId = idArg?.split("=")[1]?.trim() || `debug-property-${Date.now()}`;

  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
  });

  const createDoc = {
    _id: baseId,
    _type: "property",
    title: { en: "Debug Property" },
    slug: { _type: "slug", current: `debug-property-${Date.now()}` },
    // These refs must exist in your dataset; pass real values when needed.
    // You can override with env to run a fully valid create.
    ...(process.env.SANITY_DEBUG_AGENT_REF ? { agent: { _type: "reference", _ref: process.env.SANITY_DEBUG_AGENT_REF } } : {}),
    ...(process.env.SANITY_DEBUG_TYPE_REF ? { type: { _type: "reference", _ref: process.env.SANITY_DEBUG_TYPE_REF } } : {}),
    status: "sale",
    price: 100000,
    isPublished: false,
    lifecycleStatus: "draft",
    gallery: [],
    featured: false,
    investment: false,
    createdAt: new Date().toISOString(),
  };

  console.log(`[debug] target id: ${baseId}`);
  console.log("[debug] createOrReplace...");
  await client.createOrReplace(createDoc as any);

  console.log("[debug] patch/update...");
  await client.patch(baseId).set({ title: { en: "Debug Property Updated" }, price: 120000 }).commit();

  console.log("[debug] fetch-after-write...");
  const fetched = await client.getDocument(baseId);
  if (!fetched) throw new Error("Fetch-after-write failed: document not found");

  console.log("[debug] success");
  console.log(
    JSON.stringify(
      {
        _id: fetched._id,
        _type: fetched._type,
        title: (fetched as any).title,
        price: (fetched as any).price,
        isPublished: (fetched as any).isPublished,
        lifecycleStatus: (fetched as any).lifecycleStatus,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error("[debug] failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
