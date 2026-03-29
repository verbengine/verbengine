import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseVerb } from '../engine/VerbParser';
import { AdventureEngine } from '../engine/AdventureEngine';
import { InteractionHandler, InteractionCallbacks } from '../engine/InteractionHandler';
import type { AdventureData } from '../types/adventure-v2';

/**
 * E2E test: parses the actual .verb file and validates the full adventure flow
 * from start to win using VerbParser + AdventureEngine + InteractionHandler.
 */

function loadVerbFile(): string {
  const filePath = join(__dirname, '../../dsl/examples/missing-usb/adventure.verb');
  return readFileSync(filePath, 'utf-8');
}

interface BubbleTextStub {
  showBubble: ReturnType<typeof vi.fn>;
  showNamedBubble: ReturnType<typeof vi.fn>;
  clearAll: ReturnType<typeof vi.fn>;
}

function createBubbleTextStub(): BubbleTextStub {
  return {
    showBubble: vi.fn(),
    showNamedBubble: vi.fn(),
    clearAll: vi.fn(),
  };
}

describe('AdventureScene E2E — The Missing USB', () => {
  let adventure: AdventureData;
  let engine: AdventureEngine;
  let handler: InteractionHandler;
  let bubbleStub: BubbleTextStub;
  let callbacks: InteractionCallbacks;
  let playerPos: { x: number; y: number };
  let sceneChanges: string[];
  let inventoryChanges: string[][];
  let winTriggered: boolean;

  beforeEach(() => {
    // Parse the actual .verb file
    const source = loadVerbFile();
    adventure = parseVerb(source);

    engine = new AdventureEngine(adventure);
    bubbleStub = createBubbleTextStub();

    playerPos = { x: 7, y: 14 };
    sceneChanges = [];
    inventoryChanges = [];
    winTriggered = false;

    callbacks = {
      walkTo: (_x: number, _y: number, onArrive: () => void) => {
        // Immediately arrive for testing
        onArrive();
      },
      getPlayerPosition: () => playerPos,
      onSceneChange: (sceneId: string) => {
        sceneChanges.push(sceneId);
      },
      onInventoryChange: (inventory: string[]) => {
        inventoryChanges.push([...inventory]);
      },
      onWin: () => {
        winTriggered = true;
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler = new InteractionHandler(engine, bubbleStub as any, callbacks);
  });

  describe('VerbParser produces correct structure', () => {
    it('parses the adventure title', () => {
      expect(adventure.title).toBe('The Missing USB');
    });

    it('parses the start scene', () => {
      expect(adventure.startScene).toBe('oficina');
    });

    it('parses all items', () => {
      expect(Object.keys(adventure.items)).toEqual(['usb_drive', 'coffee_cup', 'server_key']);
      expect(adventure.items.usb_drive.name).toBe('USB Drive');
      expect(adventure.items.server_key.name).toBe('Server Room Key');
    });

    it('parses all scenes', () => {
      expect(Object.keys(adventure.scenes)).toEqual(['oficina', 'pasillo', 'server_room']);
    });

    it('parses oficina hotspots', () => {
      const oficina = adventure.scenes.oficina;
      expect(oficina.hotspots).toHaveLength(3);
      expect(oficina.hotspots.map(h => h.id)).toEqual([
        'escritorio_ana',
        'cafetera',
        'puerta_server',
      ]);
    });

    it('parses oficina characters', () => {
      const oficina = adventure.scenes.oficina;
      expect(oficina.characters).toHaveLength(2);
      expect(oficina.characters[0].id).toBe('ana');
      expect(oficina.characters[0].position).toEqual([5, 3]);
      expect(oficina.characters[1].id).toBe('carlos');
      expect(oficina.characters[1].position).toEqual([12, 13]);
    });

    it('parses oficina exits', () => {
      const oficina = adventure.scenes.oficina;
      expect(oficina.exits).toHaveLength(1);
      expect(oficina.exits[0].id).toBe('pasillo_norte');
      expect(oficina.exits[0].target).toBe('pasillo');
    });

    it('parses pasillo with locked exit', () => {
      const pasillo = adventure.scenes.pasillo;
      expect(pasillo.exits).toHaveLength(2);
      const serverExit = pasillo.exits.find(e => e.id === 'server_room_este');
      expect(serverExit).toBeDefined();
      expect(serverExit?.requires).toBe('server_key');
      expect(serverExit?.locked).toBe('You need a key card to enter.');
    });

    it('parses server_room with win condition', () => {
      const serverRoom = adventure.scenes.server_room;
      expect(serverRoom.hotspots).toHaveLength(1);
      const servidor = serverRoom.hotspots[0];
      expect(servidor.id).toBe('servidor_principal');
      // The use(usb_drive) interaction should have a win action
      const useUsb = servidor.use.find(
        u => u.condition?.type === 'has' && u.condition.target === 'usb_drive',
      );
      expect(useUsb).toBeDefined();
      expect(useUsb?.actions).toContainEqual({ type: 'win' });
    });

    it('parses map paths for all scenes', () => {
      expect(adventure.scenes.oficina.map).toBe('maps/oficina.json');
      expect(adventure.scenes.pasillo.map).toBe('maps/pasillo.json');
      expect(adventure.scenes.server_room.map).toBe('maps/server_room.json');
    });
  });

  describe('Full adventure walkthrough', () => {
    it('starts in oficina', () => {
      expect(engine.getState().currentScene).toBe('oficina');
    });

    it('step 1: talk to Ana before having USB', () => {
      handler.handleCharacterClick('ana', 5, 3);
      expect(bubbleStub.showNamedBubble).toHaveBeenCalledWith(
        5, 3, 'ana',
        'Hey! Have you seen the USB drive? I left it somewhere around here...',
      );
    });

    it('step 2: take USB from cafetera', () => {
      handler.handleHotspotClick('cafetera', 10, 11);
      expect(engine.hasItem('usb_drive')).toBe(true);
      expect(bubbleStub.showBubble).toHaveBeenCalledWith(
        10, 11,
        'You grab the USB drive hidden behind the machine!',
      );
    });

    it('step 3: talk to Ana after having USB', () => {
      // Get USB first
      engine.interactHotspot('cafetera');
      expect(engine.hasItem('usb_drive')).toBe(true);

      handler.handleCharacterClick('ana', 5, 3);
      expect(bubbleStub.showNamedBubble).toHaveBeenCalledWith(
        5, 3, 'ana',
        'You found it! Great. Now we need to get into the server room. Talk to Carlos, he has the key.',
      );
    });

    it('step 4: talk to Carlos after having USB to get server key', () => {
      // Get USB first
      engine.interactHotspot('cafetera');

      handler.handleCharacterClick('carlos', 12, 13);
      expect(engine.hasItem('server_key')).toBe(true);
      expect(bubbleStub.showNamedBubble).toHaveBeenCalledWith(
        12, 13, 'carlos',
        'Oh, you found the USB? Here, take the server key.',
      );
    });

    it('step 5: use server key on puerta_server to go to server_room', () => {
      // Get USB + server key
      engine.interactHotspot('cafetera');
      engine.interactCharacter('carlos');

      handler.setSelectedItem('server_key');
      handler.handleHotspotClick('puerta_server', 14, 0);

      expect(sceneChanges).toContain('server_room');
    });

    it('step 6: complete walkthrough — insert USB to win', () => {
      // Full walkthrough
      engine.interactHotspot('cafetera');           // get USB
      engine.interactCharacter('carlos');            // get server key
      engine.interactHotspot('puerta_server', 'server_key'); // go to server_room

      // Now in server_room
      expect(engine.getState().currentScene).toBe('server_room');

      // Use USB on servidor_principal
      handler.setSelectedItem('usb_drive');
      handler.handleHotspotClick('servidor_principal', 5, 5);

      expect(winTriggered).toBe(true);
    });
  });

  describe('Locked exits', () => {
    it('cannot enter server room via pasillo without key', () => {
      // Go to pasillo first
      engine.executeActions([{ type: 'go', target: 'pasillo' }]);
      expect(engine.getState().currentScene).toBe('pasillo');

      handler.handleExitClick('server_room_este', 24, 2);
      expect(bubbleStub.showBubble).toHaveBeenCalledWith(
        24, 2,
        'You need a key card to enter.',
      );
      expect(engine.getState().currentScene).toBe('pasillo');
    });

    it('can enter server room via pasillo with key', () => {
      // Get items and go to pasillo
      engine.interactHotspot('cafetera');
      engine.interactCharacter('carlos');
      engine.executeActions([{ type: 'go', target: 'pasillo' }]);

      handler.handleExitClick('server_room_este', 24, 2);
      expect(sceneChanges).toContain('server_room');
    });
  });

  describe('Inventory management', () => {
    it('starts with empty inventory', () => {
      expect(engine.getInventory()).toEqual([]);
    });

    it('collects items through interactions', () => {
      engine.interactHotspot('cafetera');
      expect(engine.getInventory()).toContain('usb_drive');

      // Carlos gives key when player has USB
      engine.interactCharacter('carlos');
      expect(engine.getInventory()).toContain('server_key');
    });

    it('tracks inventory changes via handler', () => {
      handler.handleHotspotClick('cafetera', 10, 11);
      expect(inventoryChanges.length).toBeGreaterThan(0);
      const lastChange = inventoryChanges[inventoryChanges.length - 1];
      expect(lastChange).toContain('usb_drive');
    });
  });

  describe('Selected item state', () => {
    it('starts with no selected item', () => {
      expect(handler.getSelectedItem()).toBeNull();
    });

    it('can select and deselect items', () => {
      handler.setSelectedItem('usb_drive');
      expect(handler.getSelectedItem()).toBe('usb_drive');

      handler.setSelectedItem(null);
      expect(handler.getSelectedItem()).toBeNull();
    });
  });

  describe('Hotspot interactions', () => {
    it('cafetera take gives USB drive', () => {
      const result = engine.interactHotspot('cafetera');
      expect(result).not.toBeNull();
      expect(result?.text).toBe('You grab the USB drive hidden behind the machine!');
      expect(engine.hasItem('usb_drive')).toBe(true);
    });

    it('escritorio default use shows nothing useful message', () => {
      const result = engine.interactHotspot('escritorio_ana');
      expect(result).not.toBeNull();
      expect(result?.text).toBe('Nothing useful here... just papers.');
    });

    it('escritorio use with server_key triggers conditional', () => {
      engine.executeActions([{ type: 'get', target: 'server_key' }]);
      const result = engine.interactHotspot('escritorio_ana', 'server_key');
      expect(result).not.toBeNull();
      expect(result?.text).toBe('You plug the key card into the reader. Access granted!');
    });
  });
});
