// The reference form: an id that is the same everywhere, and a UUID that
// parses back to the pack and type it names.

import test from "node:test";
import assert from "node:assert/strict";

import { documentId, referenceFor, parseReference, PACKS } from "../scripts/refs.mjs";

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
  assert.deepEqual(parseReference(uuid), { pack: "scenes", type: "Scene", id: "CwVVyANWmNpt3Hfg" });
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
  // Actor and Item packs must declare a system, so there is none to name yet.
  assert.throws(() => referenceFor("Actor", "aaaaaaaaaaaaaaaa"), /no pack holds an? Actor/);
});
