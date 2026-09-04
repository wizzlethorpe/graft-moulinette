// The reader's side: a graft naming one of this module's packs is
// materialised from the reader's own subscription before graft resolves it,
// and the files a built document names are fetched after.

import { MODULE_ID, documentId, aliasFor, referenceFor, parseReference, parseAlias } from "./refs.mjs";
import { localPaths, assetFor } from "./paths.mjs";
import { loadIndex, downloadFile, lookupFor } from "./index.mjs";
import { materialise } from "./packs.mjs";

/** The references to this module's packs that an entry's own source names. */
function topReferences(entry) {
  const sources = Array.isArray(entry?.source) ? entry.source
    : typeof entry?.source === "string" ? [entry.source] : [];
  return sources.map(parseReference).filter(Boolean);
}

/**
 * Every `{ _id, source, patch }` member of a keyed array, at any depth: an
 * Adventure's scenes, an actor's items. Array members only, as graft expands.
 */
function* sourcedMembers(value) {
  if (Array.isArray(value)) {
    for (const v of value) {
      if (v && typeof v === "object" && typeof v._id === "string" && typeof v.source === "string") yield v;
      yield* sourcedMembers(v);
    }
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) yield* sourcedMembers(v);
  }
}

function embeddedReferences(patch) {
  return [...sourcedMembers(patch)].map((e) => parseReference(e.source)).filter(Boolean);
}

export function referencesIn(entry) {
  return [...topReferences(entry), ...embeddedReferences(entry?.patch)];
}

/**
 * Whether an entry survives the references that could not be materialised.
 * With no source left it sinks, reported here rather than by graft's own
 * "did not resolve"; with a fallback left, the failures are warnings.
 *
 * @param {Map<string,string>} failed  reference id to reason
 */
export function outcome(entry, failed) {
  const reasons = (refs) => refs.filter((r) => failed.has(r.id)).map((r) => failed.get(r.id));
  const embedded = reasons(embeddedReferences(entry?.patch));
  const problems = reasons(topReferences(entry));
  const sources = Array.isArray(entry.source) ? entry.source.length : entry.source ? 1 : 0;
  // An embedded source has no fallback, so one failing sinks the entry.
  if (embedded.length > 0 || (problems.length > 0 && problems.length === sources)) {
    return { keep: false, reason: [...embedded, ...problems].join("; ") };
  }
  return { keep: true, warnings: problems };
}

/** The aliases one entry names, at its top level or inside its patch. */
function aliasesIn(entry) {
  const found = [];
  for (const s of Array.isArray(entry?.source) ? entry.source : [entry?.source]) {
    if (parseAlias(s)) found.push(s);
  }
  for (const member of sourcedMembers(entry?.patch)) {
    if (parseAlias(member.source)) found.push(member.source);
  }
  return found;
}

/** A copy of the entry with every alias replaced by the reference it names. */
function expand(entry, map) {
  const swap = (v) => map.get(v) ?? v;
  const out = { ...entry };
  if (out.source !== undefined) {
    out.source = Array.isArray(out.source) ? out.source.map(swap) : swap(out.source);
  }
  if (out.patch) {
    out.patch = structuredClone(out.patch);
    for (const member of sourcedMembers(out.patch)) member.source = swap(member.source);
  }
  return out;
}

/**
 * Every alias replaced by the reference it names. Only entries holding one are
 * rebuilt, so an unrelated patch is never cloned.
 */
export async function expandAliases(entries) {
  const map = new Map();
  const mine = new Set();
  for (const entry of entries) {
    for (const alias of aliasesIn(entry)) {
      mine.add(entry);
      if (map.has(alias)) continue;
      const { type, pack, file } = parseAlias(alias);
      map.set(alias, referenceFor(type, await documentId(pack, file)));
    }
  }
  return mine.size === 0 ? entries : entries.map((e) => (mine.has(e) ? expand(e, map) : e));
}

/**
 * The `graftPreBuild` transform: turn every alias into the reference it names,
 * and put the document each one wants in its pack.
 */
export async function transform(input) {
  const entries = await expandAliases(input);

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

/**
 * Copy graft: name a Moulinette source the way its marketplace page does.
 *
 * The flag is on the world document and on the pack copy alike, so it cancels
 * in the diff and costs the entry nothing.
 */
export function rewrite(entry, { document }) {
  const flag = document.flags?.[MODULE_ID];
  if (!flag || !parseReference(entry.source)) return entry;
  return { ...entry, source: aliasFor(document.documentName, flag.pack, flag.file) };
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
  // Through graft: an entry assembled into an Adventure has a uuid `fromUuid` rejects.
  const { resolve } = game.modules.get("graft").api;
  for (const uuid of built) {
    const data = await resolve(uuid);
    if (data) localPaths(data, paths);
  }
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
