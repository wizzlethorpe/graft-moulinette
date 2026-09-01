// The reader's side: a graft naming one of this module's packs is
// materialised from the reader's own subscription before graft resolves it,
// and the files a built document names are fetched after.

import { MODULE_ID, parseReference } from "./refs.mjs";
import { localPaths, assetFor } from "./paths.mjs";
import { loadIndex, downloadDocument, downloadFile, documentIds, lookupFor } from "./index.mjs";
import { hasDocument, store } from "./packs.mjs";

/** The references to this module's packs that an entry's source names. */
export function referencesIn(entry) {
  const sources = Array.isArray(entry?.source) ? entry.source
    : typeof entry?.source === "string" ? [entry.source] : [];
  return sources.map(parseReference).filter(Boolean);
}

/**
 * Whether an entry survives the references that could not be materialised.
 * With no source left it sinks, reported here rather than by graft's own
 * "did not resolve"; with a fallback left, the failures are warnings.
 *
 * @param {Map<string,string>} failed  reference id to reason
 */
export function outcome(entry, failed) {
  const problems = referencesIn(entry).filter((r) => failed.has(r.id)).map((r) => failed.get(r.id));
  if (problems.length === 0) return { keep: true, warnings: [] };
  const sources = Array.isArray(entry.source) ? entry.source.length : 1;
  if (problems.length === sources) return { keep: false, reason: problems.join("; ") };
  return { keep: true, warnings: problems };
}

/** The `graftPreBuild` transform: put every referenced document in its pack. */
export async function transform(entries) {
  const wanted = new Map();
  for (const entry of entries) for (const ref of referencesIn(entry)) wanted.set(ref.id, ref);
  if (wanted.size === 0) return entries;

  const failed = new Map();
  let index = null;
  try {
    index = await loadIndex();
  } catch (err) {
    for (const id of wanted.keys()) failed.set(id, err.message);
  }
  if (index) {
    const rows = await documentIds(index);
    const bar = game.modules.get("graft").api.progress;
    bar.phase("Moulinette", wanted.size);
    for (const ref of wanted.values()) {
      bar.step(ref.id);
      if (hasDocument(ref)) continue;
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
  }

  const out = [];
  const skipped = [];
  const warnings = [];
  for (const entry of entries) {
    const o = outcome(entry, failed);
    if (!o.keep) { skipped.push({ id: entry.id, reason: o.reason }); continue; }
    out.push(entry);
    for (const reason of o.warnings) warnings.push({ id: entry.id, reason });
  }
  return { entries: out, skipped, warnings };
}

/** Whether a data path exists, one directory listing per directory. */
function presence() {
  const dirs = new Map();
  return async (path) => {
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (!dirs.has(dir)) {
      let files = [];
      try {
        ({ files } = await foundry.applications.apps.FilePicker.implementation.browse("data", dir));
      } catch { /* a missing directory holds nothing */ }
      dirs.set(dir, new Set(files.map((f) => decodeURIComponent(f))));
    }
    return dirs.get(dir).has(path);
  };
}

/** After a build: fetch every Moulinette file the built documents name and the reader lacks. */
export async function fetchFiles(built) {
  const paths = new Set();
  for (const uuid of built) localPaths((await fromUuid(uuid)).toObject(), paths);
  if (paths.size === 0) return;

  const index = await loadIndex();
  const found = lookupFor(index);
  const present = presence();
  const fetched = [];
  const problems = [];
  for (const path of paths) {
    if (await present(path)) continue;
    const row = assetFor(path, found);
    if (!row) { problems.push(`${path}: not in your Moulinette index`); continue; }
    try {
      const landed = await downloadFile(row, index);
      if (landed === path) fetched.push(path);
      else problems.push(`${path}: Moulinette put it at ${landed}, so the pack was renamed since this graft was made`);
    } catch (err) {
      problems.push(`${path}: ${err.message}`);
    }
  }

  if (fetched.length === 0 && problems.length === 0) return;
  ui.notifications.info(game.i18n.format("GRAFTMOU.Fetched", { fetched: fetched.length, problems: problems.length }));
  if (problems.length > 0) console.warn(`${MODULE_ID} | files left unresolved:\n  ${problems.join("\n  ")}`);
}
