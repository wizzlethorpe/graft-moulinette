// Writing into this module's own packs, and filling them from the reader's index.

import { MODULE_ID, PACKS } from "./refs.mjs";
import { documentIds, downloadDocument } from "./index.mjs";

const PACK_CONFIG = "compendiumConfiguration";

export function hasDocument(type, id) {
  return !!game.packs.get(`${MODULE_ID}.${PACKS[type]}`)?.index.has(id);
}

/**
 * Put a Moulinette document in the pack for its type, under its id.
 *
 * `_stats` stays for `fromImport`, which migrates by the version recorded
 * there; only the publisher's own source claim goes.
 */
export async function store(type, json, id) {
  const data = { ...json, _stats: { ...json._stats } };
  delete data._id;
  delete data.folder;
  delete data._stats.compendiumSource;
  const prepared = (await getDocumentClass(type).fromImport(data)).toObject();
  prepared._id = id;

  const collection = `${MODULE_ID}.${PACKS[type]}`;
  const pack = game.packs.get(collection);
  if (!pack) throw new Error(`Foundry knows no pack ${collection}; restart the server if the module was just installed`);
  const wasLocked = pack.locked;
  const prior = game.settings.get("core", PACK_CONFIG)?.[collection];
  if (wasLocked) await pack.configure({ locked: false });
  try {
    const existing = await pack.getDocument(id);
    if (existing) await existing.update(prepared, { diff: false, recursive: false });
    else await getDocumentClass(type).create(prepared, { pack: collection, keepId: true, keepEmbeddedIds: true });
  } finally {
    // The whole entry, not just `locked`: one created for a pack that had none
    // carries `folder: null`, which overrides the manifest's `packFolders`.
    if (wasLocked) {
      const config = { ...game.settings.get("core", PACK_CONFIG) };
      if (prior) config[collection] = { ...prior };
      else delete config[collection];
      await game.settings.set("core", PACK_CONFIG, config);
    }
  }
}

/**
 * Put every referenced document in its pack, from the reader's own index.
 * One failing does not stop the rest.
 *
 * @returns {Map<string,string>} reference id to reason, for those it could not
 */
export async function materialise(refs, index, step = () => {}) {
  const rows = await documentIds(index);
  const failed = new Map();
  for (const ref of refs) {
    step(ref.id);
    if (hasDocument(ref.type, ref.id)) continue;
    const row = rows.get(ref.id);
    if (!row) {
      failed.set(ref.id, `${ref.id} is not in your Moulinette index: your account may not include it, or it moved`);
      continue;
    }
    try {
      await store(ref.type, await downloadDocument(row, index), ref.id);
    } catch (err) {
      failed.set(ref.id, err.message);
    }
  }
  return failed;
}
