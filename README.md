# Graft: Moulinette

[![tests](https://github.com/wizzlethorpe/graft-moulinette/actions/workflows/test.yml/badge.svg)](https://github.com/wizzlethorpe/graft-moulinette/actions/workflows/test.yml)
[![license](https://img.shields.io/github/license/wizzlethorpe/graft-moulinette)](LICENSE)

Makes [Moulinette](https://www.moulinette.cloud/) content graftable. Import a scene through Moulinette's own browser and it becomes a compendium source a [graft](https://github.com/wizzlethorpe/graft) can name; a reader's build fetches it, and the files it uses, from their own Moulinette subscription. Nothing of the publisher's travels in a graft.

**Install:** paste this into Foundry's *Install Module* dialog. Needs graft 0.7.0 or later and Moulinette.

```
https://github.com/wizzlethorpe/graft-moulinette/releases/latest/download/module.json
```

## What a source looks like

```
Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg
```

An ordinary compendium UUID. The pack is one this module declares, one per document type (`scenes`, `playlists`, `journal`, `macros`), and the id is a digest of the asset's Moulinette pack number and in-pack filepath, so it is the same sixteen characters on every machine. To graft, the source is a document like any other; to this module, it says exactly which asset to fetch.

## Authoring

Import through Moulinette as you always have. When the document lands in your world, this module writes a pristine copy into its own pack under that id and records the pack copy as the world document's source. Edit the world copy and press **Copy graft**: graft diffs it against the pack copy and produces an entry naming Moulinette rather than carrying the scene.

```yaml
id: mySewerLair000001
type: Scene
pack: my-scenes
source: Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg
patch:
  name: The Sewer Lair
  walls: [...]
```

The match is made by name: the last document Moulinette downloaded is claimed by the first world document created or filled with that name. Content imported before this module was enabled has no pack copy; make one from the console with the pack number from the marketplace URL and the asset's in-pack path:

```js
await game.modules.get("graft-moulinette").api.import({ type: "Scene", pack: 10698, file: "json/scene/mad-lair.json" })
// "Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg"
```

Files stay where Moulinette put them, under `moulinette-v2/cloud/<creator>/<pack>/`, and a graft names them by that path. Nothing is rewritten.

## Building

When a graft names one of this module's packs, the build materialises the document first: the reader's own asset index is searched for the one whose id matches, and Moulinette fetches it into the pack, its map, tiles and ambience along with it. Then graft resolves the source as usual. An asset the reader's account does not include is reported in the build's **Not built by Moulinette** section, and every other entry still builds.

After every build, the documents graft made are scanned for `moulinette-v2/cloud/...` paths, and any file not on disk is fetched through Moulinette to exactly that path. A path that cannot be matched to an asset, or that Moulinette now files elsewhere, is listed in the console.

## Limits

- **Actors and Items** have no pack yet. Foundry requires an Actor or Item pack to declare its system, so those types need one pack per system.
- **Renamed packs.** A creator renaming a pack changes the folder Moulinette files it under, so a graft made before the rename names files by a path Moulinette no longer writes to. The build reports each such file with where it landed instead.
- **Storage on a bucket.** A reader whose Moulinette stores on S3 has paths behind a base URL. A graft names data-relative paths, which are checked and fetched on the data storage only.
- **ScenePacker packs and private cloud content** are not in the asset index, so they cannot be named.
- **Paths inside markup**, such as an `<img>` in a journal page, are left alone. Only a value that is a path by itself is fetched.

## Layout

```
scripts/refs.mjs     the reference form and its id. Pure.
scripts/paths.mjs    recognising a Moulinette path and matching it to an asset. Pure.
scripts/index.mjs    the reader's Moulinette index and downloads; the one file touching Moulinette's internals.
scripts/packs.mjs    writing into this module's packs.
scripts/author.mjs   adopting what Moulinette imports.
scripts/reader.mjs   the graftPreBuild transform and the post-build file fetch.
scripts/main.mjs     hooks only.
```

Tests: `node --test 'test/*.test.mjs'`
