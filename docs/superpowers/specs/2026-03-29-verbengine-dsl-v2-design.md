# VerbEngine DSL v2 — Isometric World Adventure

## Overview

Replace Ink-based conversational flow with a spatial DSL designed for isometric point-and-click adventures. The player explores a world by walking, clicking objects, talking to NPCs, and solving puzzles — not by choosing text options.

## DSL Syntax

```
adventure "The Missing USB" {
  start: oficina

  items {
    usb_drive {
      name: "USB Drive"
      description: "A small black USB drive with a red sticker"
    }
    coffee_cup {
      name: "Coffee Cup"
      description: "A warm cup of coffee"
    }
    server_key {
      name: "Server Room Key"
      description: "A metallic key card"
    }
  }

  scene oficina {
    map: "office_main"

    hotspot escritorio_ana [4, 3] {
      look: "A messy desk with papers everywhere."
      use: "Nothing useful here... just papers."
      use(server_key): "You plug the key card into the reader. Access granted!"
    }

    hotspot cafetera [10, 11] {
      look: "A coffee machine. There's something behind it..."
      take: -> get(usb_drive) "You grab the USB drive hidden behind the machine!"
    }

    hotspot puerta_server [23, 12] {
      look: "A heavy door with a key card reader."
      use: "It's locked. You need a key card."
      use(server_key): -> go(server_room) "The door slides open."
    }

    character ana [5, 3] {
      sprite: "char_1"
      look: "Ana, the senior developer. She looks stressed."
      talk: "Hey! Have you seen the USB drive? I left it somewhere around here..."
      talk(has usb_drive): "You found it! Great. Now we need to get into the server room. Talk to Carlos, he has the key."
    }

    character carlos [14, 17] {
      sprite: "char_2"
      look: "Carlos, the sysadmin. Always with his coffee."
      talk: "I'm busy. Come back later."
      talk(has usb_drive): "Oh, you found the USB? Here, take the server key." -> get(server_key)
    }

    exit pasillo_norte [12, 0] {
      target: pasillo
      look: "A corridor leading north."
    }
  }

  scene pasillo {
    map: "corridor"

    exit oficina_sur [12, 24] {
      target: oficina
      look: "Back to the main office."
    }

    exit server_room_este [24, 12] {
      target: server_room
      requires: server_key
      look: "The server room entrance."
      locked: "You need a key card to enter."
    }
  }

  scene server_room {
    map: "server"

    hotspot servidor_principal [12, 12] {
      look: "The main server rack. There's a USB port."
      use(usb_drive): -> win "You insert the USB and deploy the fix. The servers come back online!"
    }
  }
}
```

## DSL Elements

### `adventure`
- `start`: initial scene ID
- Contains: `items`, `scene` blocks

### `items`
- Global item definitions with name and description
- Referenced by ID in interactions

### `scene`
- `map`: references an isometric tilemap definition (separate file or inline)
- Contains: `hotspot`, `character`, `exit` blocks

### `hotspot [x, y]`
- Interactive object at a grid position
- `look`: text shown when player examines it
- `use`: default interaction text
- `use(item)`: interaction when using a specific item
- `take`: picks up an item (`-> get(item_id)`)
- Actions: `-> get(item)`, `-> go(scene)`, `-> win`, `-> remove(hotspot_id)`

### `character [x, y]`
- NPC at a grid position with sprite
- `sprite`: which character sprite to use
- `look`: examination text
- `talk`: dialogue text
- `talk(has item)`: conditional dialogue when player has an item
- Can trigger actions: `-> get(item)`, `-> go(scene)`

### `exit [x, y]`
- Scene transition point
- `target`: scene ID to go to
- `requires`: item needed (optional)
- `locked`: text shown when requirement not met
- `look`: examination text

### State

Simple global state:
- `inventory`: list of item IDs the player has
- `flags`: set of boolean flags (e.g., `talked_to_ana`)
- Conditions: `has item_id`, `flag flag_name`

### Actions
- `-> get(item)` — add item to inventory
- `-> remove(item)` — remove item from inventory
- `-> go(scene)` — transition to another scene
- `-> win` — end the adventure (victory)
- `-> set(flag)` — set a boolean flag
- `-> remove_hotspot(id)` — remove a hotspot from the scene (e.g., after picking up)

## Interaction Model

Player clicks on the world:
1. **Click walkable tile** → character walks there
2. **Click hotspot** → walk to adjacent tile, then show `look` text
3. **Click character** → walk to adjacent tile, then show `talk` text
4. **Click exit** → walk there, transition scene (if requirements met)
5. **Click hotspot with inventory item selected** → walk there, trigger `use(item)`

Text appears in a floating bubble above the interaction point, not in a panel.

## Architecture

```
[DSL File (.verb)] → [Parser] → [Adventure State Machine]
                                        ↓
                                [IsoScene Renderer]
                                        ↓
                                [Playable World]
```

### Components
1. **DSL Parser** — parses `.verb` files into Adventure JSON
2. **Adventure State Machine** — manages inventory, flags, scene transitions, conditions
3. **Iso Renderer** — existing IsoScene with tilemap, character, pathfinding
4. **Interaction Handler** — click detection, walk-to, trigger actions, show text

### File Format
- `.verb` files for adventure definitions
- Tilemap definitions as JSON (map grid data per scene)
- Or: maps embedded in DSL

## Integration with Existing Code

Keep:
- IsoScene (tilemap, pathfinding, camera, zoom, NPCs)
- Nanobanana tiles
- Character sprites from fyso_world

Remove:
- Ink/inkjs dependency
- InkEngine
- DialoguePanel (replaced by floating bubbles)
- Old GameScene, BootScene adventure loading

Add:
- VerbParser (DSL → JSON)
- AdventureEngine (state machine)
- InteractionHandler (click → action)
- BubbleText (floating text above objects)
