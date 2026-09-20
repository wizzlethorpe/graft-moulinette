// The `moulinette` asset handler: `place` fetches what a graft lists, and `collect` lists what a copied graft names.

import { sourceFor, parseSource, isDocument, parseOwnPath } from "./files.mjs";
import { assetFor, fileOf } from "./paths.mjs";
import { loadIndex, downloadDocument, fetchFile, lookupFor, rowFor, cloudRoot, NOT_INDEXED } from "./index.mjs";

const fp = () => foundry.applications.apps.FilePicker.implementation;
export const graft = () => game.modules.get("graft").api;

const dirOf = (path) => path.split("/").slice(0, -1).join("/");

/** Which of `paths` are on disk, from one listing of each directory. */
async function onDisk(paths) {
  const present = new Set();
  for (const dir of new Set(paths.map(dirOf))) {
    try {
      for (const f of (await fp().browse("data", dir)).files) present.add(fileOf(f));
    } catch { /* a missing directory holds nothing */ }
  }
  return present;
}

/** `place` for `assets.moulinette`: `{ files: [{ source, destination }] }`, each source a pack number and a path inside it. */
export async function place(config, { onPhase, onFile, redownload } = {}) {
  if (!Array.isArray(config?.files)) throw new Error("assets.moulinette.files should be a list");
  const files = [];
  const skipped = [];
  for (const f of config.files) {
    const asset = parseSource(f?.source);
    if (!asset || typeof f.destination !== "string" || !f.destination) skipped.push({ id: String(f?.source), reason: "a Moulinette file is a source, as <pack number>/<path in the pack>, and a destination" });
    // The source decides how it is fetched, and graft reads a destination ending .json as a document.
    else if (isDocument(asset.path) !== isDocument(f.destination)) skipped.push({ id: f.source, reason: "a document's destination ends .json, and only a document's does" });
    else files.push({ ...f, ...asset });
  }
  if (files.length === 0) return { skipped, warnings: [] };

  const index = await loadIndex();
  const present = await onDisk(files.map((f) => f.destination));
  const held = files.filter((f) => present.has(f.destination));
  const everything = held.length > 0 && redownload ? await redownload(held.length, files.length) : false;

  onPhase?.("Moulinette", files.length);
  for (const f of files) {
    onFile?.(f.destination.split("/").pop());
    if (held.includes(f) && !everything) continue;
    try {
      const row = rowFor(index, f.pack, f.path);
      if (!row) throw new Error(NOT_INDEXED);
      if (isDocument(f.path)) await graft().placeFile(f.destination, JSON.stringify(await downloadDocument(row, index)), "application/json");
      else await graft().placeFile(f.destination, await fetchFile(row, index));
    } catch (err) {
      skipped.push({ id: f.source, reason: err.message });
    }
  }
  return { skipped, warnings: [] };
}

/** Every string that is a whole value in `value`. */
function strings(value, into = new Set()) {
  if (typeof value === "string") into.add(value);
  else if (value && typeof value === "object") for (const v of Object.values(value)) strings(v, into);
  return into;
}

/** What `entries` name of Moulinette's, each file once: paths that say which asset they are, and files under Moulinette's folder, which only the index can match. */
export function named(entries, root) {
  const own = new Map();
  const media = new Set();
  for (const value of strings(entries)) {
    // graft reads a `.json` source as a literal path. Everything else is loaded as a URL.
    const file = parseOwnPath(value) && isDocument(value) ? value : fileOf(value);
    const asset = parseOwnPath(file);
    if (asset) own.set(file, { source: sourceFor(asset.pack, asset.path), destination: file });
    else if (file.startsWith(root)) media.add(file);
  }
  return { own: [...own.values()], media: [...media] };
}

/** `collect` for Copy graft: the block that places what these entries name on another machine, or null. */
export async function collect(entries) {
  const root = cloudRoot();
  const { own, media } = named(entries, root);
  const files = [...own];
  if (media.length > 0) {
    const found = lookupFor(await loadIndex());
    for (const path of media) {
      const row = assetFor(path, found, root);
      if (row) files.push({ source: sourceFor(row.pack_id, row.url), destination: path });
      else ui.notifications.warn(game.i18n.format("GRAFTMOU.NotIndexed", { path }));
    }
  }
  return files.length > 0 ? { files } : null;
}
