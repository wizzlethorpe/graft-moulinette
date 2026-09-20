// How the assets block names a file, and where a document's JSON is kept.

import test from "node:test";
import assert from "node:assert/strict";

import { sourceFor, parseSource, isDocument, ownPath, parseOwnPath } from "../scripts/files.mjs";

test("a source is a pack number and the path inside that pack", () => {
  assert.equal(sourceFor(13648, "json/scene/lair.json"), "13648/json/scene/lair.json");
  assert.deepEqual(parseSource("13648/json/scene/lair.json"), { pack: "13648", path: "json/scene/lair.json" });
  assert.deepEqual(parseSource("00123/a.webp"), { pack: "00123", path: "a.webp" }, "the pack is kept as written");
});

test("anything else is not a source", () => {
  for (const bad of ["lairs/x.webp", "13648", "13648/", "/x.webp", 13648, null, undefined]) assert.equal(parseSource(bad), null, String(bad));
});

test("a document is a .json asset, whatever its case", () => {
  assert.equal(isDocument("json/scene/lair.json"), true);
  assert.equal(isDocument("json/scene/LAIR.JSON"), true);
  assert.equal(isDocument("images/maps/lair.webp"), false);
});

test("a path under this module's folder says which asset it is, document or file", () => {
  const at = ownPath("13648", "json/scene/lair.json");
  assert.equal(at, "graft/moulinette/13648/json/scene/lair.json");
  assert.deepEqual(parseOwnPath(at), { pack: "13648", path: "json/scene/lair.json" });
  assert.deepEqual(parseOwnPath("graft/moulinette/13648/audio/drip.ogg"), { pack: "13648", path: "audio/drip.ogg" });
  assert.equal(parseOwnPath("graft/my-vault/lair.json"), null);
  assert.equal(parseOwnPath("graft/moulinette/lairs/x.json"), null, "a folder that is not a pack number");
});
