import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { cartToIso, isoToCart } from './iso-math';

const TILE_WIDTH = 64;
const TILE_HEIGHT = 32;

/** Smaller map that fills the screen better */
const MAP_COLS = 8;
const MAP_ROWS = 8;

/**
 * Map cell types:
 * 0 = stone floor (walkable)
 * 1 = wall (blocked)
 * 2 = tiled floor (walkable, visual variant)
 * 3 = dirt floor (walkable, visual variant)
 * 4 = planks floor (walkable, visual variant)
 * 5 = barrel decoration on floor (blocked)
 * 6 = crate decoration on floor (blocked)
 * 7 = chest decoration on floor (blocked)
 * 8 = table decoration on floor (blocked)
 */
const MAP_DATA: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 2, 2, 0, 3, 1],
  [1, 0, 5, 0, 0, 8, 3, 1],
  [1, 2, 0, 0, 0, 0, 0, 1],
  [1, 2, 0, 4, 4, 0, 0, 1],
  [1, 0, 7, 0, 0, 0, 6, 1],
  [1, 3, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
];

/** Tiles that are walkable (pathfinder acceptable tiles) */
const WALKABLE_TILES = [0, 2, 3, 4];

/** Map cell type to floor texture key */
const FLOOR_TEXTURE_MAP: Record<number, string> = {
  0: 'tile-floor-stone',
  2: 'tile-floor-stone-tile',
  3: 'tile-floor-dirt',
  4: 'tile-floor-planks',
};

/** Map cell type to decoration texture key (rendered on top of floor) */
const DECORATION_TEXTURE_MAP: Record<number, string> = {
  5: 'tile-barrel',
  6: 'tile-crate',
  7: 'tile-chest',
  8: 'tile-table',
};

const TARGET_COLOR = 0xffff00;
const BLOCKED_COLOR = 0xff3333;
const HOVER_COLOR = 0xffffff;

/** Hero spritesheet frame dimensions */
const HERO_FRAME_WIDTH = 32;
const HERO_FRAME_HEIGHT = 32;

/** Character direction indices (row in spritesheet) */
const DIR_SOUTH = 0;
const DIR_NORTH = 1;
const DIR_EAST = 2;
const DIR_WEST = 3;

/**
 * Scale factor for pixel art tiles.
 * Tiles are native 64x32 pixel art, scale up for better visibility.
 */
const TILE_SCALE = 1.5;

/** Scale factor applied to the hero character */
const HERO_SCALE = 1.5;

export class IsoScene extends Phaser.Scene {
  private tileImages: Phaser.GameObjects.Image[][] = [];
  private decorationImages: Phaser.GameObjects.Image[] = [];
  private characterSprite!: Phaser.GameObjects.Sprite;
  private targetHighlight!: Phaser.GameObjects.Graphics;
  private hoverHighlight!: Phaser.GameObjects.Graphics;

  /** Current character position in grid coords */
  private charGridX = 1;
  private charGridY = 1;

  /** Current facing direction */
  private charDirection = DIR_SOUTH;

  /** Tracked hover tile for avoiding redundant redraws */
  private hoverCol = -1;
  private hoverRow = -1;

  /** Offset to center the map on screen */
  private offsetX = 0;
  private offsetY = 0;

  /** Effective tile dimensions after scaling */
  private scaledTileWidth = TILE_WIDTH * TILE_SCALE;
  private scaledTileHeight = TILE_HEIGHT * TILE_SCALE;

  private easystar!: EasyStar.js;
  private isMoving = false;

  constructor() {
    super({ key: 'IsoScene' });
  }

  preload(): void {
    // Floor tiles (64x32 pixel art)
    this.load.image('tile-floor-stone', '/assets/tiles/floor-stone.png');
    this.load.image('tile-floor-stone-tile', '/assets/tiles/floor-stone-tile.png');
    this.load.image('tile-floor-dirt', '/assets/tiles/floor-dirt.png');
    this.load.image('tile-floor-planks', '/assets/tiles/floor-planks.png');

    // Wall tile (64x48 pixel art with depth)
    this.load.image('tile-wall', '/assets/tiles/wall-stone.png');

    // Decorations
    this.load.image('tile-barrel', '/assets/tiles/barrel.png');
    this.load.image('tile-crate', '/assets/tiles/crate.png');
    this.load.image('tile-chest', '/assets/tiles/chest.png');
    this.load.image('tile-table', '/assets/tiles/table.png');

    // Hero spritesheet: 3 columns x 4 rows, 32x32 per frame
    this.load.spritesheet('hero', '/assets/characters/hero.png', {
      frameWidth: HERO_FRAME_WIDTH,
      frameHeight: HERO_FRAME_HEIGHT,
    });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1a2e');

    this.offsetX = Number(this.game.config.width) / 2;
    this.offsetY = 100;

    this.setupAnimations();
    this.setupPathfinder();
    this.drawMap();
    this.createCharacter();
    this.createTargetHighlight();
    this.createHoverHighlight();
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
    this.add.text(Number(this.game.config.width) / 2, 16, 'Isometric Dungeon', {
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

  /** Create walk animations for each direction */
  private setupAnimations(): void {
    // Each row has 3 frames (columns 0,1,2). Row index = direction.
    // Frame indices in the spritesheet: row * 3 + column
    const directions = [
      { key: 'hero-walk-south', row: DIR_SOUTH },
      { key: 'hero-walk-north', row: DIR_NORTH },
      { key: 'hero-walk-east', row: DIR_EAST },
      { key: 'hero-walk-west', row: DIR_WEST },
    ];

    for (const { key, row } of directions) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [
            { key: 'hero', frame: row * 3 + 1 },
            { key: 'hero', frame: row * 3 + 0 },
            { key: 'hero', frame: row * 3 + 2 },
            { key: 'hero', frame: row * 3 + 0 },
          ],
          frameRate: 8,
          repeat: -1,
        });
      }
    }

    // Idle frames (standing, frame 0 of each direction row)
    const idles = [
      { key: 'hero-idle-south', row: DIR_SOUTH },
      { key: 'hero-idle-north', row: DIR_NORTH },
      { key: 'hero-idle-east', row: DIR_EAST },
      { key: 'hero-idle-west', row: DIR_WEST },
    ];

    for (const { key, row } of idles) {
      if (!this.anims.exists(key)) {
        this.anims.create({
          key,
          frames: [{ key: 'hero', frame: row * 3 + 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }

  private setupPathfinder(): void {
    this.easystar = new EasyStar.js();
    this.easystar.setGrid(MAP_DATA);
    this.easystar.setAcceptableTiles(WALKABLE_TILES);
    this.easystar.enableDiagonals();
    this.easystar.enableCornerCutting();
  }

  /** Convert grid coords to screen position (center of tile diamond), scaled */
  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    const iso = cartToIso(gx, gy, this.scaledTileWidth, this.scaledTileHeight);
    return {
      x: iso.x + this.offsetX,
      y: iso.y + this.offsetY,
    };
  }

  /** Convert screen coords to grid coords (floored to integer), scaled */
  private screenToGrid(sx: number, sy: number): { col: number; row: number } | null {
    const relX = sx - this.offsetX;
    const relY = sy - this.offsetY;
    const cart = isoToCart(relX, relY, this.scaledTileWidth, this.scaledTileHeight);
    const col = Math.floor(cart.x);
    const row = Math.floor(cart.y);

    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) {
      return null;
    }
    return { col, row };
  }

  private drawMap(): void {
    this.tileImages = [];
    this.decorationImages = [];

    for (let row = 0; row < MAP_ROWS; row++) {
      this.tileImages[row] = [];
      for (let col = 0; col < MAP_COLS; col++) {
        const cellType = MAP_DATA[row][col];
        const { x, y } = this.gridToScreen(col, row);

        if (cellType === 1) {
          // Wall tile (64x48, has height)
          const wallImg = this.add.image(x, y, 'tile-wall');
          wallImg.setScale(TILE_SCALE);
          wallImg.setOrigin(0.5, 0.75);
          wallImg.setDepth(row + col);
          this.tileImages[row][col] = wallImg;
        } else {
          // Floor tile (pick texture based on cell type)
          const textureKey = FLOOR_TEXTURE_MAP[cellType] ?? 'tile-floor-stone';
          const floorImg = this.add.image(x, y, textureKey);
          floorImg.setScale(TILE_SCALE);
          floorImg.setOrigin(0.5, 0.5);
          floorImg.setDepth(row + col);
          this.tileImages[row][col] = floorImg;

          // Decoration on top of floor
          const decoKey = DECORATION_TEXTURE_MAP[cellType];
          if (decoKey) {
            const decoImg = this.add.image(x, y - 8 * TILE_SCALE, decoKey);
            decoImg.setScale(TILE_SCALE);
            decoImg.setOrigin(0.5, 0.5);
            decoImg.setDepth(row + col + 0.5);
            this.decorationImages.push(decoImg);
          }
        }
      }
    }
  }

  private createCharacter(): void {
    const { x, y } = this.gridToScreen(this.charGridX, this.charGridY);
    this.characterSprite = this.add.sprite(x, y, 'hero', DIR_SOUTH * 3);
    this.characterSprite.setScale(HERO_SCALE);
    this.characterSprite.setOrigin(0.5, 0.8);
    this.updateCharacterDepth();
  }

  private updateCharacterDepth(): void {
    this.characterSprite.setDepth(this.charGridY + this.charGridX + 0.8);
  }

  private positionCharacter(screenX: number, screenY: number): void {
    this.characterSprite.setPosition(screenX, screenY);
  }

  /** Determine direction from movement delta and play appropriate animation */
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
  }

  private getWalkAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `hero-walk-${dirNames[this.charDirection]}`;
  }

  private getIdleAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `hero-idle-${dirNames[this.charDirection]}`;
  }

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
    const hw = this.scaledTileWidth / 2;
    const hh = this.scaledTileHeight / 2;

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
    const hw = this.scaledTileWidth / 2;
    const hh = this.scaledTileHeight / 2;

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

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMoving) return;

      const grid = this.screenToGrid(pointer.x, pointer.y);
      if (!grid) return;

      const { col, row } = grid;
      const cellType = MAP_DATA[row][col];

      // Check if blocked (wall or decoration)
      if (!WALKABLE_TILES.includes(cellType)) {
        this.showTargetHighlight(col, row, BLOCKED_COLOR);
        return;
      }

      // Check if already at target
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
      // Stop walk animation, show idle frame in current direction
      this.characterSprite.play(this.getIdleAnimKey());
      return;
    }

    this.isMoving = true;
    const next = path[0];
    const remaining = path.slice(1);

    // Calculate movement direction
    const dx = next.x - this.charGridX;
    const dy = next.y - this.charGridY;
    this.setCharacterDirection(dx, dy);

    // Play walk animation for current direction
    const walkKey = this.getWalkAnimKey();
    if (this.characterSprite.anims.currentAnim?.key !== walkKey) {
      this.characterSprite.play(walkKey);
    }

    const from = this.gridToScreen(this.charGridX, this.charGridY);
    const to = this.gridToScreen(next.x, next.y);

    const tweenTarget = { x: from.x, y: from.y };

    this.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y,
      duration: 220,
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
