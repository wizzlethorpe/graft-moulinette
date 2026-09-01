// How a Moulinette asset is named as a compendium source.
//
//   Compendium.graft-moulinette.<pack>.<Type>.<id>
//
// The id is a digest of the asset's Moulinette pack number and in-pack
// filepath, so it is the same sixteen characters on every machine, and any
// reader's own index can be searched for the asset it names.
//
// No Foundry in this file.

export const MODULE_ID = "graft-moulinette";

/** Pack per document type. */
export const PACKS = { Scene: "scenes", Playlist: "playlists", JournalEntry: "journal", Macro: "macros" };

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** A Foundry document id for an asset, stable across machines. */
export async function documentId(packRef, filepath) {
  const bytes = new TextEncoder().encode(`${packRef}/${filepath}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest.slice(0, 16)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function referenceFor(type, id) {
  const pack = PACKS[type];
  if (!pack) throw new Error(`no pack holds a ${type}`);
  return `Compendium.${MODULE_ID}.${pack}.${type}.${id}`;
}

const REFERENCE = new RegExp(`^Compendium\\.${MODULE_ID}\\.([a-z]+)\\.([A-Za-z]+)\\.([A-Za-z0-9]{16})$`);

/** `{ type, id }` for a source naming one of this module's packs, or null. */
export function parseReference(uuid) {
  const m = typeof uuid === "string" ? REFERENCE.exec(uuid) : null;
  if (!m || PACKS[m[2]] !== m[1]) return null;
  return { type: m[2], id: m[3] };
}
