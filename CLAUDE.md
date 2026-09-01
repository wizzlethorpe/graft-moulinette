# graft-moulinette

A Foundry VTT module. Plain ESM, no build step. Read `README.md` first: it is the contract this code keeps.

```bash
node --test 'test/*.test.mjs'     # no Foundry needed
./release.sh <X.Y.Z> [--dry-run]  # bump, tag, publish; needs gh and a clean tree
```

## Shape

The README's Layout section names the files. The line to keep: `refs.mjs` and `paths.mjs` have no Foundry in them and carry the decisions, and every test is against those or against a pure function pulled out of a Foundry file (`downloaded`, `makeLedger`, `claimable`, `referencesIn`, `outcome`). `index.mjs` is the only file that reaches into Moulinette's internals, including the wrap on its download and the table of its asset type numbers, and checks for each thing it needs rather than assuming it; anything new that touches Moulinette goes there.

## What is fixed by others

- The id is `SHA-256(<pack_ref>/<filepath>)`, sixteen characters from the first sixteen bytes. Changing it orphans every reference ever shipped; `test/refs.test.mjs` pins one value for that reason.
- The local layout `moulinette-v2/cloud/<creator>/<pack>/<filepath>` and the shape of `previewUrl` come from Moulinette 2.3. `paths.mjs` depends on both; if either moves, `lookup()` returns an empty folder map and every file is reported unmatched, which is the intended failure.
- graft's transform contract: `graftPreBuild` may fire collect-only, so registration must do nothing; a transform returns `{ entries, skipped, warnings }` and is run once per build.

## Before shipping a change that touches Foundry

Probe it against the live world; `typeof` in the console costs seconds. Proven live:

- `_stats.compendiumSource` is writable on a world document, and survives.
- A module pack unlocks, takes a write and re-locks from the client, keeping the folder its manifest gave it.
- `importFromJSON` fills Moulinette's placeholder through an `update` carrying `name`, which is what adoption claims on.
- The whole reader path: a `graftPreBuild` transform in the `sources` phase materialises into an empty pack, and `readopt` refills one that was wiped.

`materialise` in `packs.mjs` has no unit test, being bound to Foundry through `hasDocument` and `store`; it is exercised by every path that fetches into the pack.

## Style

Follow the workspace `CLAUDE.md`: smallest thing that works, no defensive code for impossible states, comments only for what breaks without them, no em-dashes anywhere, and a test has to fail without the line it names. Never review your own work here; dispatch the reviewer.
