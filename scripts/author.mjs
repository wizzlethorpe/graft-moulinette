// The author's side: content imported through Moulinette's own browser gets a
// source graft can name, with no gesture from the author.

import { MODULE_ID, PACKS, documentId, referenceFor, parseReference } from "./refs.mjs";
import { loadIndex, watchDownloads, downloadDocument, rowFor } from "./index.mjs";
import { hasDocument, store, materialise } from "./packs.mjs";

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
    await document.update({ _stats: { compendiumSource: reference } });
    ui.notifications.info(game.i18n.format("GRAFTMOU.Adopted", { name: document.name }));
    console.log(`${MODULE_ID} | ${document.name} is now ${reference}`);
  } catch (err) {
    ui.notifications.warn(game.i18n.format("GRAFTMOU.AdoptFailed", { name: document.name, reason: err.message }));
  }
}

export function watchImports() {
  watchDownloads((record) => ledger.remember(record));
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
  const names = new Map();
  for (const type of Object.keys(PACKS)) {
    for (const doc of game.collections.get(type)) {
      const ref = parseReference(doc._stats?.compendiumSource);
      if (ref && !hasDocument(type, ref.id)) names.set(ref, doc.name);
    }
  }
  if (names.size === 0) return;
  const failed = await materialise(names.keys(), await loadIndex());
  const problems = [...names].filter(([ref]) => failed.has(ref.id)).map(([ref, name]) => `${name}: ${failed.get(ref.id)}`);
  if (problems.length > 0) throw new Error(problems.join("; "));
}

/**
 * Bring one asset into this module's packs by hand, fetched afresh: for
 * content imported before this module was watching, or republished since.
 *
 * @returns the reference a graft can name
 */
export async function importAsset({ type, pack, file }) {
  if (!PACKS[type]) throw new Error(`no pack holds a ${type}; one of ${Object.keys(PACKS).join(", ")}`);
  const index = await loadIndex();
  const row = rowFor(index, pack, file);
  if (!row) throw new Error(`no ${file} in Moulinette pack ${pack}: your account may not include it, or it moved`);
  const id = await documentId(row.pack_id, row.url);
  await store(type, await downloadDocument(row, index), id);
  return referenceFor(type, id);
}
