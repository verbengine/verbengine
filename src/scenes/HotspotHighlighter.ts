/**
 * HotspotHighlighter — visual hint overlay for interactive tiles.
 *
 * Draws isometric diamond outlines on interactive tiles so players
 * can discover what is clickable. Supports hover-on-demand and Tab
 * key reveal of all interactive positions at once.
 */

import Phaser from 'phaser';
import { cartToIso } from './iso-math';
import type { HotspotDef, CharacterDef, ExitDef } from '../types/adventure-v2';

/** Color codes for each interactable type */
export const HOTSPOT_HINT_COLOR = 0xffd700;  // yellow
export const CHARACTER_HINT_COLOR = 0x00bcd4; // cyan
export const EXIT_HINT_COLOR = 0x4caf50;      // green

/** Alpha for hover highlight */
const HOVER_ALPHA = 0.6;
/** Alpha for showAll reveal */
const SHOW_ALL_ALPHA = 0.3;

/** The type category of an interactive position */
type InteractableType = 'hotspot' | 'character' | 'exit';

/** Registry entry for an interactive grid position */
interface InteractableEntry {
  type: InteractableType;
  color: number;
}

/**
 * Manages visual diamond outlines for all interactive tiles in a scene.
 * Works with Phaser.GameObjects.Graphics to draw isometric diamond shapes.
 */
export class HotspotHighlighter {
  private scene: Phaser.Scene;
  private tileWidth: number;
  private tileHeight: number;

  /** Map from "col,row" key to entry metadata */
  private interactables: Map<string, InteractableEntry> = new Map();

  /** Graphics object used for the hover outline (single tile) */
  private hoverGraphics: Phaser.GameObjects.Graphics;

  /** Graphics objects for showAll reveal (one per interactive tile) */
  private revealGraphics: Phaser.GameObjects.Graphics[] = [];

  /** Whether showAll is currently active */
  private allVisible = false;

  constructor(scene: Phaser.Scene, tileWidth: number, tileHeight: number) {
    this.scene = scene;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;

    this.hoverGraphics = scene.add.graphics();
    this.hoverGraphics.setDepth(999);
  }

  /**
   * Register all interactive positions for the current scene.
   * Clears any previous registration and rebuilds reveal graphics.
   */
  setInteractables(
    hotspots: HotspotDef[],
    characters: CharacterDef[],
    exits: ExitDef[],
  ): void {
    this.interactables.clear();
    this.clearRevealGraphics();
    this.hoverGraphics.clear();
    this.allVisible = false;

    for (const hotspot of hotspots) {
      const key = `${hotspot.position[0]},${hotspot.position[1]}`;
      this.interactables.set(key, { type: 'hotspot', color: HOTSPOT_HINT_COLOR });
    }
    for (const character of characters) {
      const key = `${character.position[0]},${character.position[1]}`;
      this.interactables.set(key, { type: 'character', color: CHARACTER_HINT_COLOR });
    }
    for (const exit of exits) {
      const key = `${exit.position[0]},${exit.position[1]}`;
      this.interactables.set(key, { type: 'exit', color: EXIT_HINT_COLOR });
    }
  }

  /**
   * Check whether a grid position is interactive and update the hover outline.
   * Returns true if the position is interactive, false otherwise.
   */
  updateHover(gridX: number, gridY: number): boolean {
    this.hoverGraphics.clear();

    const key = `${gridX},${gridY}`;
    const entry = this.interactables.get(key);

    if (!entry) {
      return false;
    }

    this.drawDiamond(this.hoverGraphics, gridX, gridY, entry.color, HOVER_ALPHA);
    return true;
  }

  /**
   * Clear the hover outline without changing the showAll state.
   */
  clearHover(): void {
    this.hoverGraphics.clear();
  }

  /**
   * Reveal all interactive tiles with a dim outline.
   */
  showAll(): void {
    this.clearRevealGraphics();
    this.allVisible = true;

    for (const [key, entry] of this.interactables) {
      const [col, row] = key.split(',').map(Number);
      const g = this.scene.add.graphics();
      g.setDepth(998);
      this.drawDiamond(g, col, row, entry.color, SHOW_ALL_ALPHA);
      this.revealGraphics.push(g);
    }
  }

  /**
   * Hide the showAll reveal overlay.
   */
  hideAll(): void {
    this.clearRevealGraphics();
    this.allVisible = false;
  }

  /**
   * Whether showAll is currently active.
   */
  isShowingAll(): boolean {
    return this.allVisible;
  }

  /**
   * Get the interactable type at a grid position, or null if none.
   */
  getTypeAt(gridX: number, gridY: number): InteractableType | null {
    const key = `${gridX},${gridY}`;
    return this.interactables.get(key)?.type ?? null;
  }

  /**
   * Get the color for a given interactable type.
   */
  static colorForType(type: InteractableType): number {
    switch (type) {
      case 'hotspot':  return HOTSPOT_HINT_COLOR;
      case 'character': return CHARACTER_HINT_COLOR;
      case 'exit':     return EXIT_HINT_COLOR;
    }
  }

  /**
   * Clean up all graphics objects.
   */
  destroy(): void {
    this.hoverGraphics.destroy();
    this.clearRevealGraphics();
    this.interactables.clear();
  }

  // ── Private helpers ─────────────────────────────────────────────

  private drawDiamond(
    graphics: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    color: number,
    alpha: number,
  ): void {
    const { x, y } = cartToIso(col, row, this.tileWidth, this.tileHeight);
    const hw = this.tileWidth / 2;
    const hh = this.tileHeight / 2;

    graphics.lineStyle(2, color, alpha);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.lineTo(x + hw, y + hh);
    graphics.lineTo(x, y + this.tileHeight);
    graphics.lineTo(x - hw, y + hh);
    graphics.closePath();
    graphics.strokePath();
  }

  private clearRevealGraphics(): void {
    for (const g of this.revealGraphics) {
      g.destroy();
    }
    this.revealGraphics = [];
  }
}
