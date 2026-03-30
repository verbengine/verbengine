// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KonamiListener } from './KonamiListener';

describe('KonamiListener', () => {
  let listener: KonamiListener;
  let callback: ReturnType<typeof vi.fn>;
  let keydownHandler: (e: KeyboardEvent) => void;

  beforeEach(() => {
    callback = vi.fn();
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandler = handler as (e: KeyboardEvent) => void;
      }
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
    listener = new KonamiListener(callback);
  });

  afterEach(() => {
    listener.destroy();
    vi.restoreAllMocks();
  });

  function pressKey(key: string): void {
    keydownHandler(new KeyboardEvent('keydown', { key }));
  }

  function pressKonamiCode(): void {
    const sequence = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
      'b', 'a',
    ];
    for (const key of sequence) {
      pressKey(key);
    }
  }

  it('should fire callback when full Konami Code is entered', () => {
    pressKonamiCode();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should not fire callback on partial sequence', () => {
    pressKey('ArrowUp');
    pressKey('ArrowUp');
    pressKey('ArrowDown');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should reset on wrong key', () => {
    pressKey('ArrowUp');
    pressKey('ArrowUp');
    pressKey('x');
    pressKey('ArrowDown');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should allow re-entering the code after wrong key', () => {
    pressKey('ArrowUp');
    pressKey('x');
    pressKonamiCode();
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should fire callback multiple times for repeated entries', () => {
    pressKonamiCode();
    pressKonamiCode();
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should reset on timeout between keys', () => {
    vi.useFakeTimers();
    pressKey('ArrowUp');
    pressKey('ArrowUp');
    vi.advanceTimersByTime(2100);
    pressKey('ArrowDown');
    pressKey('ArrowDown');
    pressKey('ArrowLeft');
    pressKey('ArrowRight');
    pressKey('ArrowLeft');
    pressKey('ArrowRight');
    pressKey('b');
    pressKey('a');
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should accept uppercase B and A', () => {
    const sequence = [
      'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
      'B', 'A',
    ];
    for (const key of sequence) {
      pressKey(key);
    }
    expect(callback).toHaveBeenCalledOnce();
  });

  it('should remove event listener on destroy', () => {
    listener.destroy();
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
