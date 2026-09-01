// The reference form: an id that is the same everywhere, and a UUID that
// parses back to the pack and type it names.

import test from "node:test";
import assert from "node:assert/strict";

import { documentId, referenceFor, parseReference, aliasFor, parseAlias, PACKS } from "../scripts/refs.mjs";

test("an asset's id is the same sixteen characters on every machine", async () => {
  const id = await documentId(10698, "json/scene/mad-lair.json");
  assert.match(id, /^[A-Za-z0-9]{16}$/);
  assert.equal(await documentId("10698", "json/scene/mad-lair.json"), id, "the pack number as a string or a number");
  assert.equal(id, "CwVVyANWmNpt3Hfg", "pinned, since a changed digest would orphan every shipped reference");
});

test("a different pack or path is a different id", async () => {
  const a = await documentId(10698, "json/scene/mad-lair.json");
  assert.notEqual(await documentId(10699, "json/scene/mad-lair.json"), a);
  assert.notEqual(await documentId(10698, "json/scene/mad-lair-2.json"), a);
});

test("a reference names the pack for its type, and parses back", () => {
  const uuid = referenceFor("Scene", "CwVVyANWmNpt3Hfg");
  assert.equal(uuid, "Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg");
  assert.deepEqual(parseReference(uuid), { type: "Scene", id: "CwVVyANWmNpt3Hfg" });
  for (const type of Object.keys(PACKS)) assert.ok(parseReference(referenceFor(type, "aaaaaaaaaaaaaaaa")));
});

test("anything not naming one of this module's packs is not a reference", () => {
  assert.equal(parseReference("Compendium.dnd5e.monsters.Actor.mmBandit00000000"), null);
  assert.equal(parseReference("Compendium.graft-moulinette.scenes.Playlist.CwVVyANWmNpt3Hfg"), null,
    "a type in the wrong pack");
  assert.equal(parseReference("Compendium.graft-moulinette.scenes.Scene.short"), null);
  assert.equal(parseReference(null), null);
});

test("a type with no pack has no reference", () => {
  assert.throws(() => referenceFor("Actor", "aaaaaaaaaaaaaaaa"), /no pack holds an? Actor/);
});

// ── the readable form ───────────────────────────────────────────────────────

test("an alias is the pack number and filepath a marketplace page shows", () => {
  const alias = aliasFor("Scene", 11948, "json/scene/02-adamantine-mining.json");
  assert.equal(alias, "@moulinette/Scene/11948/json/scene/02-adamantine-mining.json");
  assert.deepEqual(parseAlias(alias), { type: "Scene", pack: "11948", file: "json/scene/02-adamantine-mining.json" });
});

test("an alias keeps the slashes inside its filepath", () => {
  assert.deepEqual(parseAlias("@moulinette/Playlist/212/Music/Exploration/Path.ogg"),
    { type: "Playlist", pack: "212", file: "Music/Exploration/Path.ogg" });
});

test("anything without a type this module packs, a pack or a file is not an alias", () => {
  assert.equal(parseAlias("@moulinette/Actor/11948/a.json"), null, "no pack holds an Actor");
  assert.equal(parseAlias("@moulinette/Scene/11948"), null);
  assert.equal(parseAlias("@moulinette/11948/json/scene/a.json"), null, "the old shape, with no type");
  assert.equal(parseAlias("Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg"), null);
  assert.equal(parseAlias(null), null);
});
