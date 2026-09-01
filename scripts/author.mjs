// The author's side: content imported through Moulinette's own browser gets a
// source graft can name, with no gesture from the author.

import { MODULE_ID, PACKS, documentId, referenceFor, parseReference } from "./refs.mjs";
import { loadIndex, downloadDocument, lookupFor, cachedCollection } from "./index.mjs";
import { hasDocument, store } from "./packs.mjs";

/** Moulinette's asset type numbers for the documents this module keeps. */
const TYPES = { 1: "Scene", 8: "JournalEntry", 9: "Playlist", 10: "Macro" };

/**
 * What a download told us, or null when it was not a document.
 *
 * `descriptor` is Moulinette's `/asset/<id>` response; `result` is what its
 * `downloadAsset` returned, with the document text in `message`.
 */
export function downloaded(descriptor, result) {
  if (!descriptor.filepath.endsWith(".json") || typeof result?.message !== "string") return null;
  try {
    return {
      pack: String(descriptor.pack_ref),
      file: descriptor.filepath,
      type: TYPES[descriptor.type] ?? null,     // unknown numbers claim by name alone
      document: JSON.parse(result.message),
    };
  } catch {
    return null;
  }
}

/**
 * The last document downloaded, held until a world document with its name and
 * type claims it. One slot: Moulinette imports one document per gesture.
 */
export function makeLedger() {
  let pending = null;
  return {
    remember(record) { pending = record; },
    claim(name, type) {
      if (!pending || pending.document?.name !== name || (pending.type && pending.type !== type)) return null;
      const record = pending;
      pending = null;
      return record;
    },
  };
}

/**
 * Whether a hook call could be a Moulinette import landing: a world document,
 * either created or filled in by `importFromJSON`, which sets its name.
 */
export function claimable(document, changes) {
  if (document.pack) return false;
  return !changes || "name" in changes;
}

const ledger = makeLedger();

/** Wrap Moulinette's download so the ledger sees every document it fetches. */
export function watchDownloads() {
  const collection = cachedCollection();
  if (!collection) {
    console.warn(`${MODULE_ID} | Moulinette's cloud collection is not where this module expects it; imports will not be adopted`);
    return;
  }
  const original = collection.downloadAsset.bind(collection);
  const wrapped = async (descriptor) => {
    const result = await original(descriptor);
    const record = downloaded(descriptor, result);
    if (record) ledger.remember(record);
    return result;
  };
  wrapped.wraps = original;
  collection.downloadAsset = wrapped;
}

/** Give a world document that just came from Moulinette a compendium source. */
async function adopt(document, changes) {
  if (!claimable(document, changes)) return;
  const record = ledger.claim(document.name, document.documentName);
  if (!record) return;
  const type = document.documentName;
  try {
    const id = await documentId(record.pack, record.file);
    await store(type, record.document, id);
    const reference = referenceFor(type, id);
    await document.update({ _stats: { compendiumSource: reference }, [`flags.${MODULE_ID}`]: { pack: record.pack, file: record.file } });
    ui.notifications.info(game.i18n.format("GRAFTMOU.Adopted", { name: document.name }));
    console.log(`${MODULE_ID} | ${document.name} is now ${reference}`);
  } catch (err) {
    ui.notifications.warn(game.i18n.format("GRAFTMOU.AdoptFailed", { name: document.name, reason: err.message }));
  }
}

export function registerAuthorHooks() {
  for (const type of Object.keys(PACKS)) {
    Hooks.on(`create${type}`, (document) => adopt(document));
    Hooks.on(`update${type}`, (document, changes) => adopt(document, changes));
  }
}

/**
 * Refill pack copies a module update wiped. Updating replaces the module
 * directory, packs included, and every adopted world document still names one.
 */
export async function readopt() {
  const missing = [];
  for (const type of Object.keys(PACKS)) {
    for (const doc of game.collections.get(type)) {
      const flag = doc.flags?.[MODULE_ID];
      const ref = parseReference(doc._stats?.compendiumSource);
      if (flag && ref && !hasDocument(ref)) missing.push({ flag, ref });
    }
  }
  if (missing.length === 0) return;
  const index = await loadIndex();
  for (const { flag, ref } of missing) {
    const row = lookupFor(index).rows.get(`${flag.pack}\n${flag.file}`);
    if (!row) throw new Error(`${flag.pack}/${flag.file} is not in your Moulinette index`);
    await store(ref.type, await downloadDocument(row, index), ref.id);
  }
}

/**
 * Bring one asset into this module's packs by hand, for content imported
 * before this module was watching.
 *
 * @returns the reference a graft can name
 */
export async function importAsset({ type, pack, file }) {
  if (!PACKS[type]) throw new Error(`no pack holds a ${type}; one of ${Object.keys(PACKS).join(", ")}`);
  const index = await loadIndex();
  const row = lookupFor(index).rows.get(`${pack}\n${file}`);
  if (!row) throw new Error(`no ${file} in Moulinette pack ${pack}: your account may not include it, or it moved`);
  const id = await documentId(row.pack_id, row.url);
  await store(type, await downloadDocument(row, index), id);
  return referenceFor(type, id);
}
