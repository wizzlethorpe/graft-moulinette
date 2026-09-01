// Where Foundry calls in, and nothing else.

import { MODULE_ID } from "./refs.mjs";
import { watchDownloads, registerAuthorHooks, readopt, importAsset } from "./author.mjs";
import { transform, fetchFiles } from "./reader.mjs";

const warn = (key) => (err) => ui.notifications.warn(game.i18n.format(key, { reason: err.message }));

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = { import: importAsset };
});

// On ready rather than init, so Moulinette's collections exist to be wrapped
// whichever order the two modules loaded in.
Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  watchDownloads();
  registerAuthorHooks();
  readopt().catch(warn("GRAFTMOU.ReadoptFailed"));
});

Hooks.on("graftPreBuild", (_moduleId, register) => {
  register({ id: MODULE_ID, label: "Moulinette", transform });
});

Hooks.on("graftBuilt", (_moduleId, { built }) => {
  fetchFiles(built).catch(warn("GRAFTMOU.FetchFailed"));
});
