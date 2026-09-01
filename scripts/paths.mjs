// Where Moulinette puts files, and how a path there is matched back to the
// asset it came from.
//
// A download lands at `moulinette-v2/cloud/<creator>/<pack>/<filepath>`, with
// `filepath` the asset's own `url`. An index row does not say which folder it
// lands in, but its `previewUrl` is built from the same two segments followed
// by a name derived from that `url`, so the folder can be read off it.
//
// No Foundry in this file.

export const LOCAL_ROOT = "moulinette-v2/cloud/";

// One expression both decides and extracts, so a truncated match is not
// representable. The optional prefix is the base URL a reader storing on a
// bucket sees in front of the same tree.
const WHOLE_PATH = /^(?:[a-z][a-z0-9+.-]*:\/\/[^\s"']*\/)?(moulinette-v2\/cloud\/[^?]+?)(?:\?.*)?$/i;

/** The local path a string is, or null when it is not one, or only contains one. */
export function localPath(value) {
  if (typeof value !== "string" || !value.includes(LOCAL_ROOT)) return null;
  return WHOLE_PATH.exec(value)?.[1] ?? null;
}

/** Every local path a document names as a whole string. */
export function localPaths(value, into = new Set()) {
  if (typeof value === "string") {
    const path = localPath(value);
    if (path) into.add(path);
  } else if (Array.isArray(value)) {
    for (const v of value) localPaths(v, into);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) localPaths(v, into);
  }
  return into;
}

/** `<creator>/<pack>` for one index row, or null when its preview is not that shape. */
function packFolder(asset) {
  const base = String(asset.url).replace(/\.[^./]+$/, "");
  const preview = String(asset.previewUrl ?? "").split("?")[0];
  const cut = preview.lastIndexOf(base);
  if (cut < 0) return null;
  try {
    return new URL(preview.slice(0, cut)).pathname.replace(/^\/|\/$/g, "") || null;
  } catch {
    return null;
  }
}

/**
 * The index arranged for looking paths up: pack folder to `pack_id`, and
 * `pack_id` plus `url` to the row.
 */
export function lookup(assets) {
  const folders = new Map();
  const rows = new Map();
  const mapped = new Set();                 // one preview parse per pack, not per row
  for (const asset of assets) {
    if (asset?.pack_id == null || typeof asset.url !== "string") continue;
    rows.set(`${asset.pack_id}\n${asset.url}`, asset);
    if (mapped.has(asset.pack_id)) continue;
    const folder = packFolder(asset);
    if (!folder) continue;
    mapped.add(asset.pack_id);
    folders.set(folder, String(asset.pack_id));
  }
  return { folders, rows };
}

/** The index row a local path names, or null when its pack is not in the index. */
export function assetFor(path, { folders, rows }) {
  for (const [folder, pack] of folders) {
    const prefix = `${LOCAL_ROOT}${folder}/`;
    if (!path.startsWith(prefix)) continue;
    return rows.get(`${pack}\n${path.slice(prefix.length)}`) ?? null;
  }
  return null;
}
