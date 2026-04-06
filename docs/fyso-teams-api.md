# Fyso Teams — API Reference

## `createFysoGame(container, options?)`

Factory function. Creates a Phaser game mounted inside `container` and returns a bridge for programmatic control. Only `FysoTeamsScene` is registered — no menu or adventure scenes are loaded.

```ts
function createFysoGame(
  container: HTMLElement,
  options?: FysoGameOptions,
): { game: Phaser.Game; bridge: FysoSceneBridge }
```

### Parameters

| Parameter   | Type             | Description |
|-------------|------------------|-------------|
| `container` | `HTMLElement`    | DOM element that will host the Phaser canvas. Phaser uses this as the `parent` in its config. |
| `options`   | `FysoGameOptions` (optional) | Game configuration. All fields are optional; omitting the argument uses all defaults. |

### Return value

| Field    | Type               | Description |
|----------|--------------------|-------------|
| `game`   | `Phaser.Game`      | Raw Phaser game instance. Use for low-level access or to listen to Phaser lifecycle events. |
| `bridge` | `FysoSceneBridge`  | Control interface for agents and camera. Prefer this over accessing the scene directly. |

### Behaviour

- Phaser is configured with `Phaser.Scale.RESIZE` — the canvas fills the container automatically.
- Pixel-art rendering is enabled (`pixelArt: true`, `antialias: false`, `roundPixels: true`).
- The scene starts on the `Phaser.Core.Events.READY` event with the provided options passed as init data.

```ts
const container = document.getElementById('game')!;
const { game, bridge } = createFysoGame(container, {
  zoom: 3,
  basePath: '/static',
});
```

---

## `FysoGameOptions`

Configuration object passed to `createFysoGame`.

```ts
interface FysoGameOptions {
  zoom?: number;
  basePath?: string;
  mapData?: number[][];
}
```

| Field      | Type         | Default | Description |
|------------|--------------|---------|-------------|
| `zoom`     | `number`     | `2`     | Initial camera zoom. Affects tile and character pixel sizes. Valid practical range: `1`–`4`. |
| `basePath` | `string`     | `''`    | Prefix prepended to every asset URL. Useful when assets are not served from the root. Example: `'/static'` → loads `/static/assets/tiles/floor_carpet.png`. |
| `mapData`  | `number[][]` | built-in 25x25 office | 2D array of tile type integers. Replaces the default office map entirely. See tile type reference below. |

### Tile type values for `mapData`

| Value | Tile | Notes |
|-------|------|-------|
| `0` | Floor (walkable) | Use this for all pod areas — verbengine places desk + chair internally. |
| `1` | Wall — plain | |
| `2` | Wall — window | |
| `3` | Desk (reserved) | **Do not use in `mapData`.** Verbengine writes this value internally when placing an agent's desk inside a pod. |
| `4` | Chair (walkable) | Walkable. Can appear in `mapData` for decorative chairs outside pods. |
| `5` | Bookshelf | |
| `6` | Plant | |
| `7` | Coffee machine | |

Walkable tiles are `0` (floor) and `4` (chair). All other values block pathfinding. Pod areas **must be floor (`0`)** at spawn time — verbengine handles desk/chair placement.

---

## `PodRect`

Rectangular workspace assigned to an agent. The pod is the agent's private
area: it bounds wander movement and is where verbengine places the agent's
desk and chair automatically.

```ts
interface PodRect {
  x: number;  // top-left column
  y: number;  // top-left row
  w: number;  // width in tiles (min 2)
  h: number;  // height in tiles (min 2)
}
```

**Placement convention.** Verbengine places a desk at the pod's center-top
(`deskX = pod.x + floor(pod.w / 2)`, `deskY = pod.y`) and a chair immediately
south of the desk. The desk becomes non-walkable; the chair remains walkable.
The remaining cells stay free for wander movement.

**Validation.** `spawnAgent` throws if the pod:
- Is smaller than 2×2.
- Falls outside the map bounds.
- Contains any non-floor tile (walls, decorations, etc.).
- Overlaps with another already-spawned agent's pod.

---

## `AgentDef`

Defines an agent at spawn time.

```ts
interface AgentDef {
  id: string;
  name: string;
  sprite: string;
  pod: PodRect;
  status?: AgentStatus;
  hueShift?: number;
}
```

| Field       | Type          | Required | Description |
|-------------|---------------|----------|-------------|
| `id`        | `string`      | Yes | Unique identifier. Used in all subsequent bridge calls. Duplicate IDs throw on `spawnAgent`. |
| `name`      | `string`      | Yes | Display name shown in the label above the agent. |
| `sprite`    | `string`      | Yes | Spritesheet asset key. Built-in values: `'char_0'`, `'char_1'`, `'char_2'`, `'char_3'`. |
| `pod`       | `PodRect`     | Yes | Private workspace for this agent. See `PodRect` above. The agent spawns standing on its chair. |
| `status`    | `AgentStatus` | No | Initial status (both behavior and badge). Defaults to `'idle'`. `'working'` immediately sits the agent at its desk with a laptop; `'wander'` starts automatic bounded wandering inside the pod. |
| `hueShift`  | `number`      | No | Hue rotation in degrees (0–360). Pre-renders a hue-rotated variant of `sprite` to an offscreen canvas (via `ctx.filter = 'hue-rotate(Xdeg)'`) and registers it as a cached Phaser texture. Unlike a flat tint, this preserves luminance and sprite details. Reuse the same value across agents to share the cache. Defaults to `0` (no rotation). |

---

## `AgentStatus`

```ts
type AgentStatus =
  | 'idle'
  | 'wander'
  | 'working'
  | 'talking'
  | 'walking'
  | 'done'
  | 'error';
```

| Value | Kind | Badge colour | Hex |
|-------|------|-------------|-----|
| `'idle'` | behavior | Grey | `#888888` |
| `'wander'` | behavior | Purple | `#9c27b0` |
| `'working'` | behavior | Green | `#4caf50` |
| `'done'` | behavior | Light green | `#8bc34a` |
| `'error'` | behavior | Red | `#f44336` |
| `'walking'` | transient | Orange | `#ff9800` |
| `'talking'` | transient | Blue | `#2196f3` |

The badge is a filled circle rendered above the agent's name label.

**Behavior vs. transient statuses.** The scene distinguishes two kinds of status:

- **Behavior** statuses (`idle`, `wander`, `working`, `done`, `error`) are *persistent* — they represent what the agent is doing and survive movement and dialogue. When you call `setAgentStatus` with one of these, it becomes the agent's "base" status.
- **Transient** statuses (`walking`, `talking`) are set automatically by `moveAgent` / `showAgentMessage` for the duration of the animation. When the movement or dialogue ends, the agent automatically returns to its last behavior status. You can still set them manually via `setAgentStatus`, but they don't change the underlying behavior.

### Automatic wander behavior

Setting an agent's status to `'wander'` (at spawn or via `setAgentStatus`) starts an automatic loop: every 2–6 seconds, if the agent is idle (not walking, not talking), it picks a random walkable tile **inside its pod** and walks there. The loop keeps running until the status changes to anything else, or the agent is removed.

```ts
// Spawn an agent that immediately starts wandering inside its pod
bridge.spawnAgent({
  id: 'alice',
  name: 'Alice',
  sprite: 'char_0',
  pod: { x: 5, y: 5, w: 3, h: 3 },
  status: 'wander',
});

// Stop wandering
bridge.setAgentStatus('alice', 'idle');

// Resume wandering later
bridge.setAgentStatus('alice', 'wander');
```

### Automatic working behavior

Setting an agent's status to `'working'` (at spawn or via `setAgentStatus`) makes the agent walk to its chair, sit down in a typing pose, and displays a laptop sprite on top of its desk. Transitioning out of `'working'` (to `'idle'`, `'wander'`, `'done'`, `'error'`, or via `moveAgent`) stands the agent back up and hides the laptop.

```ts
// Start working — agent walks to its chair and sits with a laptop
bridge.setAgentStatus('alice', 'working');

// Stop working — agent stands up, laptop disappears
bridge.setAgentStatus('alice', 'idle');
```

No bridge method is needed beyond `setAgentStatus` — working and wander are driven entirely by the behavior status.

---

## `FysoSceneBridge`

Thin adapter that proxies calls to `FysoTeamsScene`. The bridge holds no game state. `FysoTeamsScene` is the single source of truth for all agent positions and statuses.

All methods throw `Error('Scene 'FysoTeamsScene' not found.')` if called before the scene is initialised by Phaser.

---

### `spawnAgent(def)`

Adds an agent to the map.

```ts
spawnAgent(def: AgentDef): void
```

Throws if an agent with `def.id` is already present, or if the pod is invalid (see `PodRect` validation rules). Verbengine places a desk + chair inside the pod automatically and spawns the agent standing on the chair, facing south. If `status: 'working'` is passed, the agent sits immediately with a laptop.

```ts
bridge.spawnAgent({
  id: 'bob',
  name: 'Bob',
  sprite: 'char_1',
  pod: { x: 3, y: 4, w: 3, h: 3 },
  status: 'working',
});
```

---

### `removeAgent(id)`

Removes an agent from the map and destroys all of its game objects (sprite, label, badge, desk, chair, and laptop if working). The pod area becomes free again and can be reassigned to another agent.

```ts
removeAgent(id: string): void
```

Safe to call with a non-existent `id` — no error is thrown. Any active movement tween is stopped before destruction.

```ts
bridge.removeAgent('bob');
```

---

### `moveAgent(id, targetX, targetY)`

Moves an agent to the given grid coordinates using EasyStar pathfinding.

```ts
moveAgent(id: string, targetX: number, targetY: number): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Agent identifier. |
| `targetX` | `number` | Target column. |
| `targetY` | `number` | Target row. |

Behaviour:
- Does nothing if the agent is already moving.
- If the agent is seated (status `'working'`), it stands up first (hides the laptop and exits the sit pose).
- Sets the transient status to `'walking'` immediately (badge turns orange).
- On arrival — or if no path is found — status reverts to the agent's last behavior status (`'idle'`, `'wander'`, `'working'`, …), not hardcoded `'idle'`.
- If the agent's base status is `'working'` and it arrives at a tile **other than its chair**, it automatically walks back to its chair and sits down again.
- Movement speed is 2.5 tiles per second.

```ts
bridge.moveAgent('alice', 10, 15);
```

---

### `setAgentStatus(id, status)`

Updates the agent's status and badge colour. For behavior statuses this also drives automatic behaviors:

- `'working'` — agent walks to its chair, sits down in a typing pose, and a laptop sprite appears on its desk. On exit: agent stands up and laptop is hidden.
- `'wander'` — agent starts a bounded random-walk loop inside its pod (every 2–6 s). On exit: loop stops.
- `'idle'`, `'done'`, `'error'` — badge-only, no automatic movement.

```ts
setAgentStatus(id: string, status: AgentStatus): void
```

Does nothing if `id` does not exist.

```ts
bridge.setAgentStatus('alice', 'working');
// Later — stands up, laptop disappears, starts wandering in the pod
bridge.setAgentStatus('alice', 'wander');
```

---

### `showAgentMessage(id, text, duration?)`

Displays a speech bubble above the agent.

```ts
showAgentMessage(id: string, text: string, duration?: number): void
```

| Parameter  | Type     | Default | Description |
|------------|----------|---------|-------------|
| `id`       | `string` | — | Agent identifier. |
| `text`     | `string` | — | Message content displayed in the bubble. |
| `duration` | `number` | `3000`  | Time in milliseconds before the bubble auto-dismisses. |

While the bubble is visible, the agent's status is set to `'talking'`. When the duration elapses, the status reverts to the agent's last behavior status (`'idle'`, `'wander'`, `'working'`, …). If the agent was wandering, it resumes wandering after the bubble closes.

Does nothing if `id` does not exist.

```ts
bridge.showAgentMessage('alice', 'PR is merged!', 5000);
```

---

### `focusAgent(id)`

Pans the camera to follow the given agent with smooth lerp (`0.1` on both axes).

```ts
focusAgent(id: string): void
```

The camera keeps following the agent as it moves. Camera follow is interrupted by keyboard arrow keys (WASD / arrows) or right-click drag.

Does nothing if `id` does not exist.

```ts
bridge.focusAgent('alice');
```

---

### `enableInput()`

Re-enables pointer and keyboard input on the scene.

```ts
enableInput(): void
```

---

### `disableInput()`

Disables pointer and keyboard input on the scene. Useful when a host UI modal is open and you want to prevent accidental camera panning.

```ts
disableInput(): void
```

---

### `destroy()`

Destroys the Phaser game instance and releases all WebGL/canvas resources.

```ts
destroy(): void
```

Call this when the host component unmounts (e.g., React `useEffect` cleanup, Vue `onUnmounted`).

```ts
// React example
useEffect(() => {
  const { bridge } = createFysoGame(containerRef.current!);
  return () => bridge.destroy();
}, []);
```
