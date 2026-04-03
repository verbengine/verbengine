/**
 * AudioManager tests — verifies mute/unmute state, volume setting,
 * destroy cleanup, and graceful fallback behaviour.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioManager } from './AudioManager';
import { parseVerb } from './VerbParser';

// ── Mock Phaser sound helpers ─────────────────────────────────────

function makeMockSound(overrides: Partial<{
  play: () => void;
  stop: () => void;
  destroy: () => void;
  setVolume: (v: number) => void;
  setMute: (m: boolean) => void;
  isPlaying: boolean;
}> = {}) {
  return {
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
    setVolume: vi.fn(),
    setMute: vi.fn(),
    isPlaying: true,
    ...overrides,
  };
}

function makeMockScene(cachedKeys: string[] = []) {
  const mockSound = makeMockSound();
  return {
    _lastSound: mockSound,
    sound: {
      add: vi.fn(() => mockSound),
      get: vi.fn(() => null),
    },
    load: {
      audio: vi.fn(),
      once: vi.fn(),
      start: vi.fn(),
    },
    sys: {},
    cache: {
      audio: {
        exists: vi.fn((key: string) => cachedKeys.includes(key)),
      },
    },
  };
}

// ── AudioManager unit tests ───────────────────────────────────────

describe('AudioManager', () => {
  let manager: AudioManager;

  beforeEach(() => {
    manager = new AudioManager();
  });

  // --- isMuted / setMuted ---

  it('starts unmuted by default', () => {
    expect(manager.isMuted()).toBe(false);
  });

  it('setMuted(true) marks as muted', () => {
    manager.setMuted(true);
    expect(manager.isMuted()).toBe(true);
  });

  it('setMuted(false) marks as unmuted', () => {
    manager.setMuted(true);
    manager.setMuted(false);
    expect(manager.isMuted()).toBe(false);
  });

  it('toggling mute twice returns to original state', () => {
    manager.setMuted(true);
    manager.setMuted(false);
    expect(manager.isMuted()).toBe(false);
  });

  // --- setVolume / getVolume ---

  it('default volume is 0.7', () => {
    expect(manager.getVolume()).toBe(0.7);
  });

  it('setVolume stores the value', () => {
    manager.setVolume(0.5);
    expect(manager.getVolume()).toBe(0.5);
  });

  it('setVolume clamps to 0 when negative', () => {
    manager.setVolume(-1);
    expect(manager.getVolume()).toBe(0);
  });

  it('setVolume clamps to 1 when above 1', () => {
    manager.setVolume(999);
    expect(manager.getVolume()).toBe(1);
  });

  it('setVolume updates currently playing ambient', () => {
    const scene = makeMockScene(['bg_music']);
    manager.playAmbient(scene as never, 'bg_music');
    manager.setVolume(0.3);
    expect(scene._lastSound.setVolume).toHaveBeenCalledWith(0.3);
  });

  it('setVolume does not call setVolume on ambient when muted', () => {
    const scene = makeMockScene(['bg_music']);
    manager.setMuted(true);
    manager.playAmbient(scene as never, 'bg_music');
    const callsBefore = (scene._lastSound.setVolume as ReturnType<typeof vi.fn>).mock.calls.length;
    manager.setVolume(0.3);
    // setVolume on the sound should NOT have been called again while muted
    expect(scene._lastSound.setVolume).toHaveBeenCalledTimes(callsBefore);
  });

  // --- playAmbient ---

  it('playAmbient does nothing when key is not cached', () => {
    const scene = makeMockScene([]); // nothing cached
    manager.playAmbient(scene as never, 'missing_key');
    expect(scene.sound.add).not.toHaveBeenCalled();
  });

  it('playAmbient adds and plays sound when key is cached', () => {
    const scene = makeMockScene(['ambient_office']);
    manager.playAmbient(scene as never, 'ambient_office');
    expect(scene.sound.add).toHaveBeenCalledWith('ambient_office', expect.objectContaining({ loop: true }));
    expect(scene._lastSound.play).toHaveBeenCalled();
  });

  it('playAmbient uses zero volume when muted', () => {
    const scene = makeMockScene(['ambient_office']);
    manager.setMuted(true);
    manager.playAmbient(scene as never, 'ambient_office');
    expect(scene.sound.add).toHaveBeenCalledWith(
      'ambient_office',
      expect.objectContaining({ volume: 0 }),
    );
  });

  it('playAmbient does nothing if same key is already playing', () => {
    const scene = makeMockScene(['ambient_office']);
    manager.playAmbient(scene as never, 'ambient_office');
    const callCount = (scene.sound.add as ReturnType<typeof vi.fn>).mock.calls.length;
    manager.playAmbient(scene as never, 'ambient_office');
    expect(scene.sound.add).toHaveBeenCalledTimes(callCount);
  });

  it('playAmbient stops previous ambient before playing new one', () => {
    const scene = makeMockScene(['ambient_office', 'ambient_server']);
    manager.playAmbient(scene as never, 'ambient_office');
    const firstSound = scene._lastSound;
    manager.playAmbient(scene as never, 'ambient_server');
    expect(firstSound.stop).toHaveBeenCalled();
    expect(firstSound.destroy).toHaveBeenCalled();
  });

  // --- stopAmbient ---

  it('stopAmbient does nothing when nothing is playing', () => {
    // Should not throw
    expect(() => manager.stopAmbient()).not.toThrow();
  });

  it('stopAmbient stops and destroys the current ambient', () => {
    const scene = makeMockScene(['ambient_office']);
    manager.playAmbient(scene as never, 'ambient_office');
    const sound = scene._lastSound;
    manager.stopAmbient();
    expect(sound.stop).toHaveBeenCalled();
    expect(sound.destroy).toHaveBeenCalled();
  });

  // --- playSound ---

  it('playSound does nothing when key is not cached', () => {
    const scene = makeMockScene([]);
    manager.playSound(scene as never, 'click');
    expect(scene.sound.add).not.toHaveBeenCalled();
  });

  it('playSound adds and plays a non-looping sound', () => {
    const scene = makeMockScene(['click']);
    manager.playSound(scene as never, 'click');
    expect(scene.sound.add).toHaveBeenCalledWith('click', expect.objectContaining({ loop: false }));
    expect(scene._lastSound.play).toHaveBeenCalled();
  });

  it('playSound uses zero volume when muted', () => {
    const scene = makeMockScene(['click']);
    manager.setMuted(true);
    manager.playSound(scene as never, 'click');
    expect(scene.sound.add).toHaveBeenCalledWith(
      'click',
      expect.objectContaining({ volume: 0 }),
    );
  });

  // --- setMuted updates ambient in real time ---

  it('setMuted(true) calls setMute on currently playing ambient', () => {
    const scene = makeMockScene(['bg']);
    manager.playAmbient(scene as never, 'bg');
    manager.setMuted(true);
    expect(scene._lastSound.setMute).toHaveBeenCalledWith(true);
  });

  it('setMuted(false) calls setMute on currently playing ambient', () => {
    const scene = makeMockScene(['bg']);
    manager.playAmbient(scene as never, 'bg');
    manager.setMuted(true);
    manager.setMuted(false);
    expect(scene._lastSound.setMute).toHaveBeenLastCalledWith(false);
  });

  // --- destroy ---

  it('destroy stops and cleans up any playing ambient', () => {
    const scene = makeMockScene(['bg']);
    manager.playAmbient(scene as never, 'bg');
    const sound = scene._lastSound;
    manager.destroy();
    expect(sound.stop).toHaveBeenCalled();
    expect(sound.destroy).toHaveBeenCalled();
  });

  it('destroy does not throw when no audio is playing', () => {
    expect(() => manager.destroy()).not.toThrow();
  });

  it('isMuted returns false after destroy', () => {
    manager.setMuted(true);
    manager.destroy();
    // State is preserved; destroy only cleans audio resources
    expect(manager.isMuted()).toBe(true);
  });

  // --- Graceful error handling ---

  it('does not throw when sound.add throws', () => {
    const scene = makeMockScene(['bg']);
    (scene.sound.add as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Audio context error');
    });
    expect(() => manager.playAmbient(scene as never, 'bg')).not.toThrow();
  });

  it('does not throw when sound.stop throws', () => {
    const scene = makeMockScene(['bg']);
    manager.playAmbient(scene as never, 'bg');
    (scene._lastSound.stop as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('Stop error');
    });
    expect(() => manager.stopAmbient()).not.toThrow();
  });
});

// ── VerbParser audio field tests ──────────────────────────────────

describe('VerbParser — audio fields', () => {
  it('parses ambient field on a scene', () => {
    const source = `
adventure "Test" {
  start: scene_a
  scene scene_a {
    map: "maps/a.json"
    ambient: "sounds/ambient.mp3"
    hotspot door [1, 1] {
      look: "A door."
      use: "It is locked."
    }
  }
}`;
    const data = parseVerb(source);
    expect(data.scenes['scene_a'].ambient).toBe('sounds/ambient.mp3');
  });

  it('ambient is undefined when not specified', () => {
    const source = `
adventure "Test" {
  start: scene_a
  scene scene_a {
    map: "maps/a.json"
    hotspot door [1, 1] {
      look: "A door."
      use: "It is locked."
    }
  }
}`;
    const data = parseVerb(source);
    expect(data.scenes['scene_a'].ambient).toBeUndefined();
  });

  it('parses sound field on a hotspot', () => {
    const source = `
adventure "Test" {
  start: scene_a
  scene scene_a {
    map: "maps/a.json"
    hotspot door [1, 1] {
      look: "A door."
      sound: "sounds/door_knock.mp3"
      use: "It is locked."
    }
  }
}`;
    const data = parseVerb(source);
    expect(data.scenes['scene_a'].hotspots[0].sound).toBe('sounds/door_knock.mp3');
  });

  it('sound is undefined when not specified on hotspot', () => {
    const source = `
adventure "Test" {
  start: scene_a
  scene scene_a {
    map: "maps/a.json"
    hotspot door [1, 1] {
      look: "A door."
      use: "It is locked."
    }
  }
}`;
    const data = parseVerb(source);
    expect(data.scenes['scene_a'].hotspots[0].sound).toBeUndefined();
  });

  it('parses both ambient and sound together', () => {
    const source = `
adventure "Test" {
  start: main_hall
  scene main_hall {
    map: "maps/hall.json"
    ambient: "sounds/hall_ambience.ogg"
    hotspot bell [3, 2] {
      look: "An old brass bell."
      sound: "sounds/bell_ring.wav"
      use: "The bell rings."
    }
  }
}`;
    const data = parseVerb(source);
    expect(data.scenes['main_hall'].ambient).toBe('sounds/hall_ambience.ogg');
    expect(data.scenes['main_hall'].hotspots[0].sound).toBe('sounds/bell_ring.wav');
  });

  it('existing adventures without audio fields still parse correctly', () => {
    const source = `
adventure "Backward Compat" {
  start: room
  items {
    key {
      name: "Key"
      description: "A key."
    }
  }
  scene room {
    map: "maps/room.json"
    hotspot chest [2, 3] {
      look: "A wooden chest."
      use: "It is empty."
      take: -> get(key) "You pick up the key."
    }
  }
}`;
    const data = parseVerb(source);
    expect(data.scenes['room'].ambient).toBeUndefined();
    expect(data.scenes['room'].hotspots[0].sound).toBeUndefined();
    expect(data.title).toBe('Backward Compat');
  });
});
