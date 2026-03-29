import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdventureEngine } from './AdventureEngine';
import { InteractionHandler, InteractionCallbacks } from './InteractionHandler';
import { AdventureData } from '../types/adventure-v2';

/**
 * Minimal BubbleText stub — BubbleText depends on Phaser.Scene which
 * is not available in a node test environment. We mock the interface.
 */
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

function buildTestAdventure(): AdventureData {
  return {
    title: 'The Missing USB',
    startScene: 'oficina',
    items: {
      usb_drive: { id: 'usb_drive', name: 'USB Drive', description: 'A small black USB drive' },
      server_key: { id: 'server_key', name: 'Server Room Key', description: 'A metallic key card' },
    },
    scenes: {
      oficina: {
        id: 'oficina',
        map: 'office_main',
        hotspots: [
          {
            id: 'escritorio',
            position: [4, 3],
            look: 'A messy desk.',
            use: [
              { text: 'Nothing useful here.', actions: [] },
              {
                condition: { type: 'has', target: 'server_key' },
                text: 'You use the key card on the desk reader.',
                actions: [{ type: 'set', target: 'desk_unlocked' }],
              },
            ],
          },
          {
            id: 'cafetera',
            position: [10, 11],
            look: 'A coffee machine.',
            use: [],
            take: {
              text: 'You grab the USB drive!',
              actions: [
                { type: 'get', target: 'usb_drive' },
                { type: 'remove_hotspot', target: 'cafetera' },
              ],
            },
          },
          {
            id: 'terminal',
            position: [15, 5],
            look: 'A computer terminal.',
            use: [
              {
                condition: { type: 'has', target: 'usb_drive' },
                text: 'You insert the USB. Data copied. You win!',
                actions: [{ type: 'win' }],
              },
              { text: 'The terminal asks for a USB drive.', actions: [] },
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
                text: 'You found it! Talk to Carlos for the key.',
                actions: [{ type: 'set', target: 'talked_to_ana' }],
              },
              {
                text: 'Hey! Have you seen the USB drive?',
                actions: [],
              },
            ],
          },
        ],
        exits: [
          {
            id: 'exit_pasillo',
            position: [0, 6],
            target: 'pasillo',
            look: 'A corridor leads to the hallway.',
          },
          {
            id: 'exit_server',
            position: [23, 12],
            target: 'server_room',
            requires: 'server_key',
            locked: 'The door is locked. You need a key card.',
            look: 'Heavy door with a card reader.',
          },
        ],
      },
      pasillo: {
        id: 'pasillo',
        map: 'hallway',
        hotspots: [],
        characters: [],
        exits: [
          {
            id: 'exit_oficina',
            position: [12, 0],
            target: 'oficina',
            look: 'Back to the office.',
          },
        ],
      },
      server_room: {
        id: 'server_room',
        map: 'server',
        hotspots: [],
        characters: [],
        exits: [],
      },
    },
  };
}

describe('InteractionHandler', () => {
  let engine: AdventureEngine;
  let bubbleText: BubbleTextStub;
  let callbacks: InteractionCallbacks;
  let handler: InteractionHandler;
  let walkToCallback: ((onArrive: () => void) => void) | null;

  beforeEach(() => {
    engine = new AdventureEngine(buildTestAdventure());
    bubbleText = createBubbleTextStub();
    walkToCallback = null;

    callbacks = {
      walkTo: vi.fn((x: number, y: number, onArrive: () => void) => {
        // Store the callback to simulate arrival
        walkToCallback = () => onArrive();
        // Auto-arrive for most tests
        onArrive();
      }),
      getPlayerPosition: vi.fn(() => ({ x: 8, y: 8 })),
      onSceneChange: vi.fn(),
      onInventoryChange: vi.fn(),
      onWin: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler = new InteractionHandler(engine, bubbleText as any, callbacks);
  });

  // --- Hotspot clicks ---

  it('should walk to adjacent tile then interact with hotspot', () => {
    handler.handleHotspotClick('escritorio', 4, 3);

    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(bubbleText.showBubble).toHaveBeenCalledWith(4, 3, 'Nothing useful here.');
  });

  it('should show hotspot take text and trigger inventory callback', () => {
    handler.handleHotspotClick('cafetera', 10, 11);

    expect(bubbleText.showBubble).toHaveBeenCalledWith(10, 11, 'You grab the USB drive!');
    expect(callbacks.onInventoryChange).toHaveBeenCalledOnce();
    expect(engine.hasItem('usb_drive')).toBe(true);
  });

  it('should not show bubble for non-existent hotspot', () => {
    handler.handleHotspotClick('nonexistent', 0, 0);

    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(bubbleText.showBubble).not.toHaveBeenCalled();
  });

  it('should handle removed hotspot gracefully', () => {
    // Take the item first (removes the hotspot)
    handler.handleHotspotClick('cafetera', 10, 11);
    bubbleText.showBubble.mockClear();
    (callbacks.onInventoryChange as ReturnType<typeof vi.fn>).mockClear();

    // Try again — hotspot is removed
    handler.handleHotspotClick('cafetera', 10, 11);

    expect(bubbleText.showBubble).not.toHaveBeenCalled();
  });

  // --- Character clicks ---

  it('should show named bubble when clicking a character', () => {
    handler.handleCharacterClick('ana', 5, 3);

    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(bubbleText.showNamedBubble).toHaveBeenCalledWith(
      5,
      3,
      'ana',
      'Hey! Have you seen the USB drive?'
    );
  });

  it('should show conditional character dialogue when condition is met', () => {
    // Give player the USB drive
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);

    handler.handleCharacterClick('ana', 5, 3);

    expect(bubbleText.showNamedBubble).toHaveBeenCalledWith(
      5,
      3,
      'ana',
      'You found it! Talk to Carlos for the key.'
    );
  });

  it('should not show bubble for non-existent character', () => {
    handler.handleCharacterClick('nonexistent', 0, 0);

    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(bubbleText.showNamedBubble).not.toHaveBeenCalled();
  });

  // --- Exit clicks ---

  it('should trigger scene change when exit has no requirements', () => {
    handler.handleExitClick('exit_pasillo', 0, 6);

    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(callbacks.onSceneChange).toHaveBeenCalledWith('pasillo');
  });

  it('should show locked text when exit requirements are not met', () => {
    handler.handleExitClick('exit_server', 23, 12);

    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(bubbleText.showBubble).toHaveBeenCalledWith(
      23,
      12,
      'The door is locked. You need a key card.'
    );
    expect(callbacks.onSceneChange).not.toHaveBeenCalled();
  });

  it('should trigger scene change when exit requirements are met', () => {
    engine.executeActions([{ type: 'get', target: 'server_key' }]);

    handler.handleExitClick('exit_server', 23, 12);

    expect(callbacks.onSceneChange).toHaveBeenCalledWith('server_room');
    expect(bubbleText.showBubble).not.toHaveBeenCalled();
  });

  it('should handle non-existent exit gracefully', () => {
    handler.handleExitClick('nonexistent', 0, 0);

    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(callbacks.onSceneChange).not.toHaveBeenCalled();
    expect(bubbleText.showBubble).not.toHaveBeenCalled();
  });

  // --- Use item on hotspot ---

  it('should use selected item on hotspot when item is selected', () => {
    engine.executeActions([{ type: 'get', target: 'server_key' }]);
    handler.setSelectedItem('server_key');

    handler.handleHotspotClick('escritorio', 4, 3);

    expect(bubbleText.showBubble).toHaveBeenCalledWith(
      4,
      3,
      'You use the key card on the desk reader.'
    );
  });

  it('should handle useItemOn directly', () => {
    engine.executeActions([{ type: 'get', target: 'server_key' }]);

    handler.handleUseItemOn('escritorio', 'server_key', 4, 3);

    expect(bubbleText.showBubble).toHaveBeenCalledWith(
      4,
      3,
      'You use the key card on the desk reader.'
    );
  });

  it('should not show bubble when using wrong item on hotspot', () => {
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);

    handler.handleUseItemOn('escritorio', 'usb_drive', 4, 3);

    expect(bubbleText.showBubble).not.toHaveBeenCalled();
  });

  // --- Selected item management ---

  it('should start with no selected item', () => {
    expect(handler.getSelectedItem()).toBeNull();
  });

  it('should set and get selected item', () => {
    handler.setSelectedItem('usb_drive');
    expect(handler.getSelectedItem()).toBe('usb_drive');
  });

  it('should clear selected item when set to null', () => {
    handler.setSelectedItem('usb_drive');
    handler.setSelectedItem(null);
    expect(handler.getSelectedItem()).toBeNull();
  });

  // --- Win condition ---

  it('should trigger onWin callback when win action is executed', () => {
    engine.executeActions([{ type: 'get', target: 'usb_drive' }]);
    handler.setSelectedItem('usb_drive');

    handler.handleHotspotClick('terminal', 15, 5);

    expect(callbacks.onWin).toHaveBeenCalledOnce();
    expect(bubbleText.showBubble).toHaveBeenCalledWith(
      15,
      5,
      'You insert the USB. Data copied. You win!'
    );
  });

  // --- Walk-to behavior ---

  it('should calculate adjacent position toward player', () => {
    // Player at (8,8), target at (4,3) — adjacent should be (5,4)
    handler.handleHotspotClick('escritorio', 4, 3);

    const walkCall = (callbacks.walkTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(walkCall[0]).toBe(5); // x: target(4) + 1 (toward player at 8)
    expect(walkCall[1]).toBe(4); // y: target(3) + 1 (toward player at 8)
  });

  it('should not walk if player is already adjacent', () => {
    (callbacks.getPlayerPosition as ReturnType<typeof vi.fn>).mockReturnValue({ x: 5, y: 3 });

    handler.handleHotspotClick('escritorio', 4, 3);

    // Player is already adjacent, walkTo should receive player position
    const walkCall = (callbacks.walkTo as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(walkCall[0]).toBe(5);
    expect(walkCall[1]).toBe(3);
  });

  // --- Delayed walk arrival ---

  it('should not interact until walk completes', () => {
    let pendingArrive: (() => void) | null = null;

    (callbacks.walkTo as ReturnType<typeof vi.fn>).mockImplementation(
      (_x: number, _y: number, onArrive: () => void) => {
        pendingArrive = onArrive;
        // Do NOT auto-arrive
      }
    );

    handler.handleHotspotClick('escritorio', 4, 3);

    // Walk started but not arrived yet
    expect(callbacks.walkTo).toHaveBeenCalledOnce();
    expect(bubbleText.showBubble).not.toHaveBeenCalled();

    // Now arrive
    pendingArrive!();
    expect(bubbleText.showBubble).toHaveBeenCalledWith(4, 3, 'Nothing useful here.');
  });

  // --- Inventory change callback on get action ---

  it('should call onInventoryChange when item is obtained', () => {
    handler.handleHotspotClick('cafetera', 10, 11);

    expect(callbacks.onInventoryChange).toHaveBeenCalledOnce();
    const inventoryArg = (callbacks.onInventoryChange as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(inventoryArg).toContain('usb_drive');
  });
});
