# Fyso Teams — Architecture

## How FysoTeamsScene relates to the rest of VerbEngine

VerbEngine's normal runtime runs `MenuScene` → `AdventureScene`, consuming `.verb` DSL files through `VerbParser`. `FysoTeamsScene` is a completely separate branch that shares only the Phaser dependency and the `BubbleText` engine helper.

```
verbengine/
├── src/
│   ├── scenes/
│   │   ├── AdventureScene.ts     # normal adventure runtime
│   │   ├── FysoTeamsScene.ts     # team visualisation scene (standalone)
│   │   └── iso-math.ts           # shared coordinate utilities
│   ├── engine/
│   │   └── BubbleText.ts         # shared speech bubble primitive
│   ├── api/
│   │   ├── createFysoGame.ts     # factory — mounts a game with only FysoTeamsScene
│   │   └── FysoSceneBridge.ts    # public control surface
│   └── types/
│       └── fyso-teams.ts         # AgentDef, AgentStatus, FysoGameOptions
```

`createFysoGame` registers only `FysoTeamsScene`. No DSL parsing, no adventure logic, no inventory system is loaded. The two runtimes can coexist in the same page by running in separate Phaser game instances, each in its own container element.

---

## Coordinate system

The scene uses a standard 2:1 isometric projection. Internally there are two coordinate spaces:

### Grid space

Integer `(col, row)` pairs. Column 0, row 0 is the top corner of the diamond map. Columns increase to the right-bottom, rows increase to the left-bottom (when viewed on screen).

Map data is stored as `number[row][col]`.

### Screen space

Pixel coordinates in world space (before camera transforms). The origin `(0, 0)` in world space corresponds to grid `(0, 0)`.

Conversion formulas (from `iso-math.ts`):

```
screenX = (col - row) * (tileWidth  / 2)
screenY = (col + row) * (tileHeight / 2)
```

Inverse (screen to grid, returning fractional values):

```
col = (screenX / halfW + screenY / halfH) / 2
row = (screenY / halfH - screenX / halfW) / 2
```

Base tile dimensions before zoom: 32px wide, 16px tall (2:1 ratio). At the default zoom of `2` the rendered tile is 64x32 px.

Character sprites are positioned with `origin(0.5, 1.0)` (horizontally centred, bottom-anchored) and offset downward by half a tile height so they stand at the front edge of the tile diamond.

Depth sorting is painter's algorithm: `depth = row + col`. Decorations and agents add fractional offsets (`+0.5`, `+0.8`, `+0.9`, `+1.0`) to ensure consistent draw order within a cell.

---

## Agent lifecycle

```
spawnAgent()
    |
    v
[sprite + label + badge created at gridX, gridY]
    |
    +--- setAgentStatus()  → redraws badge colour, status persists in AgentState
    |
    +--- showAgentMessage()
    |       |
    |       +→ status = 'talking' (temporary, reverts after duration)
    |       +→ BubbleText.showNamedBubble()
    |
    +--- moveAgent()
    |       |
    |       +→ status = 'walking'
    |       +→ EasyStar.findPath() (async, resolved in update loop)
    |       +→ moveAgentAlongPath() (recursive tween chain)
    |       +→ on arrival: status = 'idle'
    |
    +--- focusAgent()  → camera.startFollow(sprite)
    |
    v
removeAgent()
    |
    +→ stop activeTween
    +→ destroy sprite, label, badge
    +→ delete from agents Map
```

`AgentState` is the internal record stored in `FysoTeamsScene.agents: Map<string, AgentState>`. It holds the current grid position, the Phaser game objects, the active tween reference, and the current status. `FysoSceneBridge` never caches this data; every call resolves the scene and reads from `AgentState` directly.

---

## Pathfinding (EasyStar)

`EasyStar.js` is configured once in `create()`:

- Grid: the full `mapData` array.
- Acceptable (walkable) tiles: `0` (floor) and `4` (chair).
- Diagonal movement: enabled.
- Corner cutting: enabled.

Path calculation is asynchronous and is driven by calling `this.easystar.calculate()` in the scene's `update()` loop. This spreads computation across frames and avoids frame drops on large maps.

`moveAgent` rejects a move request silently if the agent `isMoving` is true. There is no move queue; the caller is responsible for sequencing moves.

Movement along the computed path is a recursive tween chain (`moveAgentAlongPath`). Each step tweens the sprite (and its label and badge) from one grid position to the next over `(1 / 2.5) * 1000 = 400 ms`. On each frame of the tween, screen positions are rounded to integers to preserve pixel-art alignment.

Direction is derived from `(dx, dy)` between consecutive path steps:

| dx | dy | Direction |
|----|----|-----------|
| +  | +  | south |
| -  | -  | north |
| +  | -  | east |
| -  | +  | west |
| +  | 0  | east |
| -  | 0  | west |
| 0  | +  | south |
| 0  | -  | north |

West-facing animation reuses the east spritesheet row with `setFlipX(true)`.

---

## Rendering pipeline

Each frame Phaser renders game objects sorted by their `depth` value. The rendering pipeline for a single frame:

```
1. Map tiles — pass 1 (floors and walls)
   depth = row + col
   Wall overlay drawn at depth + 0.3

2. Map tiles — pass 2 (decorations: desks, plants, etc.)
   depth = row + col + 0.5

3. Agent sprites
   depth = row + col + 0.8

4. Agent name labels (Text)
   depth = row + col + 0.9

5. Agent status badges (Graphics circle)
   depth = row + col + 1.0

6. Speech bubbles (BubbleText — rendered as Text + Graphics)
   not depth-sorted; always rendered on top
```

Tile images use `setScale(nanoScale)` where `nanoScale = tileWidth / 711`. The source tiles are 711px wide; this scale factor fits them exactly to the zoomed tile diamond.

Character sprites use `setScale(zoom)` where `zoom` is the value from `FysoGameOptions`.

---

## Input isolation model

The scene sets up two input handlers in `setupInput()`:

- **Keyboard** (`ArrowLeft/Right/Up/Down`, `WASD`): pans the camera by `10 / zoom` pixels per keydown event. Calls `camera.stopFollow()` so manual pan breaks out of `focusAgent`.
- **Right-click drag** (`pointer.buttons === 2`): pans by pointer velocity divided by zoom.
- **Mouse wheel**: zooms the camera between `0.3` and `3.0` using `Phaser.Math.Clamp`.

`enableInput()` / `disableInput()` toggle `this.input.enabled` and `this.input.keyboard.enabled`. This does not affect Phaser's internal scene lifecycle — only pointer and keyboard events on this scene are suppressed.

---

## How to extend

### Custom map

Pass a `mapData` 2D array in `FysoGameOptions`. The array must be rectangular (all rows the same length). Only values `0` and `4` are walkable; all other values block pathfinding.

```ts
const { bridge } = createFysoGame(container, {
  mapData: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
});
```

If you add new tile type integers (e.g., `8`, `9`) they will render as floor tiles (no wall overlay, no decoration) because `drawMap` only has explicit branches for types `1`–`7`. To add new tile visuals, subclass or modify `FysoTeamsScene.drawMap`.

### Custom sprites

Pass the spritesheet key you preloaded in the host application:

```ts
// Preload in your own code before calling createFysoGame,
// or add a preload hook to FysoTeamsScene.
this.load.spritesheet('my-char', '/assets/my-char.png', {
  frameWidth: 16,
  frameHeight: 32,
});

bridge.spawnAgent({
  id: 'custom',
  name: 'Custom',
  sprite: 'my-char',   // must match the key used in load.spritesheet
  gridX: 5,
  gridY: 5,
});
```

The animation system expects the spritesheet to follow the same layout as the built-in characters: 7 columns x 3 rows, 16x32 px per frame, with south facing on row 0, north on row 1, and east on row 2. If your spritesheet differs, override `createCharacterAnimations` in a subclass.

### Extending FysoSceneBridge

`FysoSceneBridge` is not sealed. Add methods by extending the class and calling `this.getScene()` (currently private) — you will need to expose it or duplicate the accessor pattern:

```ts
class MyBridge extends FysoSceneBridge {
  highlightTile(col: number, row: number): void {
    // Access scene via the game reference you pass to super()
    const scene = (this as any).game.scene.getScene('FysoTeamsScene');
    // ... add a Graphics overlay
  }
}
```

For production use, the cleaner approach is to add the method to `FysoTeamsScene` and a corresponding delegation method to `FysoSceneBridge`, following the existing pattern.
