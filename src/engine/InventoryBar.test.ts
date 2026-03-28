import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryBar } from './InventoryBar';

function createMockText() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    x: 0,
    width: 50,
    setOrigin: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setX: vi.fn(function (this: { x: number }, newX: number) {
      this.x = newX;
      return this;
    }),
    destroy: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(cb);
    }),
    emit: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(...args));
      }
    },
  };
}

function createMockScene() {
  const texts: ReturnType<typeof createMockText>[] = [];

  const scene = {
    add: {
      rectangle: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((_x: number, _y: number, _content: string) => {
        const mockText = createMockText();
        mockText.x = _x;
        texts.push(mockText);
        return mockText;
      }),
    },
    _texts: texts,
  };

  return scene;
}

describe('InventoryBar', () => {
  let scene: ReturnType<typeof createMockScene>;
  let bar: InventoryBar;

  beforeEach(() => {
    scene = createMockScene();
    bar = new InventoryBar(scene as unknown as Phaser.Scene);
  });

  it('should create a background rectangle', () => {
    expect(scene.add.rectangle).toHaveBeenCalledWith(480, 20, 960, 40, 0x1a1a2e);
  });

  it('should start with no items', () => {
    expect(bar.getItems()).toEqual([]);
  });

  it('should start with no selection', () => {
    expect(bar.getSelectedItem()).toBeNull();
  });

  describe('addItem', () => {
    it('should add an item', () => {
      bar.addItem('Key');
      expect(bar.getItems()).toEqual(['Key']);
    });

    it('should add multiple items', () => {
      bar.addItem('Key');
      bar.addItem('Lamp');
      bar.addItem('Map');
      expect(bar.getItems()).toEqual(['Key', 'Lamp', 'Map']);
    });

    it('should not add duplicate items', () => {
      bar.addItem('Key');
      bar.addItem('Key');
      expect(bar.getItems()).toEqual(['Key']);
    });

    it('should create a text object for the item', () => {
      bar.addItem('Key');
      expect(scene.add.text).toHaveBeenCalledWith(12, 20, 'Key', expect.objectContaining({
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
      }));
    });
  });

  describe('removeItem', () => {
    it('should remove an existing item', () => {
      bar.addItem('Key');
      bar.addItem('Lamp');
      bar.removeItem('Key');
      expect(bar.getItems()).toEqual(['Lamp']);
    });

    it('should do nothing when removing non-existent item', () => {
      bar.addItem('Key');
      bar.removeItem('Sword');
      expect(bar.getItems()).toEqual(['Key']);
    });

    it('should destroy the text object on removal', () => {
      bar.addItem('Key');
      const textObj = scene._texts[0];
      bar.removeItem('Key');
      expect(textObj.destroy).toHaveBeenCalled();
    });

    it('should clear selection when removing selected item', () => {
      bar.addItem('Key');
      // Simulate click to select
      scene._texts[0].emit('pointerdown');
      expect(bar.getSelectedItem()).toBe('Key');
      bar.removeItem('Key');
      expect(bar.getSelectedItem()).toBeNull();
    });
  });

  describe('selection', () => {
    it('should select an item on click', () => {
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      expect(bar.getSelectedItem()).toBe('Key');
    });

    it('should highlight selected item with yellow color', () => {
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      expect(scene._texts[0].setColor).toHaveBeenCalledWith('#f1c40f');
    });

    it('should deselect when clicking the same item again', () => {
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      scene._texts[0].emit('pointerdown');
      expect(bar.getSelectedItem()).toBeNull();
    });

    it('should restore color when deselecting', () => {
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown'); // select
      scene._texts[0].emit('pointerdown'); // deselect
      expect(scene._texts[0].setColor).toHaveBeenCalledWith('#ffffff');
    });

    it('should switch selection when clicking a different item', () => {
      bar.addItem('Key');
      bar.addItem('Lamp');
      scene._texts[0].emit('pointerdown'); // select Key
      expect(bar.getSelectedItem()).toBe('Key');
      scene._texts[1].emit('pointerdown'); // select Lamp
      expect(bar.getSelectedItem()).toBe('Lamp');
    });

    it('should deselect previous item when switching selection', () => {
      bar.addItem('Key');
      bar.addItem('Lamp');
      scene._texts[0].emit('pointerdown'); // select Key
      scene._texts[1].emit('pointerdown'); // select Lamp
      expect(scene._texts[0].setColor).toHaveBeenCalledWith('#ffffff');
      expect(scene._texts[1].setColor).toHaveBeenCalledWith('#f1c40f');
    });
  });

  describe('clearSelection', () => {
    it('should clear the current selection', () => {
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      bar.clearSelection();
      expect(bar.getSelectedItem()).toBeNull();
    });

    it('should restore item color on clear', () => {
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      bar.clearSelection();
      expect(scene._texts[0].setColor).toHaveBeenCalledWith('#ffffff');
    });

    it('should do nothing when no selection', () => {
      bar.clearSelection();
      expect(bar.getSelectedItem()).toBeNull();
    });
  });

  describe('onItemSelected callback', () => {
    it('should notify on item selection', () => {
      const callback = vi.fn();
      bar.onItemSelected(callback);
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      expect(callback).toHaveBeenCalledWith('Key');
    });

    it('should notify with null on deselection', () => {
      const callback = vi.fn();
      bar.onItemSelected(callback);
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      scene._texts[0].emit('pointerdown');
      expect(callback).toHaveBeenLastCalledWith(null);
    });

    it('should notify on clearSelection', () => {
      const callback = vi.fn();
      bar.onItemSelected(callback);
      bar.addItem('Key');
      scene._texts[0].emit('pointerdown');
      bar.clearSelection();
      expect(callback).toHaveBeenLastCalledWith(null);
    });

    it('should notify when switching items', () => {
      const callback = vi.fn();
      bar.onItemSelected(callback);
      bar.addItem('Key');
      bar.addItem('Lamp');
      scene._texts[0].emit('pointerdown');
      scene._texts[1].emit('pointerdown');
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, 'Key');
      expect(callback).toHaveBeenNthCalledWith(2, 'Lamp');
    });
  });
});
