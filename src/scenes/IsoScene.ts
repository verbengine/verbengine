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
 * 6 = plant (blocked decoration on floor)
 * 7 = coffee machine (blocked decoration on floor)
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
  // Row 11 — corridor with plants and coffee
  [1,0,6,0,0,0,0,0,0,0,7,0,0,0,0,0,6,0,0,0,0,0,6,0,1],
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
const FLOOR_KEY = 'tile-floor-carpet';
const FLOOR_WOOD_KEY = 'tile-floor-wood';

/** Decoration texture keys (rendered on top of floor) */
const DECO_KEY: Record<number, string> = {
  3: 'tile-desk',
  5: 'tile-bookshelf-nano',
  6: 'tile-plant-nano',
  7: 'tile-coffee-nano',
};

/** Scale factor for nanobanana-generated tiles (711px wide → SCALED_TILE_W) */
const NANO_SCALE = SCALED_TILE_W / 711;

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

/** Wander config */
const WANDER_RADIUS = 4;
const WANDER_MIN_PAUSE = 2000; // ms
const WANDER_MAX_PAUSE = 5000; // ms
const NPC_MOVE_SPEED = 2; // tiles/sec

/** NPC definitions */
interface NpcDef {
  id: string;
  sprite: string;
  gridX: number;
  gridY: number;
  direction: number;
  name: string;
  dialogue: string;
}

/** Runtime NPC state */
interface NpcState {
  def: NpcDef;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  currentX: number;
  currentY: number;
  homeX: number;
  homeY: number;
  isMoving: boolean;
}

const NPCS: NpcDef[] = [
  { id: 'npc1', sprite: 'char_1', gridX: 4, gridY: 3, direction: DIR_SOUTH, name: 'Ana', dialogue: 'Hey! Welcome to the office. The coffee machine is in the corridor.' },
  { id: 'npc2', sprite: 'char_2', gridX: 20, gridY: 5, direction: DIR_WEST, name: 'Carlos', dialogue: 'Shhh... I\'m reading. The library is my favorite spot.' },
  { id: 'npc3', sprite: 'char_3', gridX: 14, gridY: 17, direction: DIR_SOUTH, name: 'Elena', dialogue: 'I\'ve been coding all day. Need more coffee...' },
];

export class IsoScene extends Phaser.Scene {
  private tileImages: Phaser.GameObjects.Image[][] = [];
  private decorationImages: Phaser.GameObjects.Image[] = [];
  private npcStates: NpcState[] = [];
  private dialogueBox: Phaser.GameObjects.Container | null = null;
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
    // Floor tiles (nanobanana)
    this.load.image(FLOOR_KEY, '/assets/tiles/floor_carpet.png');
    this.load.image(FLOOR_WOOD_KEY, '/assets/tiles/floor_wood_nano.png');

    // Wall tiles (nanobanana)
    this.load.image('tile-wall-plain', '/assets/tiles/wall_nano.png');
    this.load.image('tile-wall-window', '/assets/tiles/wall_window_nano.png');

    // Decorations (nanobanana)
    this.load.image('tile-desk', '/assets/tiles/desk.png');
    this.load.image('tile-laptop', '/assets/tiles/laptop_nano.png');
    this.load.image('tile-bookshelf-nano', '/assets/tiles/bookshelf_nano.png');
    this.load.image('tile-plant-nano', '/assets/tiles/plant_nano.png');
    this.load.image('tile-coffee-nano', '/assets/tiles/coffee_nano.png');

    // Character spritesheets: 7 cols x 3 rows, 16x32 per frame
    const charSprites = ['char_0', 'char_1', 'char_2', 'char_3'];
    for (const sprite of charSprites) {
      this.load.spritesheet(sprite, `/assets/characters/${sprite}.png`, {
        frameWidth: CHAR_W,
        frameHeight: CHAR_H,
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2c2c3a');

    this.setupAnimations();
    this.setupPathfinder();
    this.drawMap();
    this.createCharacter();
    this.createNPCs();
    this.createTargetHighlight();
    this.createHoverHighlight();
    this.setupInput();
    this.setupCamera();

    // UI Camera — separate camera that ignores zoom/scroll
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    uiCam.setScroll(0, 0);
    uiCam.setZoom(1);

    const backBtn = this.add
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

    const titleText = this.add.text(this.scale.width / 2, 16, 'VerbEngine — Iso Demo', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);

    const instrText = this.add.text(this.scale.width / 2, 44, 'Click to move | Scroll to zoom | WASD to pan | C to re-center', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);

    // Main camera ignores UI elements, UI camera only shows UI
    this.cameras.main.ignore([backBtn, titleText, instrText]);
    uiCam.ignore(this.children.list.filter(child => child !== backBtn && child !== titleText && child !== instrText));

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      titleText.setX(gameSize.width / 2);
      instrText.setX(gameSize.width / 2);
      uiCam.setSize(gameSize.width, gameSize.height);
    });
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

  /** Convert grid coords to world-space screen position (top point of diamond) */
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

    // Pass 1: Draw all floors first (lowest depth layer)
    for (let row = 0; row < MAP_ROWS; row++) {
      this.tileImages[row] = [];
      for (let col = 0; col < MAP_COLS; col++) {
        const cellType = MAP_DATA[row][col];
        const { x, y } = this.gridToScreen(col, row);
        const sx = Math.round(x);
        const sy = Math.round(y);

        if (cellType === 1 || cellType === 2) {
          // Wall tiles — draw floor underneath for seamless ground, then wall on top
          const floorImg = this.add.image(sx, sy, FLOOR_KEY);
          floorImg.setScale(NANO_SCALE);
          floorImg.setOrigin(0.5, 0);
          floorImg.setDepth(row + col);
          this.tileImages[row][col] = floorImg;

          const wallKey = 'tile-wall-plain';
          const wallImg = this.add.image(sx, sy + SCALED_TILE_H, wallKey);
          wallImg.setScale(NANO_SCALE);
          wallImg.setOrigin(0.5, 1.0);
          wallImg.setDepth(row + col + 0.3);
          this.decorationImages.push(wallImg);
        } else {
          // Floor tile (all walkable or decorated cells get floor)
          const floorImg = this.add.image(sx, sy, FLOOR_KEY);
          floorImg.setScale(NANO_SCALE);
          floorImg.setOrigin(0.5, 0);
          floorImg.setDepth(row + col);
          this.tileImages[row][col] = floorImg;
        }
      }
    }

    // Pass 2: Draw decorations on top of floors (back-to-front)
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const cellType = MAP_DATA[row][col];
        const decoKey = DECO_KEY[cellType];
        if (!decoKey) continue;

        const { x, y } = this.gridToScreen(col, row);
        const sx = Math.round(x);
        const sy = Math.round(y);

        const decoImg = this.add.image(sx, sy + SCALED_TILE_H / 2, decoKey);
        decoImg.setScale(NANO_SCALE);
        decoImg.setOrigin(0.5, 0.5);
        decoImg.setDepth(row + col + 0.5);
        this.decorationImages.push(decoImg);
      }
    }
  }

  // ── Character ─────────────────────────────────────────────────

  private createCharacter(): void {
    const { x, y } = this.gridToScreen(this.charGridX, this.charGridY);
    // Position character at diamond center (top point + half tile height)
    // Origin (0.5, 1.0) = bottom-center of sprite aligned to diamond center
    this.characterSprite = this.add.sprite(
      Math.round(x),
      Math.round(y + SCALED_TILE_H / 2),
      'char_0',
      0,
    );
    this.characterSprite.setScale(CHAR_SCALE);
    this.characterSprite.setOrigin(0.5, 1.0);
    this.updateCharacterDepth();
    this.characterSprite.play('char-idle-south');
  }

  private updateCharacterDepth(): void {
    this.characterSprite.setDepth(this.charGridY + this.charGridX + 0.8);
  }

  private positionCharacter(screenX: number, screenY: number): void {
    this.characterSprite.setPosition(Math.round(screenX), Math.round(screenY));
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

  // ── NPCs ──────────────────────────────────────────────────────

  private createNPCs(): void {
    for (const npc of NPCS) {
      // Create walk + idle animations for this NPC's sprite
      const dirs = ['south', 'north', 'east', 'west'];
      for (let d = 0; d < 4; d++) {
        const row = d === DIR_NORTH ? 1 : d >= DIR_EAST ? 2 : 0;
        const walkKey = `${npc.sprite}-walk-${dirs[d]}`;
        const idleKey = `${npc.sprite}-idle-${dirs[d]}`;
        if (!this.anims.exists(walkKey)) {
          this.anims.create({
            key: walkKey,
            frames: WALK_CYCLE.map(col => ({ key: npc.sprite, frame: row * SPRITE_COLS + col })),
            frameRate: Math.round(1000 / FRAME_DURATION_MS),
            repeat: -1,
          });
        }
        if (!this.anims.exists(idleKey)) {
          this.anims.create({
            key: idleKey,
            frames: [{ key: npc.sprite, frame: row * SPRITE_COLS + 0 }],
            frameRate: 1,
            repeat: 0,
          });
        }
      }

      const { x, y } = this.gridToScreen(npc.gridX, npc.gridY);
      const sprite = this.add.sprite(
        Math.round(x),
        Math.round(y + SCALED_TILE_H / 2),
        npc.sprite,
        0,
      );
      sprite.setScale(CHAR_SCALE);
      sprite.setOrigin(0.5, 1.0);
      sprite.setDepth(npc.gridY + npc.gridX + 0.8);
      sprite.setFlipX(npc.direction === DIR_WEST);
      sprite.play(`${npc.sprite}-idle-south`);

      // Make NPC clickable
      sprite.setInteractive({ useHandCursor: true });
      sprite.on('pointerdown', () => {
        this.showDialogue(npc.name, npc.dialogue);
      });

      // Name label
      const label = this.add.text(Math.round(x), Math.round(y + SCALED_TILE_H / 2 - CHAR_H * CHAR_SCALE - 5), npc.name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 1.0).setDepth(npc.gridY + npc.gridX + 0.9);

      const state: NpcState = {
        def: npc,
        sprite,
        label,
        currentX: npc.gridX,
        currentY: npc.gridY,
        homeX: npc.gridX,
        homeY: npc.gridY,
        isMoving: false,
      };
      this.npcStates.push(state);

      // Start wander loop
      this.scheduleWander(state);
    }
  }

  private scheduleWander(npc: NpcState): void {
    const delay = Phaser.Math.Between(WANDER_MIN_PAUSE, WANDER_MAX_PAUSE);
    this.time.delayedCall(delay, () => {
      if (npc.isMoving) {
        this.scheduleWander(npc);
        return;
      }
      this.wanderNpc(npc);
    });
  }

  private wanderNpc(npc: NpcState): void {
    // Pick a random walkable tile within WANDER_RADIUS of home
    const candidates: Array<{ x: number; y: number }> = [];
    for (let dy = -WANDER_RADIUS; dy <= WANDER_RADIUS; dy++) {
      for (let dx = -WANDER_RADIUS; dx <= WANDER_RADIUS; dx++) {
        const tx = npc.homeX + dx;
        const ty = npc.homeY + dy;
        if (tx < 0 || tx >= MAP_COLS || ty < 0 || ty >= MAP_ROWS) continue;
        if (tx === npc.currentX && ty === npc.currentY) continue;
        if (!WALKABLE_TILES.includes(MAP_DATA[ty][tx])) continue;
        candidates.push({ x: tx, y: ty });
      }
    }
    if (candidates.length === 0) {
      this.scheduleWander(npc);
      return;
    }

    const target = Phaser.Utils.Array.GetRandom(candidates);
    this.easystar.findPath(npc.currentX, npc.currentY, target.x, target.y, (path) => {
      if (!path || path.length < 2) {
        this.scheduleWander(npc);
        return;
      }
      this.moveNpcAlongPath(npc, path.slice(1));
    });
    this.easystar.calculate();
  }

  private moveNpcAlongPath(npc: NpcState, path: Array<{ x: number; y: number }>): void {
    if (path.length === 0) {
      npc.isMoving = false;
      const dirs = ['south', 'north', 'east', 'west'];
      const dir = this.getNpcDirection(npc);
      npc.sprite.play(`${npc.def.sprite}-idle-${dirs[dir]}`);
      this.scheduleWander(npc);
      return;
    }

    npc.isMoving = true;
    const next = path[0];
    const remaining = path.slice(1);

    const dx = next.x - npc.currentX;
    const dy = next.y - npc.currentY;

    // Set direction
    let dir = DIR_SOUTH;
    if (dx > 0 && dy > 0) dir = DIR_SOUTH;
    else if (dx < 0 && dy < 0) dir = DIR_NORTH;
    else if (dx > 0 && dy < 0) dir = DIR_EAST;
    else if (dx < 0 && dy > 0) dir = DIR_WEST;
    else if (dx > 0) dir = DIR_EAST;
    else if (dx < 0) dir = DIR_WEST;
    else if (dy > 0) dir = DIR_SOUTH;
    else if (dy < 0) dir = DIR_NORTH;

    npc.sprite.setFlipX(dir === DIR_WEST);
    const dirs = ['south', 'north', 'east', 'west'];
    const walkKey = `${npc.def.sprite}-walk-${dirs[dir]}`;
    if (npc.sprite.anims.currentAnim?.key !== walkKey) {
      npc.sprite.play(walkKey);
    }

    const from = this.gridToScreen(npc.currentX, npc.currentY);
    const to = this.gridToScreen(next.x, next.y);
    const charOffsetY = SCALED_TILE_H / 2;
    const stepDuration = (1 / NPC_MOVE_SPEED) * 1000;
    const tweenTarget = { x: from.x, y: from.y + charOffsetY };

    this.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y + charOffsetY,
      duration: stepDuration,
      ease: 'Linear',
      onUpdate: () => {
        npc.sprite.setPosition(Math.round(tweenTarget.x), Math.round(tweenTarget.y));
        npc.label.setPosition(Math.round(tweenTarget.x), Math.round(tweenTarget.y - CHAR_H * CHAR_SCALE - 5));
      },
      onComplete: () => {
        npc.currentX = next.x;
        npc.currentY = next.y;
        npc.sprite.setDepth(npc.currentY + npc.currentX + 0.8);
        npc.label.setDepth(npc.currentY + npc.currentX + 0.9);
        this.moveNpcAlongPath(npc, remaining);
      },
    });
  }

  private getNpcDirection(npc: NpcState): number {
    return npc.def.direction;
  }

  private showDialogue(name: string, text: string): void {
    // Remove previous dialogue
    if (this.dialogueBox) {
      this.dialogueBox.destroy();
    }

    const w = 400;
    const h = 80;
    const cx = this.scale.width / 2;
    const cy = this.scale.height - 60;

    const bg = this.add.rectangle(0, 0, w, h, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x3a3a5e)
      .setScrollFactor(0);

    const nameText = this.add.text(-w / 2 + 12, -h / 2 + 8, name, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f1c40f',
      fontStyle: 'bold',
    }).setScrollFactor(0);

    const dialogueText = this.add.text(-w / 2 + 12, -h / 2 + 28, text, {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e0e0e0',
      wordWrap: { width: w - 24 },
    }).setScrollFactor(0);

    this.dialogueBox = this.add.container(cx, cy, [bg, nameText, dialogueText])
      .setDepth(3000)
      .setScrollFactor(0);

    // Auto-dismiss after 4 seconds or on click
    const timer = this.time.delayedCall(4000, () => {
      this.dialogueBox?.destroy();
      this.dialogueBox = null;
    });

    bg.setInteractive();
    bg.on('pointerdown', () => {
      timer.destroy();
      this.dialogueBox?.destroy();
      this.dialogueBox = null;
    });
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

    // Zoom with scroll wheel / trackpad pinch (Ctrl+scroll or pinch)
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], deltaX: number, deltaY: number) => {
      const cam = this.cameras.main;
      // Pinch zoom (Ctrl+wheel) or regular scroll
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.002, 0.3, 3);
      cam.setZoom(newZoom);
    });

    // Pan with arrow keys or WASD
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const cam = this.cameras.main;
      const panSpeed = 10 / cam.zoom;
      if (event.key === 'ArrowLeft' || event.key === 'a') {
        cam.stopFollow();
        cam.scrollX -= panSpeed;
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        cam.stopFollow();
        cam.scrollX += panSpeed;
      } else if (event.key === 'ArrowUp' || event.key === 'w') {
        cam.stopFollow();
        cam.scrollY -= panSpeed;
      } else if (event.key === 'ArrowDown' || event.key === 's') {
        cam.stopFollow();
        cam.scrollY += panSpeed;
      } else if (event.key === 'c') {
        // Press C to re-center on character
        cam.startFollow(this.characterSprite, true, 0.1, 0.1);
      }
    });
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
    // gridToScreen returns top point of diamond; diamond spans from y to y + SCALED_TILE_H
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(x, y);                         // top
    graphics.lineTo(x + hw, y + SCALED_TILE_H / 2); // right
    graphics.lineTo(x, y + SCALED_TILE_H);          // bottom
    graphics.lineTo(x - hw, y + SCALED_TILE_H / 2); // left
    graphics.closePath();
    graphics.fillPath();
  }

  private drawHoverHighlight(col: number, row: number): void {
    this.hoverHighlight.clear();
    const { x, y } = this.gridToScreen(col, row);
    const hw = SCALED_TILE_W / 2;
    // gridToScreen returns top point of diamond
    this.hoverHighlight.lineStyle(2, HOVER_COLOR, 0.8);
    this.hoverHighlight.beginPath();
    this.hoverHighlight.moveTo(x, y);
    this.hoverHighlight.lineTo(x + hw, y + SCALED_TILE_H / 2);
    this.hoverHighlight.lineTo(x, y + SCALED_TILE_H);
    this.hoverHighlight.lineTo(x - hw, y + SCALED_TILE_H / 2);
    this.hoverHighlight.closePath();
    this.hoverHighlight.strokePath();

    this.hoverHighlight.fillStyle(HOVER_COLOR, 0.15);
    this.hoverHighlight.beginPath();
    this.hoverHighlight.moveTo(x, y);
    this.hoverHighlight.lineTo(x + hw, y + SCALED_TILE_H / 2);
    this.hoverHighlight.lineTo(x, y + SCALED_TILE_H);
    this.hoverHighlight.lineTo(x - hw, y + SCALED_TILE_H / 2);
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
    // Character stands at diamond center (top point + half tile height)
    const charOffsetY = SCALED_TILE_H / 2;

    // Duration from MOVE_SPEED (tiles/second)
    const stepDuration = (1 / MOVE_SPEED) * 1000;
    const tweenTarget = { x: from.x, y: from.y + charOffsetY };

    this.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y + charOffsetY,
      duration: stepDuration,
      ease: 'Linear',
      onUpdate: () => {
        this.positionCharacter(tweenTarget.x, tweenTarget.y);
      },
      onComplete: () => {
        this.charGridX = next.x;
        this.charGridY = next.y;
        const pos = this.gridToScreen(this.charGridX, this.charGridY);
        this.positionCharacter(pos.x, pos.y + charOffsetY);
        this.updateCharacterDepth();
        this.moveAlongPath(remaining);
      },
    });
  }
}
