// The reader's side: a graft naming one of this module's packs is
// materialised from the reader's own subscription before graft resolves it,
// and the files a built document names are fetched after.

import { MODULE_ID, parseReference } from "./refs.mjs";
import { localPaths, assetFor } from "./paths.mjs";
import { loadIndex, downloadFile, lookupFor } from "./index.mjs";
import { materialise } from "./packs.mjs";

/** The references to this module's packs that an entry's own source names. */
function topReferences(entry) {
  const sources = Array.isArray(entry?.source) ? entry.source
    : typeof entry?.source === "string" ? [entry.source] : [];
  return sources.map(parseReference).filter(Boolean);
}

/** Those named by `{ _id, source, patch }` entries inside the patch, at any depth: an Adventure's scenes, an actor's items. */
function embeddedReferences(value, into = []) {
  if (Array.isArray(value)) {
    for (const v of value) embeddedReferences(v, into);
  } else if (value && typeof value === "object") {
    const ref = typeof value._id === "string" ? parseReference(value.source) : null;
    if (ref) into.push(ref);
    for (const v of Object.values(value)) embeddedReferences(v, into);
  }
  return into;
}

export function referencesIn(entry) {
  return [...topReferences(entry), ...embeddedReferences(entry?.patch)];
}

/**
 * Whether an entry survives the references that could not be materialised.
 * With no source left it sinks, reported here rather than by graft's own
 * "did not resolve"; with a fallback left, the failures are warnings. An
 * embedded source has no fallback, so one failing sinks the entry, as graft
 * itself would.
 *
 * @param {Map<string,string>} failed  reference id to reason
 */
export function outcome(entry, failed) {
  const reasons = (refs) => refs.filter((r) => failed.has(r.id)).map((r) => failed.get(r.id));
  const embedded = reasons(embeddedReferences(entry?.patch));
  if (embedded.length > 0) return { keep: false, reason: embedded.join("; ") };
  const problems = reasons(topReferences(entry));
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

  let failed;
  try {
    const index = await loadIndex();
    const bar = game.modules.get("graft").api.progress;
    bar.phase("Moulinette", wanted.size);
    failed = await materialise(wanted.values(), index, bar.step);
  } catch (err) {
    failed = new Map([...wanted.keys()].map((id) => [id, err.message]));
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
      else problems.push(`${path}: Moulinette put it at ${landed}`);
    } catch (err) {
      problems.push(`${path}: ${err.message}`);
    }
  }

  if (fetched.length === 0 && problems.length === 0) return;
  ui.notifications.info(game.i18n.format("GRAFTMOU.Fetched", { fetched: fetched.length, problems: problems.length }));
  if (problems.length > 0) console.warn(`${MODULE_ID} | files left unresolved:\n  ${problems.join("\n  ")}`);
}
