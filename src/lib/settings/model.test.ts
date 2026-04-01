import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_SETTINGS, parseStoredSettings } from "@/lib/settings/model";

test("parseStoredSettings returns defaults on empty input", () => {
  assert.deepEqual(parseStoredSettings(null), DEFAULT_SETTINGS);
});

test("parseStoredSettings accepts valid language/theme", () => {
  const out = parseStoredSettings(JSON.stringify({ language: "it", theme: "light" }));
  assert.deepEqual(out, { language: "it", theme: "light" });
});

test("parseStoredSettings sanitizes invalid values", () => {
  const out = parseStoredSettings(JSON.stringify({ language: "xx", theme: "system" }));
  assert.deepEqual(out, DEFAULT_SETTINGS);
});

