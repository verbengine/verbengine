import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HotspotHighlighter,
  HOTSPOT_HINT_COLOR,
  CHARACTER_HINT_COLOR,
  EXIT_HINT_COLOR,
} from './HotspotHighlighter';
import type { HotspotDef, CharacterDef, ExitDef } from '../types/adventure-v2';

// ── Phaser mock helpers ────────────────────────────────────────────

function createMockGraphics() {
  return {
    setDepth: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    closePath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

function createMockScene() {
  const graphics = createMockGraphics();
  return {
    scene: {
      add: {
        graphics: vi.fn().mockReturnValue(graphics),
      },
    },
    graphics,
  };
}

// ── Sample data ────────────────────────────────────────────────────

const sampleHotspot: HotspotDef = {
  id: 'box',
  position: [2, 3],
  look: 'A wooden box.',
  use: [{ text: 'Nothing happens.', actions: [] }],
};

const sampleCharacter: CharacterDef = {
  id: 'npc1',
  position: [5, 5],
  sprite: 'char_1',
  look: 'A guard.',
  talk: [{ text: 'Go away.', actions: [] }],
};

const sampleExit: ExitDef = {
  id: 'door',
  position: [8, 1],
  target: 'room2',
  look: 'A heavy door.',
};

// ── Tests ──────────────────────────────────────────────────────────

describe('HotspotHighlighter', () => {
  let mockSceneObj: ReturnType<typeof createMockScene>;
  let highlighter: HotspotHighlighter;

  beforeEach(() => {
    mockSceneObj = createMockScene();
    const mockScene = mockSceneObj.scene as unknown as Phaser.Scene;
    highlighter = new HotspotHighlighter(mockScene, 96, 48);
  });

  describe('setInteractables', () => {
    it('registers hotspot positions', () => {
      highlighter.setInteractables([sampleHotspot], [], []);
      expect(highlighter.getTypeAt(2, 3)).toBe('hotspot');
    });

    it('registers character positions', () => {
      highlighter.setInteractables([], [sampleCharacter], []);
      expect(highlighter.getTypeAt(5, 5)).toBe('character');
    });

    it('registers exit positions', () => {
      highlighter.setInteractables([], [], [sampleExit]);
      expect(highlighter.getTypeAt(8, 1)).toBe('exit');
    });

    it('registers all three types together', () => {
      highlighter.setInteractables([sampleHotspot], [sampleCharacter], [sampleExit]);
      expect(highlighter.getTypeAt(2, 3)).toBe('hotspot');
      expect(highlighter.getTypeAt(5, 5)).toBe('character');
      expect(highlighter.getTypeAt(8, 1)).toBe('exit');
    });

    it('returns null for unregistered positions', () => {
      highlighter.setInteractables([sampleHotspot], [], []);
      expect(highlighter.getTypeAt(0, 0)).toBeNull();
    });

    it('clears previous registrations on re-call', () => {
      highlighter.setInteractables([sampleHotspot], [], []);
      highlighter.setInteractables([], [sampleCharacter], []);
      // Old hotspot position should be gone
      expect(highlighter.getTypeAt(2, 3)).toBeNull();
      // New character position should be present
      expect(highlighter.getTypeAt(5, 5)).toBe('character');
    });
  });

  describe('updateHover', () => {
    beforeEach(() => {
      highlighter.setInteractables([sampleHotspot], [sampleCharacter], [sampleExit]);
    });

    it('returns true for an interactive position', () => {
      const result = highlighter.updateHover(2, 3);
      expect(result).toBe(true);
    });

    it('returns true for a character position', () => {
      const result = highlighter.updateHover(5, 5);
      expect(result).toBe(true);
    });

    it('returns true for an exit position', () => {
      const result = highlighter.updateHover(8, 1);
      expect(result).toBe(true);
    });

    it('returns false for a non-interactive position', () => {
      const result = highlighter.updateHover(0, 0);
      expect(result).toBe(false);
    });

    it('calls clear() on the hover graphics each time', () => {
      const g = mockSceneObj.graphics;
      highlighter.updateHover(2, 3);
      expect(g.clear).toHaveBeenCalled();
    });

    it('draws stroke for interactive position', () => {
      const g = mockSceneObj.graphics;
      highlighter.updateHover(2, 3);
      expect(g.strokePath).toHaveBeenCalled();
    });

    it('does not draw stroke for non-interactive position', () => {
      const g = mockSceneObj.graphics;
      highlighter.updateHover(0, 0);
      expect(g.strokePath).not.toHaveBeenCalled();
    });
  });

  describe('showAll / hideAll', () => {
    beforeEach(() => {
      highlighter.setInteractables([sampleHotspot], [sampleCharacter], [sampleExit]);
    });

    it('isShowingAll starts as false', () => {
      expect(highlighter.isShowingAll()).toBe(false);
    });

    it('showAll sets isShowingAll to true', () => {
      highlighter.showAll();
      expect(highlighter.isShowingAll()).toBe(true);
    });

    it('hideAll sets isShowingAll to false', () => {
      highlighter.showAll();
      highlighter.hideAll();
      expect(highlighter.isShowingAll()).toBe(false);
    });

    it('showAll creates one graphics object per interactable', () => {
      const addGraphics = mockSceneObj.scene.add.graphics;
      const callsBefore = addGraphics.mock.calls.length;
      highlighter.showAll();
      const callsAfter = addGraphics.mock.calls.length;
      // 3 interactables → 3 new graphics created
      expect(callsAfter - callsBefore).toBe(3);
    });

    it('hideAll destroys the reveal graphics', () => {
      highlighter.showAll();
      // Collect references to the graphics created by showAll
      const addGraphics = mockSceneObj.scene.add.graphics;
      const revealGraphicsMocks = addGraphics.mock.results
        .slice(-3)
        .map(r => r.value as ReturnType<typeof createMockGraphics>);

      highlighter.hideAll();

      for (const g of revealGraphicsMocks) {
        expect(g.destroy).toHaveBeenCalled();
      }
    });

    it('showAll after hideAll recreates graphics', () => {
      highlighter.showAll();
      highlighter.hideAll();
      const addGraphics = mockSceneObj.scene.add.graphics;
      const callsBefore = addGraphics.mock.calls.length;
      highlighter.showAll();
      const callsAfter = addGraphics.mock.calls.length;
      expect(callsAfter - callsBefore).toBe(3);
    });
  });

  describe('colorForType', () => {
    it('returns yellow for hotspot', () => {
      expect(HotspotHighlighter.colorForType('hotspot')).toBe(HOTSPOT_HINT_COLOR);
    });

    it('returns cyan for character', () => {
      expect(HotspotHighlighter.colorForType('character')).toBe(CHARACTER_HINT_COLOR);
    });

    it('returns green for exit', () => {
      expect(HotspotHighlighter.colorForType('exit')).toBe(EXIT_HINT_COLOR);
    });
  });

  describe('destroy', () => {
    it('destroys the hover graphics object', () => {
      const g = mockSceneObj.graphics;
      highlighter.destroy();
      expect(g.destroy).toHaveBeenCalled();
    });

    it('clears the interactables registry', () => {
      highlighter.setInteractables([sampleHotspot], [], []);
      highlighter.destroy();
      // After destroy getTypeAt should return null (map cleared)
      expect(highlighter.getTypeAt(2, 3)).toBeNull();
    });
  });
});
