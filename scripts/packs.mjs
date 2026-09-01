// Writing into this module's own compendium packs.

import { MODULE_ID, PACKS } from "./refs.mjs";

const PACK_CONFIG = "compendiumConfiguration";

export function hasDocument({ pack, id }) {
  return !!game.packs.get(`${MODULE_ID}.${pack}`)?.index.has(id);
}

/**
 * Put a Moulinette document in the pack for its type, under its id. Migrated
 * by Foundry on the way in; the publisher's `_stats` go, and Foundry writes fresh ones.
 */
export async function store(type, json, id) {
  const data = { ...json };
  delete data._id;
  delete data.folder;
  delete data._stats;
  const prepared = (await getDocumentClass(type).fromImport(data)).toObject();
  prepared._id = id;
  await writeDocument(type, prepared);
}

// The pack's whole configuration entry is restored, not just `locked`, because
// an entry created for a pack that had none carries `folder: null`, which
// beats the manifest's `packFolders` and unfiles the pack for good.
async function writeDocument(type, data) {
  const collection = `${MODULE_ID}.${PACKS[type]}`;
  const pack = game.packs.get(collection);
  if (!pack) throw new Error(`Foundry knows no pack ${collection}; restart the server if the module was just installed`);

  const wasLocked = pack.locked;
  const prior = game.settings.get("core", PACK_CONFIG)?.[collection];
  if (wasLocked) await pack.configure({ locked: false });
  try {
    const existing = await pack.getDocument(data._id);
    if (existing) await existing.update(data, { diff: false, recursive: false });
    else await getDocumentClass(type).create(data, { pack: collection, keepId: true, keepEmbeddedIds: true });
  } finally {
    if (wasLocked) {
      const config = { ...game.settings.get("core", PACK_CONFIG) };
      if (prior) config[collection] = { ...prior };
      else delete config[collection];
      await game.settings.set("core", PACK_CONFIG, config);
    }
  }
}
