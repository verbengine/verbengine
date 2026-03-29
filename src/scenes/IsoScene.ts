import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { cartToIso, isoToCart } from './iso-math';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

const MAP_COLS = 10;
const MAP_ROWS = 10;

/** 0 = floor (walkable), 1 = wall (blocked) */
const MAP_DATA: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const FLOOR_COLOR = 0xc2b280; // tan
const WALL_COLOR = 0x555555;  // dark gray
const CHAR_COLOR = 0x3366ff;  // blue
const TARGET_COLOR = 0xffff00; // yellow highlight
const BLOCKED_COLOR = 0xff3333; // red flash for blocked

export class IsoScene extends Phaser.Scene {
  private tileGraphics!: Phaser.GameObjects.Graphics;
  private character!: Phaser.GameObjects.Graphics;
  private targetHighlight!: Phaser.GameObjects.Graphics;

  /** Current character position in grid coords */
  private charGridX = 1;
  private charGridY = 1;

  /** Offset to center the map on screen */
  private offsetX = 0;
  private offsetY = 0;

  private easystar!: EasyStar.js;
  private isMoving = false;

  constructor() {
    super({ key: 'IsoScene' });
  }

  create(): void {
    this.offsetX = Number(this.game.config.width) / 2;
    this.offsetY = 80;

    this.setupPathfinder();
    this.drawMap();
    this.createCharacter();
    this.createTargetHighlight();
    this.setupInput();

    // Back button
    this.add
      .text(16, 16, '< Back', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 8, y: 4 },
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });

    // Title
    this.add.text(Number(this.game.config.width) / 2, 16, 'Isometric Pathfinding Spike', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    // Instructions
    this.add.text(Number(this.game.config.width) / 2, 44, 'Click a floor tile to move the character', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5, 0);
  }

  private setupPathfinder(): void {
    this.easystar = new EasyStar.js();
    this.easystar.setGrid(MAP_DATA);
    this.easystar.setAcceptableTiles([0]);
    this.easystar.enableDiagonals();
    this.easystar.enableCornerCutting();
  }

  /** Convert grid coords to screen position (center of tile) */
  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    const iso = cartToIso(gx, gy, TILE_WIDTH, TILE_HEIGHT);
    return {
      x: iso.x + this.offsetX,
      y: iso.y + this.offsetY,
    };
  }

  /** Convert screen coords to grid coords (floored to integer) */
  private screenToGrid(sx: number, sy: number): { col: number; row: number } | null {
    const relX = sx - this.offsetX;
    const relY = sy - this.offsetY;
    const cart = isoToCart(relX, relY, TILE_WIDTH, TILE_HEIGHT);
    const col = Math.floor(cart.x);
    const row = Math.floor(cart.y);

    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) {
      return null;
    }
    return { col, row };
  }

  private drawMap(): void {
    this.tileGraphics = this.add.graphics();

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const isWall = MAP_DATA[row][col] === 1;
        const color = isWall ? WALL_COLOR : FLOOR_COLOR;
        this.drawDiamond(this.tileGraphics, col, row, color, isWall ? 0.9 : 0.7);
      }
    }
  }

  private drawDiamond(
    graphics: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    fillColor: number,
    alpha: number,
  ): void {
    const { x, y } = this.gridToScreen(col, row);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    graphics.fillStyle(fillColor, alpha);
    graphics.beginPath();
    graphics.moveTo(x, y - hh);      // top
    graphics.lineTo(x + hw, y);      // right
    graphics.lineTo(x, y + hh);      // bottom
    graphics.lineTo(x - hw, y);      // left
    graphics.closePath();
    graphics.fillPath();

    // Outline
    graphics.lineStyle(1, 0x000000, 0.3);
    graphics.beginPath();
    graphics.moveTo(x, y - hh);
    graphics.lineTo(x + hw, y);
    graphics.lineTo(x, y + hh);
    graphics.lineTo(x - hw, y);
    graphics.closePath();
    graphics.strokePath();
  }

  private createCharacter(): void {
    this.character = this.add.graphics();
    this.drawCharacter();
  }

  private drawCharacter(): void {
    this.character.clear();
    const { x, y } = this.gridToScreen(this.charGridX, this.charGridY);
    // Draw a filled circle for the character
    this.character.fillStyle(CHAR_COLOR, 1);
    this.character.fillCircle(x, y - 6, 10);
    // Small shadow ellipse
    this.character.fillStyle(0x000000, 0.25);
    this.character.fillEllipse(x, y + 2, 16, 6);
  }

  private createTargetHighlight(): void {
    this.targetHighlight = this.add.graphics();
    this.targetHighlight.setDepth(-1);
  }

  private showTargetHighlight(col: number, row: number, color: number): void {
    this.targetHighlight.clear();
    this.drawHighlightDiamond(col, row, color);

    // Fade out after a short time
    this.time.delayedCall(400, () => {
      this.targetHighlight.clear();
    });
  }

  private drawHighlightDiamond(col: number, row: number, color: number): void {
    const { x, y } = this.gridToScreen(col, row);
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    this.targetHighlight.fillStyle(color, 0.4);
    this.targetHighlight.beginPath();
    this.targetHighlight.moveTo(x, y - hh);
    this.targetHighlight.lineTo(x + hw, y);
    this.targetHighlight.lineTo(x, y + hh);
    this.targetHighlight.lineTo(x - hw, y);
    this.targetHighlight.closePath();
    this.targetHighlight.fillPath();
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMoving) return;

      const grid = this.screenToGrid(pointer.x, pointer.y);
      if (!grid) return;

      const { col, row } = grid;

      // Check if wall
      if (MAP_DATA[row][col] === 1) {
        this.showTargetHighlight(col, row, BLOCKED_COLOR);
        return;
      }

      // Check if already at target
      if (col === this.charGridX && row === this.charGridY) return;

      this.showTargetHighlight(col, row, TARGET_COLOR);
      this.findAndMoveTo(col, row);
    });
  }

  private findAndMoveTo(targetCol: number, targetRow: number): void {
    this.easystar.findPath(
      this.charGridX,
      this.charGridY,
      targetCol,
      targetRow,
      (path) => {
        if (!path || path.length < 2) return;
        // path[0] is current position, skip it
        this.moveAlongPath(path.slice(1));
      },
    );
    this.easystar.calculate();
  }

  private moveAlongPath(path: Array<{ x: number; y: number }>): void {
    if (path.length === 0) {
      this.isMoving = false;
      return;
    }

    this.isMoving = true;
    const next = path[0];
    const remaining = path.slice(1);

    const from = this.gridToScreen(this.charGridX, this.charGridY);
    const to = this.gridToScreen(next.x, next.y);

    // Use a tween on a temporary object to animate position
    const tweenTarget = { x: from.x, y: from.y };

    this.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y,
      duration: 180,
      ease: 'Linear',
      onUpdate: () => {
        this.character.clear();
        // Shadow
        this.character.fillStyle(0x000000, 0.25);
        this.character.fillEllipse(tweenTarget.x, tweenTarget.y + 2, 16, 6);
        // Character
        this.character.fillStyle(CHAR_COLOR, 1);
        this.character.fillCircle(tweenTarget.x, tweenTarget.y - 6, 10);
      },
      onComplete: () => {
        this.charGridX = next.x;
        this.charGridY = next.y;
        this.drawCharacter();
        this.moveAlongPath(remaining);
      },
    });
  }
}
