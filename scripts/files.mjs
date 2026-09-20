// How a graft's `assets.moulinette` block names a file, and the folder whose paths say which asset they are.
//
// No Foundry in this file.

export const MODULE_ID = "graft-moulinette";

/** `<pack number>/<path inside the pack>`, the two things an asset's marketplace page shows. */
export const sourceFor = (pack, path) => `${pack}/${path}`;

/** `{ pack, path }` for a source, or null. */
export function parseSource(value) {
  const m = typeof value === "string" ? /^(\d+)\/(.+)$/.exec(value) : null;
  return m ? { pack: m[1], path: m[2] } : null;
}

/** A document, which Moulinette hands over as data, as opposed to a file it serves as bytes. */
export const isDocument = (path) => /\.json$/i.test(path);

const OWN = "graft/moulinette/";

/** A path that says which asset it is. An adopted document is written here, and a graft may place any file here. */
export const ownPath = (pack, path) => OWN + sourceFor(pack, path);

/** `{ pack, path }` for a path `ownPath` made, or null. */
export function parseOwnPath(value) {
  if (typeof value !== "string" || !value.startsWith(OWN)) return null;
  return parseSource(value.slice(OWN.length));
}
