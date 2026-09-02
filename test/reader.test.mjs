// The reader's side, without Foundry: which sources are this module's, and
// what a failed one does to the entry naming it.

import test from "node:test";
import assert from "node:assert/strict";

import { referencesIn, outcome, expandAliases, rewrite } from "../scripts/reader.mjs";

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

test("a list with no source left sinks too, rather than being reported twice", () => {
  const other = "Compendium.graft-moulinette.scenes.Scene.aaaaaaaaaaaaaaaa";
  const failed = new Map([["CwVVyANWmNpt3Hfg", "gone"], ["aaaaaaaaaaaaaaaa", "also gone"]]);
  assert.deepEqual(outcome({ id: "e1", source: [MINE, other] }, failed), { keep: false, reason: "gone; also gone" });
});

test("an entry whose references all materialised, or that has none, is untouched", () => {
  const failed = new Map([["zzzzzzzzzzzzzzzz", "gone"]]);
  assert.deepEqual(outcome({ id: "e1", source: MINE }, failed), { keep: true, warnings: [] });
  assert.deepEqual(outcome({ id: "e2", source: THEIRS }, failed), { keep: true, warnings: [] });
});

test("a source inside the patch counts too, at any depth", () => {
  // An Adventure package carries its scenes as embedded entries, so this is
  // the common case for a vault, not a corner.
  const entry = { id: "adv", type: "Adventure", patch: { scenes: [{ _id: "s1", source: MINE, patch: {} }], actors: [{ _id: "a1", source: THEIRS }] } };
  assert.deepEqual(referencesIn(entry).map((r) => r.id), ["CwVVyANWmNpt3Hfg"]);
});

test("an embedded source that failed sinks the entry, even with a top-level fallback left", () => {
  // The top-level list would survive on its own; the embedded source has no
  // fallback, so graft would refuse the entry whatever this said.
  const OTHER = "Compendium.graft-moulinette.scenes.Scene.aaaaaaaaaaaaaaaa";
  const entry = { id: "adv", source: [THEIRS, OTHER], patch: { scenes: [{ _id: "s1", source: MINE, patch: {} }] } };
  const failed = new Map([["CwVVyANWmNpt3Hfg", "not in your Moulinette index"]]);
  assert.deepEqual(outcome(entry, failed), { keep: false, reason: "not in your Moulinette index" });
});

test("a sourced object outside an array is not an embedded entry", () => {
  // graft only expands array members, so fetching for one would be work no
  // build ever uses.
  assert.deepEqual(referencesIn({ id: "a", patch: { system: { _id: "x", source: MINE } } }), []);
});

// ── the readable form ───────────────────────────────────────────────────────

const ALIAS = "@moulinette/Scene/10698/json/scene/mad-lair.json";

test("an alias becomes the reference it names, wherever it sits", async () => {
  const other = "Compendium.other.p.Scene.aaaaaaaaaaaaaaaa";
  const entries = await expandAliases([
    { id: "a", source: ALIAS, patch: {} },
    { id: "b", source: [other, ALIAS], patch: {} },
    { id: "c", type: "Adventure", patch: { scenes: [{ _id: "s1", source: ALIAS, patch: { name: "x" } }] } },
    { id: "d", patch: { name: "untouched" } },
  ]);
  // MINE names the same asset, so the two spellings have to agree.
  assert.equal(entries[0].source, MINE);
  assert.deepEqual(entries[1].source, [other, MINE]);
  assert.equal(entries[2].patch.scenes[0].source, MINE);
  assert.deepEqual(entries[2].patch.scenes[0].patch, { name: "x" }, "the rest of the entry is untouched");
  assert.deepEqual(entries[3], { id: "d", patch: { name: "untouched" } });
});

test("an entry with no alias is not rebuilt, so its patch is never cloned", async () => {
  const before = [{ id: "a", source: THEIRS, patch: { name: "x" } }, { id: "b", source: ALIAS, patch: {} }];
  const after = await expandAliases(before);
  assert.equal(after[0], before[0], "the same object, not a copy");
  assert.notEqual(after[1], before[1]);
});

test("a member that names no source is left exactly as it was", async () => {
  // `source: undefined` is invisible to JSON.stringify and visible to
  // everything else: graft hashes it, and Foundry writes it.
  const [entry] = await expandAliases([
    { id: "a", source: ALIAS, patch: { tokens: [{ _id: "t1", name: "Guard" }] } },
  ]);
  assert.deepStrictEqual(Object.keys(entry.patch.tokens[0]), ["_id", "name"]);
});

test("an alias nested below one level is still expanded", async () => {
  const [entry] = await expandAliases([
    { id: "a", type: "Adventure", patch: { scenes: [{ _id: "s1", source: THEIRS, patch: { tokens: [{ _id: "t1", source: ALIAS }] } }] } },
  ]);
  assert.equal(entry.patch.scenes[0].patch.tokens[0].source, MINE);
});

test("Copy graft names a Moulinette source the way its page does", () => {
  const document = {
    documentName: "Scene", name: "Mad Lair",
    flags: { "graft-moulinette": { pack: "10698", file: "json/scene/mad-lair.json" } },
  };
  const out = rewrite({ id: "a", source: MINE, patch: { name: "Mine" } }, { document });
  assert.equal(out.source, ALIAS);
  assert.deepEqual(out.patch, { name: "Mine" });
});

test("a document this module did not adopt keeps the source graft gave it", () => {
  assert.equal(rewrite({ id: "a", source: THEIRS }, { document: { flags: {} } }).source, THEIRS);
  // Adopted, but graft named a pack belonging to somebody else.
  const adopted = { documentName: "Scene", flags: { "graft-moulinette": { pack: "10698", file: "json/scene/mad-lair.json" } } };
  assert.equal(rewrite({ id: "a", source: THEIRS }, { document: adopted }).source, THEIRS);
  assert.equal(rewrite({ id: "a", patch: {} }, { document: { documentName: "Scene", flags: { "graft-moulinette": { pack: "1", file: "a.json" } } } }).source,
    undefined, "content with no source at all");
});
