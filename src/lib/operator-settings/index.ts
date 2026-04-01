import "server-only";

import { prisma } from "@/lib/db/prisma";

const SINGLETON_ID = "singleton";

export type OperatorSettingsData = {
  /** Operator-supplied description used as a style/structure template for AI generation. */
  descriptionExample: string | null;
};

/**
 * Returns the current operator settings, or defaults if none have been saved yet.
 * Safe to call with no prior data in the DB (returns nulls).
 */
export async function getOperatorSettings(): Promise<OperatorSettingsData> {
  const row = await prisma.operatorSettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  return {
    descriptionExample: row?.descriptionExample ?? null,
  };
}

/**
 * Upserts operator settings (creates on first call, updates on subsequent calls).
 * Accepts a partial patch — unspecified fields are not changed.
 */
export async function updateOperatorSettings(
  patch: Partial<OperatorSettingsData>,
): Promise<OperatorSettingsData> {
  const current = await prisma.operatorSettings.findUnique({
    where: { id: SINGLETON_ID },
  });

  const updated = await prisma.operatorSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      descriptionExample: patch.descriptionExample ?? null,
    },
    update: {
      // Only apply fields that are explicitly in the patch
      ...(patch.descriptionExample !== undefined
        ? { descriptionExample: patch.descriptionExample }
        : { descriptionExample: current?.descriptionExample ?? null }),
    },
  });

  return {
    descriptionExample: updated.descriptionExample ?? null,
  };
}
