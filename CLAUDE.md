# graft-moulinette

A Foundry VTT module. Plain ESM, no build step. Read `README.md` first: it is the contract this code keeps.

```bash
node --test 'test/*.test.mjs'     # no Foundry needed
./release.sh <X.Y.Z> [--dry-run]  # bump, tag, publish; needs gh and a clean tree
```

## Shape

Two pure files and four that need Foundry. Keep the line where it is.

- `refs.mjs` and `paths.mjs` have no Foundry in them and carry the decisions: what an id is, what a reference parses to, whether a string is a Moulinette path, which index row a path names. Every test is against these or against a pure function pulled out of the Foundry files (`downloaded`, `makeLedger`, `referencesIn`, `outcome`).
- `index.mjs` is the only file that reaches into Moulinette's internals, and it checks for each thing it needs rather than assuming it. Anything new that touches Moulinette goes here.
- `author.mjs` wraps one Moulinette method and listens to Foundry's own create and update hooks. `reader.mjs` is graft's `graftPreBuild` transform and its `graftBuilt` listener.

## What is fixed by others

- The id is `SHA-256(<pack_ref>/<filepath>)`, sixteen characters from the first sixteen bytes. Changing it orphans every reference ever shipped; `test/refs.test.mjs` pins one value for that reason.
- The local layout `moulinette-v2/cloud/<creator>/<pack>/<filepath>` and the shape of `previewUrl` come from Moulinette 2.3. `paths.mjs` depends on both; if either moves, `lookup()` returns an empty folder map and every file is reported unmatched, which is the intended failure.
- graft's transform contract: `graftPreBuild` may fire collect-only, so registration must do nothing; a transform returns `{ entries, skipped, warnings }` and is run once per build.

## Before shipping a change that touches Foundry

Probe it against the live world; `typeof` in the console costs seconds. Things this module relies on and has not proven in every Foundry version:

- `document.update({ _stats: { compendiumSource } })` persists on a world document.
- Moulinette's `/asset/<id>` descriptor carries `pack_ref` and `filepath`, and `importFromJSON` fills the placeholder through `update` with `name` in the changes.
- A module pack can be unlocked, written and re-locked from the client the way graft does it.

## Style

Follow the workspace `CLAUDE.md`: smallest thing that works, no defensive code for impossible states, comments only for what breaks without them, no em-dashes anywhere, and a test has to fail without the line it names. Never review your own work here; dispatch the reviewer.
