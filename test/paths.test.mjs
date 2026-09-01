// Recognising a Moulinette file path, and matching it to an index row.

import test from "node:test";
import assert from "node:assert/strict";

import { localPath, localPaths, lookup, assetFor } from "../scripts/paths.mjs";

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

test("a whole-string path is recognised, a path inside a longer string is not", () => {
  assert.equal(localPath(LOCAL), LOCAL);
  assert.equal(localPath(`<p>See <img src="${LOCAL}" width="400"> here.</p>`), null,
    "rewriting inside markup would cut the markup, and nothing resolves a path there anyway");
  assert.equal(localPath("worlds/mine/map.webp"), null);
  assert.equal(localPath(42), null);
});

test("a path behind a bucket URL is the same path, without its signature", () => {
  assert.equal(localPath(`https://my-bucket.s3.amazonaws.com/${LOCAL}?X-Amz-Signature=z`), LOCAL);
  assert.equal(localPath(`https://endpoint.example.com/bucket/${LOCAL}`), LOCAL, "path-style buckets too");
});

test("a filename with a space or an apostrophe survives whole", () => {
  const odd = "moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/scenes/it's the mad lair.webp";
  assert.equal(localPath(odd), odd);
});

test("every path a document names is collected once, wherever it sits", () => {
  const paths = localPaths({
    name: "Mad Lair",
    background: { src: LOCAL },
    tiles: [{ texture: { src: LOCAL } }, { texture: { src: "moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/audio/drip.ogg" } }],
    walls: [{ c: [0, 0, 1, 1] }],
  });
  assert.deepEqual([...paths], [LOCAL, "moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/audio/drip.ogg"]);
});

test("a pack's folder is read off one of its rows, in either preview shape", () => {
  const { folders } = lookup([LAIR, DRIP, WIND]);
  assert.deepEqual(folders, new Map([
    ["themadcartographer/mad-lairs-2.3", "10698"],
    ["michaelghelfi/Winds_Vol._1", "204"],
  ]));
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

test("a path under a pack the account lacks, or a file it does not hold, matches nothing", () => {
  const found = lookup([LAIR]);
  assert.equal(assetFor("moulinette-v2/cloud/somebody/gone-pack/scenes/x.webp", found), null);
  assert.equal(assetFor("moulinette-v2/cloud/themadcartographer/mad-lairs-2.3/scenes/other.webp", found), null,
    "the pack is known but the file is not in it");
});
