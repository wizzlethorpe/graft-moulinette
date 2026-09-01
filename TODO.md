# TODO

Short, and meant to stay short. Anything settled belongs in the README instead.

## Known limits

- The author-side match is by name and type. Moulinette creates a placeholder
  and fills it by `importFromJSON`, so nothing ties the update to the download
  but the document's name and the order of events. Two imports of same-named
  scenes in quick succession could claim each other's download, and a
  Moulinette action that downloads a document without importing it leaves a
  record the next same-named document claims.
- Moulinette's asset type numbers are read from its bundle and pinned in
  `index.mjs`. A renumbering makes every download claim by name alone, which
  still works and is not reported.
- An alias is not checked when it is written. Nothing can reach Moulinette at
  authoring time, so a mistyped pack or filepath first shows up on a reader's
  machine as "not in your Moulinette index". Importing through Moulinette and
  pressing Copy graft cannot get this wrong, and is still the surer road.

## Wanted

- A way to adopt an existing world scene. The folder map gives its pack, and
  the pack's `.json` rows are few, so the one whose dependencies name the
  scene's background is very likely its source. Inference, so it should say
  what it guessed and let the author confirm.
