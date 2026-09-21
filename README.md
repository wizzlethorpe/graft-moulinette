# Graft: Moulinette

[![tests](https://github.com/wizzlethorpe/graft-moulinette/actions/workflows/test.yml/badge.svg)](https://github.com/wizzlethorpe/graft-moulinette/actions/workflows/test.yml)
[![license](https://img.shields.io/github/license/wizzlethorpe/graft-moulinette)](LICENSE)
[![release](https://img.shields.io/github/v/release/wizzlethorpe/graft-moulinette?display_name=tag&sort=semver)](https://github.com/wizzlethorpe/graft-moulinette/releases/latest)
[![foundry](https://img.shields.io/endpoint?url=https://foundryshields.com/version?url=https://github.com/wizzlethorpe/graft-moulinette/releases/latest/download/module.json&style=flat)](https://foundryvtt.com/packages/graft-moulinette)

Makes [Moulinette](https://www.moulinette.cloud/) content usable in a [graft](https://github.com/wizzlethorpe/graft). A graft lists the scenes, maps, tiles and tracks it needs by Moulinette pack and path, and when a reader builds it, the files come from the reader's own Moulinette subscription. The graft itself never contains the publisher's content.

To install, search for **Graft** in Foundry's *Install Module* dialog. Needs Moulinette and graft 0.14.0 or later.

> [!IMPORTANT]
> **Enable this module before you import.** It records where a document came from at the moment Moulinette hands it over. Documents imported before that have no recorded source, so **Copy graft** on them copies the whole document, walls and lights included. The source cannot be recovered from disk afterwards, because Moulinette saves a document's images and audio but never the document itself. For a document you imported earlier, use `api.import` below.

## What a graft lists

This module is a graft asset handler. A graft lists each Moulinette file it needs under `assets.moulinette`, as a `source` and a `destination`, and this module puts each one there before anything builds. The entries name the destinations, which are ordinary paths.

```json
{
  "format": 4,
  "assets": {
    "moulinette": { "files": [
      { "source": "10698/json/scene/mad-lair.json", "destination": "graft/moulinette/10698/json/scene/mad-lair.json" },
      { "source": "10698/audio/drip.ogg", "destination": "graft/moulinette/10698/audio/drip.ogg" }
    ] }
  },
  "entries": [
    {
      "id": "mySewerLair00001",
      "type": "Scene",
      "source": "graft/moulinette/10698/json/scene/mad-lair.json",
      "patch": {
        "name": "The Sewer Lair",
        "sounds": [{ "_id": "drip000000000001", "path": "graft/moulinette/10698/audio/drip.ogg", "x": 900, "y": 1200, "radius": 20 }]
      }
    }
  ]
}
```

A `source` is the pack number and the path inside that pack, which are the two things the asset's marketplace page shows you. A `destination` is any path in the Foundry data folder. A `.json` asset is a document, its destination ends `.json` too, and an entry names that destination as its `source`. Anything else is a file, and a patch names its destination wherever a path would go: a scene's background, a tile's texture, a sound's path.

## Authoring

Import through Moulinette as you always have. When the document lands in your world, this module keeps an untouched copy of it as a file under `graft/moulinette/<pack>/` and tells graft that file is the document's source. Edit the world copy, drop in whatever Moulinette tiles and sounds you like, and press **Copy graft**.

Graft diffs your version against the file, so the entry holds your changes and none of the creator's work. This module adds the `assets.moulinette` block to what is copied. It lists the document, and every file under your Moulinette folder that your changes name, each with the file the entry's path loads as its destination. What you paste fetches everything it needs on a reader's machine.

A file under your Moulinette folder that matches nothing in your Moulinette index is left out of the block, and a warning names it. Copying a graft that names Moulinette files needs you signed in to Moulinette, since only its index says which asset a file is.

Moulinette never says which world document came from which download, so this module matches them itself: it remembers the last document Moulinette downloaded and takes the next one to appear in your world with the same name and type to be it.

**This module only adopts documents that arrive while it is enabled.** For a document imported before then, `api.import` fetches the asset afresh, writes the file, and records it as that document's source. It takes the pack number and path the marketplace page shows. Without a `document` it only rewrites the file, which is what you want when a creator republishes a pack.

```js
await game.modules.get("graft-moulinette").api.import({ pack: 10698, path: "json/scene/mad-lair.json", document: game.scenes.getName("Mad Lair") })
// "graft/moulinette/10698/json/scene/mad-lair.json"
```

## Building

Before a build, graft hands this module the `assets.moulinette` block. Each source is looked up in the reader's own Moulinette index. A document is downloaded by Moulinette, which also fetches the images and audio the document itself uses, and its JSON is written to the destination. Any other file is downloaded from the link Moulinette signs for the reader's account and written to the destination.

A file already at its destination is not fetched again unless the reader asks graft to fetch everything. A file that is not in the reader's index is reported as skipped. Moulinette's index holds only what its server lets the session reach, so a world where Moulinette is not linked to the reader's Patreon finds nothing but free content. An entry whose source never arrived is skipped by graft, and a missing image or track shows as missing in Foundry.

Only a Moulinette *Scene*, *Journal Entry*, *Playlist* or *Macro* is adopted on import. A Moulinette *Map* is a bare image: list it as a file, and compose the scene around it in your own entry.

## Limits

- **Storage on a bucket.** A world whose Foundry stores on S3 names its files by URL. This module checks and writes on the data storage only, and does not list a URL.
- **Paths inside markup**, such as an `<img>` in a journal page, are not listed. Only a value that is a path by itself is.
- **ScenePacker packs and private cloud content** are not in the asset index, so they cannot be listed.
- **A file the reader also has through Moulinette** is stored a second time when its destination is somewhere other than Moulinette's own folder.

## Support

Graft: Moulinette is free and open source, from Wizzlethorpe Labs. If it is useful to you, [support us on Patreon](https://www.patreon.com/wizzlethorpe). More free tools and content at [wizzlethorpe.com](https://wizzlethorpe.com).

## Layout

```
scripts/files.mjs    how the assets block names a file, and where a document's JSON is kept. Pure.
scripts/paths.mjs    recognising a path under Moulinette's folder and matching it to an asset. Pure.
scripts/index.mjs    everything that touches Moulinette: its index, its downloads, the wrap that watches them.
scripts/author.mjs   adopting what Moulinette imports.
scripts/handler.mjs  the asset handler: place for a build, collect for Copy graft.
scripts/main.mjs     hooks only.
```

Tests: `node --test 'test/*.test.mjs'`
