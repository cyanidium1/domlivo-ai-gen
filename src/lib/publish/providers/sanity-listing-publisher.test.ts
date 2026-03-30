import test from "node:test";
import assert from "node:assert/strict";

import { resolveLifecycleForMode, resolveTargetDocumentId } from "@/lib/publish/persist-logic";

test("Case 1: no existing sanity id => create target id", () => {
  const out = resolveTargetDocumentId({
    sessionId: "abc123",
    payload: {} as any,
    mode: "draft",
    existingSanityDocumentId: null,
  });
  assert.equal(out.action, "created");
  assert.equal(out.id, "property-abc123");
});

test("Case 2: existing sanity id => update same id", () => {
  const out = resolveTargetDocumentId({
    sessionId: "abc123",
    payload: {} as any,
    mode: "draft",
    existingSanityDocumentId: "property-existing",
  });
  assert.equal(out.action, "updated");
  assert.equal(out.id, "property-existing");
});

test("Case 3: publish existing draft => same id lifecycle to published", () => {
  const life = resolveLifecycleForMode("property");
  assert.equal(life.isPublished, true);
  assert.equal(life.lifecycleStatus, "active");
});

