// Recognising a Moulinette file path, and matching it to an index row.

import test from "node:test";
import assert from "node:assert/strict";

import { fileOf, lookup, assetFor, DEFAULT_ROOT } from "../scripts/paths.mjs";

/** Index rows, as Moulinette's `cache.allAssets` holds them. */
const LAIR = {
  id: 1, pack_id: "10698", url: "scenes/mad-lair.webp",
  previewUrl: "https://mttestorage.blob.core.windows.net/themadcartographer/mad-lairs-2.3/scenes/mad-lair_thumb.webp?sv=2021&sig=abc",
};
const DRIP = { id: 2, pack_id: "10698", url: "audio/drip.ogg", previewUrl: LAIR.previewUrl.replace("scenes/mad-lair_thumb.webp", "audio/drip.ogg") };
const WIND = {
  id: 3, pack_id: "204", url: "Ambiences/wind.ogg",
  previewUrl: "https://moulinette-previews.nyc3.cdn.digitaloceanspaces.com/michaelghelfi/Winds_Vol._1/Ambiences/wind.ogg",
};

const LOCAL = "moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/scenes/mad-lair.webp";

test("a stored path is the file it loads, whichever way the world spelled it", () => {
  const onDisk = "moulinette-v2/cloud/tomcartos/pub-crawl/The Gilded Dragon 01 Cellar_No Grid.webp";
  assert.equal(fileOf(onDisk), onDisk, "a literal space");
  assert.equal(fileOf(onDisk.replaceAll(" ", "%20")), onDisk, "percent-encoded");
  assert.equal(fileOf("a/Map%20%232.webp"), "a/Map #2.webp", "an encoded # is part of the name");
  const apostrophe = "moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/scenes/it's the mad lair.webp";
  assert.equal(fileOf(apostrophe), apostrophe);
  const percent = "moulinette-v2/cloud/somebody/pack/100% wool.webp";
  assert.equal(fileOf(percent), percent, "a bare % does not decode, and is kept as written");
});

test("a cache-busting query or a fragment is no part of the file", () => {
  assert.equal(fileOf(`${LOCAL}?1699`), LOCAL);
  assert.equal(fileOf(`${LOCAL}#t=1`), LOCAL);
});

test("a pack's folder is read off one of its rows, in either preview shape", () => {
  const { folders } = lookup([LAIR, DRIP, WIND]);
  assert.deepEqual(folders, new Map([
    ["themadcartographer/mad-lairs-2.3", "10698"],
    ["michaelghelfi/Winds_Vol._1", "204"],
  ]));
});

test("a creator or pack folder with a space is matched from either spelling of the path", () => {
  const row = { id: 7, pack_id: "77", url: "maps/a.webp", previewUrl: "https://host.example/Tom Cartos/Pub Crawl/maps/a_thumb.webp" };
  const found = lookup([row]);
  assert.deepEqual([...found.folders.keys()], ["Tom Cartos/Pub Crawl"]);
  assert.equal(assetFor(fileOf("moulinette-v2/cloud/Tom%20Cartos/Pub%20Crawl/maps/a.webp"), found), row);
  assert.equal(assetFor(fileOf("moulinette-v2/cloud/Tom Cartos/Pub Crawl/maps/a.webp"), found), row);
});

test("a row whose preview is not that shape names no folder", () => {
  assert.equal(lookup([{ id: 9, pack_id: "99", url: "x.webp", previewUrl: "not-a-url" }]).folders.size, 0);
  assert.equal(lookup([{ id: 9, pack_id: "99", url: "x.webp" }]).folders.size, 0);
});

test("a local path finds the row it came from", () => {
  const found = lookup([LAIR, DRIP, WIND]);
  assert.equal(assetFor(LOCAL, found), LAIR);
  assert.equal(assetFor("moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/audio/drip.ogg", found), DRIP);
  assert.equal(assetFor("moulinette-v2/cloud/michaelghelfi/Winds_Vol._1/Ambiences/wind.ogg", found), WIND);
});

test("a reader who changed Moulinette's folder is matched under that folder, and not under the default", () => {
  const root = "moufolder/cloud/";
  const moved = LOCAL.replace(DEFAULT_ROOT, root);
  assert.equal(assetFor(moved, lookup([LAIR]), root), LAIR);
});

test("a path under a pack the account lacks, or a file it does not hold, matches nothing", () => {
  const found = lookup([LAIR]);
  assert.equal(assetFor("moulinette-v2/cloud/somebody/gone-pack/scenes/x.webp", found), null);
  assert.equal(assetFor("moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/scenes/other.webp", found), null,
    "the pack is known but the file is not in it");
});
