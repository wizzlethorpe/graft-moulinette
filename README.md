# Graft: Moulinette

[![tests](https://github.com/wizzlethorpe/graft-moulinette/actions/workflows/test.yml/badge.svg)](https://github.com/wizzlethorpe/graft-moulinette/actions/workflows/test.yml)
[![license](https://img.shields.io/github/license/wizzlethorpe/graft-moulinette)](LICENSE)
[![release](https://img.shields.io/github/v/release/wizzlethorpe/graft-moulinette?display_name=tag&sort=semver)](https://github.com/wizzlethorpe/graft-moulinette/releases/latest)

Makes [Moulinette](https://www.moulinette.cloud/) content usable as [graft](https://github.com/wizzlethorpe/graft) sources. When you import a scene through Moulinette's browser, this module records where it came from, so a graft can name it as a source. When a reader builds that graft, the build fetches the scene and the files it uses from the reader's own Moulinette subscription. The graft itself never contains the publisher's content.

**Install:** paste this into Foundry's *Install Module* dialog. Needs Moulinette and graft 0.7.0 or later.

```
https://github.com/wizzlethorpe/graft-moulinette/releases/latest/download/module.json
```

> [!IMPORTANT]
> **Enable this module before you import.** It records where a document came from at the moment Moulinette hands it over. Documents imported before that have no recorded source, so **Copy graft** on them copies the whole document, walls and lights included, without warning you. The source cannot be recovered from disk afterwards, because Moulinette saves a document's images and audio but never the document itself. For content you imported earlier, write the source by hand or import it again.

## What a source looks like

```
Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg
```

This is an ordinary compendium UUID. The pack is one this module declares, one per document type (`scenes`, `playlists`, `journal`, `macros`). The id is a hash of the asset's Moulinette pack number and its filepath within that pack, so the same asset gets the same sixteen characters on every machine. Graft treats the source as a normal document; this module reads it to know exactly which asset to fetch.

Nobody can compute that hash by hand, so you can also write a source as an alias, from the two things the asset's marketplace page shows you: the pack number and the filepath.

```
@moulinette/Scene/10698/json/scene/mad-lair.json
```

The type is part of the alias because it decides which pack the document lands in, and the module cannot ask Moulinette for it when the graft is written. Both spellings name the same document; the build converts the alias to the UUID before graft resolves it. **Copy graft** writes the alias form, so what you paste is what you would have written by hand. The one exception is a source nested inside a patch, such as a scene inside an Adventure, which comes back as the UUID.

## Authoring

Import through Moulinette as you always have. When the document lands in your world, this module writes an unmodified copy into its own pack under the asset's id and records that copy as the world document's source. Edit the world copy and press **Copy graft**: graft diffs your version against the pack copy, so the entry names the Moulinette asset instead of carrying the scene.

```json
{
  "id": "mySewerLair00001",
  "type": "Scene",
  "pack": "my-scenes",
  "source": "@moulinette/Scene/10698/json/scene/mad-lair.json",
  "patch": {
    "name": "The Sewer Lair",
    "walls": [ … ]
  }
}
```

Moulinette never says which world document came from which download, so this module matches them itself: it remembers the last file Moulinette downloaded and takes the next document to appear in your world with the same name and type to be it.

**This module only adopts documents that arrive while it is enabled.** A document imported before then has no recorded source, so **Copy graft** copies it whole. To fix one, write its source by hand (this is what the alias is for) or import it again through Moulinette and copy that.

When a creator republishes a pack, your pack copy goes stale. `api.import` fetches an asset again and replaces the pack copy, taking the same pack number and filepath the marketplace page shows. It does not touch documents already in your world.

```js
await game.modules.get("graft-moulinette").api.import({ type: "Scene", pack: 10698, file: "json/scene/mad-lair.json" })
// "Compendium.graft-moulinette.scenes.Scene.CwVVyANWmNpt3Hfg"
```

Files stay where Moulinette put them, under `moulinette-v2/cloud/<creator>/<pack>/`, and a graft names them by that path. This module rewrites nothing.

Only a Moulinette *Scene*, the kind that arrives with walls and lights, becomes a source. A Moulinette *Map* is a bare image, and Moulinette builds a scene around it locally, so there is no document to adopt. **Copy graft** on one copies that scene whole, but it holds nothing except default settings and the image's path, and the image itself still resolves for a reader like any other file.

Updating this module replaces its packs, as any module update does. Every adopted document in the world records which asset it came from, so the next world load refills the packs from your subscription.

## Building

When a graft names one of this module's packs, either as its source or nested inside its patch, the build fetches the document first: the module finds the asset in the reader's own Moulinette index by id, and Moulinette downloads it into the pack along with its map, tiles and ambience. Then graft resolves the source as usual. The build reports an asset the reader's account does not include in its **Not built by Moulinette** section, and every other entry still builds.

After every build, this module scans the documents graft made for `moulinette-v2/cloud/...` paths and fetches any file not on disk through Moulinette to exactly that path. A path it cannot match to an asset, or that Moulinette now files elsewhere, goes to the console.

## Limits

- **Actors and Items** have no pack yet. Foundry requires an Actor or Item pack to declare its system, so those types need one pack per system.
- **Renamed packs.** A creator renaming a pack changes the folder Moulinette files it under, so a graft made before the rename names files by a path Moulinette no longer writes to. The build reports each such file with where it landed instead.
- **Storage on a bucket.** A reader whose Moulinette stores on S3 has paths behind a base URL. A graft names data-relative paths, and this module checks and fetches on the data storage only.
- **ScenePacker packs and private cloud content** are not in the asset index, so they cannot be named.
- **Paths inside markup**, such as an `<img>` in a journal page, are left alone. The module fetches only a value that is a path by itself.

## Support

Graft: Moulinette is free and open source, from Wizzlethorpe Labs. If it is useful to you, [support us on Patreon](https://www.patreon.com/wizzlethorpe). More free tools and content at [wizzlethorpe.com](https://wizzlethorpe.com).

## Layout

```
scripts/refs.mjs     the reference form and its id. Pure.
scripts/paths.mjs    recognising a Moulinette path and matching it to an asset. Pure.
scripts/index.mjs    everything that touches Moulinette: its index, its downloads, the wrap that watches them.
scripts/packs.mjs    writing into this module's packs.
scripts/author.mjs   adopting what Moulinette imports.
scripts/reader.mjs   aliases, the graftPreBuild transform, Copy graft's rename, the post-build file fetch.
scripts/main.mjs     hooks only.
```

Tests: `node --test 'test/*.test.mjs'`
