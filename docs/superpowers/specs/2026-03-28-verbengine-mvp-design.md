# VerbEngine MVP (v0.1.0) — Design Spec

## Overview

VerbEngine is an open-source, AI-powered point-and-click adventure engine inspired by LucasArts classics. It lets users generate playable graphic adventures from a text prompt.

The system combines three pillars:
1. **Ink DSL** — narrative scripting language for defining adventures
2. **Phaser 3 Web Player** — browser-based point-and-click gameplay
3. **Fyso Backend** — stores adventures, exposes API, orchestrates LLM generation

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User Prompt │────▶│  Fyso Backend     │────▶│  Ink DSL +      │
│  (text)      │     │  (Entities + AI)  │     │  Scene Metadata │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  Phaser 3 Player │
                                              │  (SPA, no SSR)   │
                                              └─────────────────┘
```

### Components

#### 1. Backend (Fyso)

Fyso replaces a custom Python backend entirely. No server to deploy or maintain.

**Fyso Entity: `Adventure`**

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid (auto) | Unique adventure ID |
| `title` | text | Adventure title |
| `prompt` | text | Original user prompt |
| `scenes_count` | number | Requested number of scenes |
| `ink_script` | text (long) | Generated Ink script |
| `scene_metadata` | json | Scene layout metadata for Phaser |
| `status` | enum | `generating`, `ready`, `error` |
| `created_at` | datetime (auto) | Creation timestamp |

**Fyso Channel (API):**

| Operation | Description |
|-----------|-------------|
| `create_adventure` | Receive prompt, trigger AI generation, store result |
| `get_adventure` | Return adventure by ID (ink_script + scene_metadata) |
| `list_adventures` | List all generated adventures |

**Fyso AI Rule:**
- Triggered on `create_adventure`
- Sets `status = "generating"`
- Sends LLM prompt with adventure generation instructions
- Parses response into `ink_script` + `scene_metadata`
- Validates output structure
- Sets `status = "ready"` (or `"error"` on failure)

**Why Fyso:**
- No Python, no server, no deployment — Fyso handles persistence, API, and AI
- Frontend is a pure SPA that talks to Fyso's API
- Single language across the project (TypeScript only)
- Built-in persistence — no in-memory hacks

#### 2. Ink DSL (Adventure Definition)

We use standard Ink syntax with a metadata convention for scene definitions. The LLM generates two outputs:

**a) Ink script** — handles narrative flow, choices, variables, inventory:

```ink
VAR has_rope = false
VAR has_key = false

-> beach

=== beach ===
You stand on a sandy beach. A wrecked ship leans against the rocks. Palm trees sway in the wind.

+ [Look at the ship] -> beach_ship
+ [Look at the palm trees] -> beach_palms
+ {has_key} [Go north to the cave] -> cave
+ [Go east to the village] -> village

= beach_ship
The ship's hull is cracked open. Inside you spot a coil of rope.
+ [Take the rope]
  ~ has_rope = true
  You grab the rope. Could be useful.
  -> beach
+ [Leave it] -> beach

= beach_palms
Tall palm trees with coconuts. Nothing special, but the shade is nice.
-> beach

=== cave ===
A dark cave. Water drips from the ceiling. You see a chest in the corner.

+ [Look at the chest] -> cave_chest
+ [Go south to the beach] -> beach

= cave_chest
{has_rope:
  You tie the rope to the chest and pull it open. Gold coins spill everywhere! You've found Blackbeard's treasure!
  -> END
- else:
  The chest is wedged tight. You need something to pull it open.
  -> cave
}

=== village ===
A small fishing village. An old sailor sits on a barrel, muttering to himself.

+ [Talk to the sailor] -> village_sailor
+ [Go west to the beach] -> beach

= village_sailor
"Arrr, looking for the cave, are ye? You'll need the key. I dropped it somewhere on the beach... near the ship, I think."
~ has_key = true
-> village
```

**b) Scene metadata JSON** — describes visual layout for Phaser:

```json
{
  "scenes": {
    "beach": {
      "description": "A sandy beach with palm trees and a wrecked ship",
      "background_color": "#c2b280",
      "hotspots": [
        {
          "id": "ship",
          "label": "Ship",
          "x": 0.6,
          "y": 0.4,
          "width": 0.25,
          "height": 0.3,
          "ink_target": "beach_ship"
        },
        {
          "id": "palms",
          "label": "Palm Trees",
          "x": 0.15,
          "y": 0.3,
          "width": 0.15,
          "height": 0.4,
          "ink_target": "beach_palms"
        }
      ],
      "characters": [],
      "exits": [
        {"direction": "north", "target_scene": "cave", "requires": "has_key", "x": 0.5, "y": 0.05},
        {"direction": "east", "target_scene": "village", "x": 0.95, "y": 0.5}
      ]
    },
    "cave": {
      "description": "A dark cave with dripping water and a treasure chest",
      "background_color": "#2d2d2d",
      "hotspots": [
        {
          "id": "chest",
          "label": "Chest",
          "x": 0.7,
          "y": 0.6,
          "width": 0.15,
          "height": 0.15,
          "ink_target": "cave_chest"
        }
      ],
      "characters": [],
      "exits": [
        {"direction": "south", "target_scene": "beach", "x": 0.5, "y": 0.95}
      ]
    },
    "village": {
      "description": "A small fishing village with an old sailor",
      "background_color": "#8fbc8f",
      "hotspots": [],
      "characters": [
        {
          "id": "sailor",
          "label": "Old Sailor",
          "x": 0.4,
          "y": 0.5,
          "ink_target": "village_sailor"
        }
      ],
      "exits": [
        {"direction": "west", "target_scene": "beach", "x": 0.05, "y": 0.5}
      ]
    }
  }
}
```

**Why two outputs instead of one?**
- Ink handles narrative logic (branching, variables, state) — it's proven and well-tooled
- Scene metadata handles spatial/visual layout — concerns Ink was never designed for
- They reference each other via `ink_target` links
- Each can be edited independently

#### 3. Frontend (Phaser 3 SPA)

**Pure SPA — no SSR, no server-side rendering.** Static files served from any CDN or static host.

**Responsibilities:**
- Load adventure from Fyso API (Ink script + scene metadata)
- Render current scene: background color, hotspot zones, character markers, exit indicators
- Handle user interaction: left-click to interact, right-click to look
- Display dialogue/text in a bottom panel (LucasArts style)
- Manage inventory bar at the top
- Navigate between scenes via exits
- Drive Ink story forward based on user choices

**UI Layout (MVP):**
```
┌──────────────────────────────────────┐
│  [rope] [key]          INVENTORY BAR │
├──────────────────────────────────────┤
│                                      │
│         SCENE AREA                   │
│                                      │
│    [hotspot]    [character]          │
│                                      │
│              [exit ↑]                │
│                                      │
├──────────────────────────────────────┤
│  Text/dialogue appears here          │
│  > Choice 1                          │
│  > Choice 2                          │
└──────────────────────────────────────┘
```

**Visual style (MVP):**
- Background: solid color per scene (from `background_color`)
- Hotspots: labeled rectangles with subtle border, highlight on hover
- Characters: labeled circles or simple shapes, distinct color
- Exits: arrow indicators at screen edges
- Text panel: dark background, light monospace text, LucasArts style
- Inventory: icon slots at top (text labels in MVP, icons in v2)
- Resolution: 960x600 canvas (3x scale of 320x200 aesthetic)

**Interaction model:**
- Left-click on hotspot/character → triggers default action (use/talk)
- Right-click on hotspot/character → triggers "look" action
- Left-click on exit → navigate to connected scene (if requirements met)
- Click inventory item + click hotspot → "use item with" action
- Hover → highlight element + show label

**Ink integration:**
- Use `inkjs` (JavaScript Ink runtime) in the browser
- On scene load: navigate Ink story to the current scene's knot
- On hotspot click: follow the Ink choice that matches `ink_target`
- Display Ink text output in the dialogue panel
- When Ink presents choices: show them as clickable options in the panel
- Track Ink variables for inventory state and gate conditions

**Hosting:**
- Static build output (Vite → `dist/`) deployed to any static host
- No Node.js runtime needed in production
- Candidates: GitHub Pages, Vercel (static), Netlify, Cloudflare Pages

## Data Flow

```
1. User types prompt in SPA → calls Fyso channel `create_adventure`
2. Fyso AI rule triggers → builds LLM prompt → calls AI API
3. LLM returns Ink script + scene metadata JSON
4. Fyso validates, stores in Adventure entity, sets status = "ready"
5. Frontend polls/fetches adventure by ID from Fyso
6. Frontend initializes inkjs with Ink script
7. Frontend renders first scene from metadata
8. User clicks hotspot → Ink story advances → UI updates
9. Loop until Ink reaches -> END
```

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | TypeScript, Phaser 3, Vite, inkjs | SPA, no SSR |
| Backend | Fyso | Entities, channels, AI rules |
| Package manager | pnpm | Frontend only |
| Hosting | Static (GitHub Pages / Vercel / Netlify) | No server |

## File Structure (MVP)

```
verbengine/
├── src/
│   ├── main.ts              # Entry point, Phaser config
│   ├── scenes/
│   │   ├── BootScene.ts     # Load adventure data from Fyso
│   │   ├── MenuScene.ts     # Prompt input + adventure list
│   │   └── GameScene.ts     # Main gameplay scene
│   ├── engine/
│   │   ├── InkEngine.ts     # inkjs wrapper
│   │   ├── SceneRenderer.ts # Render hotspots, characters, exits
│   │   ├── DialoguePanel.ts # Text/choices display
│   │   └── InventoryBar.ts  # Inventory UI
│   ├── api/
│   │   └── fyso.ts          # Fyso API client
│   └── types/
│       └── adventure.ts     # TypeScript interfaces
├── dsl/
│   └── examples/
│       └── pirate-adventure/
│           ├── story.ink
│           └── metadata.json
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-03-28-verbengine-mvp-design.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CLAUDE.md
├── LICENSE
└── README.md
```

Note: no `frontend/` + `backend/` split needed. The entire repo is the SPA. Fyso is configured externally.

## Error Handling (MVP)

- **Fyso AI fails**: frontend shows error state with retry button
- **Invalid Ink generated**: Fyso AI rule validates before storing; if invalid, retries LLM once with error context, then sets `status = "error"`
- **Missing ink_target**: frontend shows "Nothing happens." fallback text
- **Locked exit**: frontend shows "You need [item] to go there." message
- **Network error**: frontend shows offline/retry state

## Out of Scope (v0.2.0+)

- AI-generated pixel art backgrounds and sprites
- Runtime dynamic dialogues with LLM (characters respond to free text)
- Visual adventure editor (drag & drop scenes, hotspots)
- Audio and music
- Character walking animations and pathfinding
- Save/load game state
- Multiplayer or shared adventures
- Adventure marketplace / sharing platform
- Mobile-optimized controls

## Success Criteria (MVP)

1. User can submit a prompt and receive a playable adventure
2. Adventure has at least 3 interconnected scenes
3. Player can navigate scenes, interact with hotspots, talk to characters
4. Inventory system works (pick up items, use items on hotspots)
5. Adventure has a win condition (reaches -> END)
6. Entire flow works in a modern browser without installation
7. No server to deploy — Fyso handles backend, frontend is static SPA
