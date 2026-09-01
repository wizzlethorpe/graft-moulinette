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

## Wanted

- A way to adopt an existing world scene. The folder map gives its pack, and
  the pack's `.json` rows are few, so the one whose dependencies name the
  scene's background is very likely its source. Inference, so it should say
  what it guessed and let the author confirm.
