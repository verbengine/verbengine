/**
 * SaveManager — persists and restores GameState via localStorage.
 *
 * Supports up to MAX_SLOTS save slots per adventure. Sets are serialized
 * to sorted string arrays so the data is plain JSON.
 */

import { AdventureEngine } from './AdventureEngine';

export interface SerializedGameState {
  currentScene: string;
  inventory: string[];
  flags: string[];
  removedHotspots: string[];
}

export interface SaveSlot {
  adventureId: string;
  sceneName: string;
  timestamp: number;
  state: SerializedGameState;
}

const MAX_SLOTS = 3;
const STORAGE_KEY = (adventureId: string, slot: number): string =>
  `verbengine:save:${adventureId}:${slot}`;

export class SaveManager {
  /**
   * Serialize the engine's current GameState and write it to localStorage.
   * Defaults to slot 0.
   */
  save(adventureId: string, engine: AdventureEngine, slotIndex: number = 0): void {
    if (slotIndex < 0 || slotIndex >= MAX_SLOTS) {
      throw new RangeError(`slotIndex must be 0–${MAX_SLOTS - 1}, got ${slotIndex}`);
    }

    const raw = engine.getState();
    const serialized: SerializedGameState = {
      currentScene: raw.currentScene,
      inventory: [...raw.inventory],
      flags: [...raw.flags].sort(),
      removedHotspots: [...raw.removedHotspots].sort(),
    };

    const slot: SaveSlot = {
      adventureId,
      sceneName: raw.currentScene,
      timestamp: Date.now(),
      state: serialized,
    };

    localStorage.setItem(STORAGE_KEY(adventureId, slotIndex), JSON.stringify(slot));
  }

  /**
   * Retrieve a saved state from localStorage.
   * Returns null when the slot does not exist.
   * Defaults to slot 0.
   */
  load(adventureId: string, slotIndex: number = 0): SerializedGameState | null {
    const raw = localStorage.getItem(STORAGE_KEY(adventureId, slotIndex));
    if (raw === null) {
      return null;
    }

    const slot = JSON.parse(raw) as SaveSlot;
    return slot.state;
  }

  /**
   * List all occupied save slots for an adventure, sorted by timestamp ascending.
   */
  listSaves(adventureId: string): SaveSlot[] {
    const results: SaveSlot[] = [];

    for (let i = 0; i < MAX_SLOTS; i++) {
      const raw = localStorage.getItem(STORAGE_KEY(adventureId, i));
      if (raw !== null) {
        results.push(JSON.parse(raw) as SaveSlot);
      }
    }

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Delete a specific save slot.
   */
  deleteSave(adventureId: string, slotIndex: number): void {
    localStorage.removeItem(STORAGE_KEY(adventureId, slotIndex));
  }

  /**
   * Return true when at least one save slot exists for the adventure.
   */
  hasSave(adventureId: string): boolean {
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (localStorage.getItem(STORAGE_KEY(adventureId, i)) !== null) {
        return true;
      }
    }
    return false;
  }
}
