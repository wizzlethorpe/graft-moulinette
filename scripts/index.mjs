// Everything that touches Moulinette: its index, its downloads, and the wrap
// on its download that tells the author's side what was fetched. Internals
// are checked for rather than assumed.

import { lookup, rowKey, DEFAULT_ROOT } from "./paths.mjs";
import { isDocument } from "./files.mjs";

export const NOT_INDEXED = "not in your Moulinette index: your account may not include it, or it moved";

/** The collection that fetches `/all-assets`: everything the account can reach. */
const CACHED_COLLECTION = "mou-cloud-cached";

/** Moulinette's asset type numbers for the documents this module keeps. */
export const TYPES = { 1: "Scene", 8: "JournalEntry", 9: "Playlist", 10: "Macro" };

/** Where this reader's Moulinette files cloud downloads. `MOU_DEF_FOLDER` is documented as overridable. */
export function cloudRoot() {
  const folder = game.modules.get("moulinette")?.configs?.MOU_DEF_FOLDER;
  return folder ? `${folder}/cloud/` : DEFAULT_ROOT;
}

/** The cloud collection, or null when it lacks what this module calls on it. */
function cachedCollection(mod = game.modules.get("moulinette")) {
  const c = mod?.collections?.find((c) => c.getId?.() === CACHED_COLLECTION);
  return c?.initialize && c.downloadAsset ? c : null;
}

/** `{ mod, collection, assets }`, or throws with the reason. */
export async function loadIndex() {
  const mod = game.modules.get("moulinette");
  const collection = cachedCollection(mod);
  if (!collection || !mod.cloudclient?.apiGET || !mod.getSessionId) {
    throw new Error("Moulinette's asset index is not where graft-moulinette expects it; this needs updating");
  }
  // The setting's default, so it means signed out.
  if (mod.getSessionId() === "anonymous") throw new Error("you are not signed in to Moulinette; sign in and try again");

  // Moulinette never clears its error on a later success, and keeps the empty
  // list a failure leaves, so both are reset here or a retry could never work.
  collection.error = 0;
  if (mod.cache.allAssets?.length === 0) mod.cache.allAssets = null;
  await collection.initialize();            // fills cache.allAssets; warm after the first call
  const error = collection.getCollectionError?.();
  if (error) throw new Error(`Moulinette could not load your asset index: ${error}`);
  const assets = mod.cache.allAssets;
  if (!Array.isArray(assets)) throw new Error("Moulinette's asset index is not a list; this needs updating");
  return { mod, collection, assets };
}

/**
 * What a download told us, or null when it was not a document.
 *
 * `descriptor` is Moulinette's `/asset/<id>` response; `result` is what its
 * `downloadAsset` returned, with the document text in `message`.
 */
export function downloaded(descriptor, result) {
  if (!isDocument(descriptor.filepath) || typeof result?.message !== "string") return null;
  try {
    return {
      pack: String(descriptor.pack_ref),
      path: descriptor.filepath,
      type: TYPES[descriptor.type] ?? null,     // unknown numbers claim by name alone
      document: JSON.parse(result.message),
    };
  } catch {
    return null;
  }
}

const UNWRAPPED = Symbol("graft-moulinette: Moulinette's own downloadAsset");

/** Wrap Moulinette's download so `onDocument` sees every document it fetches. */
export function watchDownloads(onDocument) {
  const collection = cachedCollection();
  if (!collection) {
    ui.notifications.warn(game.i18n.localize("GRAFTMOU.NoCollection"));
    return;
  }
  const original = collection.downloadAsset.bind(collection);
  collection[UNWRAPPED] = original;
  collection.downloadAsset = async (descriptor) => {
    const result = await original(descriptor);
    const record = downloaded(descriptor, result);
    if (record) onDocument(record);
    return result;
  };
}

/** Moulinette's download as it was before the wrap, so this module's own fetches are not seen as imports. */
const unwrappedDownload = (collection) => collection[UNWRAPPED] ?? collection.downloadAsset.bind(collection);

/** Moulinette's `/asset/<id>` response, which holds a download link signed for this account and good for an hour. */
const descriptorFor = (row, index) => index.mod.cloudclient.apiGET(`/asset/${row.id}`, { session: index.mod.getSessionId() });

/**
 * Document data for a `.json` row, its `#DEP#` placeholders already local.
 * Slow: a scene pulls its map, tiles and ambience with it.
 */
export async function downloadDocument(row, index) {
  const descriptor = await descriptorFor(row, index);
  const dl = await unwrappedDownload(index.collection)(descriptor);
  if (!dl?.message) throw new Error(`Moulinette could not download ${row.pack_id}/${row.url}`);
  return JSON.parse(dl.message);
}

/** A media row's bytes. Fetched directly, since Moulinette's own download writes to a folder of its choosing. */
export async function fetchFile(row, index) {
  const descriptor = await descriptorFor(row, index);
  const res = await fetch(`${descriptor.base_url}/${descriptor.file_url}`);
  if (!res.ok) throw new Error(`${res.status} downloading ${row.pack_id}/${row.url} from Moulinette`);
  return res.blob();
}

// Keyed on the array Moulinette holds: it replaces that array when its
// settings change, so this notices without being told.
let cache = { assets: null, lookup: null };

export function lookupFor(index) {
  if (cache.assets !== index.assets) cache = { assets: index.assets, lookup: lookup(index.assets) };
  return cache.lookup;
}

/** The index row for a pack number and in-pack path, or undefined. */
export function rowFor(index, pack, path) {
  return lookupFor(index).rows.get(rowKey(pack, path));
}
