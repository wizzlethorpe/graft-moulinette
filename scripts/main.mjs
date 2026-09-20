// Where Foundry calls in, and nothing else.

import { MODULE_ID } from "./files.mjs";
import { watchImports, importAsset } from "./author.mjs";
import { place, collect } from "./handler.mjs";

Hooks.once("init", () => {
  game.modules.get(MODULE_ID).api = { import: importAsset };
});

// Moulinette fills its collections in its own ready handler, which may run
// after this one, so the wrap waits for the whole ready pass to finish.
Hooks.once("ready", () => {
  if (game.user.isGM) Promise.resolve().then(watchImports);
});

Hooks.on("graftAssets", (register) => {
  register({ id: "moulinette", place, collect });
});
