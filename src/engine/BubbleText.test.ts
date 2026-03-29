import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BubbleText } from './BubbleText';

function createMockText(overrides?: Partial<{ width: number; height: number }>) {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    width: overrides?.width ?? 100,
    height: overrides?.height ?? 16,
    setDepth: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    _handlers: handlers,
    _emit(event: string) {
      if (handlers[event]) handlers[event].forEach((h) => h());
    },
  };
}

function createMockGraphics() {
  return {
    fillStyle: vi.fn().mockReturnThis(),
    fillRoundedRect: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
}

function createMockContainer() {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    setDepth: vi.fn().mockReturnThis(),
    setSize: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    _handlers: handlers,
    _emit(event: string) {
      if (handlers[event]) handlers[event].forEach((h) => h());
    },
  };
}

function createMockTimerEvent() {
  return {
    remove: vi.fn(),
  };
}

function createMockScene() {
  const textObjects: ReturnType<typeof createMockText>[] = [];
  const containers: ReturnType<typeof createMockContainer>[] = [];
  const timers: ReturnType<typeof createMockTimerEvent>[] = [];
  const timerCallbacks: (() => void)[] = [];

  return {
    add: {
      text: vi.fn((_x: number, _y: number, _text: string, _style: Record<string, unknown>) => {
        const t = createMockText();
        textObjects.push(t);
        return t;
      }),
      graphics: vi.fn(() => createMockGraphics()),
      container: vi.fn((_x: number, _y: number, _children: unknown[]) => {
        const c = createMockContainer();
        containers.push(c);
        return c;
      }),
    },
    time: {
      addEvent: vi.fn((config: { delay: number; callback: () => void }) => {
        timerCallbacks.push(config.callback);
        const timer = createMockTimerEvent();
        timers.push(timer);
        return timer;
      }),
    },
    _textObjects: textObjects,
    _containers: containers,
    _timers: timers,
    _timerCallbacks: timerCallbacks,
  };
}

describe('BubbleText', () => {
  let scene: ReturnType<typeof createMockScene>;
  let bubbleText: BubbleText;

  beforeEach(() => {
    scene = createMockScene();
    bubbleText = new BubbleText(scene as unknown as Phaser.Scene);
  });

  describe('showBubble', () => {
    it('should create a text object with correct style', () => {
      bubbleText.showBubble(100, 200, 'Hello world');

      expect(scene.add.text).toHaveBeenCalledWith(
        0,
        0,
        'Hello world',
        expect.objectContaining({
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#e0e0e0',
        })
      );
    });

    it('should create a graphics background', () => {
      bubbleText.showBubble(100, 200, 'Test');

      expect(scene.add.graphics).toHaveBeenCalledTimes(1);
    });

    it('should create a container at world position', () => {
      bubbleText.showBubble(100, 200, 'Test');

      expect(scene.add.container).toHaveBeenCalledTimes(1);
      expect(scene.add.container).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Array)
      );
    });

    it('should set container depth to 1500', () => {
      bubbleText.showBubble(100, 200, 'Test');

      const container = scene._containers[0];
      expect(container.setDepth).toHaveBeenCalledWith(1500);
    });

    it('should set up auto-dismiss timer with default duration', () => {
      bubbleText.showBubble(100, 200, 'Test');

      expect(scene.time.addEvent).toHaveBeenCalledWith(
        expect.objectContaining({ delay: 3000 })
      );
    });

    it('should set up auto-dismiss timer with custom duration', () => {
      bubbleText.showBubble(100, 200, 'Test', 5000);

      expect(scene.time.addEvent).toHaveBeenCalledWith(
        expect.objectContaining({ delay: 5000 })
      );
    });

    it('should auto-dismiss when timer fires', () => {
      bubbleText.showBubble(100, 200, 'Test');

      const container = scene._containers[0];
      scene._timerCallbacks[0]();

      expect(container.destroy).toHaveBeenCalled();
    });

    it('should dismiss on click', () => {
      bubbleText.showBubble(100, 200, 'Test');

      const container = scene._containers[0];
      expect(container.setInteractive).toHaveBeenCalled();

      container._emit('pointerdown');
      expect(container.destroy).toHaveBeenCalled();
    });

    it('should remove timer when dismissed by click', () => {
      bubbleText.showBubble(100, 200, 'Test');

      const timer = scene._timers[0];
      scene._containers[0]._emit('pointerdown');

      expect(timer.remove).toHaveBeenCalled();
    });
  });

  describe('showNamedBubble', () => {
    it('should create name text with yellow bold style', () => {
      bubbleText.showNamedBubble(100, 200, 'Guard', 'Halt!');

      expect(scene.add.text).toHaveBeenCalledWith(
        0,
        0,
        'Guard',
        expect.objectContaining({
          color: '#f1c40f',
          fontStyle: 'bold',
        })
      );
    });

    it('should create body text with standard style', () => {
      bubbleText.showNamedBubble(100, 200, 'Guard', 'Halt!');

      expect(scene.add.text).toHaveBeenCalledWith(
        0,
        0,
        'Halt!',
        expect.objectContaining({
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#e0e0e0',
        })
      );
    });

    it('should create both name and body text objects', () => {
      bubbleText.showNamedBubble(100, 200, 'Guard', 'Halt!');

      expect(scene.add.text).toHaveBeenCalledTimes(2);
    });

    it('should create container with depth 1500', () => {
      bubbleText.showNamedBubble(100, 200, 'Guard', 'Halt!');

      const container = scene._containers[0];
      expect(container.setDepth).toHaveBeenCalledWith(1500);
    });

    it('should set up auto-dismiss timer', () => {
      bubbleText.showNamedBubble(100, 200, 'Guard', 'Halt!', 4000);

      expect(scene.time.addEvent).toHaveBeenCalledWith(
        expect.objectContaining({ delay: 4000 })
      );
    });
  });

  describe('multiple bubbles', () => {
    it('should support multiple bubbles coexisting', () => {
      bubbleText.showBubble(100, 200, 'First');
      bubbleText.showBubble(300, 200, 'Second');

      expect(scene._containers).toHaveLength(2);
    });

    it('should not destroy other bubbles when one is dismissed', () => {
      bubbleText.showBubble(100, 200, 'First');
      bubbleText.showBubble(300, 200, 'Second');

      scene._containers[0]._emit('pointerdown');

      expect(scene._containers[0].destroy).toHaveBeenCalled();
      expect(scene._containers[1].destroy).not.toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should remove all active bubbles', () => {
      bubbleText.showBubble(100, 200, 'First');
      bubbleText.showBubble(300, 200, 'Second');
      bubbleText.showNamedBubble(500, 200, 'NPC', 'Third');

      bubbleText.clearAll();

      for (const container of scene._containers) {
        expect(container.destroy).toHaveBeenCalled();
      }
      for (const timer of scene._timers) {
        expect(timer.remove).toHaveBeenCalled();
      }
    });

    it('should handle clearAll when no bubbles exist', () => {
      expect(() => bubbleText.clearAll()).not.toThrow();
    });

    it('should handle clearAll after bubbles already dismissed', () => {
      bubbleText.showBubble(100, 200, 'Test');
      scene._containers[0]._emit('pointerdown');

      expect(() => bubbleText.clearAll()).not.toThrow();
    });
  });

  describe('double dismiss protection', () => {
    it('should not destroy a bubble twice when clicked after timer fires', () => {
      bubbleText.showBubble(100, 200, 'Test');

      const container = scene._containers[0];
      scene._timerCallbacks[0]();
      container._emit('pointerdown');

      expect(container.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
