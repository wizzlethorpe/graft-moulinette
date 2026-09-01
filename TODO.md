# TODO

Short, and meant to stay short. Anything settled belongs in the README instead.

## Known limits

- The author-side match is by name and type. Moulinette creates a placeholder
  and fills it by `importFromJSON`, so nothing ties the update to the download
  but the document's name and the order of events. Two imports of same-named
  scenes in quick succession could claim each other's download, and a
  Moulinette action that downloads a document without importing it leaves a
  record the next same-named document claims.
- Adoption is forward-only, and silent about it. A document imported before
  this module was enabled records nothing, so Copy graft carries it whole with
  no warning, which is the one failure here that can ship somebody else's
  content. The README says to enable this first for that reason. Recovering it
  after the fact means inference, not a lookup: Moulinette writes a document's
  dependencies to disk but never the document, so nothing local says which
  asset an import came from.
- Moulinette's asset type numbers are read from its bundle and pinned in
  `index.mjs`. A renumbering makes every download claim by name alone, which
  still works and is not reported.
- An alias is not checked when it is written. Nothing can reach Moulinette at
  authoring time, so a mistyped pack or filepath first shows up on a reader's
  machine as "not in your Moulinette index". Importing through Moulinette and
  pressing Copy graft cannot get this wrong, and is still the surer road.

## Wanted

- A way to adopt existing world content. Any local path in the document gives
  its pack exactly, through the same folder map the file fetch uses; the
  document's own filepath does not follow, and has to be inferred by
  downloading the pack's `.json` rows and matching their dependencies against
  the paths the document uses. Worth it for a batch of scenes, where the match
  is strong. A Journal that embeds no Moulinette image, or a Macro, offers
  nothing to infer from at all.
