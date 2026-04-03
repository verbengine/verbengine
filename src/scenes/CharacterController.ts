/**
 * CharacterController — manages player character sprite, walk animations,
 * and EasyStar pathfinding movement for isometric adventure scenes.
 *
 * Encapsulates the character creation and tween-based movement patterns
 * from IsoScene so they can be reused without duplicating code in AdventureScene.
 */

import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { cartToIso } from './iso-math';

// ── Direction indices ─────────────────────────────────────────────
const DIR_SOUTH = 0;
const DIR_NORTH = 1;
const DIR_EAST = 2;
const DIR_WEST = 3;

// ── Spritesheet layout ────────────────────────────────────────────
/** 7 columns x 3 rows, each frame CHAR_W x CHAR_H */
const SPRITE_COLS = 7;
/** Walk cycle ping-pong: col indices 0,1,2,1 */
const WALK_CYCLE = [0, 1, 2, 1];
/** Character frame size (matches IsoScene convention) */
const CHAR_W = 16;
const CHAR_H = 32;

export interface TileDimensions {
  /** Base tile diamond width (before zoom), e.g. 32 */
  tileWidth: number;
  /** Base tile diamond height (before zoom), e.g. 16 */
  tileHeight: number;
  /** Zoom/scale factor applied to tiles and character, e.g. 3 */
  zoom: number;
}

/**
 * CharacterController
 *
 * Usage:
 *   const ctrl = new CharacterController(scene, easystar, dims, 'char_0');
 *   ctrl.createCharacter(startCol, startRow);
 *   ctrl.walkTo(targetCol, targetRow, () => console.log('arrived'));
 */
export class CharacterController {
  private readonly scene: Phaser.Scene;
  private readonly easystar: EasyStar.js;
  private readonly tileW: number;
  private readonly tileH: number;
  private readonly scaledTileW: number;
  private readonly scaledTileH: number;
  private readonly charScale: number;
  private readonly spriteKey: string;

  private sprite!: Phaser.GameObjects.Sprite;
  private gridX = 0;
  private gridY = 0;
  private direction = DIR_SOUTH;
  private moving = false;
  private moveCallback: (() => void) | null = null;

  /** Movement speed in tiles/second (matches IsoScene MOVE_SPEED) */
  private readonly moveSpeed: number;
  /** Animation frame duration in milliseconds (matches IsoScene FRAME_DURATION_MS) */
  private readonly frameDurationMs: number;

  constructor(
    scene: Phaser.Scene,
    easystar: EasyStar.js,
    dims: TileDimensions,
    spriteKey: string,
    moveSpeed = 2.5,
    frameDurationMs = 150,
  ) {
    this.scene = scene;
    this.easystar = easystar;
    this.tileW = dims.tileWidth;
    this.tileH = dims.tileHeight;
    this.scaledTileW = dims.tileWidth * dims.zoom;
    this.scaledTileH = dims.tileHeight * dims.zoom;
    this.charScale = dims.zoom;
    this.spriteKey = spriteKey;
    this.moveSpeed = moveSpeed;
    this.frameDurationMs = frameDurationMs;
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Create the character sprite at the given grid position.
   * Also registers walk/idle animations for the sprite key if they don't exist yet.
   *
   * @returns the created Phaser.GameObjects.Sprite
   */
  createCharacter(gridX: number, gridY: number): Phaser.GameObjects.Sprite {
    this.gridX = gridX;
    this.gridY = gridY;

    this.registerAnimations();

    const { x, y } = this.gridToScreen(gridX, gridY);
    this.sprite = this.scene.add.sprite(
      Math.round(x),
      Math.round(y + this.scaledTileH / 2),
      this.spriteKey,
      0,
    );
    this.sprite.setScale(this.charScale);
    this.sprite.setOrigin(0.5, 1.0);
    this.updateDepth();

    const idleKey = this.idleAnimKey();
    if (this.scene.anims.exists(idleKey)) {
      this.sprite.play(idleKey);
    }

    return this.sprite;
  }

  /**
   * Walk the character to the given grid cell using EasyStar pathfinding.
   * Plays walk animation for each step and idle animation on arrival.
   * Calls onComplete when the character reaches the target (or immediately if
   * no path is found or the target equals the current position).
   */
  walkTo(targetGridX: number, targetGridY: number, onComplete?: () => void): void {
    if (targetGridX === this.gridX && targetGridY === this.gridY) {
      onComplete?.();
      return;
    }

    this.moveCallback = onComplete ?? null;

    this.easystar.findPath(
      this.gridX,
      this.gridY,
      targetGridX,
      targetGridY,
      (path) => {
        if (!path || path.length < 2) {
          // No path found — fire callback immediately
          const cb = this.moveCallback;
          this.moveCallback = null;
          cb?.();
          return;
        }
        this.moveAlongPath(path.slice(1));
      },
    );
    this.easystar.calculate();
  }

  /** Current grid position */
  getPosition(): { gridX: number; gridY: number } {
    return { gridX: this.gridX, gridY: this.gridY };
  }

  /** World (screen) position of the character sprite */
  getWorldPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  /** Returns true while the character is walking */
  isMoving(): boolean {
    return this.moving;
  }

  /** Destroy the sprite and clean up */
  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
    }
  }

  // ── Private helpers ───────────────────────────────────────────

  /** Register walk + idle animations for this.spriteKey if they don't exist yet. */
  private registerAnimations(): void {
    const frameRate = Math.round(1000 / this.frameDurationMs);
    const dirDefs = [
      { dir: 'south', row: 0 },
      { dir: 'north', row: 1 },
      { dir: 'east',  row: 2 },
      { dir: 'west',  row: 2 }, // same frames as east, sprite flipped horizontally
    ];

    for (const { dir, row } of dirDefs) {
      const walkKey = `${this.spriteKey}-walk-${dir}`;
      if (!this.scene.anims.exists(walkKey)) {
        this.scene.anims.create({
          key: walkKey,
          frames: WALK_CYCLE.map((col) => ({
            key: this.spriteKey,
            frame: row * SPRITE_COLS + col,
          })),
          frameRate,
          repeat: -1,
        });
      }

      const idleKey = `${this.spriteKey}-idle-${dir}`;
      if (!this.scene.anims.exists(idleKey)) {
        this.scene.anims.create({
          key: idleKey,
          frames: [{ key: this.spriteKey, frame: row * SPRITE_COLS + 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }

  /** Convert grid coordinates to isometric screen position (top of tile diamond). */
  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    return cartToIso(gx, gy, this.scaledTileW, this.scaledTileH);
  }

  /** Update sprite depth for correct isometric layering. */
  private updateDepth(): void {
    this.sprite.setDepth(this.gridY + this.gridX + 0.8);
  }

  /** Determine facing direction from movement delta and apply sprite flip. */
  private setDirection(dx: number, dy: number): void {
    if (dx > 0 && dy > 0)       this.direction = DIR_SOUTH;
    else if (dx < 0 && dy < 0)  this.direction = DIR_NORTH;
    else if (dx > 0 && dy < 0)  this.direction = DIR_EAST;
    else if (dx < 0 && dy > 0)  this.direction = DIR_WEST;
    else if (dx > 0)             this.direction = DIR_EAST;
    else if (dx < 0)             this.direction = DIR_WEST;
    else if (dy > 0)             this.direction = DIR_SOUTH;
    else if (dy < 0)             this.direction = DIR_NORTH;

    // West is the east spritesheet row flipped horizontally
    this.sprite.setFlipX(this.direction === DIR_WEST);
  }

  private walkAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `${this.spriteKey}-walk-${dirNames[this.direction]}`;
  }

  private idleAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `${this.spriteKey}-idle-${dirNames[this.direction]}`;
  }

  /** Recursively walk one step at a time along the path returned by EasyStar. */
  private moveAlongPath(path: Array<{ x: number; y: number }>): void {
    if (path.length === 0) {
      this.moving = false;

      const idleKey = this.idleAnimKey();
      if (this.scene.anims.exists(idleKey)) {
        this.sprite.play(idleKey);
      }

      const cb = this.moveCallback;
      this.moveCallback = null;
      cb?.();
      return;
    }

    this.moving = true;
    const next = path[0];
    const remaining = path.slice(1);

    const dx = next.x - this.gridX;
    const dy = next.y - this.gridY;
    this.setDirection(dx, dy);

    const walkKey = this.walkAnimKey();
    if (this.scene.anims.exists(walkKey) && this.sprite.anims.currentAnim?.key !== walkKey) {
      this.sprite.play(walkKey);
    }

    const from = this.gridToScreen(this.gridX, this.gridY);
    const to   = this.gridToScreen(next.x, next.y);
    const charOffsetY = this.scaledTileH / 2;
    const stepDuration = (1 / this.moveSpeed) * 1000;
    const tweenTarget = { x: from.x, y: from.y + charOffsetY };

    this.scene.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y + charOffsetY,
      duration: stepDuration,
      ease: 'Linear',
      onUpdate: () => {
        this.sprite.setPosition(Math.round(tweenTarget.x), Math.round(tweenTarget.y));
      },
      onComplete: () => {
        this.gridX = next.x;
        this.gridY = next.y;

        const snapped = this.gridToScreen(this.gridX, this.gridY);
        this.sprite.setPosition(
          Math.round(snapped.x),
          Math.round(snapped.y + charOffsetY),
        );
        this.updateDepth();
        this.moveAlongPath(remaining);
      },
    });
  }
}

// Re-export direction constants for consumers that need them
export { DIR_SOUTH, DIR_NORTH, DIR_EAST, DIR_WEST, CHAR_W, CHAR_H };
