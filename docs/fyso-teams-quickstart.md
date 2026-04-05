# Fyso Teams — Quick Start

FysoSceneBridge is a thin control layer over a self-contained Phaser 3 isometric scene designed to visualise teams of agents in a shared office space. You give it a DOM container, and it gives you back a bridge to spawn, move, and talk to agents programmatically.

## Installation

The integration ships as part of VerbEngine. Import directly from the package entry point:

```ts
import { createFysoGame } from 'verbengine/src/api';
// or from the compiled bundle
import { createFysoGame } from '@verbengine/fyso-teams';
```

Peer dependency: `phaser >= 3.60`.

## Minimal working example

```html
<!-- index.html -->
<div id="game" style="width: 800px; height: 600px;"></div>
```

```ts
import { createFysoGame } from 'verbengine/src/api';

// 1. Mount the game into a container element.
const container = document.getElementById('game')!;
const { bridge } = createFysoGame(container, { zoom: 2 });

// 2. Spawn an agent at grid position (5, 5).
//    The scene must be ready before calling bridge methods.
//    Phaser fires 'ready' on the game object once all scenes are initialised.
bridge.spawnAgent({
  id: 'alice',
  name: 'Alice',
  sprite: 'char_0',
  gridX: 5,
  gridY: 5,
  status: 'idle',
  hueShift: 120,      // optional: recolor the sprite via hue rotation
});

// 3. Move the agent to another tile via pathfinding.
bridge.moveAgent('alice', 12, 8);

// 4. Show a speech bubble for 4 seconds.
bridge.showAgentMessage('alice', 'Hello, office!', 4000);

// 5. Let the agent wander automatically around nearby walkable tiles.
//    Setting the status to 'wander' enables the automatic loop; any other
//    behavior status (idle/working/done) stops it.
bridge.setAgentStatus('alice', 'wander');
```

The built-in 25x25 office map loads automatically. Four character spritesheets (`char_0`–`char_3`) are included. No extra configuration is required for a local dev server that serves assets from `/assets/`.

## What happens at startup

1. `createFysoGame` instantiates a Phaser game with `FysoTeamsScene` as the only registered scene.
2. On the `READY` event the scene starts and receives the options you passed.
3. The scene preloads tiles and character spritesheets, draws the map, and initialises EasyStar pathfinding.
4. Control returns to you through `FysoSceneBridge` — all subsequent calls go through the bridge.
