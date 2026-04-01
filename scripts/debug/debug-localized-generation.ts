import "dotenv/config";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3003";

async function main() {
  const createRes = await fetch(`${baseUrl}/api/listing-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "agent-mvp" }),
  });
  if (!createRes.ok) throw new Error(`create failed: ${createRes.status}`);
  const created = (await createRes.json()) as { id: string };
  const sessionId = created.id;
  console.log("[debug] sessionId:", sessionId);

  const sourceText =
    "Apartment in Durres near the sea. Area 120 m2. 2 bedrooms, 1 bathroom. Property type apartment. Sale. Address Rruga Taulantia 12.";
  await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceText }),
  });

  const intakeRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/intake`, { method: "POST" });
  const intake = await intakeRes.json();
  console.log("[debug] intake ready:", intake?.intake?.isReadyForDraft, "textReady:", intake?.intake?.isReadyForTextDraft);
  console.log("[debug] intake missing:", intake?.intake?.missingRequiredFacts);

  // Follow-up answer, emulating chat continuation.
  const followupText = `${sourceText}\nPrice 130000 euro`;
  await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceText: followupText }),
  });
  const intake2Res = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/intake`, { method: "POST" });
  const intake2 = await intake2Res.json();
  console.log("[debug] followup intake ready:", intake2?.intake?.isReadyForDraft, "textReady:", intake2?.intake?.isReadyForTextDraft);
  console.log("[debug] followup intake missing:", intake2?.intake?.missingRequiredFacts);

  const preEditRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/conversational-edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction: "make title more premium", detectedInputLanguage: "en" }),
  });
  console.log("[debug] pre-generate edit status:", preEditRes.status);
  if (!preEditRes.ok) {
    console.log("[debug] pre-generate edit body:", await preEditRes.text());
  }

  const genRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/generate`, { method: "POST" });
  console.log("[debug] generate status:", genRes.status);
  if (!genRes.ok) {
    console.log("[debug] generate body:", await genRes.text());
  }

  const sessionRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, { cache: "no-store" });
  const session = await sessionRes.json();
  const draft = session?.generatedDraft ?? session?.editedDraft;
  const title = draft?.title ?? {};
  const shortDescription = draft?.shortDescription ?? {};
  const description = draft?.description ?? {};
  console.log("[debug] hasDraft:", Boolean(draft));
  console.log("[debug] title locales:", Object.keys(title).filter((k) => title[k]));
  console.log("[debug] shortDescription locales:", Object.keys(shortDescription).filter((k) => shortDescription[k]));
  console.log("[debug] description locales:", Object.keys(description).filter((k) => description[k]));
  console.log("[debug] title values:", title);

  const postEditRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}/conversational-edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction: "set price to 140000", detectedInputLanguage: "en" }),
  });
  console.log("[debug] post-generate edit status:", postEditRes.status);
  if (!postEditRes.ok) {
    console.log("[debug] post-generate edit body:", await postEditRes.text());
  } else {
    const postEdit = await postEditRes.json();
    console.log("[debug] post-generate edit summary:", postEdit.changeSummary);
  }

  const sessionAfterEditRes = await fetch(`${baseUrl}/api/listing-sessions/${sessionId}`, { cache: "no-store" });
  const sessionAfterEdit = await sessionAfterEditRes.json();
  const edited = sessionAfterEdit?.editedDraft ?? {};
  const generated = sessionAfterEdit?.generatedDraft ?? {};
  const editedLocales = Object.keys(edited?.title ?? {}).filter((k) => edited?.title?.[k]);
  const generatedLocales = Object.keys(generated?.title ?? {}).filter((k) => generated?.title?.[k]);
  console.log("[debug] edited title locales:", editedLocales);
  console.log("[debug] generated title locales:", generatedLocales);
}

main().catch((err) => {
  console.error("[debug] failed:", err);
  process.exit(1);
});

