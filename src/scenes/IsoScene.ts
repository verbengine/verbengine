import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { cartToIso, isoToCart } from './iso-math';

// ── Fyso World–style constants ──────────────────────────────────
/** Base tile diamond: 32x16 pixels (2:1 ratio) */
const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;

/** Zoom: everything rendered at 3x scale */
const ZOOM = 3;

/** Effective (scaled) tile dimensions */
const SCALED_TILE_W = TILE_WIDTH * ZOOM;
const SCALED_TILE_H = TILE_HEIGHT * ZOOM;

/** Character frame size in the spritesheet */
const CHAR_W = 16;
const CHAR_H = 32;

/** Character scale matches the tile zoom */
const CHAR_SCALE = ZOOM;

/** Movement speed in tiles/second and animation frame duration */
const MOVE_SPEED = 2.5;
const FRAME_DURATION_MS = 150; // 0.15s per frame

// ── Map definition (25x25) ──────────────────────────────────────
const MAP_COLS = 25;
const MAP_ROWS = 25;

/**
 * Cell types:
 * 0 = office floor (walkable)
 * 1 = wall plain (blocked)
 * 2 = wall window (blocked)
 * 3 = desk (blocked decoration on floor)
 * 4 = chair (walkable decoration on floor)
 * 5 = bookshelf (blocked decoration on floor)
 * 6 = barrel (blocked decoration on floor)
 *
 * Layout: 4 rooms connected by corridors
 * - Top-left (rows 1-9, cols 1-9): Office with desks/chairs
 * - Top-center (rows 1-9, cols 11-15): Meeting room
 * - Top-right (rows 1-9, cols 17-23): Library with bookshelves
 * - Bottom-left (rows 14-23, cols 1-9): Storage room with barrels
 * - Bottom-right (rows 14-23, cols 11-23): Large open office
 * - Rows 10-13: Horizontal corridor connecting everything
 */
const MAP_DATA: number[][] = [
  // Row 0 — top perimeter
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  // Row 2
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  // Row 3 — office desks
  [1,0,0,3,0,0,3,0,0,0,2,0,0,0,0,0,1,0,0,5,5,5,0,0,1],
  // Row 4 — office chairs
  [1,0,0,4,0,0,4,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  // Row 5
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,5,5,5,0,0,1],
  // Row 6 — more desks
  [1,0,0,3,0,0,3,0,0,0,1,0,0,0,0,0,2,0,0,0,0,0,0,0,1],
  // Row 7 — more chairs
  [1,0,0,4,0,0,4,0,0,0,2,0,0,0,0,0,0,0,0,5,5,5,0,0,1],
  // Row 8
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  // Row 9
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,4,0,0,0,1],
  // Row 10 — horizontal corridor wall with doorways
  [1,1,1,1,1,0,0,1,1,1,1,0,0,0,0,0,1,1,1,0,0,1,1,1,1],
  // Row 11 — corridor
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 12 — corridor
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 13 — horizontal wall with doorways
  [1,1,1,0,0,1,1,1,1,1,1,1,0,0,1,1,1,1,1,0,0,1,1,1,1],
  // Row 14
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 15
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 16 — storage barrels
  [1,0,6,6,0,0,0,0,0,0,1,0,0,3,0,0,3,0,0,0,0,0,0,0,1],
  // Row 17
  [1,0,0,0,0,0,6,6,0,0,2,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
  // Row 18
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 19 — more barrels
  [1,0,6,0,0,0,0,6,0,0,1,0,0,3,0,0,3,0,0,0,0,0,0,0,1],
  // Row 20
  [1,0,0,0,0,0,0,0,0,0,1,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
  // Row 21
  [1,0,0,0,6,6,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 22
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,6,6,0,0,0,1],
  // Row 23
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 24 — bottom perimeter
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

/** Tiles the pathfinder treats as walkable */
const WALKABLE_TILES = [0, 4];

/** Floor texture for walkable cells */
const FLOOR_KEY = 'tile-floor-office';

/** Decoration texture keys (rendered on top of floor) */
const DECO_KEY: Record<number, string> = {
  3: 'tile-desk',
  4: 'tile-chair',
  5: 'tile-bookshelf',
  6: 'tile-barrel',
};

const TARGET_COLOR = 0xffff00;
const BLOCKED_COLOR = 0xff3333;
const HOVER_COLOR = 0xffffff;

/** Direction indices — rows 0-2 in the spritesheet, west = flipped east */
const DIR_SOUTH = 0;
const DIR_NORTH = 1;
const DIR_EAST = 2;
const DIR_WEST = 3;

/**
 * Spritesheet layout (fyso_world):
 * 7 columns x 3 rows, each frame 16x32.
 * Columns: walk0 | walk1 | walk2 | type0 | type1 | read0 | read1
 * Rows: DOWN(0) | UP(1) | RIGHT(2)
 * Walk cycle ping-pong: 0, 1, 2, 1
 */
const SPRITE_COLS = 7;
const WALK_CYCLE = [0, 1, 2, 1];

export class IsoScene extends Phaser.Scene {
  private tileImages: Phaser.GameObjects.Image[][] = [];
  private decorationImages: Phaser.GameObjects.Image[] = [];
  private characterSprite!: Phaser.GameObjects.Sprite;
  private targetHighlight!: Phaser.GameObjects.Graphics;
  private hoverHighlight!: Phaser.GameObjects.Graphics;

  /** Current character grid position */
  private charGridX = 1;
  private charGridY = 1;

  /** Current facing direction */
  private charDirection = DIR_SOUTH;

  /** Tracked hover tile for avoiding redundant redraws */
  private hoverCol = -1;
  private hoverRow = -1;

  private easystar!: EasyStar.js;
  private isMoving = false;

  constructor() {
    super({ key: 'IsoScene' });
  }

  preload(): void {
    // Floor tile (32x16 base)
    this.load.image(FLOOR_KEY, '/assets/tiles/floor_office.png');

    // Wall tiles
    this.load.image('tile-wall-plain', '/assets/tiles/wall_plain.png');
    this.load.image('tile-wall-window', '/assets/tiles/wall_window.png');

    // Decorations
    this.load.image('tile-desk', '/assets/tiles/desk.png');
    this.load.image('tile-chair', '/assets/tiles/chair.png');
    this.load.image('tile-bookshelf', '/assets/tiles/bookshelf.png');
    this.load.image('tile-barrel', '/assets/tiles/barrel.png');

    // Character spritesheet: 7 cols x 3 rows, 16x32 per frame
    this.load.spritesheet('char_0', '/assets/characters/char_0.png', {
      frameWidth: CHAR_W,
      frameHeight: CHAR_H,
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2c2c3a');

    this.setupAnimations();
    this.setupPathfinder();
    this.drawMap();
    this.createCharacter();
    this.createTargetHighlight();
    this.createHoverHighlight();
    this.setupInput();
    this.setupCamera();

    // Fixed-position UI (ignores camera scroll)
    this.add
      .text(16, 16, '< Back', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#333333',
        padding: { x: 8, y: 4 },
      })
      .setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(2000)
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });

    this.add.text(Number(this.game.config.width) / 2, 16, 'Fyso World Office', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);

    this.add.text(Number(this.game.config.width) / 2, 44, 'Click a floor tile to move', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);
  }

  // ── Animations ────────────────────────────────────────────────

  private setupAnimations(): void {
    // Walk: 4-step ping-pong using spritesheet columns 0,1,2
    const walkDirs = [
      { key: 'char-walk-south', row: 0 },
      { key: 'char-walk-north', row: 1 },
      { key: 'char-walk-east', row: 2 },
      { key: 'char-walk-west', row: 2 }, // same frames, flipped in render
    ];

    for (const { key, row } of walkDirs) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: WALK_CYCLE.map((col) => ({
            key: 'char_0',
            frame: row * SPRITE_COLS + col,
          })),
          frameRate: Math.round(1000 / FRAME_DURATION_MS),
          repeat: -1,
        });
      }
    }

    // Idle: frame 0 of each row
    const idleDirs = [
      { key: 'char-idle-south', row: 0 },
      { key: 'char-idle-north', row: 1 },
      { key: 'char-idle-east', row: 2 },
      { key: 'char-idle-west', row: 2 },
    ];

    for (const { key, row } of idleDirs) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [{ key: 'char_0', frame: row * SPRITE_COLS + 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }

  // ── Pathfinder ────────────────────────────────────────────────

  private setupPathfinder(): void {
    this.easystar = new EasyStar.js();
    this.easystar.setGrid(MAP_DATA);
    this.easystar.setAcceptableTiles(WALKABLE_TILES);
    this.easystar.enableDiagonals();
    this.easystar.enableCornerCutting();
  }

  // ── Coordinate helpers ────────────────────────────────────────

  /** Convert grid coords to world-space screen position (center of diamond) */
  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    return cartToIso(gx, gy, SCALED_TILE_W, SCALED_TILE_H);
  }

  /** Convert viewport screen coords (accounting for camera scroll) to grid */
  private screenToGrid(sx: number, sy: number): { col: number; row: number } | null {
    const worldPoint = this.cameras.main.getWorldPoint(sx, sy);
    const cart = isoToCart(worldPoint.x, worldPoint.y, SCALED_TILE_W, SCALED_TILE_H);
    const col = Math.floor(cart.x);
    const row = Math.floor(cart.y);

    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) {
      return null;
    }
    return { col, row };
  }

  // ── Map rendering ─────────────────────────────────────────────

  private drawMap(): void {
    this.tileImages = [];
    this.decorationImages = [];

    for (let row = 0; row < MAP_ROWS; row++) {
      this.tileImages[row] = [];
      for (let col = 0; col < MAP_COLS; col++) {
        const cellType = MAP_DATA[row][col];
        const { x, y } = this.gridToScreen(col, row);

        if (cellType === 1) {
          // Plain wall
          const wallImg = this.add.image(x, y, 'tile-wall-plain');
          wallImg.setScale(ZOOM);
          wallImg.setOrigin(0.5, 0.75);
          wallImg.setDepth(row + col);
          this.tileImages[row][col] = wallImg;
        } else if (cellType === 2) {
          // Window wall
          const wallImg = this.add.image(x, y, 'tile-wall-window');
          wallImg.setScale(ZOOM);
          wallImg.setOrigin(0.5, 0.75);
          wallImg.setDepth(row + col);
          this.tileImages[row][col] = wallImg;
        } else {
          // Floor tile (all walkable or decorated cells get floor underneath)
          const floorImg = this.add.image(x, y, FLOOR_KEY);
          floorImg.setScale(ZOOM);
          floorImg.setOrigin(0.5, 0.5);
          floorImg.setDepth(row + col);
          this.tileImages[row][col] = floorImg;

          // Decoration on top of the floor
          const decoKey = DECO_KEY[cellType];
          if (decoKey) {
            const decoImg = this.add.image(x, y - 8 * ZOOM, decoKey);
            decoImg.setScale(ZOOM);
            decoImg.setOrigin(0.5, 0.5);
            decoImg.setDepth(row + col + 0.5);
            this.decorationImages.push(decoImg);
          }
        }
      }
    }
  }

  // ── Character ─────────────────────────────────────────────────

  private createCharacter(): void {
    const { x, y } = this.gridToScreen(this.charGridX, this.charGridY);
    this.characterSprite = this.add.sprite(x, y, 'char_0', 0);
    this.characterSprite.setScale(CHAR_SCALE);
    this.characterSprite.setOrigin(0.5, 0.8);
    this.updateCharacterDepth();
    this.characterSprite.play('char-idle-south');
  }

  private updateCharacterDepth(): void {
    this.characterSprite.setDepth(this.charGridY + this.charGridX + 0.8);
  }

  private positionCharacter(screenX: number, screenY: number): void {
    this.characterSprite.setPosition(screenX, screenY);
  }

  /** Determine direction from movement delta and apply sprite flip */
  private setCharacterDirection(dx: number, dy: number): void {
    if (dx > 0 && dy > 0) {
      this.charDirection = DIR_SOUTH;
    } else if (dx < 0 && dy < 0) {
      this.charDirection = DIR_NORTH;
    } else if (dx > 0 && dy < 0) {
      this.charDirection = DIR_EAST;
    } else if (dx < 0 && dy > 0) {
      this.charDirection = DIR_WEST;
    } else if (dx > 0) {
      this.charDirection = DIR_EAST;
    } else if (dx < 0) {
      this.charDirection = DIR_WEST;
    } else if (dy > 0) {
      this.charDirection = DIR_SOUTH;
    } else if (dy < 0) {
      this.charDirection = DIR_NORTH;
    }

    // West = horizontally flipped east row
    this.characterSprite.setFlipX(this.charDirection === DIR_WEST);
  }

  private getWalkAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `char-walk-${dirNames[this.charDirection]}`;
  }

  private getIdleAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `char-idle-${dirNames[this.charDirection]}`;
  }

  // ── Camera ────────────────────────────────────────────────────

  private setupCamera(): void {
    // Compute world bounds from map corners (isometric diamond extents)
    const topLeft = this.gridToScreen(0, 0);
    const topRight = this.gridToScreen(MAP_COLS, 0);
    const bottomLeft = this.gridToScreen(0, MAP_ROWS);
    const bottomRight = this.gridToScreen(MAP_COLS, MAP_ROWS);

    const minX = Math.min(topLeft.x, bottomLeft.x) - SCALED_TILE_W;
    const maxX = Math.max(topRight.x, bottomRight.x) + SCALED_TILE_W;
    const minY = Math.min(topLeft.y, topRight.y) - SCALED_TILE_H * 2;
    const maxY = Math.max(bottomLeft.y, bottomRight.y) + SCALED_TILE_H * 2;

    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
    this.cameras.main.startFollow(this.characterSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
  }

  // ── Highlights ────────────────────────────────────────────────

  private createTargetHighlight(): void {
    this.targetHighlight = this.add.graphics();
    this.targetHighlight.setDepth(1000);
  }

  private createHoverHighlight(): void {
    this.hoverHighlight = this.add.graphics();
    this.hoverHighlight.setDepth(999);
  }

  private showTargetHighlight(col: number, row: number, color: number): void {
    this.targetHighlight.clear();
    this.drawHighlightDiamond(this.targetHighlight, col, row, color, 0.4);

    this.time.delayedCall(400, () => {
      this.targetHighlight.clear();
    });
  }

  private drawHighlightDiamond(
    graphics: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    color: number,
    alpha: number,
  ): void {
    const { x, y } = this.gridToScreen(col, row);
    const hw = SCALED_TILE_W / 2;
    const hh = SCALED_TILE_H / 2;

    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(x, y - hh);
    graphics.lineTo(x + hw, y);
    graphics.lineTo(x, y + hh);
    graphics.lineTo(x - hw, y);
    graphics.closePath();
    graphics.fillPath();
  }

  private drawHoverHighlight(col: number, row: number): void {
    this.hoverHighlight.clear();
    const { x, y } = this.gridToScreen(col, row);
    const hw = SCALED_TILE_W / 2;
    const hh = SCALED_TILE_H / 2;

    this.hoverHighlight.lineStyle(2, HOVER_COLOR, 0.8);
    this.hoverHighlight.beginPath();
    this.hoverHighlight.moveTo(x, y - hh);
    this.hoverHighlight.lineTo(x + hw, y);
    this.hoverHighlight.lineTo(x, y + hh);
    this.hoverHighlight.lineTo(x - hw, y);
    this.hoverHighlight.closePath();
    this.hoverHighlight.strokePath();

    this.hoverHighlight.fillStyle(HOVER_COLOR, 0.15);
    this.hoverHighlight.beginPath();
    this.hoverHighlight.moveTo(x, y - hh);
    this.hoverHighlight.lineTo(x + hw, y);
    this.hoverHighlight.lineTo(x, y + hh);
    this.hoverHighlight.lineTo(x - hw, y);
    this.hoverHighlight.closePath();
    this.hoverHighlight.fillPath();
  }

  private clearHoverHighlight(): void {
    this.hoverHighlight.clear();
    this.hoverCol = -1;
    this.hoverRow = -1;
  }

  // ── Input ─────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMoving) return;

      const grid = this.screenToGrid(pointer.x, pointer.y);
      if (!grid) return;

      const { col, row } = grid;
      const cellType = MAP_DATA[row][col];

      if (!WALKABLE_TILES.includes(cellType)) {
        this.showTargetHighlight(col, row, BLOCKED_COLOR);
        return;
      }

      if (col === this.charGridX && row === this.charGridY) return;

      this.showTargetHighlight(col, row, TARGET_COLOR);
      this.findAndMoveTo(col, row);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const grid = this.screenToGrid(pointer.x, pointer.y);
      if (!grid) {
        this.clearHoverHighlight();
        return;
      }

      const { col, row } = grid;
      if (col === this.hoverCol && row === this.hoverRow) return;

      this.hoverCol = col;
      this.hoverRow = row;
      this.drawHoverHighlight(col, row);
    });
  }

  // ── Movement ──────────────────────────────────────────────────

  private findAndMoveTo(targetCol: number, targetRow: number): void {
    this.easystar.findPath(
      this.charGridX,
      this.charGridY,
      targetCol,
      targetRow,
      (path) => {
        if (!path || path.length < 2) return;
        this.moveAlongPath(path.slice(1));
      },
    );
    this.easystar.calculate();
  }

  private moveAlongPath(path: Array<{ x: number; y: number }>): void {
    if (path.length === 0) {
      this.isMoving = false;
      this.characterSprite.play(this.getIdleAnimKey());
      return;
    }

    this.isMoving = true;
    const next = path[0];
    const remaining = path.slice(1);

    const dx = next.x - this.charGridX;
    const dy = next.y - this.charGridY;
    this.setCharacterDirection(dx, dy);

    const walkKey = this.getWalkAnimKey();
    if (this.characterSprite.anims.currentAnim?.key !== walkKey) {
      this.characterSprite.play(walkKey);
    }

    const from = this.gridToScreen(this.charGridX, this.charGridY);
    const to = this.gridToScreen(next.x, next.y);

    // Duration from MOVE_SPEED (tiles/second)
    const stepDuration = (1 / MOVE_SPEED) * 1000;
    const tweenTarget = { x: from.x, y: from.y };

    this.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y,
      duration: stepDuration,
      ease: 'Linear',
      onUpdate: () => {
        this.positionCharacter(tweenTarget.x, tweenTarget.y);
      },
      onComplete: () => {
        this.charGridX = next.x;
        this.charGridY = next.y;
        const pos = this.gridToScreen(this.charGridX, this.charGridY);
        this.positionCharacter(pos.x, pos.y);
        this.updateCharacterDepth();
        this.moveAlongPath(remaining);
      },
    });
  }
}
