// Where Foundry calls in, and nothing else.

import { MODULE_ID } from "./refs.mjs";
import { watchDownloads, registerAuthorHooks, importAsset } from "./author.mjs";
import { transform, fetchFiles } from "./reader.mjs";

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = { import: importAsset };
});

// On ready rather than init, so Moulinette's collections exist to be wrapped
// whichever order the two modules loaded in.
Hooks.once("ready", () => {
  for (const dep of ["graft", "moulinette"]) {
    if (!game.modules.get(dep)?.active) {
      ui.notifications.warn(game.i18n.format("GRAFTMOU.Missing", { module: dep }));
      return;
    }
  }
  if (!game.user.isGM) return;
  watchDownloads();
  registerAuthorHooks();
});

Hooks.on("graftPreBuild", (_moduleId, register) => {
  register({ id: MODULE_ID, label: "Moulinette", transform });
});

Hooks.on("graftBuilt", (_moduleId, { built }) => { fetchFiles(built); });
