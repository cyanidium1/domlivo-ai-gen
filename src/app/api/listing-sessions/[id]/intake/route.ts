import { fail, ok } from "@/lib/api/response";
import { analyzeListingIntake } from "@/lib/listing-session/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await analyzeListingIntake(id);
    console.info(
      "[api][intake] response",
      JSON.stringify({
        sessionId: id,
        knownFacts: result.intake.knownFacts,
        missingRequiredFacts: result.intake.missingRequiredFacts,
        missingOptionalFacts: result.intake.missingOptionalFacts,
      }),
    );
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
