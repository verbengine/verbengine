import { describe, it, expect, vi } from 'vitest';
import { AdventureEngine } from './AdventureEngine';
import { AdventureData } from '../types/adventure-v2';
import { SerializedGameState } from './SaveManager';

/**
 * Build a test adventure matching the spec example:
 * "The Missing USB" — oficina, pasillo, server_room.
 */
function buildTestAdventure(): AdventureData {
  return {
    title: 'The Missing USB',
    startScene: 'oficina',
    items: {
      usb_drive: { id: 'usb_drive', name: 'USB Drive', description: 'A small black USB drive' },
      coffee_cup: { id: 'coffee_cup', name: 'Coffee Cup', description: 'A warm cup of coffee' },
      server_key: { id: 'server_key', name: 'Server Room Key', description: 'A metallic key card' },
    },
    scenes: {
      oficina: {
        id: 'oficina',
        map: 'office_main',
        hotspots: [
          {
            id: 'escritorio_ana',
            position: [4, 3],
            look: 'A messy desk with papers everywhere.',
            use: [
              { text: 'Nothing useful here... just papers.', actions: [] },
              {
                condition: { type: 'has', target: 'server_key' },
                text: 'You plug the key card into the reader. Access granted!',
                actions: [{ type: 'set', target: 'desk_unlocked' }],
              },
            ],
          },
          {
            id: 'cafetera',
            position: [10, 11],
            look: 'A coffee machine. There\'s something behind it...',
            use: [],
            take: {
              text: 'You grab the USB drive hidden behind the machine!',
              actions: [
                { type: 'get', target: 'usb_drive' },
                { type: 'remove_hotspot', target: 'cafetera' },
              ],
            },
          },
          {
            id: 'puerta_server',
            position: [23, 12],
            look: 'A heavy door with a key card reader.',
            use: [
              { text: 'It\'s locked. You need a key card.', actions: [] },
              {
                condition: { type: 'has', target: 'server_key' },
                text: 'The door slides open.',
                actions: [{ type: 'go', target: 'server_room' }],
              },
            ],
          },
        ],
        characters: [
          {
            id: 'ana',
            position: [5, 3],
            sprite: 'char_1',
            look: 'Ana, the senior developer.',
            talk: [
              {
                condition: { type: 'has', target: 'usb_drive' },
                text: 'You found it! Talk to Carlos, he has the key.',
                actions: [{ type: 'set', target: 'talked_to_ana' }],
              },
              {
                text: 'Hey! Have you seen the USB drive?',
                actions: [],
              },
            ],
          },
          {
            id: 'carlos',
            position: [14, 17],
            sprite: 'char_2',
            look: 'Carlos, the sysadmin.',
            talk: [
              {
                condition: { type: 'has', target: 'usb_drive' },
                text: 'Oh, you found the USB? Here, take the server key.',
                actions: [{ type: 'get', target: 'server_key' }],
              },
              {
                text: 'I\'m busy. Come back later.',
                actions: [],
              },
            ],
          },
        ],
        exits: [
          {
            id: 'pasillo_norte',
            position: [12, 0],
            target: 'pasillo',
            look: 'A corridor leading north.',
          },
        ],
      },
      pasillo: {
        id: 'pasillo',
        map: 'corridor',
        hotspots: [],
        characters: [],
        exits: [
          {
            id: 'oficina_sur',
            position: [12, 24],
            target: 'oficina',
            look: 'Back to the main office.',
          },
          {
            id: 'server_room_este',
            position: [24, 12],
            target: 'server_room',
            requires: 'server_key',
            locked: 'You need a key card to enter.',
            look: 'The server room entrance.',
          },
        ],
      },
      server_room: {
        id: 'server_room',
        map: 'server',
        hotspots: [
          {
            id: 'servidor_principal',
            position: [12, 12],
            look: 'The main server rack. There\'s a USB port.',
            use: [
              {
                condition: { type: 'has', target: 'usb_drive' },
                text: 'You insert the USB and deploy the fix!',
                actions: [{ type: 'win' }],
              },
            ],
          },
        ],
        characters: [],
        exits: [],
      },
    },
  };
}

describe('AdventureEngine', () => {
  // --- Initialization ---

  it('should initialize with the start scene', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    expect(engine.getState().currentScene).toBe('oficina');
  });

  it('should start with empty inventory', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    expect(engine.getInventory()).toEqual([]);
  });

  it('should start with no flags', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    expect(engine.hasFlag('anything')).toBe(false);
  });

  it('should return the current scene definition', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const scene = engine.getCurrentScene();
    expect(scene.id).toBe('oficina');
    expect(scene.map).toBe('office_main');
  });

  // --- Scene description ---

  it('should return scene description when present', () => {
    const adventure = buildTestAdventure();
    adventure.scenes['oficina'].description = 'The bustling office floor.';
    const engine = new AdventureEngine(adventure);
    expect(engine.getSceneDescription()).toBe('The bustling office floor.');
  });

  it('should return undefined for scene without description', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    expect(engine.getSceneDescription()).toBeUndefined();
  });

  it('should return description for the current scene after scene change', () => {
    const adventure = buildTestAdventure();
    adventure.scenes['pasillo'].description = 'A long empty corridor.';
    const engine = new AdventureEngine(adventure);
    engine.executeActions([{ type: 'go', target: 'pasillo' }]);
    expect(engine.getSceneDescription()).toBe('A long empty corridor.');
  });

  // --- Inventory ---

  it('should add items to inventory via get action', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    expect(engine.hasItem('usb_drive')).toBe(true);
    expect(engine.getInventory()).toContain('usb_drive');
  });

  it('should not duplicate items in inventory', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    expect(engine.getInventory().filter((i) => i === 'usb_drive').length).toBe(1);
  });

  it('should remove items from inventory via remove action', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    expect(engine.hasItem('usb_drive')).toBe(true);
    engine.executeActions([{ type: 'remove', target: 'usb_drive' }]);
    expect(engine.hasItem('usb_drive')).toBe(false);
  });

  it('should handle removing non-existent item gracefully', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'remove', target: 'nonexistent' }]);
    expect(engine.getInventory()).toEqual([]);
  });

  // --- Flags ---

  it('should set flags via set action', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'set', target: 'talked_to_ana' }]);
    expect(engine.hasFlag('talked_to_ana')).toBe(true);
  });

  it('should report false for unset flags', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    expect(engine.hasFlag('nonexistent_flag')).toBe(false);
  });

  // --- Hotspot interaction ---

  it('should return default use text for hotspot without item', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactHotspot('escritorio_ana');
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Nothing useful here... just papers.');
  });

  it('should return conditional use text when item matches', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'server_key' }]);
    const result = engine.interactHotspot('escritorio_ana', 'server_key');
    expect(result).not.toBeNull();
    expect(result!.text).toContain('Access granted');
  });

  it('should return null when using wrong item on hotspot', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactHotspot('escritorio_ana', 'coffee_cup');
    expect(result).toBeNull();
  });

  it('should execute take action and add item to inventory', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactHotspot('cafetera');
    expect(result).not.toBeNull();
    expect(result!.text).toContain('USB drive');
    expect(engine.hasItem('usb_drive')).toBe(true);
  });

  it('should return null for nonexistent hotspot', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactHotspot('nonexistent');
    expect(result).toBeNull();
  });

  // --- Character interaction ---

  it('should return default talk text when no condition met', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactCharacter('ana');
    expect(result).not.toBeNull();
    expect(result!.text).toContain('Have you seen the USB');
  });

  it('should return conditional talk text when condition met', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    const result = engine.interactCharacter('ana');
    expect(result).not.toBeNull();
    expect(result!.text).toContain('You found it');
  });

  it('should execute actions from character talk', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    engine.interactCharacter('carlos');
    expect(engine.hasItem('server_key')).toBe(true);
  });

  it('should return null for nonexistent character', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactCharacter('nobody');
    expect(result).toBeNull();
  });

  // --- Exit interaction ---

  it('should allow exit when no requires condition', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactExit('pasillo_norte');
    expect(result).not.toBeNull();
    expect(engine.getState().currentScene).toBe('pasillo');
  });

  it('should block exit when requires condition not met', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    // Navigate to pasillo first
    engine.executeActions([{ type: 'go', target: 'pasillo' }]);
    const result = engine.interactExit('server_room_este');
    expect(result).not.toBeNull();
    expect(result!.text).toBe('You need a key card to enter.');
    expect(engine.getState().currentScene).toBe('pasillo');
  });

  it('should allow locked exit when player has required item', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'go', target: 'pasillo' }]);
    engine.executeActions([{ type: 'get', target: 'server_key' }]);
    const result = engine.interactExit('server_room_este');
    expect(result).not.toBeNull();
    expect(engine.getState().currentScene).toBe('server_room');
  });

  it('should return null for nonexistent exit', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.interactExit('nonexistent');
    expect(result).toBeNull();
  });

  // --- Scene transitions ---

  it('should change scene via go action', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'go', target: 'pasillo' }]);
    expect(engine.getState().currentScene).toBe('pasillo');
    expect(engine.getCurrentScene().id).toBe('pasillo');
  });

  it('should ignore go action to nonexistent scene', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'go', target: 'narnia' }]);
    expect(engine.getState().currentScene).toBe('oficina');
  });

  // --- Win condition ---

  it('should trigger win callback on win action', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const winHandler = vi.fn();
    engine.onWin(winHandler);
    engine.executeActions([{ type: 'win' }]);
    expect(winHandler).toHaveBeenCalledOnce();
  });

  // --- Removed hotspots ---

  it('should mark hotspot as removed via remove_hotspot action', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    expect(engine.isHotspotRemoved('cafetera')).toBe(false);
    engine.executeActions([{ type: 'remove_hotspot', target: 'cafetera' }]);
    expect(engine.isHotspotRemoved('cafetera')).toBe(true);
  });

  it('should return null when interacting with removed hotspot', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'remove_hotspot', target: 'cafetera' }]);
    const result = engine.interactHotspot('cafetera');
    expect(result).toBeNull();
  });

  // --- Event callbacks ---

  it('should fire scene change callback', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const callback = vi.fn();
    engine.onSceneChange(callback);
    engine.executeActions([{ type: 'go', target: 'pasillo' }]);
    expect(callback).toHaveBeenCalledWith('pasillo');
  });

  it('should fire inventory change callback on get', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const callback = vi.fn();
    engine.onInventoryChange(callback);
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    expect(callback).toHaveBeenCalledWith(['usb_drive']);
  });

  it('should fire inventory change callback on remove', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    const callback = vi.fn();
    engine.onInventoryChange(callback);
    engine.executeActions([{ type: 'remove', target: 'usb_drive' }]);
    expect(callback).toHaveBeenCalledWith([]);
  });

  it('should support multiple callbacks', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    engine.onWin(cb1);
    engine.onWin(cb2);
    engine.executeActions([{ type: 'win' }]);
    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
  });

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

  // --- lookAt ---

  it('should return look text for a hotspot', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.lookAt('escritorio_ana');
    expect(result).not.toBeNull();
    expect(result!.text).toBe('A messy desk with papers everywhere.');
    expect(result!.actions).toEqual([]);
  });

  it('should return look text for a character', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.lookAt('ana');
    expect(result).not.toBeNull();
    expect(result!.text).toBe('Ana, the senior developer.');
    expect(result!.actions).toEqual([]);
  });

  it('should return look text for an exit', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.lookAt('pasillo_norte');
    expect(result).not.toBeNull();
    expect(result!.text).toBe('A corridor leading north.');
    expect(result!.actions).toEqual([]);
  });

  it('should return null for a non-existent target', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const result = engine.lookAt('nonexistent');
    expect(result).toBeNull();
  });

  it('should fire interaction callback with verb look', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const callback = vi.fn();
    engine.onInteraction(callback);
    engine.lookAt('cafetera');
    expect(callback).toHaveBeenCalledOnce();
    const event = callback.mock.calls[0][0];
    expect(event.verb).toBe('look');
    expect(event.targetId).toBe('cafetera');
    expect(event.text).toBe('A coffee machine. There\'s something behind it...');
  });

  it('should never trigger actions when looking at any target', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const inventoryCallback = vi.fn();
    const sceneCallback = vi.fn();
    engine.onInventoryChange(inventoryCallback);
    engine.onSceneChange(sceneCallback);
    engine.lookAt('escritorio_ana');
    engine.lookAt('ana');
    engine.lookAt('pasillo_norte');
    expect(inventoryCallback).not.toHaveBeenCalled();
    expect(sceneCallback).not.toHaveBeenCalled();
  });

  // --- Queries ---

  it('should return hotspot by id', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const hotspot = engine.getHotspot('cafetera');
    expect(hotspot).toBeDefined();
    expect(hotspot!.id).toBe('cafetera');
  });

  it('should return character by id', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const character = engine.getCharacter('ana');
    expect(character).toBeDefined();
    expect(character!.sprite).toBe('char_1');
  });

  it('should return exit by id', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const exit = engine.getExit('pasillo_norte');
    expect(exit).toBeDefined();
    expect(exit!.target).toBe('pasillo');
  });

  it('should return item by id', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const item = engine.getItem('usb_drive');
    expect(item).toBeDefined();
    expect(item!.name).toBe('USB Drive');
  });

  it('should return undefined for nonexistent item', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    expect(engine.getItem('nonexistent')).toBeUndefined();
  });

  // --- Flag-based conditions ---

  it('should evaluate flag conditions in character talk', () => {
    const adventure = buildTestAdventure();
    // Add a flag-based conditional talk to ana
    adventure.scenes['oficina'].characters[0].talk.unshift({
      condition: { type: 'flag', target: 'talked_to_carlos' },
      text: 'I see you already talked to Carlos.',
      actions: [],
    });
    const engine = new AdventureEngine(adventure);
    engine.executeActions([{ type: 'set', target: 'talked_to_carlos' }]);
    const result = engine.interactCharacter('ana');
    expect(result).not.toBeNull();
    expect(result!.text).toContain('talked to Carlos');
  });

  // --- loadState ---

  it('loadState restores currentScene', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const saved: SerializedGameState = {
      currentScene: 'pasillo',
      inventory: [],
      flags: [],
      removedHotspots: [],
    };
    engine.loadState(saved);
    expect(engine.getState().currentScene).toBe('pasillo');
    expect(engine.getCurrentScene().id).toBe('pasillo');
  });

  it('loadState restores inventory', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const saved: SerializedGameState = {
      currentScene: 'oficina',
      inventory: ['usb_drive', 'server_key'],
      flags: [],
      removedHotspots: [],
    };
    engine.loadState(saved);
    expect(engine.hasItem('usb_drive')).toBe(true);
    expect(engine.hasItem('server_key')).toBe(true);
    expect(engine.getInventory()).toEqual(['usb_drive', 'server_key']);
  });

  it('loadState restores flags', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const saved: SerializedGameState = {
      currentScene: 'oficina',
      inventory: [],
      flags: ['talked_to_ana', 'desk_unlocked'],
      removedHotspots: [],
    };
    engine.loadState(saved);
    expect(engine.hasFlag('talked_to_ana')).toBe(true);
    expect(engine.hasFlag('desk_unlocked')).toBe(true);
    expect(engine.hasFlag('nonexistent')).toBe(false);
  });

  it('loadState restores removedHotspots', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const saved: SerializedGameState = {
      currentScene: 'oficina',
      inventory: [],
      flags: [],
      removedHotspots: ['cafetera'],
    };
    engine.loadState(saved);
    expect(engine.isHotspotRemoved('cafetera')).toBe(true);
    expect(engine.interactHotspot('cafetera')).toBeNull();
  });

  it('loadState fires sceneChange callback', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const sceneCallback = vi.fn();
    engine.onSceneChange(sceneCallback);

    const saved: SerializedGameState = {
      currentScene: 'server_room',
      inventory: [],
      flags: [],
      removedHotspots: [],
    };
    engine.loadState(saved);
    expect(sceneCallback).toHaveBeenCalledWith('server_room');
  });

  it('loadState fires inventoryChange callback', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const inventoryCallback = vi.fn();
    engine.onInventoryChange(inventoryCallback);

    const saved: SerializedGameState = {
      currentScene: 'oficina',
      inventory: ['usb_drive'],
      flags: [],
      removedHotspots: [],
    };
    engine.loadState(saved);
    expect(inventoryCallback).toHaveBeenCalledWith(['usb_drive']);
  });

  it('loadState replaces existing state rather than merging', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    engine.executeActions([{ type: 'set', target: 'some_flag' }]);

    const saved: SerializedGameState = {
      currentScene: 'oficina',
      inventory: [],
      flags: [],
      removedHotspots: [],
    };
    engine.loadState(saved);

    expect(engine.hasItem('usb_drive')).toBe(false);
    expect(engine.hasFlag('some_flag')).toBe(false);
  });

  // --- Full playthrough ---

  it('should complete the full Missing USB adventure', () => {
    const engine = new AdventureEngine(buildTestAdventure());
    const sceneChanges: string[] = [];
    const inventoryChanges: string[][] = [];
    let won = false;

    engine.onSceneChange((id) => sceneChanges.push(id));
    engine.onInventoryChange((inv) => inventoryChanges.push([...inv]));
    engine.onWin(() => { won = true; });

    // 1. Talk to Ana — default response (no USB yet)
    let result = engine.interactCharacter('ana');
    expect(result!.text).toContain('Have you seen the USB');

    // 2. Pick up USB from cafetera
    result = engine.interactHotspot('cafetera');
    expect(result!.text).toContain('USB drive');
    expect(engine.hasItem('usb_drive')).toBe(true);
    expect(engine.isHotspotRemoved('cafetera')).toBe(true);

    // 3. Talk to Ana again — now she knows we have USB
    result = engine.interactCharacter('ana');
    expect(result!.text).toContain('You found it');
    expect(engine.hasFlag('talked_to_ana')).toBe(true);

    // 4. Talk to Carlos — gives us server key
    result = engine.interactCharacter('carlos');
    expect(result!.text).toContain('take the server key');
    expect(engine.hasItem('server_key')).toBe(true);

    // 5. Use server key on door — go to server_room
    result = engine.interactHotspot('puerta_server', 'server_key');
    expect(result!.text).toContain('door slides open');
    expect(engine.getState().currentScene).toBe('server_room');

    // 6. Use USB on server — win!
    result = engine.interactHotspot('servidor_principal', 'usb_drive');
    expect(result!.text).toContain('deploy the fix');
    expect(won).toBe(true);

    // Verify callbacks were fired
    expect(sceneChanges).toContain('server_room');
    expect(inventoryChanges.length).toBeGreaterThanOrEqual(2);
  });
});
