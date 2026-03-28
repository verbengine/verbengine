import { describe, it, expect, vi } from 'vitest';
import { InkEngine } from './engine/InkEngine';
import { loadStaticAdventure } from './scenes/adventure-loader';

vi.mock('phaser', () => ({
  default: {
    Scene: class MockScene {},
  },
}));

import { GameLoop, GameLoopDeps } from './scenes/GameScene';

function createTrackedDeps(inkEngine: InkEngine, metadata: GameLoopDeps['sceneMetadata']) {
  const inventory: string[] = [];

  const deps: GameLoopDeps & {
    showText: ReturnType<typeof vi.fn>;
    showChoices: ReturnType<typeof vi.fn>;
    renderScene: ReturnType<typeof vi.fn>;
    clearScene: ReturnType<typeof vi.fn>;
    addItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    getSelectedItem: ReturnType<typeof vi.fn>;
    clearSelection: ReturnType<typeof vi.fn>;
    getInventoryItems: ReturnType<typeof vi.fn>;
  } = {
    inkEngine,
    sceneMetadata: metadata,
    renderScene: vi.fn(),
    clearScene: vi.fn(),
    showText: vi.fn(),
    showChoices: vi.fn(),
    addItem: vi.fn((item: string) => {
      if (!inventory.includes(item)) inventory.push(item);
    }),
    removeItem: vi.fn((item: string) => {
      const idx = inventory.indexOf(item);
      if (idx !== -1) inventory.splice(idx, 1);
    }),
    getSelectedItem: vi.fn(() => null),
    clearSelection: vi.fn(),
    getInventoryItems: vi.fn(() => [...inventory]),
  };

  return { deps, inventory };
}

/**
 * Helper to find a choice index by partial text match from the GameLoop's
 * current choices.
 */
function findChoice(gameLoop: GameLoop, partialText: string): number {
  const choices = gameLoop.getCurrentChoices();
  const match = choices.find((c) =>
    c.text.toLowerCase().includes(partialText.toLowerCase())
  );
  if (match === undefined) {
    throw new Error(
      `Choice "${partialText}" not found. Available: ${choices.map((c) => c.text).join(', ')}`
    );
  }
  return match.index;
}

describe('E2E: Pirate Adventure playthrough', () => {
  it('plays the pirate adventure from start to finish', () => {
    const adventure = loadStaticAdventure();
    const inkEngine = new InkEngine();
    inkEngine.loadStory(adventure.ink_script);

    const { deps, inventory } = createTrackedDeps(inkEngine, adventure.scene_metadata);
    const gameLoop = new GameLoop(deps);

    // Start the game
    gameLoop.start();

    // Verify we begin on the beach
    expect(deps.showText).toHaveBeenCalledWith(
      expect.stringContaining('sandy beach')
    );
    expect(deps.renderScene).toHaveBeenCalledWith(adventure.scene_metadata.scenes['beach']);
    expect(gameLoop.getCurrentSceneName()).toBe('beach');

    // Step 1: Look at the ship (via hotspot interaction)
    gameLoop.handleInteraction('beach_ship');
    expect(deps.showText).toHaveBeenCalledWith(
      expect.stringContaining('coil of rope')
    );

    // Step 2: Take the rope
    const takeRopeIdx = findChoice(gameLoop, 'Take the rope');
    gameLoop.handleChoiceSelected(takeRopeIdx);
    expect(deps.showText).toHaveBeenCalledWith(
      expect.stringContaining('grab the rope')
    );
    // Verify rope variable was set in Ink
    expect(inkEngine.getVariable('has_rope')).toBe(true);
    // Verify we are back on the beach
    expect(gameLoop.getCurrentSceneName()).toBe('beach');

    // Step 3: Go east to the village (via exit)
    const eastExit = adventure.scene_metadata.scenes['beach'].exits.find(
      (e) => e.direction === 'east'
    );
    expect(eastExit).toBeDefined();
    gameLoop.handleExit(eastExit!);
    expect(gameLoop.getCurrentSceneName()).toBe('village');

    // Step 4: Talk to the sailor (via character interaction)
    gameLoop.handleInteraction('village_sailor');
    expect(deps.showText).toHaveBeenCalledWith(
      expect.stringContaining('Arrr')
    );
    // Sailor gives has_key = true

    // Step 5: Go west back to the beach
    const westExit = adventure.scene_metadata.scenes['village'].exits.find(
      (e) => e.direction === 'west'
    );
    expect(westExit).toBeDefined();
    gameLoop.handleExit(westExit!);
    expect(gameLoop.getCurrentSceneName()).toBe('beach');

    // Verify has_key is now true (sailor gave it)
    expect(inkEngine.getVariable('has_key')).toBe(true);

    // Step 6: Go north to the cave (was locked before, now accessible)
    const northExit = adventure.scene_metadata.scenes['beach'].exits.find(
      (e) => e.direction === 'north'
    );
    expect(northExit).toBeDefined();
    expect(northExit!.requires).toBe('has_key');
    gameLoop.handleExit(northExit!);
    expect(gameLoop.getCurrentSceneName()).toBe('cave');

    // Step 7: Look at the chest (via hotspot interaction)
    // Since has_rope is true, this triggers the victory path
    expect(inkEngine.getVariable('has_rope')).toBe(true);
    gameLoop.handleInteraction('cave_chest');

    // Step 8: The Ink story checks has_rope and delivers victory text + END
    expect(deps.showText).toHaveBeenCalledWith(
      expect.stringContaining("Blackbeard's treasure")
    );
    expect(deps.showText).toHaveBeenCalledWith(
      expect.stringContaining('The End.')
    );
  });

  it('blocks the cave exit when has_key is false', () => {
    const adventure = loadStaticAdventure();
    const inkEngine = new InkEngine();
    inkEngine.loadStory(adventure.ink_script);

    const { deps } = createTrackedDeps(inkEngine, adventure.scene_metadata);
    const gameLoop = new GameLoop(deps);

    gameLoop.start();

    // Try to go north without has_key
    const northExit = adventure.scene_metadata.scenes['beach'].exits.find(
      (e) => e.direction === 'north'
    );
    expect(northExit).toBeDefined();

    deps.showText.mockClear();
    gameLoop.handleExit(northExit!);

    expect(deps.showText).toHaveBeenCalledWith('You need key to go there.');
    // Should still be on the beach
    expect(gameLoop.getCurrentSceneName()).toBe('beach');
  });

  it('shows "The chest is wedged tight" when looking at chest without rope', () => {
    const adventure = loadStaticAdventure();
    const inkEngine = new InkEngine();
    inkEngine.loadStory(adventure.ink_script);

    const { deps } = createTrackedDeps(inkEngine, adventure.scene_metadata);
    const gameLoop = new GameLoop(deps);

    gameLoop.start();

    // Go east to village
    const eastExit = adventure.scene_metadata.scenes['beach'].exits.find(
      (e) => e.direction === 'east'
    );
    gameLoop.handleExit(eastExit!);

    // Talk to sailor (get has_key)
    gameLoop.handleInteraction('village_sailor');

    // Go west to beach
    const westExit = adventure.scene_metadata.scenes['village'].exits.find(
      (e) => e.direction === 'west'
    );
    gameLoop.handleExit(westExit!);

    // Go north to cave (has_key is true now)
    const northExit = adventure.scene_metadata.scenes['beach'].exits.find(
      (e) => e.direction === 'north'
    );
    gameLoop.handleExit(northExit!);
    expect(gameLoop.getCurrentSceneName()).toBe('cave');

    // Look at chest without rope
    deps.showText.mockClear();
    gameLoop.handleInteraction('cave_chest');

    expect(deps.showText).toHaveBeenCalledWith(
      expect.stringContaining('wedged tight')
    );
  });
});
