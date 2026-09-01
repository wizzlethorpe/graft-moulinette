// The reader's side, without Foundry: which sources are this module's, and
// what a failed one does to the entry naming it.

import test from "node:test";
import assert from "node:assert/strict";

import { referencesIn, outcome } from "../scripts/reader.mjs";

const MINE = "Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg";
const THEIRS = "Compendium.some-maps.maps.Scene.aaaaaaaaaaaaaaaa";

test("only sources naming this module's packs are its business", () => {
  assert.deepEqual(referencesIn({ source: MINE }).map((r) => r.id), ["CwVVyANWmNpt3Hfg"]);
  assert.deepEqual(referencesIn({ source: [THEIRS, MINE] }).map((r) => r.id), ["CwVVyANWmNpt3Hfg"]);
  assert.deepEqual(referencesIn({ source: THEIRS }), []);
  assert.deepEqual(referencesIn({ patch: { name: "x" } }), [], "no source at all");
});

test("a lone source that failed sinks its entry, with the reason", () => {
  const failed = new Map([["CwVVyANWmNpt3Hfg", "not in your Moulinette index"]]);
  assert.deepEqual(outcome({ id: "e1", source: MINE }, failed), { keep: false, reason: "not in your Moulinette index" });
});

test("one failure in a list of fallbacks is a warning, since the rest may resolve", () => {
  const failed = new Map([["CwVVyANWmNpt3Hfg", "not in your Moulinette index"]]);
  assert.deepEqual(outcome({ id: "e1", source: [MINE, THEIRS] }, failed),
    { keep: true, warnings: ["not in your Moulinette index"] });
});

test("an entry whose references all materialised, or that has none, is untouched", () => {
  const failed = new Map([["zzzzzzzzzzzzzzzz", "gone"]]);
  assert.deepEqual(outcome({ id: "e1", source: MINE }, failed), { keep: true, warnings: [] });
  assert.deepEqual(outcome({ id: "e2", source: THEIRS }, failed), { keep: true, warnings: [] });
});
