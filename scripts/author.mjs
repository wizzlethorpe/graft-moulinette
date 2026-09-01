// The author's side: content imported through Moulinette's own browser gets a
// source graft can name, with no gesture from the author.
//
// Moulinette stamps nothing and fires no hooks of its own, but every download
// passes through one method, and the world document then arrives through
// Foundry's ordinary create and update hooks. Wrapping the first and watching
// the second is enough to know which asset a new document came from.

import { MODULE_ID, PACKS, documentId, referenceFor } from "./refs.mjs";
import { loadIndex, downloadDocument, cachedCollection } from "./index.mjs";
import { prepare, writeDocument } from "./packs.mjs";

/**
 * What a download told us, or null when it was not a document.
 *
 * `descriptor` is Moulinette's `/asset/<id>` response; `result` is what its
 * `downloadAsset` returned, with the document text in `message`.
 */
export function downloaded(descriptor, result) {
  if (typeof descriptor?.filepath !== "string" || !descriptor.filepath.endsWith(".json")) return null;
  if (descriptor.pack_ref == null || typeof result?.message !== "string") return null;
  try {
    return { pack: String(descriptor.pack_ref), file: descriptor.filepath, document: JSON.parse(result.message) };
  } catch {
    return null;
  }
}

/**
 * The last document downloaded, held until a world document with its name
 * claims it. One slot: Moulinette imports one document per gesture, and the
 * world document follows within the same call.
 */
export function makeLedger() {
  let pending = null;
  return {
    remember(record) { pending = record; },
    claim(name) {
      if (!pending || pending.document?.name !== name) return null;
      const record = pending;
      pending = null;
      return record;
    },
  };
}

const ledger = makeLedger();

/** Wrap Moulinette's download so the ledger sees every document it fetches. */
export function watchDownloads() {
  const collection = cachedCollection();
  if (!collection) {
    console.warn(`${MODULE_ID} | Moulinette's cloud collection is not where this module expects it; imports will not be adopted`);
    return false;
  }
  if (collection.downloadAsset.wraps) return true;
  const original = collection.downloadAsset.bind(collection);
  const wrapped = async (descriptor) => {
    const result = await original(descriptor);
    const record = downloaded(descriptor, result);
    if (record) ledger.remember(record);
    return result;
  };
  wrapped.wraps = original;
  collection.downloadAsset = wrapped;
  return true;
}

/**
 * Give a world document that just came from Moulinette a compendium source.
 *
 * Moulinette creates a placeholder and fills it by `importFromJSON`, so the
 * real content arrives as an update; a Playlist arrives whole on create. Both
 * hooks lead here, and the ledger decides by name.
 */
async function adopt(document, changes) {
  if (document.pack || (changes && !("name" in changes))) return;
  const record = ledger.claim(document.name);
  if (!record) return;
  const type = document.documentName;
  try {
    const id = await documentId(record.pack, record.file);
    await writeDocument(type, await prepare(type, record.document, id, record));
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
 * Bring one asset into this module's packs by hand, for content imported
 * before this module was watching.
 *
 * @returns the reference a graft can name
 */
export async function importAsset({ type, pack, file }) {
  if (!PACKS[type]) throw new Error(`no pack holds a ${type}; one of ${Object.keys(PACKS).join(", ")}`);
  const index = await loadIndex();
  const row = index.assets.find((a) => String(a?.pack_id) === String(pack) && a?.url === file);
  if (!row) throw new Error(`no ${file} in Moulinette pack ${pack}: your account may not include it, or it moved`);
  const id = await documentId(row.pack_id, row.url);
  const json = await downloadDocument(row, index);
  await writeDocument(type, await prepare(type, json, id, { pack: row.pack_id, file: row.url }));
  return referenceFor(type, id);
}
