/**
 * AudioManager — wraps Phaser's audio system for VerbEngine.
 *
 * Handles ambient looping background audio (per scene) and one-shot
 * sound effects (per hotspot interaction). All operations degrade
 * gracefully when audio is unavailable or files fail to load.
 */

/** Minimal interface for the Phaser scene we need from AudioManager. */
interface PhaserSceneAudio {
  sound: {
    add(
      key: string,
      config?: { loop?: boolean; volume?: number },
    ): PhaserSound;
    get(key: string): PhaserSound | null;
  };
  load: {
    audio(key: string, url: string): void;
    once(event: string, callback: () => void): void;
    start(): void;
  };
  sys: {
    textures?: { exists(key: string): boolean };
  };
  cache: {
    audio: { exists(key: string): boolean };
  };
}

interface PhaserSound {
  play(config?: { loop?: boolean; volume?: number }): void;
  stop(): void;
  destroy(): void;
  setVolume(volume: number): void;
  setMute(muted: boolean): void;
  isPlaying: boolean;
}

export class AudioManager {
  private currentAmbient: PhaserSound | null = null;
  private currentAmbientKey: string | null = null;
  private volume: number = 0.7;
  private muted: boolean = false;

  /**
   * Play looping ambient background audio for a scene.
   * Stops any currently playing ambient before starting the new one.
   * If the key matches the currently playing ambient, does nothing.
   * Gracefully skips if the audio asset is not cached.
   */
  playAmbient(scene: PhaserSceneAudio, key: string): void {
    if (this.currentAmbientKey === key && this.currentAmbient?.isPlaying) {
      return;
    }

    this.stopAmbient();

    if (!this.isCached(scene, key)) {
      return;
    }

    try {
      const sound = scene.sound.add(key, { loop: true, volume: this.muted ? 0 : this.volume });
      sound.play({ loop: true, volume: this.muted ? 0 : this.volume });
      this.currentAmbient = sound;
      this.currentAmbientKey = key;
    } catch {
      // Silently continue — audio failure must not crash the game
    }
  }

  /**
   * Stop any currently playing ambient audio.
   */
  stopAmbient(): void {
    if (this.currentAmbient) {
      try {
        this.currentAmbient.stop();
        this.currentAmbient.destroy();
      } catch {
        // Silently continue
      }
      this.currentAmbient = null;
      this.currentAmbientKey = null;
    }
  }

  /**
   * Play a one-shot sound effect.
   * Gracefully skips if the audio asset is not cached.
   */
  playSound(scene: PhaserSceneAudio, key: string): void {
    if (!this.isCached(scene, key)) {
      return;
    }

    try {
      const sound = scene.sound.add(key, { loop: false, volume: this.muted ? 0 : this.volume });
      sound.play({ loop: false, volume: this.muted ? 0 : this.volume });
    } catch {
      // Silently continue
    }
  }

  /**
   * Set the master volume for future audio playback (0.0 – 1.0).
   * Also updates the currently playing ambient if any.
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentAmbient && !this.muted) {
      try {
        this.currentAmbient.setVolume(this.volume);
      } catch {
        // Silently continue
      }
    }
  }

  /**
   * Mute or unmute all audio.
   * Also updates the currently playing ambient if any.
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.currentAmbient) {
      try {
        this.currentAmbient.setMute(muted);
      } catch {
        // Silently continue
      }
    }
  }

  /** Returns whether audio is currently muted. */
  isMuted(): boolean {
    return this.muted;
  }

  /** Returns the current volume (0.0 – 1.0). */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Clean up all audio resources. Call when the scene is destroyed.
   */
  destroy(): void {
    this.stopAmbient();
  }

  // ── Private helpers ──────────────────────────────────────────────

  private isCached(scene: PhaserSceneAudio, key: string): boolean {
    try {
      return scene.cache.audio.exists(key);
    } catch {
      return false;
    }
  }
}
