import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toCanvasX, toCanvasY, toCanvasWidth, toCanvasHeight, SceneRenderer } from './SceneRenderer';
import { SceneData, Hotspot, Character, Exit } from '../types/adventure';

// --- Coordinate math tests (no Phaser dependency) ---

describe('Coordinate conversion', () => {
  it('converts normalized x=0 to canvas x=0', () => {
    expect(toCanvasX(0)).toBe(0);
  });

  it('converts normalized x=1 to canvas x=960', () => {
    expect(toCanvasX(1)).toBe(960);
  });

  it('converts normalized x=0.5 to canvas x=480', () => {
    expect(toCanvasX(0.5)).toBe(480);
  });

  it('converts normalized y=0 to canvas y=0', () => {
    expect(toCanvasY(0)).toBe(0);
  });

  it('converts normalized y=1 to canvas y=600', () => {
    expect(toCanvasY(1)).toBe(600);
  });

  it('converts normalized y=0.5 to canvas y=300', () => {
    expect(toCanvasY(0.5)).toBe(300);
  });

  it('converts normalized width=0.25 to canvas width=240', () => {
    expect(toCanvasWidth(0.25)).toBe(240);
  });

  it('converts normalized height=0.3 to canvas height=180', () => {
    expect(toCanvasHeight(0.3)).toBe(180);
  });
});

// --- Mock helpers ---

function createMockGameObject() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    setStrokeStyle: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    input: { cursor: '' },
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    }),
    emit: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        for (const cb of listeners[event]) cb(...args);
      }
    },
    _listeners: listeners,
  };
}

function createMockScene() {
  const objects: ReturnType<typeof createMockGameObject>[] = [];

  return {
    add: {
      rectangle: vi.fn(() => {
        const obj = createMockGameObject();
        objects.push(obj);
        return obj;
      }),
      circle: vi.fn(() => {
        const obj = createMockGameObject();
        objects.push(obj);
        return obj;
      }),
      text: vi.fn(() => {
        const obj = createMockGameObject();
        objects.push(obj);
        return obj;
      }),
    },
    _objects: objects,
  };
}

function createTestSceneData(overrides?: Partial<SceneData>): SceneData {
  return {
    description: 'A test scene',
    background_color: '#c2b280',
    hotspots: [],
    characters: [],
    exits: [],
    ...overrides,
  };
}

function createTestHotspot(overrides?: Partial<Hotspot>): Hotspot {
  return {
    id: 'ship',
    label: 'Ship',
    x: 0.6,
    y: 0.4,
    width: 0.25,
    height: 0.3,
    ink_target: 'beach_ship',
    ...overrides,
  };
}

function createTestCharacter(overrides?: Partial<Character>): Character {
  return {
    id: 'sailor',
    label: 'Old Sailor',
    x: 0.4,
    y: 0.5,
    ink_target: 'village_sailor',
    ...overrides,
  };
}

function createTestExit(overrides?: Partial<Exit>): Exit {
  return {
    direction: 'north',
    target_scene: 'cave',
    x: 0.5,
    y: 0.05,
    ...overrides,
  };
}

// --- SceneRenderer tests with mocked Phaser.Scene ---

// We need to mock the Phaser module since it's not available in Node
function MockCircle() { /* noop */ }
MockCircle.Contains = vi.fn();

vi.mock('phaser', () => ({
  default: {
    Display: {
      Color: {
        HexStringToColor: vi.fn(() => ({ color: 0xc2b280 })),
      },
    },
    Geom: {
      Circle: MockCircle,
    },
    Input: {
      Pointer: class {},
    },
  },
}));

describe('SceneRenderer', () => {
  let mockScene: ReturnType<typeof createMockScene>;
  let renderer: SceneRenderer;

  beforeEach(() => {
    mockScene = createMockScene();
    // Cast mock scene to Phaser.Scene since we only use .add methods
    renderer = new SceneRenderer(mockScene as unknown as Phaser.Scene);
  });

  describe('renderScene', () => {
    it('renders background rectangle covering full canvas', () => {
      const sceneData = createTestSceneData();
      renderer.renderScene(sceneData);

      expect(mockScene.add.rectangle).toHaveBeenCalledWith(
        480, 300, 960, 600, expect.any(Number),
      );
    });

    it('renders hotspot rectangles at correct canvas positions', () => {
      const hotspot = createTestHotspot();
      const sceneData = createTestSceneData({ hotspots: [hotspot] });
      renderer.renderScene(sceneData);

      // Background + hotspot rectangle
      expect(mockScene.add.rectangle).toHaveBeenCalledTimes(2);
      expect(mockScene.add.rectangle).toHaveBeenCalledWith(
        576, 240, 240, 180,
      );
    });

    it('renders hotspot labels', () => {
      const hotspot = createTestHotspot({ label: 'Ship' });
      const sceneData = createTestSceneData({ hotspots: [hotspot] });
      renderer.renderScene(sceneData);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        576, expect.any(Number), 'Ship', expect.any(Object),
      );
    });

    it('renders character circles at correct canvas positions', () => {
      const character = createTestCharacter();
      const sceneData = createTestSceneData({ characters: [character] });
      renderer.renderScene(sceneData);

      expect(mockScene.add.circle).toHaveBeenCalledWith(
        384, 300, 24, 0xe67e22,
      );
    });

    it('renders character labels', () => {
      const character = createTestCharacter({ label: 'Old Sailor' });
      const sceneData = createTestSceneData({ characters: [character] });
      renderer.renderScene(sceneData);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        384, expect.any(Number), 'Old Sailor', expect.any(Object),
      );
    });

    it('renders exit arrow text', () => {
      const exit = createTestExit({ direction: 'north' });
      const sceneData = createTestSceneData({ exits: [exit] });
      renderer.renderScene(sceneData);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        480, 30, '\u2191 EXIT', expect.any(Object),
      );
    });

    it('renders all four exit directions correctly', () => {
      const exits: Exit[] = [
        createTestExit({ direction: 'north', x: 0.5, y: 0.05 }),
        createTestExit({ direction: 'south', x: 0.5, y: 0.95, target_scene: 'beach' }),
        createTestExit({ direction: 'east', x: 0.95, y: 0.5, target_scene: 'village' }),
        createTestExit({ direction: 'west', x: 0.05, y: 0.5, target_scene: 'beach' }),
      ];
      const sceneData = createTestSceneData({ exits });
      renderer.renderScene(sceneData);

      // 4 exit texts
      expect(mockScene.add.text).toHaveBeenCalledTimes(4);
    });

    it('sets interactive on hotspot rectangles', () => {
      const hotspot = createTestHotspot();
      const sceneData = createTestSceneData({ hotspots: [hotspot] });
      renderer.renderScene(sceneData);

      // The hotspot rectangle (second rectangle call, index 1 in _objects)
      const hotspotRect = mockScene._objects[1];
      expect(hotspotRect.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
    });

    it('sets interactive on character circles', () => {
      const character = createTestCharacter();
      const sceneData = createTestSceneData({ characters: [character] });
      renderer.renderScene(sceneData);

      // The circle is the second object (after background rect)
      const circle = mockScene._objects[1];
      expect(circle.setInteractive).toHaveBeenCalled();
    });

    it('sets interactive on exit text', () => {
      const exit = createTestExit();
      const sceneData = createTestSceneData({ exits: [exit] });
      renderer.renderScene(sceneData);

      // Exit text is the second object (after background rect)
      const exitText = mockScene._objects[1];
      expect(exitText.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
    });
  });

  describe('clearScene', () => {
    it('destroys all rendered game objects', () => {
      const sceneData = createTestSceneData({
        hotspots: [createTestHotspot()],
        characters: [createTestCharacter()],
        exits: [createTestExit()],
      });
      renderer.renderScene(sceneData);

      const objectCount = mockScene._objects.length;
      expect(objectCount).toBeGreaterThan(0);

      renderer.clearScene();

      for (const obj of mockScene._objects) {
        expect(obj.destroy).toHaveBeenCalled();
      }
    });

    it('clears objects before rendering new scene', () => {
      const sceneData1 = createTestSceneData({ hotspots: [createTestHotspot()] });
      renderer.renderScene(sceneData1);

      const firstBatch = [...mockScene._objects];

      const sceneData2 = createTestSceneData();
      renderer.renderScene(sceneData2);

      for (const obj of firstBatch) {
        expect(obj.destroy).toHaveBeenCalled();
      }
    });
  });

  describe('Callback registration', () => {
    it('registers and fires hotspot click callbacks', () => {
      const hotspot = createTestHotspot();
      const sceneData = createTestSceneData({ hotspots: [hotspot] });
      const callback = vi.fn();

      renderer.onHotspotClick(callback);
      renderer.renderScene(sceneData);

      // The hotspot rectangle is the second object (after background)
      const hotspotRect = mockScene._objects[1];
      const mockPointer = { rightButtonDown: () => false };
      hotspotRect.emit('pointerdown', mockPointer);

      expect(callback).toHaveBeenCalledWith(hotspot);
    });

    it('registers and fires hotspot right-click callbacks', () => {
      const hotspot = createTestHotspot();
      const sceneData = createTestSceneData({ hotspots: [hotspot] });
      const callback = vi.fn();

      renderer.onHotspotRightClick(callback);
      renderer.renderScene(sceneData);

      const hotspotRect = mockScene._objects[1];
      const mockPointer = { rightButtonDown: () => true };
      hotspotRect.emit('pointerdown', mockPointer);

      expect(callback).toHaveBeenCalledWith(hotspot);
    });

    it('registers and fires character click callbacks', () => {
      const character = createTestCharacter();
      const sceneData = createTestSceneData({ characters: [character] });
      const callback = vi.fn();

      renderer.onCharacterClick(callback);
      renderer.renderScene(sceneData);

      const circle = mockScene._objects[1];
      const mockPointer = { rightButtonDown: () => false };
      circle.emit('pointerdown', mockPointer);

      expect(callback).toHaveBeenCalledWith(character);
    });

    it('registers and fires character right-click callbacks', () => {
      const character = createTestCharacter();
      const sceneData = createTestSceneData({ characters: [character] });
      const callback = vi.fn();

      renderer.onCharacterRightClick(callback);
      renderer.renderScene(sceneData);

      const circle = mockScene._objects[1];
      const mockPointer = { rightButtonDown: () => true };
      circle.emit('pointerdown', mockPointer);

      expect(callback).toHaveBeenCalledWith(character);
    });

    it('registers and fires exit click callbacks', () => {
      const exit = createTestExit();
      const sceneData = createTestSceneData({ exits: [exit] });
      const callback = vi.fn();

      renderer.onExitClick(callback);
      renderer.renderScene(sceneData);

      const exitText = mockScene._objects[1];
      exitText.emit('pointerdown');

      expect(callback).toHaveBeenCalledWith(exit);
    });

    it('supports multiple callbacks for the same event', () => {
      const hotspot = createTestHotspot();
      const sceneData = createTestSceneData({ hotspots: [hotspot] });
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      renderer.onHotspotClick(callback1);
      renderer.onHotspotClick(callback2);
      renderer.renderScene(sceneData);

      const hotspotRect = mockScene._objects[1];
      const mockPointer = { rightButtonDown: () => false };
      hotspotRect.emit('pointerdown', mockPointer);

      expect(callback1).toHaveBeenCalledWith(hotspot);
      expect(callback2).toHaveBeenCalledWith(hotspot);
    });
  });

  describe('Hover behavior', () => {
    it('changes alpha on hotspot hover', () => {
      const hotspot = createTestHotspot();
      const sceneData = createTestSceneData({ hotspots: [hotspot] });
      renderer.renderScene(sceneData);

      const hotspotRect = mockScene._objects[1];
      hotspotRect.emit('pointerover');
      expect(hotspotRect.setAlpha).toHaveBeenCalledWith(0.7);

      hotspotRect.emit('pointerout');
      expect(hotspotRect.setAlpha).toHaveBeenCalledWith(1);
    });

    it('changes alpha on character hover', () => {
      const character = createTestCharacter();
      const sceneData = createTestSceneData({ characters: [character] });
      renderer.renderScene(sceneData);

      const circle = mockScene._objects[1];
      circle.emit('pointerover');
      expect(circle.setAlpha).toHaveBeenCalledWith(0.7);

      circle.emit('pointerout');
      expect(circle.setAlpha).toHaveBeenCalledWith(1);
    });

    it('changes alpha on exit hover', () => {
      const exit = createTestExit();
      const sceneData = createTestSceneData({ exits: [exit] });
      renderer.renderScene(sceneData);

      const exitText = mockScene._objects[1];
      exitText.emit('pointerover');
      expect(exitText.setAlpha).toHaveBeenCalledWith(0.7);

      exitText.emit('pointerout');
      expect(exitText.setAlpha).toHaveBeenCalledWith(1);
    });
  });
});
