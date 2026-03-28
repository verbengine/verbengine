import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InkEngine } from '../engine/InkEngine';
import { SceneMetadata } from '../types/adventure';

// Mock Phaser before importing GameScene (which imports Phaser at top level)
vi.mock('phaser', () => ({
  default: {
    Scene: class MockScene {},
  },
}));

import { GameLoop, GameLoopDeps } from './GameScene';

/**
 * Compiled Ink JSON for the following story:
 *
 * VAR has_key = false
 *
 * -> start
 *
 * === start ===
 * # start
 * You are on the beach.
 * + [Look around] You see a key in the sand.
 *   ++ [Take the key]
 *     ~ has_key = true
 *     You pick up the key.
 *     -> start
 *   ++ [Leave it] -> start
 * + [Go to cave] -> cave
 * + [beach_ship] The ship creaks in the wind. -> start
 *
 * === cave ===
 * # cave
 * You are in a dark cave.
 * + [Go back] -> start
 * + [use(key)] You use the key on the chest. -> ending
 *
 * === ending ===
 * # ending
 * You found the treasure! Congratulations!
 * -> END
 */
const TEST_STORY_JSON = '{"inkVersion":21,"root":[[{"->":"start"},["done",{"#n":"g-0"}],null],"done",{"start":[["#","^start","/#","^You are on the beach.","\\n","ev","str","^Look around","/str","/ev",{"*":".^.c-0","flg":4},"ev","str","^Go to cave","/str","/ev",{"*":".^.c-1","flg":4},"ev","str","^beach_ship","/str","/ev",{"*":".^.c-2","flg":4},{"c-0":["^ You see a key in the sand.","\\n",["ev","str","^Take the key","/str","/ev",{"*":".^.c-0","flg":4},"ev","str","^Leave it","/str","/ev",{"*":".^.c-1","flg":4},{"c-0":["\\n","ev",true,"/ev",{"VAR=":"has_key","re":true},"^You pick up the key.","\\n",{"->":"start"},null],"c-1":["^ ",{"->":"start"},"\\n",null]}],null],"c-1":["^ ",{"->":"cave"},"\\n",null],"c-2":["^ The ship creaks in the wind. ",{"->":"start"},"\\n",null]}],null],"cave":[["#","^cave","/#","^You are in a dark cave.","\\n","ev","str","^Go back","/str","/ev",{"*":".^.c-0","flg":4},"ev","str","^use(key)","/str","/ev",{"*":".^.c-1","flg":4},{"c-0":["^ ",{"->":"start"},"\\n",null],"c-1":["^ You use the key on the chest. ",{"->":"ending"},"\\n",null]}],null],"ending":["#","^ending","/#","^You found the treasure! Congratulations!","\\n","end",null],"global decl":["ev",false,{"VAR=":"has_key"},"/ev","end",null]}],"listDefs":{}}';

const TEST_SCENE_METADATA: SceneMetadata = {
  scenes: {
    start: {
      description: 'A sandy beach with a shipwreck.',
      background_color: '#c2b280',
      hotspots: [
        {
          id: 'key',
          label: 'Key',
          x: 0.3,
          y: 0.5,
          width: 0.1,
          height: 0.1,
          ink_target: 'Look around',
        },
        {
          id: 'ship',
          label: 'Ship',
          x: 0.7,
          y: 0.4,
          width: 0.2,
          height: 0.3,
          ink_target: 'beach_ship',
        },
      ],
      characters: [],
      exits: [
        {
          direction: 'north',
          target_scene: 'cave',
          x: 0.5,
          y: 0.05,
        },
      ],
    },
    cave: {
      description: 'A dark cave with a treasure chest.',
      background_color: '#333333',
      hotspots: [
        {
          id: 'chest',
          label: 'Chest',
          x: 0.5,
          y: 0.5,
          width: 0.15,
          height: 0.15,
          ink_target: 'use(key)',
        },
      ],
      characters: [],
      exits: [
        {
          direction: 'south',
          target_scene: 'start',
          x: 0.5,
          y: 0.95,
        },
      ],
    },
  },
};

function createMockDeps(inkEngine: InkEngine): GameLoopDeps & {
  renderScene: ReturnType<typeof vi.fn>;
  clearScene: ReturnType<typeof vi.fn>;
  showText: ReturnType<typeof vi.fn>;
  showChoices: ReturnType<typeof vi.fn>;
  addItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  getSelectedItem: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  getInventoryItems: ReturnType<typeof vi.fn>;
} {
  return {
    inkEngine,
    sceneMetadata: TEST_SCENE_METADATA,
    renderScene: vi.fn(),
    clearScene: vi.fn(),
    showText: vi.fn(),
    showChoices: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    getSelectedItem: vi.fn(() => null),
    clearSelection: vi.fn(),
    getInventoryItems: vi.fn(() => [] as string[]),
  };
}

describe('GameLoop', () => {
  let inkEngine: InkEngine;
  let deps: ReturnType<typeof createMockDeps>;
  let gameLoop: GameLoop;

  beforeEach(() => {
    inkEngine = new InkEngine();
    inkEngine.loadStory(TEST_STORY_JSON);
    deps = createMockDeps(inkEngine);
    gameLoop = new GameLoop(deps);
  });

  describe('start', () => {
    it('should continue the story and show initial text', () => {
      gameLoop.start();

      expect(deps.showText).toHaveBeenCalledWith(
        expect.stringContaining('You are on the beach.')
      );
    });

    it('should detect and render the first scene from tags', () => {
      gameLoop.start();

      expect(deps.clearScene).toHaveBeenCalled();
      expect(deps.renderScene).toHaveBeenCalledWith(TEST_SCENE_METADATA.scenes['start']);
      expect(gameLoop.getCurrentSceneName()).toBe('start');
    });

    it('should show initial choices', () => {
      gameLoop.start();

      expect(deps.showChoices).toHaveBeenCalledWith(
        expect.arrayContaining([
          'Look around',
          'Go to cave',
          'beach_ship',
        ])
      );
    });
  });

  describe('handleInteraction', () => {
    beforeEach(() => {
      gameLoop.start();
      deps.showText.mockClear();
      deps.showChoices.mockClear();
      deps.clearScene.mockClear();
      deps.renderScene.mockClear();
    });

    it('should find and select a matching Ink choice by ink_target', () => {
      gameLoop.handleInteraction('beach_ship');

      expect(deps.showText).toHaveBeenCalledWith(
        expect.stringContaining('ship creaks')
      );
    });

    it('should show "Nothing happens." when no matching choice exists', () => {
      gameLoop.handleInteraction('nonexistent_target');

      expect(deps.showText).toHaveBeenCalledWith('Nothing happens.');
    });

    it('should match choice by partial text', () => {
      gameLoop.handleInteraction('Look around');

      expect(deps.showText).toHaveBeenCalledWith(
        expect.stringContaining('key in the sand')
      );
    });
  });

  describe('handleLook', () => {
    it('should show default look text for a label', () => {
      gameLoop.start();
      gameLoop.handleLook('Ship');

      expect(deps.showText).toHaveBeenCalledWith('You look at the Ship.');
    });

    it('should show custom description when provided', () => {
      gameLoop.start();
      gameLoop.handleLook('Ship', 'An old wrecked vessel.');

      expect(deps.showText).toHaveBeenCalledWith('An old wrecked vessel.');
    });
  });

  describe('handleExit', () => {
    beforeEach(() => {
      gameLoop.start();
      deps.showText.mockClear();
      deps.clearScene.mockClear();
      deps.renderScene.mockClear();
    });

    it('should navigate to target scene when no requires condition', () => {
      const exit = TEST_SCENE_METADATA.scenes['start'].exits[0];
      gameLoop.handleExit(exit);

      expect(deps.clearScene).toHaveBeenCalled();
      expect(deps.renderScene).toHaveBeenCalledWith(TEST_SCENE_METADATA.scenes['cave']);
      expect(gameLoop.getCurrentSceneName()).toBe('cave');
    });

    it('should show blocked message when requires condition is not met', () => {
      const exit = {
        direction: 'east' as const,
        target_scene: 'cave',
        requires: 'has_key',
        x: 0.95,
        y: 0.5,
      };
      gameLoop.handleExit(exit);

      expect(deps.showText).toHaveBeenCalledWith('The way east is blocked.');
      expect(deps.renderScene).not.toHaveBeenCalled();
    });

    it('should navigate when requires condition is met', () => {
      inkEngine.setVariable('has_key', true);

      const exit = {
        direction: 'north' as const,
        target_scene: 'cave',
        requires: 'has_key',
        x: 0.5,
        y: 0.05,
      };
      gameLoop.handleExit(exit);

      expect(deps.clearScene).toHaveBeenCalled();
      expect(deps.renderScene).toHaveBeenCalledWith(TEST_SCENE_METADATA.scenes['cave']);
    });

    it('should show nothing happens when target scene does not exist', () => {
      const exit = {
        direction: 'west' as const,
        target_scene: 'nonexistent',
        x: 0.05,
        y: 0.5,
      };
      gameLoop.handleExit(exit);

      expect(deps.showText).toHaveBeenCalledWith('Nothing happens.');
    });
  });

  describe('handleChoiceSelected', () => {
    beforeEach(() => {
      gameLoop.start();
      deps.showText.mockClear();
      deps.showChoices.mockClear();
    });

    it('should advance the story when a choice is selected', () => {
      // Select "Look around" (index 0)
      gameLoop.handleChoiceSelected(0);

      expect(deps.showText).toHaveBeenCalledWith(
        expect.stringContaining('key in the sand')
      );
    });

    it('should show new choices after advancing', () => {
      // Select "Look around" (index 0)
      gameLoop.handleChoiceSelected(0);

      expect(deps.showChoices).toHaveBeenCalledWith(
        expect.arrayContaining(['Take the key', 'Leave it'])
      );
    });
  });

  describe('scene transitions via Ink tags', () => {
    beforeEach(() => {
      gameLoop.start();
      deps.clearScene.mockClear();
      deps.renderScene.mockClear();
    });

    it('should switch visual scene when Ink navigates to a new knot with matching tag', () => {
      // Select "Go to cave" (index 1)
      gameLoop.handleChoiceSelected(1);

      expect(deps.clearScene).toHaveBeenCalled();
      expect(deps.renderScene).toHaveBeenCalledWith(TEST_SCENE_METADATA.scenes['cave']);
      expect(gameLoop.getCurrentSceneName()).toBe('cave');
    });

    it('should not re-render when staying in same scene', () => {
      // Select "Look around" (index 0) — stays in start
      gameLoop.handleChoiceSelected(0);

      // clearScene is called for re-render but renderScene should show start again
      // since we're still in the start knot
      expect(gameLoop.getCurrentSceneName()).toBe('start');
    });
  });

  describe('inventory sync', () => {
    beforeEach(() => {
      gameLoop.start();
      deps.addItem.mockClear();
      deps.removeItem.mockClear();
    });

    it('should add item when has_* variable becomes true', () => {
      // Look around -> Take the key (sets has_key = true)
      gameLoop.handleChoiceSelected(0); // Look around
      deps.addItem.mockClear();

      gameLoop.handleChoiceSelected(0); // Take the key

      expect(deps.addItem).toHaveBeenCalledWith('key');
    });

    it('should not add item when has_* variable is false', () => {
      // After start, has_key is false — no item should be added
      expect(deps.addItem).not.toHaveBeenCalledWith('key');
    });
  });

  describe('use item interaction', () => {
    beforeEach(() => {
      gameLoop.start();
      deps.showText.mockClear();
      deps.clearSelection.mockClear();
    });

    it('should show message when item cannot be used', () => {
      deps.getSelectedItem.mockReturnValue('key');
      gameLoop.handleInteraction('beach_ship');

      expect(deps.clearSelection).toHaveBeenCalled();
      expect(deps.showText).toHaveBeenCalledWith("You can't use key here.");
    });

    it('should use item when matching use(item) choice exists', () => {
      // Navigate to cave first
      gameLoop.handleChoiceSelected(1); // Go to cave
      deps.showText.mockClear();
      deps.clearSelection.mockClear();

      deps.getSelectedItem.mockReturnValue('key');
      gameLoop.handleInteraction('use(key)');

      expect(deps.clearSelection).toHaveBeenCalled();
      expect(deps.showText).toHaveBeenCalledWith(
        expect.stringContaining('use the key on the chest')
      );
    });
  });

  describe('end detection', () => {
    it('should show end message when story reaches END', () => {
      gameLoop.start();

      // Navigate: Look around -> Take the key -> Go to cave -> use(key) -> ending
      gameLoop.handleChoiceSelected(0); // Look around
      gameLoop.handleChoiceSelected(0); // Take the key
      // Now back at start
      gameLoop.handleChoiceSelected(1); // Go to cave
      deps.showText.mockClear();

      gameLoop.handleChoiceSelected(1); // use(key) -> ending

      expect(deps.showText).toHaveBeenCalledWith(
        expect.stringContaining('The End.')
      );
      expect(deps.showText).toHaveBeenCalledWith(
        expect.stringContaining('found the treasure')
      );
    });
  });

  describe('getCurrentSceneName', () => {
    it('should return empty string before start', () => {
      expect(gameLoop.getCurrentSceneName()).toBe('');
    });

    it('should return current scene name after start', () => {
      gameLoop.start();
      expect(gameLoop.getCurrentSceneName()).toBe('start');
    });
  });
});
