// Writing into this module's own compendium packs.

import { MODULE_ID, PACKS } from "./refs.mjs";

const PACK_CONFIG = "compendiumConfiguration";

export function hasDocument({ pack, id }) {
  return !!game.packs.get(`${MODULE_ID}.${pack}`)?.index.has(id);
}

/**
 * Plain data for one of this module's packs: migrated by Foundry, under the
 * deterministic id, with the asset it came from recorded on it.
 */
export async function prepare(type, json, id, { pack, file }) {
  const data = { ...json };
  delete data._id;
  delete data.folder;
  delete data._stats;                       // the publisher's; Foundry writes fresh ones
  const cls = getDocumentClass(type);
  const prepared = (await cls.fromImport(data)).toObject();
  prepared._id = id;
  foundry.utils.setProperty(prepared, `flags.${MODULE_ID}`, { pack: String(pack), file });
  return prepared;
}

/**
 * Create or replace a document in the pack for its type.
 *
 * The pack's whole configuration entry is restored afterwards, not just
 * `locked`: `configure` writes the full current state, and an entry created
 * for a pack that had none carries `folder: null`, which beats the manifest's
 * `packFolders` and unfiles the pack for good.
 */
export async function writeDocument(type, data) {
  const collection = `${MODULE_ID}.${PACKS[type]}`;
  const pack = game.packs.get(collection);
  if (!pack) throw new Error(`Foundry knows no pack ${collection}; restart the server if the module was just installed`);

  const prior = game.settings.get("core", PACK_CONFIG)?.[collection];
  if (pack.locked) await pack.configure({ locked: false });
  try {
    const existing = await pack.getDocument(data._id);
    if (existing) await existing.update(data, { diff: false, recursive: false });
    else await getDocumentClass(type).create(data, { pack: collection, keepId: true, keepEmbeddedIds: true });
  } finally {
    const config = { ...game.settings.get("core", PACK_CONFIG) };
    if (prior) config[collection] = { ...prior };
    else delete config[collection];
    await game.settings.set("core", PACK_CONFIG, config);
  }
}
