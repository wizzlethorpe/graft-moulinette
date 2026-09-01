// The author's side, without Foundry: what a download tells the ledger, and
// which world document gets to claim it.

import test from "node:test";
import assert from "node:assert/strict";

import { downloaded, makeLedger } from "../scripts/author.mjs";

const SCENE = JSON.stringify({ name: "Mad Lair", background: { src: "moulinette-v2/cloud/tmc/mad-lairs-2.3/scenes/mad-lair.webp" } });

test("a document download is remembered by pack, file and content", () => {
  const record = downloaded(
    { pack_ref: 10698, filepath: "json/scene/mad-lair.json", base_url: "https://x" },
    { path: "moulinette-v2/cloud/tmc/mad-lairs-2.3", message: SCENE, status: "success" });
  assert.deepEqual(record, { pack: "10698", file: "json/scene/mad-lair.json", document: JSON.parse(SCENE) });
});

test("a file download is not a document", () => {
  assert.equal(downloaded({ pack_ref: 10698, filepath: "scenes/mad-lair.webp" }, { path: "moulinette-v2/cloud/x.webp" }), null);
  assert.equal(downloaded({ pack_ref: 10698, filepath: "json/scene/a.json" }, false), null, "a download that failed");
  assert.equal(downloaded({ filepath: "json/scene/a.json" }, { message: SCENE }), null, "no pack to name");
  assert.equal(downloaded({ pack_ref: 1, filepath: "json/scene/a.json" }, { message: "{not json" }), null);
});

test("the document that claims a download is the one with its name, once", () => {
  const ledger = makeLedger();
  const record = { pack: "10698", file: "json/scene/mad-lair.json", document: JSON.parse(SCENE) };
  ledger.remember(record);
  assert.equal(ledger.claim("Imported Scene"), null, "Moulinette's placeholder does not match");
  assert.equal(ledger.claim("Mad Lair"), record);
  assert.equal(ledger.claim("Mad Lair"), null, "claimed once; a later document of that name is not the import");
});

test("a newer download replaces an unclaimed one", () => {
  const ledger = makeLedger();
  ledger.remember({ pack: "1", file: "a.json", document: { name: "A" } });
  ledger.remember({ pack: "2", file: "b.json", document: { name: "B" } });
  assert.equal(ledger.claim("A"), null);
  assert.equal(ledger.claim("B")?.file, "b.json");
});
