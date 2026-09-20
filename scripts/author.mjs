// The author's side: content imported through Moulinette's own browser gets a
// source graft can name, with no gesture from the author.

import { MODULE_ID, ownPath } from "./files.mjs";
import { loadIndex, watchDownloads, downloadDocument, rowFor, TYPES, NOT_INDEXED } from "./index.mjs";
import { graft } from "./handler.mjs";

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

/** A world document created, or filled by `importFromJSON`, which sets its name. The hooks also fire inside a compendium. */
export function claimable(document, changes) {
  if (document.pack) return false;
  return !changes || "name" in changes;
}

const ledger = makeLedger();

/** Write one asset's document where its path says which asset it is, and say where that is. */
async function placeDocument(pack, path, data) {
  const destination = ownPath(pack, path);
  await graft().placeFile(destination, JSON.stringify(data), "application/json");
  return destination;
}

/** Give a world document that just came from Moulinette a source: the untouched document, kept as a file. */
async function adopt(document, changes) {
  if (!claimable(document, changes)) return;
  const record = ledger.claim(document.name, document.documentName);
  if (!record) return;
  try {
    const source = await placeDocument(record.pack, record.path, record.document);
    await graft().recordFileSource(document, source);
    ui.notifications.info(game.i18n.format("GRAFTMOU.Adopted", { name: document.name }));
    console.log(`${MODULE_ID} | ${document.name} is built on ${source}`);
  } catch (err) {
    ui.notifications.warn(game.i18n.format("GRAFTMOU.AdoptFailed", { name: document.name, reason: err.message }));
  }
}

export function watchImports() {
  watchDownloads((record) => ledger.remember(record));
  for (const type of Object.values(TYPES)) {
    Hooks.on(`create${type}`, (document) => adopt(document));
    Hooks.on(`update${type}`, (document, changes) => adopt(document, changes));
  }
}

/**
 * Fetch one asset's document afresh and keep it where a graft reads it, for content republished since it was adopted.
 * Given a world `document` imported before this module was watching, records the file as its source.
 *
 * @returns the path a graft names as the source
 */
export async function importAsset({ pack, path, document }) {
  const index = await loadIndex();
  const row = rowFor(index, pack, path);
  if (!row) throw new Error(`${pack}/${path}: ${NOT_INDEXED}`);
  const source = await placeDocument(row.pack_id, row.url, await downloadDocument(row, index));
  if (document) await graft().recordFileSource(document, source);
  return source;
}
