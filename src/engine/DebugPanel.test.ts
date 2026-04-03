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
