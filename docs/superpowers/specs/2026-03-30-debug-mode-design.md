# Debug Mode — Design Spec

## Overview

An in-game debug overlay panel that shows the live state of the AdventureEngine while playing. Activated by entering the Konami Code (Up Up Down Down Left Right Left Right B A).

## Toggle: Konami Code Listener

- Listens for the keyboard sequence: `↑↑↓↓←→←→BA`
- On complete sequence: toggles debug panel visibility
- Resets sequence on wrong key or timeout (2s between keys)
- Non-intrusive: does not interfere with normal gameplay input

## Panel: Right Sidebar

- **Width**: ~300px, anchored to right edge of the game canvas
- **Style**: semitransparent black background (`#000000`, 80% opacity), monospace font, green text (`#00ff00`)
- **Depth**: rendered above all game objects
- **Scroll**: vertical scroll if content exceeds viewport height
- **Sections** (in order):

### 1. SCENE
- Current scene id
- List of hotspots with id and position `[x, y]`
- List of characters with id and position `[x, y]`
- List of exits with id, position, and target scene

### 2. INVENTORY
- Each item: id and display name
- Empty state: `(empty)`

### 3. FLAGS
- Each active flag name
- Empty state: `(none)`

### 4. REMOVED HOTSPOTS
- Each removed hotspot id
- Empty state: `(none)`

### 5. LAST INTERACTION
- Verb used: `look` | `use` | `talk` | `take` | `exit`
- Target entity id
- Condition evaluated (if any): type, target, result (true/false)
- Actions executed: list of `type(target)` strings
- Empty state: `(no interactions yet)`

## Architecture

### New files
- `src/engine/DebugPanel.ts` — renders and updates the debug overlay using Phaser GameObjects
- `src/engine/KonamiListener.ts` — keyboard sequence detector, calls a toggle callback

### Integration point
- `AdventureScene.ts` — instantiates KonamiListener and DebugPanel after engine init

### Data flow
- DebugPanel holds a reference to `AdventureEngine` and reads state via existing public getters (`getState()`, `getCurrentScene()`, `getInventory()`)
- Subscribes to `onSceneChange` and `onInventoryChange` to trigger re-renders
- For "last interaction" tracking: AdventureEngine gets a new `onInteraction` callback that fires with interaction details (verb, target, condition, result, actions)

### AdventureEngine change
- Add `InteractionEvent` interface: `{ verb: string; targetId: string; condition?: { type: string; target: string; result: boolean }; actions: Action[]; text: string }`
- Add `onInteraction(callback)` method and `interactionCallbacks` array
- Fire callback from `interactHotspot`, `interactCharacter`, `interactExit` when a result is produced

## Out of scope
- Modifying game state from the debug panel
- Persisting debug panel state
- Debug panel in production builds (always available, no build flag for MVP)
- Step-through or breakpoint functionality
