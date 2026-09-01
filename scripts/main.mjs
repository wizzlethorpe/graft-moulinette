// Where Foundry calls in, and nothing else.

import { MODULE_ID } from "./refs.mjs";
import { watchImports, readopt, importAsset } from "./author.mjs";
import { transform, fetchFiles } from "./reader.mjs";

const warn = (key) => (err) => ui.notifications.warn(game.i18n.format(key, { reason: err.message }));

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = { import: importAsset };
});

// Moulinette fills its collections in its own ready handler, which may run
// after this one, so the wrap waits for the whole ready pass to finish.
Hooks.once("ready", () => {
  if (!game.user.isGM) return;
  Promise.resolve().then(() => {
    watchImports();
    return readopt();
  }).catch(warn("GRAFTMOU.ReadoptFailed"));
});

Hooks.on("graftPreBuild", (_moduleId, register) => {
  register({ id: MODULE_ID, label: "Moulinette", transform });
});

Hooks.on("graftBuilt", (_moduleId, { built }) => {
  fetchFiles(built).catch(warn("GRAFTMOU.FetchFailed"));
});
