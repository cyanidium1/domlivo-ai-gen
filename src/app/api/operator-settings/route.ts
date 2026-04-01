import { type NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/response";
import { getOperatorSettings, updateOperatorSettings } from "@/lib/operator-settings";

export async function GET() {
  try {
    const settings = await getOperatorSettings();
    return ok(settings);
  } catch (error) {
    console.error("[operator-settings GET] error:", error);
    return fail(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    // Accept only known fields; coerce to string | null
    const descriptionExample =
      typeof body.descriptionExample === "string"
        ? body.descriptionExample.trim() || null   // empty string → null
        : body.descriptionExample === null
          ? null
          : undefined; // field absent → don't touch it

    const updated = await updateOperatorSettings({
      ...(descriptionExample !== undefined ? { descriptionExample } : {}),
    });

    return ok(updated);
  } catch (error) {
    console.error("[operator-settings PATCH] error:", error);
    return fail(error);
  }
}
