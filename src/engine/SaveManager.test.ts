import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveManager } from './SaveManager';
import { AdventureEngine } from './AdventureEngine';
import { AdventureData } from '../types/adventure-v2';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function makeLocalStorageMock(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Test adventure fixture
// ---------------------------------------------------------------------------

function buildTestAdventure(): AdventureData {
  return {
    title: 'Test Adventure',
    startScene: 'scene_a',
    items: {
      key: { id: 'key', name: 'Key', description: 'A rusty key.' },
      lamp: { id: 'lamp', name: 'Lamp', description: 'An old lamp.' },
    },
    scenes: {
      scene_a: {
        id: 'scene_a',
        map: 'map_a',
        hotspots: [],
        characters: [],
        exits: [{ id: 'to_b', position: [0, 0], target: 'scene_b', look: 'Go to B.' }],
      },
      scene_b: {
        id: 'scene_b',
        map: 'map_b',
        hotspots: [],
        characters: [],
        exits: [],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEngine(): AdventureEngine {
  return new AdventureEngine(buildTestAdventure());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SaveManager', () => {
  let manager: SaveManager;
  let storage: Storage;

  beforeEach(() => {
    storage = makeLocalStorageMock();
    vi.stubGlobal('localStorage', storage);
    manager = new SaveManager();
  });

  // --- save / load round-trip ---

  it('saves and loads basic state (round-trip)', () => {
    const engine = buildEngine();
    manager.save('test-game', engine);

    const state = manager.load('test-game');
    expect(state).not.toBeNull();
    expect(state!.currentScene).toBe('scene_a');
    expect(state!.inventory).toEqual([]);
    expect(state!.flags).toEqual([]);
    expect(state!.removedHotspots).toEqual([]);
  });

  it('serializes inventory array correctly', () => {
    const engine = buildEngine();
    engine.executeActions([{ type: 'get', target: 'key' }]);
    engine.executeActions([{ type: 'get', target: 'lamp' }]);

    manager.save('test-game', engine);
    const state = manager.load('test-game');

    expect(state!.inventory).toEqual(['key', 'lamp']);
  });

  it('serializes flags Set to sorted array', () => {
    const engine = buildEngine();
    engine.executeActions([{ type: 'set', target: 'zebra_flag' }]);
    engine.executeActions([{ type: 'set', target: 'alpha_flag' }]);

    manager.save('test-game', engine);
    const state = manager.load('test-game');

    expect(state!.flags).toEqual(['alpha_flag', 'zebra_flag']);
  });

  it('serializes removedHotspots Set to sorted array', () => {
    const engine = buildEngine();
    engine.executeActions([{ type: 'remove_hotspot', target: 'hotspot_z' }]);
    engine.executeActions([{ type: 'remove_hotspot', target: 'hotspot_a' }]);

    manager.save('test-game', engine);
    const state = manager.load('test-game');

    expect(state!.removedHotspots).toEqual(['hotspot_a', 'hotspot_z']);
  });

  it('saves scene correctly after transition', () => {
    const engine = buildEngine();
    engine.executeActions([{ type: 'go', target: 'scene_b' }]);

    manager.save('test-game', engine);
    const state = manager.load('test-game');

    expect(state!.currentScene).toBe('scene_b');
  });

  // --- load non-existent ---

  it('returns null for non-existent save slot', () => {
    expect(manager.load('no-such-game')).toBeNull();
    expect(manager.load('no-such-game', 0)).toBeNull();
    expect(manager.load('no-such-game', 2)).toBeNull();
  });

  // --- multiple slots ---

  it('saves and loads from different slots independently', () => {
    const engine = buildEngine();
    manager.save('test-game', engine, 0);

    engine.executeActions([{ type: 'go', target: 'scene_b' }]);
    manager.save('test-game', engine, 1);

    const slot0 = manager.load('test-game', 0);
    const slot1 = manager.load('test-game', 1);

    expect(slot0!.currentScene).toBe('scene_a');
    expect(slot1!.currentScene).toBe('scene_b');
  });

  it('allows overwriting an existing slot', () => {
    const engine = buildEngine();
    manager.save('test-game', engine, 0);

    engine.executeActions([{ type: 'get', target: 'key' }]);
    manager.save('test-game', engine, 0);

    const state = manager.load('test-game', 0);
    expect(state!.inventory).toContain('key');
  });

  it('throws RangeError when slot index >= MAX_SLOTS (3)', () => {
    const engine = buildEngine();
    expect(() => manager.save('test-game', engine, 3)).toThrow(RangeError);
  });

  it('throws RangeError when slot index is negative', () => {
    const engine = buildEngine();
    expect(() => manager.save('test-game', engine, -1)).toThrow(RangeError);
  });

  // --- listSaves ---

  it('listSaves returns empty array when no saves exist', () => {
    expect(manager.listSaves('test-game')).toEqual([]);
  });

  it('listSaves returns slots sorted by timestamp ascending', () => {
    const engine = buildEngine();

    // Stub Date.now to control timestamps
    vi.spyOn(Date, 'now').mockReturnValueOnce(3000).mockReturnValueOnce(1000).mockReturnValueOnce(2000);

    manager.save('test-game', engine, 0); // timestamp 3000
    manager.save('test-game', engine, 1); // timestamp 1000
    manager.save('test-game', engine, 2); // timestamp 2000

    const slots = manager.listSaves('test-game');
    expect(slots.map((s) => s.timestamp)).toEqual([1000, 2000, 3000]);
  });

  it('listSaves only returns slots that exist', () => {
    const engine = buildEngine();
    manager.save('test-game', engine, 1);

    const slots = manager.listSaves('test-game');
    expect(slots.length).toBe(1);
    expect(slots[0].adventureId).toBe('test-game');
  });

  it('listSaves includes sceneName and adventureId', () => {
    const engine = buildEngine();
    engine.executeActions([{ type: 'go', target: 'scene_b' }]);
    manager.save('my-adventure', engine, 0);

    const slots = manager.listSaves('my-adventure');
    expect(slots[0].sceneName).toBe('scene_b');
    expect(slots[0].adventureId).toBe('my-adventure');
  });

  // --- deleteSave ---

  it('deleteSave removes the specified slot', () => {
    const engine = buildEngine();
    manager.save('test-game', engine, 0);
    expect(manager.load('test-game', 0)).not.toBeNull();

    manager.deleteSave('test-game', 0);
    expect(manager.load('test-game', 0)).toBeNull();
  });

  it('deleteSave only removes the targeted slot', () => {
    const engine = buildEngine();
    manager.save('test-game', engine, 0);
    manager.save('test-game', engine, 1);

    manager.deleteSave('test-game', 0);

    expect(manager.load('test-game', 0)).toBeNull();
    expect(manager.load('test-game', 1)).not.toBeNull();
  });

  it('deleteSave on non-existent slot is a no-op', () => {
    expect(() => manager.deleteSave('test-game', 2)).not.toThrow();
  });

  // --- hasSave ---

  it('hasSave returns false when no slots exist', () => {
    expect(manager.hasSave('test-game')).toBe(false);
  });

  it('hasSave returns true when at least one slot exists', () => {
    const engine = buildEngine();
    manager.save('test-game', engine, 2);
    expect(manager.hasSave('test-game')).toBe(true);
  });

  it('hasSave returns false after all slots are deleted', () => {
    const engine = buildEngine();
    manager.save('test-game', engine, 0);
    manager.save('test-game', engine, 1);

    manager.deleteSave('test-game', 0);
    manager.deleteSave('test-game', 1);

    expect(manager.hasSave('test-game')).toBe(false);
  });

  it('hasSave is isolated per adventure id', () => {
    const engine = buildEngine();
    manager.save('adventure-a', engine, 0);

    expect(manager.hasSave('adventure-a')).toBe(true);
    expect(manager.hasSave('adventure-b')).toBe(false);
  });
});
