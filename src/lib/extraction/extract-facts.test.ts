import test from "node:test";
import assert from "node:assert/strict";

import { extractFacts, recoverFactsFromText } from "@/lib/extraction/extract-facts";

test("maps address + yearBuilt + country from explicit phrase", async () => {
  const input = {
    sourceText: "Apartment at Rruga e Kavajës 12, built in 2019, 2 bedrooms",
    transcript: null,
  };
  const facts = await extractFacts(input);
  const normalized = recoverFactsFromText(input, facts);

  assert.equal(normalized.displayAddress, "Rruga e Kavajës 12");
  assert.equal(normalized.streetLine, "Rruga e Kavajës 12");
  assert.equal(normalized.yearBuilt, 2019);
  assert.equal(normalized.country, "Albania");
});

test("maps address from 'address ...' + year keyword + country default", async () => {
  const input = {
    sourceText: "House in Tirana, address Rruga Mustafa Matohiti, year 2015",
    transcript: null,
  };
  const facts = await extractFacts(input);
  const normalized = recoverFactsFromText(input, facts);

  assert.match(normalized.displayAddress ?? "", /Rruga Mustafa Matohiti/i);
  assert.equal(normalized.yearBuilt, 2015);
  assert.equal(normalized.country, "Albania");
});

test("maps built year when only build phrase is given", async () => {
  const input = {
    sourceText: "Beautiful villa, built in 2021",
    transcript: null,
  };
  const facts = await extractFacts(input);
  const normalized = recoverFactsFromText(input, facts);

  assert.equal(normalized.yearBuilt, 2021);
  assert.equal(normalized.country, "Albania");
});

test("country is Albania when user does not mention country", async () => {
  const input = {
    sourceText: "2-bedroom apartment in Tirana",
    transcript: null,
  };
  const facts = await extractFacts(input);
  const normalized = recoverFactsFromText(input, facts);

  assert.equal(normalized.country, "Albania");
});

test("country is forced to Albania even if another country is mentioned", async () => {
  const input = {
    sourceText: "Apartment in Tirana, Albania style, maybe in Italy by mistake, built in 2020",
    transcript: null,
  };
  const facts = await extractFacts(input);
  const normalized = recoverFactsFromText(input, facts);

  assert.equal(normalized.country, "Albania");
  assert.equal(normalized.yearBuilt, 2020);
});
