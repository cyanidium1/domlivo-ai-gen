import test from "node:test";
import assert from "node:assert/strict";

import { canSendMessage } from "@/lib/listing-session/composer-logic";

test("Case 1: text only => send enabled", () => {
  assert.equal(canSendMessage({ text: "hello", photoCount: 0, recording: false }), true);
});

test("Case 2: photos only => send enabled", () => {
  assert.equal(canSendMessage({ text: "   ", photoCount: 2, recording: false }), true);
});

test("Case 3: text + photos => send enabled", () => {
  assert.equal(canSendMessage({ text: "hi", photoCount: 1, recording: false }), true);
});

test("Case 4: no text, no photos => send disabled", () => {
  assert.equal(canSendMessage({ text: " ", photoCount: 0, recording: false }), false);
});

test("Case 5: voice recording active => send enabled (stop)", () => {
  assert.equal(canSendMessage({ text: "", photoCount: 0, recording: true }), true);
});

