// The reader's Moulinette index and downloads. The only file that reaches into
// Moulinette's internals, which are checked for rather than assumed.

import { documentId } from "./refs.mjs";
import { lookup } from "./paths.mjs";

/** The collection that fetches `/all-assets`: everything the account can reach. */
const CACHED_COLLECTION = "mou-cloud-cached";

/** `{ mod, collection, assets }`, or throws with the reason. */
export async function loadIndex() {
  const mod = game.modules.get("moulinette");
  // "anonymous" is the setting's default, so it means signed out.
  if ((mod.getSessionId?.() ?? "anonymous") === "anonymous") {
    throw new Error("you are not signed in to Moulinette; sign in and try again");
  }
  const collection = cachedCollection(mod);
  if (!collection || !mod.cloudclient?.apiGET) {
    throw new Error("Moulinette's asset index is not where graft-moulinette expects it; this needs updating");
  }
  await collection.initialize();            // fills cache.allAssets; warm after the first call
  const error = collection.getCollectionError?.();
  if (error) throw new Error(`Moulinette could not load your asset index: ${error}`);
  const assets = mod.cache?.allAssets;
  if (!Array.isArray(assets)) throw new Error("Moulinette's asset index is not a list; this needs updating");
  return { mod, collection, assets };
}

/** The cloud collection, or null when it lacks what this module calls on it. */
export function cachedCollection(mod = game.modules.get("moulinette")) {
  const c = mod?.collections?.find((c) => c.getId?.() === CACHED_COLLECTION);
  return c?.initialize && c.selectAsset && c.downloadAsset ? c : null;
}

/** Moulinette's download as it was before this module wrapped it, so its own fetches never reach the ledger. */
function download(collection) {
  return collection.downloadAsset.wraps ?? collection.downloadAsset.bind(collection);
}

/**
 * Document data for a `.json` row, its `#DEP#` placeholders already local.
 * Slow: a scene pulls its map, tiles and ambience with it.
 */
export async function downloadDocument(row, index) {
  const descriptor = await index.mod.cloudclient.apiGET(`/asset/${row.id}`, { session: index.mod.getSessionId() });
  const dl = await download(index.collection)(descriptor);
  if (!dl?.message) throw new Error(`Moulinette could not download ${row.pack_id}/${row.url}`);
  return JSON.parse(dl.message);
}

/** Where a media row's file lands, downloaded if it is not there yet. */
export async function downloadFile(row, index) {
  const path = await index.collection.selectAsset(row);
  if (!path) throw new Error(`Moulinette could not download ${row.pack_id}/${row.url}`);
  return path;
}

// Keyed on the array Moulinette holds: it replaces that array when its
// settings change, so this notices without being told.
let cache = { assets: null, lookup: null, ids: null };

function cacheFor(assets) {
  if (cache.assets !== assets) cache = { assets, lookup: lookup(assets), ids: null };
  return cache;
}

export function lookupFor(index) {
  return cacheFor(index.assets).lookup;
}

/** Document id to index row, for every `.json` asset the account can reach. */
export async function documentIds(index) {
  const c = cacheFor(index.assets);
  if (!c.ids) {
    c.ids = new Map();
    for (const a of c.assets) {
      if (a.url.endsWith(".json")) c.ids.set(await documentId(a.pack_id, a.url), a);
    }
  }
  return c.ids;
}
