// Where Moulinette puts files, and how a path there is matched back to the
// asset it came from.
//
// A download lands at `<root>/cloud/<creator>/<pack>/<filepath>`, with
// `filepath` the asset's own `url` and the root Moulinette's `MOU_DEF_FOLDER`,
// which a reader can change. An index row does not say which folder it lands
// in, but its `previewUrl` is built from the same two segments followed by a
// name derived from that `url`, so the folder can be read off it.
//
// No Foundry in this file.

/** Moulinette's own default, for a reader who has not changed it. */
export const DEFAULT_ROOT = "moulinette-v2/cloud/";

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The optional prefix is the base URL a reader storing on a bucket sees in
// front of the same tree.
const wholePath = (root) => new RegExp(`^(?:[a-z][a-z0-9+.-]*:\\/\\/[^\\s"']*\\/)?(${escapeRe(root)}[^?]+?)(?:\\?.*)?$`);

/** The local path a string is, or null when it is not one, or only contains one. */
export function localPath(value, root = DEFAULT_ROOT) {
  if (typeof value !== "string" || !value.includes(root)) return null;
  return wholePath(root).exec(value)?.[1] ?? null;
}

/** Every local path a document names as a whole string. */
export function localPaths(value, into = new Set(), root = DEFAULT_ROOT) {
  if (typeof value === "string") {
    const path = localPath(value, root);
    if (path) into.add(path);
  } else if (Array.isArray(value)) {
    for (const v of value) localPaths(v, into, root);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) localPaths(v, into, root);
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

export const rowKey = (pack, file) => `${pack}\n${file}`;

/**
 * The index arranged for looking paths up: pack folder to `pack_id`, and
 * `pack_id` plus `url` to the row.
 */
export function lookup(assets) {
  const folders = new Map();
  const rows = new Map();
  const mapped = new Set();                 // one preview parse per pack, not per row
  for (const asset of assets) {
    rows.set(rowKey(asset.pack_id, asset.url), asset);
    if (mapped.has(asset.pack_id)) continue;
    const folder = packFolder(asset);
    if (!folder) continue;
    mapped.add(asset.pack_id);
    folders.set(folder, String(asset.pack_id));
  }
  return { folders, rows };
}

/** The index row a local path names, or null when its pack is not in the index. */
export function assetFor(path, { folders, rows }, root = DEFAULT_ROOT) {
  for (const [folder, pack] of folders) {
    const prefix = `${root}${folder}/`;
    if (!path.startsWith(prefix)) continue;
    return rows.get(rowKey(pack, path.slice(prefix.length))) ?? null;
  }
  return null;
}
