// The asset handler, against a stand-in for Moulinette, its storage, Foundry's file picker and graft's api.

import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { place, collect, named } from "../scripts/handler.mjs";
import { importAsset } from "../scripts/author.mjs";
import { watchDownloads } from "../scripts/index.mjs";

const PREVIEW = "https://mttestorage.blob.core.windows.net/mad/lairs/";
const ROWS = [
  { id: 1, pack_id: "13648", url: "json/scene/lair.json", previewUrl: `${PREVIEW}json/scene/lair_thumb.webp` },
  { id: 2, pack_id: "13648", url: "images/maps/lair.webp", previewUrl: `${PREVIEW}images/maps/lair_thumb.webp` },
];
// A reader who moved Moulinette's folder, so nothing here passes by matching the default.
const ROOT = "my-assets";
const MAP_LOCAL = `${ROOT}/cloud/mad/lairs/images/maps/lair.webp`;
const SCENE_AT = "graft/moulinette/13648/json/scene/lair.json";
const MAP_AT = "graft/moulinette/13648/images/maps/lair.webp";
const FILES = { files: [
  { source: "13648/json/scene/lair.json", destination: SCENE_AT },
  { source: "13648/images/maps/lair.webp", destination: MAP_AT },
] };

let disk, fetched, session, recorded, warned, storage, handsOver, rows;

beforeEach(() => {
  disk = new Map();
  fetched = [];
  recorded = [];
  warned = [];
  session = "abc";
  rows = ROWS;
  handsOver = () => ({ message: JSON.stringify({ name: "Lair", walls: [] }) });
  storage = async (url) => { fetched.push(url); return { ok: true, status: 200, blob: async () => new Blob(["map bytes"]) }; };
  const collection = {
    getId: () => "mou-cloud-cached",
    initialize: async () => {},
    getCollectionError: () => null,
    downloadAsset: async (descriptor) => { fetched.push(descriptor.filepath); return handsOver(); },
  };
  const moulinette = {
    collections: [collection], cache: { get allAssets() { return rows; } }, configs: { MOU_DEF_FOLDER: ROOT },
    getSessionId: () => session,
    cloudclient: { apiGET: async (route, opts) => {
      if (opts?.session !== session) throw new Error("401");
      const row = rows.find((r) => route.endsWith(`/${r.id}`));
      return { filepath: row.url, base_url: "https://storage.example/mad/lairs", file_url: `${row.url}?sig=secret` };
    } },
  };
  const graft = { api: {
    placeFile: async (destination, data) => { disk.set(destination, typeof data === "string" ? data : await data.text()); },
    recordFileSource: async (document, path) => { recorded.push([document.name, path]); },
  } };
  globalThis.fetch = (url) => storage(url);
  globalThis.game = {
    modules: { get: (id) => ({ moulinette, graft })[id] ?? null },
    i18n: { format: (key, data) => `${key} ${data.path}` },
  };
  globalThis.ui = { notifications: { warn: (message) => warned.push(message) } };
  globalThis.foundry = { applications: { apps: { FilePicker: { implementation: {
    browse: async (_store, dir) => {
      const files = [...disk.keys()].filter((p) => p.split("/").slice(0, -1).join("/") === dir);
      if (files.length === 0) throw new Error("Directory does not exist");
      return { files: files.map(encodeURI) };
    },
  } } } } };
});
const realFetch = globalThis.fetch;
afterEach(() => { delete globalThis.game; delete globalThis.foundry; delete globalThis.ui; globalThis.fetch = realFetch; });

// ── place ───────────────────────────────────────────────────────────────────

test("each file is put at the destination the graft gives, a document as Moulinette hands it over and a file from its signed link", async () => {
  assert.deepEqual(await place(FILES), { skipped: [], warnings: [] });
  assert.deepEqual(JSON.parse(disk.get(SCENE_AT)), { name: "Lair", walls: [] });
  assert.equal(disk.get(MAP_AT), "map bytes");
  assert.deepEqual(fetched, ["json/scene/lair.json", "https://storage.example/mad/lairs/images/maps/lair.webp?sig=secret"], "the signature is what authorises the download");
});

test("a destination is the graft's to choose", async () => {
  await place({ files: [{ source: "13648/images/maps/lair.webp", destination: MAP_LOCAL }] });
  assert.equal(disk.get(MAP_LOCAL), "map bytes");
});

test("what is already on disk is not fetched again, unless the reader asks for everything", async () => {
  await place(FILES, { redownload: () => assert.fail("nothing is on disk yet, so there is nothing to ask about") });
  fetched = [];
  await place(FILES, { redownload: async () => false });
  assert.deepEqual(fetched, []);
  await place(FILES, { redownload: async (held, total) => { assert.deepEqual([held, total], [2, 2]); return true; } });
  assert.equal(fetched.length, 2);
});

test("a file with a space in its name is found on disk, though the file picker lists it encoded", async () => {
  const spaced = { files: [{ source: "13648/images/maps/lair.webp", destination: "graft/moulinette/13648/the lair.webp" }] };
  await place(spaced);
  fetched = [];
  await place(spaced);
  assert.deepEqual(fetched, []);
});

test("a file at the top of the data folder is found on disk too", async () => {
  const top = { files: [{ source: "13648/images/maps/lair.webp", destination: "lair.webp" }] };
  disk.set("lair.webp", "already here");
  await place(top);
  assert.deepEqual(fetched, []);
});

test("a document Moulinette would not hand over is skipped with a reason that says so", async () => {
  handsOver = () => false;
  const { skipped } = await place({ files: [FILES.files[0]] });
  assert.match(skipped[0].reason, /Moulinette could not download 13648\/json\/scene\/lair\.json/);
});

test("the source decides how a file is fetched, so a destination that disagrees with it is refused", async () => {
  const { skipped } = await place({ files: [
    { source: "13648/json/scene/lair.json", destination: "graft/moulinette/13648/lair.webp" },
    { source: "13648/images/maps/lair.webp", destination: "graft/moulinette/13648/lair.json" },
  ] });
  assert.equal(skipped.length, 2);
  assert.match(skipped[0].reason, /a document's destination ends \.json, and only a document's does/);
  assert.deepEqual(fetched, []);
});

test("this module's own downloads are not taken for an author's import", async () => {
  // Otherwise a GM reader's build leaves a record, and the next same-named document the build makes is adopted.
  const seen = [];
  watchDownloads((record) => seen.push(record));
  await place(FILES);
  await importAsset({ pack: 13648, path: "json/scene/lair.json" });
  assert.deepEqual(seen, []);
});

test("an import through Moulinette itself is seen", async () => {
  const seen = [];
  watchDownloads((record) => seen.push(record));
  await game.modules.get("moulinette").collections[0].downloadAsset({ filepath: "json/scene/lair.json", pack_ref: 13648, type: 1 });
  assert.deepEqual(seen.map((r) => [r.pack, r.path, r.type]), [["13648", "json/scene/lair.json", "Scene"]]);
});

test("a wrap on an earlier collection does not reach this one", async () => {
  // Moulinette rebuilds its collections; a download kept at module level would fetch through the dead one.
  const first = game.modules.get("moulinette").collections[0];
  watchDownloads(() => {});
  first.downloadAsset = async () => assert.fail("fetched through a collection that is gone");
  const { getId, initialize, getCollectionError } = first;
  const second = { getId, initialize, getCollectionError, downloadAsset: async (d) => { fetched.push(`second:${d.filepath}`); return handsOver(); } };
  game.modules.get("moulinette").collections[0] = second;
  await place({ files: [FILES.files[0]] });
  assert.deepEqual(fetched, ["second:json/scene/lair.json"]);
});
test("a file the reader's account does not hold is skipped with the reason, and the rest are still fetched", async () => {
  const { skipped } = await place({ files: [{ source: "999/images/gone.webp", destination: "graft/moulinette/999/images/gone.webp" }, ...FILES.files] });
  assert.deepEqual(skipped.map((s) => s.id), ["999/images/gone.webp"]);
  assert.match(skipped[0].reason, /not in your Moulinette index: Moulinette may not be linked to your Patreon in this world/);
  assert.equal(disk.has(MAP_AT), true);
});

test("a download the storage refuses is skipped with its status, and the rest are still fetched", async () => {
  storage = async () => ({ ok: false, status: 403 });
  const { skipped } = await place({ files: [FILES.files[1], FILES.files[0]] });
  assert.deepEqual(skipped.map((s) => s.id), ["13648/images/maps/lair.webp"]);
  assert.match(skipped[0].reason, /^403 downloading 13648\/images\/maps\/lair\.webp/);
  assert.doesNotMatch(skipped[0].reason, /secret/, "the signed link stays out of the report");
  assert.equal(disk.has(SCENE_AT), true);
});

test("a reader who is signed out gets one reason from graft, not one per file", async () => {
  session = "anonymous";
  await assert.rejects(place(FILES), /not signed in/);
});

test("a listing that is not a source and a destination is skipped, not fetched", async () => {
  // With the progress callbacks graft passes: a malformed listing must not reach them.
  const { skipped } = await place({ files: [{ source: "lairs/x.webp", destination: "a.webp" }, { source: "13648/x.webp" }, null] },
    { onPhase: () => assert.fail("nothing to fetch"), onFile: () => {} });
  assert.equal(skipped.length, 3);
  assert.match(skipped[0].reason, /a source, as <pack number>\/<path in the pack>, and a destination/);
  assert.deepEqual(fetched, []);
});

test("a block whose files is not a list says so", async () => {
  await assert.rejects(place({ files: { a: 1 } }), /assets\.moulinette\.files should be a list/);
});

// ── collect ─────────────────────────────────────────────────────────────────

const entry = (over) => ({ id: "scene00000000001", type: "Scene", patch: {}, ...over });

test("what entries name of Moulinette's: paths that say which asset they are, and files under Moulinette's folder", () => {
  const entries = [entry({ source: SCENE_AT, patch: {
    items: [{ _id: "item000000000001", source: "graft/moulinette/13648/json/item/Key #2 100%.json", patch: {} }],
    background: { src: MAP_LOCAL }, tiles: [{ texture: { src: `${MAP_LOCAL}?1699` } }, { texture: { src: MAP_LOCAL.replace("lair.webp", "the%20lair.webp") } }],
    navName: `see ${MAP_LOCAL}`, img: "art/mine.webp",
    sounds: [{ path: "graft/moulinette/13648/audio/drip.ogg" }, { path: "graft/moulinette/13648/audio/drip.ogg?1699" }, { path: "graft/moulinette/13648/audio/the%20drip.ogg" }],
  } })];
  const { own, media } = named(entries, `${ROOT}/cloud/`);
  assert.deepEqual(own.map((f) => f.destination).sort(), ["graft/moulinette/13648/audio/drip.ogg", "graft/moulinette/13648/audio/the drip.ogg",
    "graft/moulinette/13648/json/item/Key #2 100%.json", SCENE_AT]);
  assert.equal(own.find((f) => f.destination.endsWith("100%.json")).source, "13648/json/item/Key #2 100%.json", "a .json source is a literal path, kept as written");
  assert.deepEqual(own.find((f) => f.destination.endsWith("the drip.ogg")).source, "13648/audio/the drip.ogg", "the source is the index's spelling");
  assert.deepEqual(own.find((f) => f.destination === SCENE_AT), { source: "13648/json/scene/lair.json", destination: SCENE_AT });
  assert.deepEqual(media, [MAP_LOCAL, MAP_LOCAL.replace("lair.webp", "the lair.webp")],
    "each file once, as it is on disk, and not where it sits inside longer text");
});

test("Copy graft gets the block that places them, each file where the entry already names it", async () => {
  const entries = [entry({ source: SCENE_AT, patch: { background: { src: MAP_LOCAL } } })];
  const before = structuredClone(entries);
  assert.deepEqual(await collect(entries), { files: [
    { source: "13648/json/scene/lair.json", destination: SCENE_AT },
    { source: "13648/images/maps/lair.webp", destination: MAP_LOCAL },
  ] });
  assert.deepEqual(entries, before, "the entries are read, never changed");
  assert.deepEqual(await place(await collect(entries)), { skipped: [], warnings: [] }, "and place accepts what collect wrote");
});

test("a path the world stored percent-encoded is matched, and listed as the file it loads", async () => {
  rows = [...ROWS, { id: 3, pack_id: "13648", url: "images/maps/the lair.webp", previewUrl: `${PREVIEW}images/maps/the lair_thumb.webp` }];
  const stored = `${ROOT}/cloud/mad/lairs/images/maps/the%20lair.webp`;
  assert.deepEqual(await collect([entry({ patch: { background: { src: stored } } })]), { files: [
    { source: "13648/images/maps/the lair.webp", destination: `${ROOT}/cloud/mad/lairs/images/maps/the lair.webp` },
  ] });
});

test("a Moulinette folder with a space in its name is matched when the world stored it encoded", () => {
  const { media } = named([entry({ patch: { img: "my%20assets/cloud/mad/lairs/a.webp" } })], "my assets/cloud/");
  assert.deepEqual(media, ["my assets/cloud/mad/lairs/a.webp"]);
});

test("entries that name nothing of Moulinette's get no block, and the index is not loaded", async () => {
  session = "anonymous";
  assert.equal(await collect([entry({ source: "Compendium.a.b.Scene.aaaaaaaaaaaaaaaa", patch: { img: "art/x.webp" } })]), null);
});

test("a document alone is listed without the index, so it copies while signed out", async () => {
  session = "anonymous";
  assert.deepEqual(await collect([entry({ source: SCENE_AT })]), { files: [{ source: "13648/json/scene/lair.json", destination: SCENE_AT }] });
});

test("a copy that names Moulinette's files fails while signed out, since it would lack them", async () => {
  session = "anonymous";
  await assert.rejects(collect([entry({ patch: { background: { src: MAP_LOCAL } } })]), /not signed in/);
});

test("a path under Moulinette's folder that matches no asset is left out, and the author is told", async () => {
  const stray = `${ROOT}/cloud/somebody/private-pack/x.webp`;
  assert.equal(await collect([entry({ patch: { background: { src: stray } } })]), null);
  assert.deepEqual(warned, [`GRAFTMOU.NotIndexed ${stray}`]);
});

// ── the author's side ───────────────────────────────────────────────────────

test("api.import fetches the document afresh, and makes it the source of a world document given to it", async () => {
  assert.equal(await importAsset({ pack: 13648, path: "json/scene/lair.json" }), SCENE_AT);
  assert.deepEqual(recorded, [], "no document, nothing recorded");
  await importAsset({ pack: 13648, path: "json/scene/lair.json", document: { name: "My Lair" } });
  assert.deepEqual(recorded, [["My Lair", SCENE_AT]]);
  await assert.rejects(importAsset({ pack: 999, path: "x.json" }), /Error: 999\/x\.json: not in your Moulinette index/);
});
