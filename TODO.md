# TODO

Short, and meant to stay short. Anything settled belongs in the README instead.

## Known limits

- Actor and Item packs need a system each. Foundry refuses a system-agnostic
  pack of either type, so serving them means one declared pack per system and
  a reference form that names it.
- The author-side match is by name. Moulinette creates a placeholder and fills
  it by `importFromJSON`, so nothing ties the update to the download but the
  document's name and the order of events. Two imports of same-named scenes in
  quick succession could claim each other's download.
- Adoption is forward-only. Content imported before this module was watching
  has no pack copy and needs `api.import`, which wants the pack number and
  in-pack path typed by hand.
- The post-build fetch checks presence on the `data` storage only, so a reader
  storing Moulinette content on a bucket is told every file is missing and
  then that each landed elsewhere.

## Wanted

- A way to adopt an existing world scene. The folder map gives its pack, and
  the pack's `.json` rows are few, so the one whose dependencies name the
  scene's background is very likely its source. Inference, so it should say
  what it guessed and let the author confirm.
- Embedded sources. `referencesIn` reads an entry's top-level `source` only; a
  `{ _id, source, patch }` inside a patch naming one of these packs is not
  materialised, and graft's "embedded source did not resolve" fails the entry.
