// The author's side, without Foundry: what a download tells the ledger, and
// which world document gets to claim it.

import test from "node:test";
import assert from "node:assert/strict";

import { downloaded } from "../scripts/index.mjs";
import { makeLedger, claimable } from "../scripts/author.mjs";

const SCENE = JSON.stringify({ name: "Mad Lair", background: { src: "moulinette-v2/cloud/tmc/mad-lairs-2.3/scenes/mad-lair.webp" } });

test("a document download is remembered by pack, file and content", () => {
  const record = downloaded(
    { pack_ref: 10698, filepath: "json/scene/mad-lair.json", type: 1, base_url: "https://x" },
    { path: "moulinette-v2/cloud/tmc/mad-lairs-2.3", message: SCENE, status: "success" });
  assert.deepEqual(record, { pack: "10698", file: "json/scene/mad-lair.json", type: "Scene", document: JSON.parse(SCENE) });
  assert.equal(downloaded({ pack_ref: 1, filepath: "a.json", type: 42 }, { message: SCENE }).type, null,
    "a type number this module does not know");
});

test("Moulinette's type numbers map to the documents this module keeps", () => {
  const typeOf = (n) => downloaded({ pack_ref: 1, filepath: "a.json", type: n }, { message: "{}" }).type;
  assert.deepEqual([1, 8, 9, 10].map(typeOf), ["Scene", "JournalEntry", "Playlist", "Macro"]);
});

test("a file download is not a document", () => {
  assert.equal(downloaded({ pack_ref: 10698, filepath: "scenes/mad-lair.webp" }, { path: "moulinette-v2/cloud/x.webp" }), null);
  // A ScenePacker pack answers with a message too, but it is a list of files
  // to hand to another module, not a document.
  assert.equal(downloaded({ pack_ref: 10698, filepath: "maps/pack.webp", type: 98 }, { path: "", message: "{}" }), null);
  assert.equal(downloaded({ pack_ref: 10698, filepath: "json/scene/a.json" }, false), null, "a download that failed");
  assert.equal(downloaded({ pack_ref: 1, filepath: "json/scene/a.json" }, { message: "{not json" }), null);
});

test("the document that claims a download is the one with its name and type, once", () => {
  const ledger = makeLedger();
  const record = { pack: "10698", file: "json/scene/mad-lair.json", type: "Scene", document: JSON.parse(SCENE) };
  ledger.remember(record);
  assert.equal(ledger.claim("Imported Scene", "Scene"), null, "Moulinette's placeholder does not match");
  assert.equal(ledger.claim("Mad Lair", "Playlist"), null, "same name, wrong type");
  assert.equal(ledger.claim("Mad Lair", "Scene"), record);
  assert.equal(ledger.claim("Mad Lair", "Scene"), null, "claimed once; a later document of that name is not the import");
});

test("a download of unknown type is claimed by name alone", () => {
  const ledger = makeLedger();
  ledger.remember({ pack: "1", file: "a.json", type: null, document: { name: "A" } });
  assert.ok(ledger.claim("A", "Playlist"));
});

test("only a world document, created or filled, can claim", () => {
  assert.equal(claimable({ pack: null }), true, "created");
  assert.equal(claimable({ pack: null }, { name: "Mad Lair", walls: [] }), true, "filled by importFromJSON");
  assert.equal(claimable({ pack: null }, { thumb: "x.webp" }), false, "an update that is not the import");
  assert.equal(claimable({ pack: "graft-moulinette.scenes" }), false, "this module's own pack copy landing");
});

test("a newer download replaces an unclaimed one", () => {
  const ledger = makeLedger();
  ledger.remember({ pack: "1", file: "a.json", document: { name: "A" } });
  ledger.remember({ pack: "2", file: "b.json", document: { name: "B" } });
  assert.equal(ledger.claim("A", "Scene"), null);
  assert.equal(ledger.claim("B", "Scene")?.file, "b.json");
});
