# VerbEngine

AI-powered point-and-click adventure engine inspired by LucasArts classics.

VerbEngine combines a custom **DSL v2** scripting language (`.verb` files) with **Phaser 3** to create and play isometric point-and-click graphic adventures entirely in the browser.

## Features

- **VerbEngine DSL v2** -- declarative `.verb` files define scenes, hotspots, characters, dialogue, inventory, exits, and win conditions
- **Isometric renderer** -- Phaser 3 isometric tile-based rendering with pathfinding (EasyStar)
- **Walk-to-interact** -- click a hotspot, character, or exit and the player walks there before interacting
- **Conditional interactions** -- dialogue and actions change based on inventory items and flags
- **Inventory system** -- pick up, use, and combine items
- **Debug mode** -- in-game overlay activated by the Konami Code that shows live engine state (scene, inventory, flags, interactions)

## Quick Start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser.

## DSL Example

```
adventure "The Missing USB" {
  start: oficina

  items {
    usb_drive {
      name: "USB Drive"
      description: "A small black USB drive with a red sticker"
    }
  }

  scene oficina {
    map: "maps/oficina.json"

    hotspot cafetera [10, 11] {
      look: "A coffee machine. There's something behind it..."
      take: -> get(usb_drive) "You grab the USB drive!"
    }

    character ana [5, 3] {
      sprite: "char_1"
      look: "Ana, the senior developer."
      talk: "Hey! Have you seen the USB drive?"
      talk(has usb_drive): "You found it! Great."
    }

    exit pasillo_norte [7, 0] {
      target: pasillo
      look: "A corridor leading north."
    }
  }
}
```

See `dsl/examples/` for complete adventures.

## Debug Mode

Enter the **Konami Code** during gameplay to toggle the debug panel:

**Up Up Down Down Left Right Left Right B A**

The panel shows:
- Current scene with hotspots, characters, and exits
- Inventory items
- Active flags
- Removed hotspots
- Last interaction details (verb, target, conditions, actions)

## Architecture

```
.verb file --> VerbParser --> AdventureEngine --> Phaser 3 (AdventureScene)
```

| Layer | Responsibility |
|---|---|
| `VerbParser` | Tokenizer + recursive descent parser, produces `AdventureData` |
| `AdventureEngine` | State machine: inventory, flags, scene transitions, interaction evaluation |
| `InteractionHandler` | Click detection, walk-to-interact coordination |
| `AdventureScene` | Phaser scene: isometric rendering, sprites, UI, input |
| `DebugPanel` | Live state overlay, subscribes to engine events |
| `KonamiListener` | Keyboard sequence detector for debug toggle |

## Project Structure

```
verbengine/
  src/
    engine/          # VerbParser, AdventureEngine, DebugPanel, KonamiListener
    scenes/          # Phaser scenes (AdventureScene, MenuScene, IsoScene)
    types/           # TypeScript interfaces (adventure-v2.ts)
  dsl/examples/      # .verb adventure files
  public/assets/     # Tiles, characters, maps
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm test` | Run tests (Vitest) |
| `pnpm preview` | Preview production build |

## Tech Stack

- **TypeScript** (strict mode)
- **Phaser 3** -- 2D game engine
- **Vite** -- build tool
- **Vitest** -- testing
- **EasyStar.js** -- pathfinding

## License

MIT
