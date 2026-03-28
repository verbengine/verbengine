import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DialoguePanel } from './DialoguePanel';

function createMockText() {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    setDepth: vi.fn().mockReturnThis(),
    setInteractive: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    on: vi.fn((event: string, handler: () => void) => {
      if (!handlers[event]) {
        handlers[event] = [];
      }
      handlers[event].push(handler);
    }),
    _handlers: handlers,
    _emit(event: string) {
      if (handlers[event]) {
        handlers[event].forEach((h) => h());
      }
    },
  };
}

function createMockScene() {
  const textObjects: ReturnType<typeof createMockText>[] = [];
  return {
    add: {
      rectangle: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
      })),
      text: vi.fn(() => {
        const t = createMockText();
        textObjects.push(t);
        return t;
      }),
    },
    _textObjects: textObjects,
  };
}

describe('DialoguePanel', () => {
  let scene: ReturnType<typeof createMockScene>;
  let panel: DialoguePanel;

  beforeEach(() => {
    scene = createMockScene();
    panel = new DialoguePanel(scene as unknown as Phaser.Scene);
  });

  it('should create background and border on construction', () => {
    expect(scene.add.rectangle).toHaveBeenCalledTimes(2);
  });

  it('should display narrative text via showText', () => {
    panel.showText('You stand on a sandy beach.');

    expect(scene.add.text).toHaveBeenCalledTimes(1);
    expect(scene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      'You stand on a sandy beach.',
      expect.objectContaining({
        fontFamily: 'monospace',
        color: '#e0e0e0',
      })
    );
  });

  it('should clear previous text when showText is called again', () => {
    panel.showText('First text.');
    const firstText = scene._textObjects[0];

    panel.showText('Second text.');

    expect(firstText.destroy).toHaveBeenCalled();
    expect(scene.add.text).toHaveBeenCalledTimes(2);
  });

  it('should display choices with prefix', () => {
    panel.showChoices(['Go north', 'Look around']);

    expect(scene.add.text).toHaveBeenCalledTimes(2);
    expect(scene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      '> Go north',
      expect.any(Object)
    );
    expect(scene.add.text).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      '> Look around',
      expect.any(Object)
    );
  });

  it('should make choices interactive', () => {
    panel.showChoices(['Option A']);

    const choiceText = scene._textObjects[0];
    expect(choiceText.setInteractive).toHaveBeenCalledWith({ useHandCursor: true });
  });

  it('should register and invoke choice callback', () => {
    const callback = vi.fn();
    panel.onChoiceSelected(callback);
    panel.showChoices(['Option A', 'Option B']);

    const secondChoice = scene._textObjects[1];
    secondChoice._emit('pointerdown');

    expect(callback).toHaveBeenCalledWith(1);
  });

  it('should not throw if choice clicked without callback', () => {
    panel.showChoices(['Option A']);

    const choiceText = scene._textObjects[0];
    expect(() => choiceText._emit('pointerdown')).not.toThrow();
  });

  it('should highlight choice on hover', () => {
    panel.showChoices(['Option A']);

    const choiceText = scene._textObjects[0];
    choiceText._emit('pointerover');
    expect(choiceText.setColor).toHaveBeenCalledWith('#ffffff');

    choiceText._emit('pointerout');
    expect(choiceText.setColor).toHaveBeenCalledWith('#e0e0e0');
  });

  it('should clear all content via clear()', () => {
    panel.showText('Some text.');
    panel.showChoices(['A', 'B']);

    const allTexts = [...scene._textObjects];
    panel.clear();

    for (const t of allTexts) {
      expect(t.destroy).toHaveBeenCalled();
    }
  });

  it('should clear previous choices when showChoices is called again', () => {
    panel.showChoices(['Old choice']);
    const oldChoice = scene._textObjects[0];

    panel.showChoices(['New choice']);

    expect(oldChoice.destroy).toHaveBeenCalled();
  });

  it('should allow replacing callback via onChoiceSelected', () => {
    const first = vi.fn();
    const second = vi.fn();

    panel.onChoiceSelected(first);
    panel.onChoiceSelected(second);
    panel.showChoices(['Click me']);

    scene._textObjects[0]._emit('pointerdown');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(0);
  });
});
