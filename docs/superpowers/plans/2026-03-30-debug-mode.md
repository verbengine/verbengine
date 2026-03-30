# Debug Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-game debug overlay panel activated by the Konami Code that shows live AdventureEngine state (scene, inventory, flags, removed hotspots, last interaction).

**Architecture:** Three new units — `KonamiListener` (keyboard sequence detector), `InteractionEvent` type + `onInteraction` callback on `AdventureEngine`, and `DebugPanel` (Phaser overlay). `AdventureScene` wires them together.

**Tech Stack:** TypeScript, Phaser 3, Vitest

---

### Task 1: InteractionEvent type and onInteraction callback on AdventureEngine

**Files:**
- Modify: `src/types/adventure-v2.ts`
- Modify: `src/engine/AdventureEngine.ts`
- Modify: `src/engine/AdventureEngine.test.ts`

- [ ] **Step 1: Add InteractionEvent interface to types**

In `src/types/adventure-v2.ts`, add at the end of the file:

```typescript
export interface InteractionEvent {
  verb: 'look' | 'use' | 'talk' | 'take' | 'exit';
  targetId: string;
  condition?: { type: string; target: string; result: boolean };
  actions: Action[];
  text: string;
}
```

- [ ] **Step 2: Write failing tests for onInteraction callback**

In `src/engine/AdventureEngine.test.ts`, add these tests inside the existing `describe('AdventureEngine', ...)` block, after the "Event callbacks" section:

```typescript
// --- Interaction events ---

it('should fire interaction event on hotspot default use', () => {
  const engine = new AdventureEngine(buildTestAdventure());
  const callback = vi.fn();
  engine.onInteraction(callback);
  engine.interactHotspot('escritorio_ana');
  expect(callback).toHaveBeenCalledOnce();
  const event = callback.mock.calls[0][0];
  expect(event.verb).toBe('use');
  expect(event.targetId).toBe('escritorio_ana');
  expect(event.text).toBe('Nothing useful here... just papers.');
});

it('should fire interaction event on hotspot take', () => {
  const engine = new AdventureEngine(buildTestAdventure());
  const callback = vi.fn();
  engine.onInteraction(callback);
  engine.interactHotspot('cafetera');
  expect(callback).toHaveBeenCalledOnce();
  const event = callback.mock.calls[0][0];
  expect(event.verb).toBe('take');
  expect(event.targetId).toBe('cafetera');
  expect(event.actions).toEqual([
    { type: 'get', target: 'usb_drive' },
    { type: 'remove_hotspot', target: 'cafetera' },
  ]);
});

it('should fire interaction event with condition on hotspot use(item)', () => {
  const engine = new AdventureEngine(buildTestAdventure());
  engine.executeActions([{ type: 'get', target: 'server_key' }]);
  const callback = vi.fn();
  engine.onInteraction(callback);
  engine.interactHotspot('escritorio_ana', 'server_key');
  expect(callback).toHaveBeenCalledOnce();
  const event = callback.mock.calls[0][0];
  expect(event.verb).toBe('use');
  expect(event.condition).toEqual({ type: 'has', target: 'server_key', result: true });
});

it('should fire interaction event on character talk', () => {
  const engine = new AdventureEngine(buildTestAdventure());
  const callback = vi.fn();
  engine.onInteraction(callback);
  engine.interactCharacter('ana');
  expect(callback).toHaveBeenCalledOnce();
  const event = callback.mock.calls[0][0];
  expect(event.verb).toBe('talk');
  expect(event.targetId).toBe('ana');
});

it('should fire interaction event on exit', () => {
  const engine = new AdventureEngine(buildTestAdventure());
  const callback = vi.fn();
  engine.onInteraction(callback);
  engine.interactExit('pasillo_norte');
  expect(callback).toHaveBeenCalledOnce();
  const event = callback.mock.calls[0][0];
  expect(event.verb).toBe('exit');
  expect(event.targetId).toBe('pasillo_norte');
});

it('should not fire interaction event when interact returns null', () => {
  const engine = new AdventureEngine(buildTestAdventure());
  const callback = vi.fn();
  engine.onInteraction(callback);
  engine.interactHotspot('nonexistent');
  expect(callback).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- src/engine/AdventureEngine.test.ts`
Expected: FAIL — `engine.onInteraction is not a function`

- [ ] **Step 4: Implement onInteraction in AdventureEngine**

In `src/engine/AdventureEngine.ts`:

1. Add import for `InteractionEvent`:

```typescript
import {
  Action,
  AdventureData,
  CharacterDef,
  Condition,
  ConditionalInteraction,
  ExitDef,
  GameState,
  HotspotDef,
  InteractionEvent,
  InteractionResult,
  ItemDef,
  SceneDef,
} from '../types/adventure-v2';
```

2. Add callback type and array after existing callback types (line ~25):

```typescript
type InteractionCallback = (event: InteractionEvent) => void;
```

3. Add to the class fields after `private winCallbacks`:

```typescript
private interactionCallbacks: InteractionCallback[] = [];
```

4. Add `onInteraction` method after `onWin`:

```typescript
onInteraction(callback: InteractionCallback): void {
  this.interactionCallbacks.push(callback);
}
```

5. Add private notify method after `notifyWin`:

```typescript
private notifyInteraction(event: InteractionEvent): void {
  for (const cb of this.interactionCallbacks) {
    cb(event);
  }
}
```

6. Modify `interactHotspot` — after each `return` that produces a result, fire the callback. Replace the method body with:

```typescript
interactHotspot(hotspotId: string, withItem?: string): InteractionResult | null {
  const hotspot = this.getHotspot(hotspotId);
  if (!hotspot || this.isHotspotRemoved(hotspotId)) {
    return null;
  }

  if (withItem) {
    const match = hotspot.use.find(
      (u) => u.condition?.type === 'has' && u.condition.target === withItem
    );
    if (match) {
      this.executeActions(match.actions);
      this.notifyInteraction({
        verb: 'use',
        targetId: hotspotId,
        condition: match.condition
          ? { type: match.condition.type, target: match.condition.target, result: true }
          : undefined,
        actions: match.actions,
        text: match.text,
      });
      return { text: match.text, actions: match.actions };
    }
    return null;
  }

  if (hotspot.take) {
    this.executeActions(hotspot.take.actions);
    this.notifyInteraction({
      verb: 'take',
      targetId: hotspotId,
      actions: hotspot.take.actions,
      text: hotspot.take.text,
    });
    return { text: hotspot.take.text, actions: hotspot.take.actions };
  }

  const defaultUse = hotspot.use.find((u) => !u.condition);
  if (defaultUse) {
    this.executeActions(defaultUse.actions);
    this.notifyInteraction({
      verb: 'use',
      targetId: hotspotId,
      actions: defaultUse.actions,
      text: defaultUse.text,
    });
    return { text: defaultUse.text, actions: defaultUse.actions };
  }

  return null;
}
```

7. Modify `interactCharacter` — replace the method body with:

```typescript
interactCharacter(characterId: string): InteractionResult | null {
  const character = this.getCharacter(characterId);
  if (!character) {
    return null;
  }

  for (const interaction of character.talk) {
    if (interaction.condition && this.evaluateCondition(interaction.condition)) {
      this.executeActions(interaction.actions);
      this.notifyInteraction({
        verb: 'talk',
        targetId: characterId,
        condition: {
          type: interaction.condition.type,
          target: interaction.condition.target,
          result: true,
        },
        actions: interaction.actions,
        text: interaction.text,
      });
      return { text: interaction.text, actions: interaction.actions };
    }
  }

  const defaultTalk = character.talk.find((t) => !t.condition);
  if (defaultTalk) {
    this.executeActions(defaultTalk.actions);
    this.notifyInteraction({
      verb: 'talk',
      targetId: characterId,
      actions: defaultTalk.actions,
      text: defaultTalk.text,
    });
    return { text: defaultTalk.text, actions: defaultTalk.actions };
  }

  return null;
}
```

8. Modify `interactExit` — replace the method body with:

```typescript
interactExit(exitId: string): InteractionResult | null {
  const exit = this.getExit(exitId);
  if (!exit) {
    return null;
  }

  if (exit.requires && !this.hasItem(exit.requires)) {
    const result = { text: exit.locked ?? 'You cannot go there yet.', actions: [] as Action[] };
    this.notifyInteraction({
      verb: 'exit',
      targetId: exitId,
      condition: { type: 'has', target: exit.requires, result: false },
      actions: result.actions,
      text: result.text,
    });
    return result;
  }

  const goAction: Action = { type: 'go', target: exit.target };
  this.executeActions([goAction]);
  this.notifyInteraction({
    verb: 'exit',
    targetId: exitId,
    actions: [goAction],
    text: exit.look,
  });
  return { text: exit.look, actions: [goAction] };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/engine/AdventureEngine.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/types/adventure-v2.ts src/engine/AdventureEngine.ts src/engine/AdventureEngine.test.ts
git commit -m "feat: add InteractionEvent type and onInteraction callback to AdventureEngine"
```

---

### Task 2: KonamiListener

**Files:**
- Create: `src/engine/KonamiListener.ts`
- Create: `src/engine/KonamiListener.test.ts`

- [ ] **Step 1: Write failing tests for KonamiListener**

Create `src/engine/KonamiListener.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KonamiListener } from './KonamiListener';

describe('KonamiListener', () => {
  let listener: KonamiListener;
  let callback: ReturnType<typeof vi.fn>;
  let keydownHandler: (e: KeyboardEvent) => void;

  beforeEach(() => {
    callback = vi.fn();
    // Capture the keydown handler added to window
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandler = handler as (e: KeyboardEvent) => void;
      }
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
    listener = new KonamiListener(callback);
  });

  afterEach(() => {
    listener.destroy();
    vi.restoreAllMocks();
  });

  function pressKey(key: string): void {
    keydownHandler(new KeyboardEvent('keydown', { key }));
  }

  function pressKonamiCode(): void {
    const sequence = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
      'b', 'a',
    ];
    for (const key of sequence) {
      pressKey(key);
    }
  }

  it('should fire callback when full Konami Code is entered', () => {
    pressKonamiCode();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should not fire callback on partial sequence', () => {
    pressKey('ArrowUp');
    pressKey('ArrowUp');
    pressKey('ArrowDown');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should reset on wrong key', () => {
    pressKey('ArrowUp');
    pressKey('ArrowUp');
    pressKey('x'); // wrong
    pressKey('ArrowDown');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow re-entering the code after wrong key', () => {
    pressKey('ArrowUp');
    pressKey('x'); // wrong — reset
    pressKonamiCode(); // full sequence from scratch
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should fire callback multiple times for repeated entries', () => {
    pressKonamiCode();
    pressKonamiCode();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should reset on timeout between keys', () => {
    vi.useFakeTimers();
    pressKey('ArrowUp');
    pressKey('ArrowUp');
    vi.advanceTimersByTime(2100); // exceed 2s timeout
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowLeft');
    pressKey('ArrowRight');
    pressKey('ArrowLeft');
    pressKey('ArrowRight');
    pressKey('b');
    pressKey('a');
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should accept uppercase B and A', () => {
    const sequence = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
      'B', 'A',
    ];
    for (const key of sequence) {
      pressKey(key);
    }
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should remove event listener on destroy', () => {
    listener.destroy();
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/engine/KonamiListener.test.ts`
Expected: FAIL — cannot find module `./KonamiListener`

- [ ] **Step 3: Implement KonamiListener**

Create `src/engine/KonamiListener.ts`:

```typescript
const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

const TIMEOUT_MS = 2000;

export class KonamiListener {
  private position = 0;
  private lastKeyTime = 0;
  private readonly onActivate: () => void;
  private readonly handler: (e: KeyboardEvent) => void;

  constructor(onActivate: () => void) {
    this.onActivate = onActivate;
    this.handler = (e: KeyboardEvent) => this.handleKey(e);
    window.addEventListener('keydown', this.handler);
  }

  private handleKey(e: KeyboardEvent): void {
    const now = Date.now();

    if (this.position > 0 && now - this.lastKeyTime > TIMEOUT_MS) {
      this.position = 0;
    }

    this.lastKeyTime = now;

    const expected = KONAMI_SEQUENCE[this.position];
    const key = e.key.toLowerCase();
    const expectedLower = expected.toLowerCase();

    if (key === expectedLower || e.key === expected) {
      this.position++;
      if (this.position === KONAMI_SEQUENCE.length) {
        this.position = 0;
        this.onActivate();
      }
    } else {
      this.position = 0;
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handler);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/engine/KonamiListener.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/KonamiListener.ts src/engine/KonamiListener.test.ts
git commit -m "feat: add KonamiListener for debug mode toggle"
```

---

### Task 3: DebugPanel

**Files:**
- Create: `src/engine/DebugPanel.ts`
- Create: `src/engine/DebugPanel.test.ts`

- [ ] **Step 1: Write failing tests for DebugPanel**

Create `src/engine/DebugPanel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebugPanel } from './DebugPanel';
import { AdventureEngine } from './AdventureEngine';
import { AdventureData } from '../types/adventure-v2';

function buildTestAdventure(): AdventureData {
  return {
    title: 'Test Adventure',
    startScene: 'room1',
    items: {
      key: { id: 'key', name: 'Golden Key', description: 'A shiny key' },
    },
    scenes: {
      room1: {
        id: 'room1',
        map: 'map1',
        hotspots: [
          {
            id: 'box',
            position: [2, 3],
            look: 'A wooden box.',
            use: [{ text: 'Nothing happens.', actions: [] }],
          },
        ],
        characters: [
          {
            id: 'npc1',
            position: [5, 5],
            sprite: 'char_1',
            look: 'A guard.',
            talk: [{ text: 'Go away.', actions: [] }],
          },
        ],
        exits: [
          { id: 'door', position: [0, 0], target: 'room2', look: 'A door.' },
        ],
      },
      room2: {
        id: 'room2',
        map: 'map2',
        hotspots: [],
        characters: [],
        exits: [],
      },
    },
  };
}

// Mock Phaser scene with minimal API needed by DebugPanel
function createMockScene(): {
  scene: { add: { container: ReturnType<typeof vi.fn>; rectangle: ReturnType<typeof vi.fn>; text: ReturnType<typeof vi.fn> }; cameras: { main: { width: number; height: number; scrollX: number; scrollY: number } }; scale: { width: number; height: number } };
  container: { add: ReturnType<typeof vi.fn>; setVisible: ReturnType<typeof vi.fn>; setScrollFactor: ReturnType<typeof vi.fn>; setDepth: ReturnType<typeof vi.fn>; visible: boolean; destroy: ReturnType<typeof vi.fn> };
} {
  const container = {
    add: vi.fn(),
    setVisible: vi.fn().mockImplementation(function (this: { visible: boolean }, v: boolean) {
      this.visible = v;
      return this;
    }),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    visible: false,
    destroy: vi.fn(),
  };

  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setWordWrapWidth: vi.fn().mockReturnThis(),
    text: '',
  };

  const mockRect = {
    setOrigin: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
  };

  const scene = {
    add: {
      container: vi.fn().mockReturnValue(container),
      rectangle: vi.fn().mockReturnValue(mockRect),
      text: vi.fn().mockReturnValue({ ...mockText }),
    },
    cameras: { main: { width: 1024, height: 768, scrollX: 0, scrollY: 0 } },
    scale: { width: 1024, height: 768 },
  };

  return { scene, container };
}

describe('DebugPanel', () => {
  it('should create without errors', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    expect(panel).toBeDefined();
  });

  it('should start hidden', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene, container } = createMockScene();
    new DebugPanel(scene as unknown as Phaser.Scene, engine);
    expect(container.setVisible).toHaveBeenCalledWith(false);
  });

  it('should toggle visibility', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene, container } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    panel.toggle();
    expect(container.setVisible).toHaveBeenCalledWith(true);
    container.visible = true;
    panel.toggle();
    expect(container.setVisible).toHaveBeenCalledWith(false);
  });

  it('should build scene section text', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    const text = panel.buildDebugText();
    expect(text).toContain('SCENE: room1');
    expect(text).toContain('box [2,3]');
    expect(text).toContain('npc1 [5,5]');
    expect(text).toContain('door [0,0] -> room2');
  });

  it('should show empty inventory', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    const text = panel.buildDebugText();
    expect(text).toContain('(empty)');
  });

  it('should show inventory items after get action', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    engine.executeActions([{ type: 'get', target: 'key' }]);
    const text = panel.buildDebugText();
    expect(text).toContain('key (Golden Key)');
  });

  it('should show flags', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    engine.executeActions([{ type: 'set', target: 'visited_room' }]);
    const text = panel.buildDebugText();
    expect(text).toContain('visited_room');
  });

  it('should show removed hotspots', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    engine.executeActions([{ type: 'remove_hotspot', target: 'box' }]);
    const text = panel.buildDebugText();
    expect(text).toContain('box');
    expect(text).toContain('REMOVED HOTSPOTS');
  });

  it('should show last interaction after engine event', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    engine.interactHotspot('box');
    const text = panel.buildDebugText();
    expect(text).toContain('LAST INTERACTION');
    expect(text).toContain('use');
    expect(text).toContain('box');
  });

  it('should show no interactions initially', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    const text = panel.buildDebugText();
    expect(text).toContain('(no interactions yet)');
  });

  it('should clean up on destroy', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const { scene, container } = createMockScene();
    const panel = new DebugPanel(scene as unknown as Phaser.Scene, engine);
    panel.destroy();
    expect(container.destroy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/engine/DebugPanel.test.ts`
Expected: FAIL — cannot find module `./DebugPanel`

- [ ] **Step 3: Implement DebugPanel**

Create `src/engine/DebugPanel.ts`:

```typescript
import Phaser from 'phaser';
import { AdventureEngine } from './AdventureEngine';
import type { InteractionEvent } from '../types/adventure-v2';

const PANEL_WIDTH = 300;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.8;
const TEXT_COLOR = '#00ff00';
const FONT_SIZE = '12px';
const FONT_FAMILY = 'Courier, monospace';
const PADDING = 10;
const DEPTH = 9999;

export class DebugPanel {
  private readonly scene: Phaser.Scene;
  private readonly engine: AdventureEngine;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly debugText: Phaser.GameObjects.Text;
  private lastInteraction: InteractionEvent | null = null;

  constructor(scene: Phaser.Scene, engine: AdventureEngine) {
    this.scene = scene;
    this.engine = engine;

    const { width, height } = scene.scale;

    this.container = scene.add.container(width - PANEL_WIDTH, 0);
    this.container.setDepth(DEPTH);
    this.container.setScrollFactor(0);

    this.bg = scene.add.rectangle(PANEL_WIDTH / 2, height / 2, PANEL_WIDTH, height, BG_COLOR);
    this.bg.setOrigin(0.5, 0.5);
    this.bg.setAlpha(BG_ALPHA);

    this.debugText = scene.add.text(PADDING, PADDING, '', {
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: PANEL_WIDTH - PADDING * 2 },
    });
    this.debugText.setOrigin(0, 0);

    this.container.add([this.bg, this.debugText]);
    this.container.setVisible(false);

    // Subscribe to engine events for auto-refresh
    engine.onSceneChange(() => this.refresh());
    engine.onInventoryChange(() => this.refresh());
    engine.onInteraction((event: InteractionEvent) => {
      this.lastInteraction = event;
      this.refresh();
    });
  }

  toggle(): void {
    const newVisible = !this.container.visible;
    this.container.setVisible(newVisible);
    if (newVisible) {
      this.refresh();
    }
  }

  refresh(): void {
    this.debugText.setText(this.buildDebugText());
  }

  buildDebugText(): string {
    const state = this.engine.getState();
    const currentScene = this.engine.getCurrentScene();
    const lines: string[] = [];

    // SCENE
    lines.push(`== SCENE: ${currentScene.id} ==`);
    lines.push('');
    if (currentScene.hotspots.length > 0) {
      lines.push('Hotspots:');
      for (const h of currentScene.hotspots) {
        const removed = state.removedHotspots.has(h.id) ? ' [REMOVED]' : '';
        lines.push(`  ${h.id} [${h.position[0]},${h.position[1]}]${removed}`);
      }
    }
    if (currentScene.characters.length > 0) {
      lines.push('Characters:');
      for (const c of currentScene.characters) {
        lines.push(`  ${c.id} [${c.position[0]},${c.position[1]}]`);
      }
    }
    if (currentScene.exits.length > 0) {
      lines.push('Exits:');
      for (const e of currentScene.exits) {
        lines.push(`  ${e.id} [${e.position[0]},${e.position[1]}] -> ${e.target}`);
      }
    }

    // INVENTORY
    lines.push('');
    lines.push('== INVENTORY ==');
    if (state.inventory.length === 0) {
      lines.push('  (empty)');
    } else {
      for (const itemId of state.inventory) {
        const item = this.engine.getItem(itemId);
        const name = item ? item.name : '?';
        lines.push(`  ${itemId} (${name})`);
      }
    }

    // FLAGS
    lines.push('');
    lines.push('== FLAGS ==');
    if (state.flags.size === 0) {
      lines.push('  (none)');
    } else {
      for (const flag of state.flags) {
        lines.push(`  ${flag}`);
      }
    }

    // REMOVED HOTSPOTS
    lines.push('');
    lines.push('== REMOVED HOTSPOTS ==');
    if (state.removedHotspots.size === 0) {
      lines.push('  (none)');
    } else {
      for (const id of state.removedHotspots) {
        lines.push(`  ${id}`);
      }
    }

    // LAST INTERACTION
    lines.push('');
    lines.push('== LAST INTERACTION ==');
    if (!this.lastInteraction) {
      lines.push('  (no interactions yet)');
    } else {
      const ev = this.lastInteraction;
      lines.push(`  verb: ${ev.verb}`);
      lines.push(`  target: ${ev.targetId}`);
      if (ev.condition) {
        lines.push(`  condition: ${ev.condition.type}(${ev.condition.target}) = ${ev.condition.result}`);
      }
      if (ev.actions.length > 0) {
        lines.push('  actions:');
        for (const a of ev.actions) {
          lines.push(`    ${a.type}${a.target ? `(${a.target})` : ''}`);
        }
      }
      if (ev.text) {
        lines.push(`  text: "${ev.text}"`);
      }
    }

    return lines.join('\n');
  }

  destroy(): void {
    this.container.destroy();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/engine/DebugPanel.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/engine/DebugPanel.ts src/engine/DebugPanel.test.ts
git commit -m "feat: add DebugPanel overlay for live engine state display"
```

---

### Task 4: Integrate into AdventureScene

**Files:**
- Modify: `src/scenes/AdventureScene.ts`

- [ ] **Step 1: Add imports**

At the top of `src/scenes/AdventureScene.ts`, add after the existing imports:

```typescript
import { KonamiListener } from '../engine/KonamiListener';
import { DebugPanel } from '../engine/DebugPanel';
```

- [ ] **Step 2: Add class fields**

Inside the `AdventureScene` class, add after the `private moveCallback` field:

```typescript
// Debug
private debugPanel: DebugPanel | null = null;
private konamiListener: KonamiListener | null = null;
```

- [ ] **Step 3: Initialize debug panel and Konami listener in create()**

At the end of the `create()` method, after `this.createUIOverlay();`, add:

```typescript
// Debug mode — activated by Konami Code
this.debugPanel = new DebugPanel(this, this.engine);
this.konamiListener = new KonamiListener(() => {
  this.debugPanel?.toggle();
});
```

- [ ] **Step 4: Clean up in scene shutdown**

Find the scene's `shutdown` or `destroy` method (or add cleanup if not present). Look for any existing cleanup. Add at the appropriate location:

```typescript
this.konamiListener?.destroy();
this.debugPanel?.destroy();
```

If no shutdown method exists, add it to the class:

```typescript
shutdown(): void {
  this.konamiListener?.destroy();
  this.debugPanel?.destroy();
}
```

- [ ] **Step 5: Run all tests to verify nothing is broken**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 6: Manual verification**

Run: `pnpm dev`

1. Open the game in the browser
2. Enter the Konami Code: ↑↑↓↓←→←→BA
3. Verify the debug panel appears on the right side with green text on black background
4. Verify it shows scene info, inventory, flags, removed hotspots sections
5. Interact with something (click a hotspot) and verify "LAST INTERACTION" updates
6. Enter the Konami Code again to hide the panel
7. Verify gameplay works normally with panel hidden

- [ ] **Step 7: Commit**

```bash
git add src/scenes/AdventureScene.ts
git commit -m "feat: integrate debug panel and Konami Code toggle into AdventureScene"
```
