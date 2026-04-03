import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CharacterController } from './CharacterController';
import type { TileDimensions } from './CharacterController';

/**
 * Tests for CharacterController.
 *
 * Since CharacterController depends on Phaser.Scene and EasyStar (both browser/canvas
 * based), we mock the minimal subset needed to exercise the public API without
 * spinning up a real game instance.
 */

// ── Minimal Phaser mock ───────────────────────────────────────────

function makeSpriteMock() {
  return {
    setScale: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setFlipX: vi.fn().mockReturnThis(),
    play: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0,
    anims: { currentAnim: null as { key: string } | null },
  };
}

function makeSceneMock(spriteMock = makeSpriteMock()) {
  const animsStore = new Set<string>();

  return {
    add: {
      sprite: vi.fn(() => spriteMock),
    },
    anims: {
      exists: vi.fn((key: string) => animsStore.has(key)),
      create: vi.fn((config: { key: string }) => {
        animsStore.add(config.key);
      }),
    },
    tweens: {
      add: vi.fn(),
    },
    _spriteMock: spriteMock,
    _animsStore: animsStore,
  };
}

// ── Minimal EasyStar mock ─────────────────────────────────────────

function makeEasyStarMock() {
  return {
    findPath: vi.fn(),
    calculate: vi.fn(),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────

const DEFAULT_DIMS: TileDimensions = {
  tileWidth: 32,
  tileHeight: 16,
  zoom: 3,
};

describe('CharacterController', () => {
  let scene: ReturnType<typeof makeSceneMock>;
  let easystar: ReturnType<typeof makeEasyStarMock>;
  let ctrl: CharacterController;

  beforeEach(() => {
    scene = makeSceneMock();
    easystar = makeEasyStarMock();
    // Cast to unknown then to the required types — mocks satisfy the used subset
    ctrl = new CharacterController(
      scene as unknown as Phaser.Scene,
      easystar as unknown as import('easystarjs'),
      DEFAULT_DIMS,
      'char_0',
    );
  });

  // ── createCharacter ────────────────────────────────────────────

  describe('createCharacter', () => {
    it('returns a sprite object', () => {
      const sprite = ctrl.createCharacter(2, 3);
      expect(sprite).toBeDefined();
      expect(scene.add.sprite).toHaveBeenCalledOnce();
    });

    it('registers walk and idle animations for all 4 directions', () => {
      ctrl.createCharacter(0, 0);

      const expectedAnims = [
        'char_0-walk-south', 'char_0-walk-north',
        'char_0-walk-east',  'char_0-walk-west',
        'char_0-idle-south', 'char_0-idle-north',
        'char_0-idle-east',  'char_0-idle-west',
      ];

      for (const key of expectedAnims) {
        expect(scene._animsStore.has(key)).toBe(true);
      }
    });

    it('sets the sprite scale to the zoom level', () => {
      ctrl.createCharacter(0, 0);
      expect(scene._spriteMock.setScale).toHaveBeenCalledWith(DEFAULT_DIMS.zoom);
    });

    it('sets sprite origin to (0.5, 1.0) — bottom-center', () => {
      ctrl.createCharacter(0, 0);
      expect(scene._spriteMock.setOrigin).toHaveBeenCalledWith(0.5, 1.0);
    });
  });

  // ── getPosition ────────────────────────────────────────────────

  describe('getPosition', () => {
    it('returns the initial grid position after createCharacter', () => {
      ctrl.createCharacter(4, 7);
      expect(ctrl.getPosition()).toEqual({ gridX: 4, gridY: 7 });
    });

    it('returns { gridX: 0, gridY: 0 } before createCharacter is called', () => {
      // Controller initialises to (0, 0)
      expect(ctrl.getPosition()).toEqual({ gridX: 0, gridY: 0 });
    });
  });

  // ── isMoving ───────────────────────────────────────────────────

  describe('isMoving', () => {
    it('returns false initially', () => {
      expect(ctrl.isMoving()).toBe(false);
    });

    it('returns false after createCharacter (still idle)', () => {
      ctrl.createCharacter(1, 1);
      expect(ctrl.isMoving()).toBe(false);
    });
  });

  // ── walkTo ─────────────────────────────────────────────────────

  describe('walkTo', () => {
    it('calls onComplete immediately when target equals current position', () => {
      ctrl.createCharacter(3, 3);
      const onComplete = vi.fn();
      ctrl.walkTo(3, 3, onComplete);
      expect(onComplete).toHaveBeenCalledOnce();
      expect(easystar.findPath).not.toHaveBeenCalled();
    });

    it('calls easystar.findPath and calculate for a different target', () => {
      ctrl.createCharacter(1, 1);
      ctrl.walkTo(5, 5);
      expect(easystar.findPath).toHaveBeenCalledOnce();
      expect(easystar.calculate).toHaveBeenCalledOnce();
    });

    it('fires onComplete when EasyStar returns no path', () => {
      ctrl.createCharacter(1, 1);
      const onComplete = vi.fn();
      ctrl.walkTo(9, 9, onComplete);

      // Simulate EasyStar returning null (no path found)
      const findPathArgs = easystar.findPath.mock.calls[0] as [
        number, number, number, number, (path: null) => void
      ];
      const callback = findPathArgs[4];
      callback(null);

      expect(onComplete).toHaveBeenCalledOnce();
    });

    it('fires onComplete when EasyStar returns an empty path', () => {
      ctrl.createCharacter(1, 1);
      const onComplete = vi.fn();
      ctrl.walkTo(9, 9, onComplete);

      const findPathArgs = easystar.findPath.mock.calls[0] as [
        number, number, number, number, (path: Array<{x: number; y: number}>) => void
      ];
      const callback = findPathArgs[4];
      // Path with only 1 node means no movement steps
      callback([{ x: 1, y: 1 }]);

      expect(onComplete).toHaveBeenCalledOnce();
    });
  });

  // ── destroy ────────────────────────────────────────────────────

  describe('destroy', () => {
    it('calls destroy on the sprite', () => {
      ctrl.createCharacter(0, 0);
      ctrl.destroy();
      expect(scene._spriteMock.destroy).toHaveBeenCalledOnce();
    });
  });
});
