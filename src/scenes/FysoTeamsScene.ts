import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { cartToIso, isoToCart } from './iso-math';
import { BubbleText } from '../engine/BubbleText';
import type { AgentDef, AgentStatus, FysoGameOptions } from '../types/fyso-teams';

// ── Constants ─────────────────────────────────────────────────────

/** Base tile diamond dimensions (2:1 ratio) */
const BASE_TILE_WIDTH = 32;
const BASE_TILE_HEIGHT = 16;

/** Default zoom level */
const DEFAULT_ZOOM = 2;

/** Character frame size in the spritesheet */
const CHAR_W = 16;
const CHAR_H = 32;

/** Movement speed in tiles/second */
const MOVE_SPEED = 2.5;

/** Animation frame duration in ms */
const FRAME_DURATION_MS = 150;

/** Spritesheet layout: 7 cols x 3 rows, each frame 16x32 */
const SPRITE_COLS = 7;
const WALK_CYCLE = [0, 1, 2, 1];

/** Direction indices */
const DIR_SOUTH = 0;
const DIR_NORTH = 1;
const DIR_EAST = 2;
const DIR_WEST = 3;

/** Walkable tile types */
const WALKABLE_TILES = [0, 4];

/** Status badge colors per status */
const STATUS_COLORS: Record<AgentStatus, number> = {
  idle: 0x888888,
  working: 0x4caf50,
  talking: 0x2196f3,
  walking: 0xff9800,
  done: 0x8bc34a,
  error: 0xf44336,
};

/** Badge radius in pixels (pre-zoom) */
const BADGE_RADIUS = 4;

/** Convert a hue angle (0-360) to a Phaser tint (0xRRGGBB) via HSL→RGB at S=0.5, L=0.75 */
function hueToTint(hue: number): number {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.45;
  const l = 0.78;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const ri = Math.round((r + m) * 255);
  const gi = Math.round((g + m) * 255);
  const bi = Math.round((b + m) * 255);
  return (ri << 16) | (gi << 8) | bi;
}

/** Depth layers */
const BADGE_DEPTH_OFFSET = 1.0;
const LABEL_DEPTH_OFFSET = 0.9;
const SPRITE_DEPTH_OFFSET = 0.8;

/**
 * Default 25x25 office map.
 * 0=floor, 1=wall-plain, 2=wall-window, 3=desk, 4=chair, 5=bookshelf, 6=plant, 7=coffee
 */
const DEFAULT_MAP_DATA: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,3,0,0,3,0,0,0,2,0,0,0,0,0,1,0,0,5,5,5,0,0,1],
  [1,0,0,4,0,0,4,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,5,5,5,0,0,1],
  [1,0,0,3,0,0,3,0,0,0,1,0,0,0,0,0,2,0,0,0,0,0,0,0,1],
  [1,0,0,4,0,0,4,0,0,0,2,0,0,0,0,0,0,0,0,5,5,5,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,4,0,0,0,1],
  [1,1,1,1,1,0,0,1,1,1,1,0,0,0,0,0,1,1,1,0,0,1,1,1,1],
  [1,0,6,0,0,0,0,0,0,0,7,0,0,0,0,0,6,0,0,0,0,0,6,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,0,1,1,1,1,1,1,1,0,0,1,1,1,1,1,0,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,6,6,0,0,0,0,0,0,1,0,0,3,0,0,3,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,6,6,0,0,2,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,6,0,0,0,0,6,0,0,1,0,0,3,0,0,3,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,4,0,0,4,0,0,0,0,0,0,0,1],
  [1,0,0,0,6,6,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,6,6,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];


// ── Agent state ───────────────────────────────────────────────────

interface AgentState {
  def: AgentDef;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Graphics;
  status: AgentStatus;
  currentX: number;
  currentY: number;
  isMoving: boolean;
  activeTween?: Phaser.Tweens.Tween;
}

// ── Scene ─────────────────────────────────────────────────────────

export class FysoTeamsScene extends Phaser.Scene {
  private mapData: number[][] = DEFAULT_MAP_DATA;
  private mapRows = 0;
  private mapCols = 0;
  private zoom = DEFAULT_ZOOM;
  private basePath = '';

  private tileWidth = 0;
  private tileHeight = 0;
  private nanoScale = 0;
  private charScale = 0;

  private easystar!: EasyStar.js;
  private bubble!: BubbleText;
  private agents: Map<string, AgentState> = new Map();

  constructor() {
    super({ key: 'FysoTeamsScene' });
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  init(data: FysoGameOptions): void {
    this.mapData = data.mapData ?? DEFAULT_MAP_DATA;
    this.mapRows = this.mapData.length;
    this.mapCols = this.mapData[0]?.length ?? 0;
    this.zoom = data.zoom ?? DEFAULT_ZOOM;
    this.basePath = data.basePath ?? '';

    this.tileWidth = BASE_TILE_WIDTH * this.zoom;
    this.tileHeight = BASE_TILE_HEIGHT * this.zoom;
    this.nanoScale = this.tileWidth / 711;
    this.charScale = this.zoom;
  }

  preload(): void {
    const base = this.basePath;
    this.load.image('fyso-floor', `${base}/assets/tiles/floor_carpet.png`);
    this.load.image('fyso-floor-wood', `${base}/assets/tiles/floor_wood_nano.png`);
    this.load.image('fyso-wall-plain', `${base}/assets/tiles/wall_nano.png`);
    this.load.image('fyso-wall-window', `${base}/assets/tiles/wall_window_nano.png`);
    this.load.image('fyso-desk', `${base}/assets/tiles/desk.png`);
    this.load.image('fyso-bookshelf', `${base}/assets/tiles/bookshelf_nano.png`);
    this.load.image('fyso-plant', `${base}/assets/tiles/plant_nano.png`);
    this.load.image('fyso-coffee', `${base}/assets/tiles/coffee_nano.png`);

    const charSprites = ['char_0', 'char_1', 'char_2', 'char_3'];
    for (const key of charSprites) {
      this.load.spritesheet(key, `${base}/assets/characters/${key}.png`, {
        frameWidth: CHAR_W,
        frameHeight: CHAR_H,
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#2c2c3a');

    this.bubble = new BubbleText(this);

    this.setupPathfinder();
    this.drawMap();
    this.setupCamera();
    this.setupInput();
  }

  update(): void {
    this.easystar.calculate();
  }

  // ── Public API (called by FysoSceneBridge) ────────────────────

  spawnAgent(def: AgentDef): void {
    if (this.agents.has(def.id)) {
      throw new Error(`Agent '${def.id}' is already spawned.`);
    }

    const status: AgentStatus = def.status ?? 'idle';

    this.setupAgentAnimations(def.sprite);

    const { x, y } = this.gridToScreen(def.gridX, def.gridY);
    const sx = Math.round(x);
    const sy = Math.round(y + this.tileHeight / 2);

    const sprite = this.add.sprite(sx, sy, def.sprite, 0);
    sprite.setScale(this.charScale);
    sprite.setOrigin(0.5, 1.0);
    sprite.setDepth(def.gridY + def.gridX + SPRITE_DEPTH_OFFSET);
    sprite.play(`${def.sprite}-idle-south`);

    // Apply hue shift as a color tint
    if (def.hueShift && def.hueShift !== 0) {
      sprite.setTint(hueToTint(def.hueShift));
    }

    const labelY = sy - CHAR_H * this.charScale - 5;
    const label = this.add
      .text(sx, labelY, def.name, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1.0)
      .setDepth(def.gridY + def.gridX + LABEL_DEPTH_OFFSET);

    const badge = this.add.graphics();
    badge.setDepth(def.gridY + def.gridX + BADGE_DEPTH_OFFSET);
    this.drawBadge(badge, sx, labelY - 10, status);

    const state: AgentState = {
      def: { ...def },
      sprite,
      label,
      badge,
      status,
      currentX: def.gridX,
      currentY: def.gridY,
      isMoving: false,
    };

    this.agents.set(def.id, state);
  }

  removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    agent.activeTween?.stop();
    agent.sprite.destroy();
    agent.label.destroy();
    agent.badge.destroy();
    this.agents.delete(id);
  }

  moveAgent(id: string, targetX: number, targetY: number): void {
    const agent = this.agents.get(id);
    if (!agent || agent.isMoving) return;

    this.setAgentStatus(id, 'walking');

    this.easystar.findPath(
      agent.currentX,
      agent.currentY,
      targetX,
      targetY,
      (path) => {
        if (!path || path.length < 2) {
          this.setAgentStatus(id, 'idle');
          return;
        }
        this.moveAgentAlongPath(agent, path.slice(1));
      },
    );
  }

  setAgentStatus(id: string, status: AgentStatus): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    agent.status = status;
    const { x, y } = agent.sprite;
    const labelY = y - CHAR_H * this.charScale - 5;
    this.drawBadge(agent.badge, x, labelY - 10, status);
  }

  showAgentMessage(id: string, text: string, duration?: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    const previousStatus = agent.status;
    const { x, y } = agent.sprite;
    const bubbleY = y - CHAR_H * this.charScale - 20;
    const ms = duration ?? 3000;

    this.bubble.showNamedBubble(x, bubbleY, agent.def.name, text, ms);
    this.setAgentStatus(id, 'talking');

    this.time.delayedCall(ms, () => {
      if (this.agents.has(id) && agent.status === 'talking') {
        this.setAgentStatus(id, previousStatus);
      }
    });
  }

  focusAgent(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    this.cameras.main.startFollow(agent.sprite, true, 0.1, 0.1);
  }

  enableInput(): void {
    this.input.enabled = true;
    if (this.input.keyboard) this.input.keyboard.enabled = true;
  }

  disableInput(): void {
    this.input.enabled = false;
    if (this.input.keyboard) this.input.keyboard.enabled = false;
  }

  // ── Animations ────────────────────────────────────────────────

  private setupAgentAnimations(spriteKey: string): void {
    this.createCharacterAnimations(spriteKey);
  }

  private createCharacterAnimations(spriteKey: string): void {
    const dirs = [
      { name: 'south', row: 0 },
      { name: 'north', row: 1 },
      { name: 'east', row: 2 },
      { name: 'west', row: 2 },
    ];

    for (const { name, row } of dirs) {
      const walkKey = `${spriteKey}-walk-${name}`;
      const idleKey = `${spriteKey}-idle-${name}`;

      if (!this.anims.exists(walkKey)) {
        this.anims.create({
          key: walkKey,
          frames: WALK_CYCLE.map((col) => ({
            key: spriteKey,
            frame: row * SPRITE_COLS + col,
          })),
          frameRate: Math.round(1000 / FRAME_DURATION_MS),
          repeat: -1,
        });
      }

      if (!this.anims.exists(idleKey)) {
        this.anims.create({
          key: idleKey,
          frames: [{ key: spriteKey, frame: row * SPRITE_COLS + 0 }],
          frameRate: 1,
          repeat: 0,
        });
      }
    }
  }

  // ── Pathfinder ────────────────────────────────────────────────

  private setupPathfinder(): void {
    this.easystar = new EasyStar.js();
    this.easystar.setGrid(this.mapData);
    this.easystar.setAcceptableTiles(WALKABLE_TILES);
    this.easystar.enableDiagonals();
    this.easystar.enableCornerCutting();
  }

  // ── Coordinate helpers ────────────────────────────────────────

  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    return cartToIso(gx, gy, this.tileWidth, this.tileHeight);
  }

  private screenToGrid(sx: number, sy: number): { col: number; row: number } | null {
    const worldPoint = this.cameras.main.getWorldPoint(sx, sy);
    const cart = isoToCart(worldPoint.x, worldPoint.y, this.tileWidth, this.tileHeight);
    const col = Math.floor(cart.x);
    const row = Math.floor(cart.y);

    if (col < 0 || col >= this.mapCols || row < 0 || row >= this.mapRows) {
      return null;
    }
    return { col, row };
  }

  // ── Map rendering ─────────────────────────────────────────────

  private drawMap(): void {
    const decoTextureMap: Record<number, string> = {
      3: 'fyso-desk',
      5: 'fyso-bookshelf',
      6: 'fyso-plant',
      7: 'fyso-coffee',
    };

    // Pass 1: floors and walls
    for (let row = 0; row < this.mapRows; row++) {
      for (let col = 0; col < this.mapCols; col++) {
        const cellType = this.mapData[row][col];
        const { x, y } = this.gridToScreen(col, row);
        const sx = Math.round(x);
        const sy = Math.round(y);
        const depth = row + col;

        if (cellType === 1 || cellType === 2) {
          const floorImg = this.add.image(sx, sy, 'fyso-floor');
          floorImg.setScale(this.nanoScale);
          floorImg.setOrigin(0.5, 0);
          floorImg.setDepth(depth);

          const wallKey = cellType === 2 ? 'fyso-wall-window' : 'fyso-wall-plain';
          const wallImg = this.add.image(sx, sy + this.tileHeight, wallKey);
          wallImg.setScale(this.nanoScale);
          wallImg.setOrigin(0.5, 1.0);
          wallImg.setDepth(depth + 0.3);
        } else {
          const floorImg = this.add.image(sx, sy, 'fyso-floor');
          floorImg.setScale(this.nanoScale);
          floorImg.setOrigin(0.5, 0);
          floorImg.setDepth(depth);
        }
      }
    }

    // Pass 2: decorations
    for (let row = 0; row < this.mapRows; row++) {
      for (let col = 0; col < this.mapCols; col++) {
        const cellType = this.mapData[row][col];
        const decoKey = decoTextureMap[cellType];
        if (!decoKey) continue;

        const { x, y } = this.gridToScreen(col, row);
        const decoImg = this.add.image(
          Math.round(x),
          Math.round(y + this.tileHeight / 2),
          decoKey,
        );
        decoImg.setScale(this.nanoScale);
        decoImg.setOrigin(0.5, 0.5);
        decoImg.setDepth(row + col + 0.5);
      }
    }
  }

  // ── Badge ─────────────────────────────────────────────────────

  private drawBadge(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    status: AgentStatus,
  ): void {
    graphics.clear();
    const color = STATUS_COLORS[status];
    graphics.fillStyle(color, 1);
    graphics.fillCircle(x, y, BADGE_RADIUS * this.charScale);
  }

  // ── Camera ────────────────────────────────────────────────────

  private setupCamera(): void {
    const topLeft = this.gridToScreen(0, 0);
    const topRight = this.gridToScreen(this.mapCols, 0);
    const bottomLeft = this.gridToScreen(0, this.mapRows);
    const bottomRight = this.gridToScreen(this.mapCols, this.mapRows);

    const minX = Math.min(topLeft.x, bottomLeft.x) - this.tileWidth;
    const maxX = Math.max(topRight.x, bottomRight.x) + this.tileWidth;
    const minY = Math.min(topLeft.y, topRight.y) - this.tileHeight * 2;
    const maxY = Math.max(bottomLeft.y, bottomRight.y) + this.tileHeight * 2;

    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(0, 0);

    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: unknown[],
      _deltaX: number,
      deltaY: number,
    ) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.002, 0.3, 3);
      cam.setZoom(newZoom);
    });
  }

  // ── Input ─────────────────────────────────────────────────────

  private setupInput(): void {
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
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // Drag-to-pan
      if (pointer.isDown && pointer.buttons === 2) {
        const cam = this.cameras.main;
        cam.stopFollow();
        cam.scrollX -= pointer.velocity.x / cam.zoom;
        cam.scrollY -= pointer.velocity.y / cam.zoom;
      }
    });
  }

  // ── Agent movement ────────────────────────────────────────────

  private moveAgentAlongPath(
    agent: AgentState,
    path: Array<{ x: number; y: number }>,
  ): void {
    if (path.length === 0) {
      agent.isMoving = false;
      const spriteKey = agent.def.sprite;
      agent.sprite.play(`${spriteKey}-idle-south`);
      const prevStatus = agent.status === 'walking' ? 'idle' : agent.status;
      this.setAgentStatus(agent.def.id, prevStatus);
      return;
    }

    agent.isMoving = true;
    const next = path[0];
    const remaining = path.slice(1);

    const dx = next.x - agent.currentX;
    const dy = next.y - agent.currentY;
    const dir = this.getDirectionFromDelta(dx, dy);
    const dirNames = ['south', 'north', 'east', 'west'];
    const spriteKey = agent.def.sprite;

    agent.sprite.setFlipX(dir === DIR_WEST);
    const walkKey = `${spriteKey}-walk-${dirNames[dir]}`;
    if (agent.sprite.anims.currentAnim?.key !== walkKey) {
      agent.sprite.play(walkKey);
    }

    const from = this.gridToScreen(agent.currentX, agent.currentY);
    const to = this.gridToScreen(next.x, next.y);
    const charOffsetY = this.tileHeight / 2;
    const stepDuration = (1 / MOVE_SPEED) * 1000;
    const tweenTarget = { x: from.x, y: from.y + charOffsetY };

    agent.activeTween = this.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y + charOffsetY,
      duration: stepDuration,
      ease: 'Linear',
      onUpdate: () => {
        agent.sprite.setPosition(Math.round(tweenTarget.x), Math.round(tweenTarget.y));
        const labelY = Math.round(tweenTarget.y - CHAR_H * this.charScale - 5);
        agent.label.setPosition(Math.round(tweenTarget.x), labelY);
        this.drawBadge(agent.badge, Math.round(tweenTarget.x), labelY - 10, agent.status);
      },
      onComplete: () => {
        agent.currentX = next.x;
        agent.currentY = next.y;
        const newDepth = agent.currentY + agent.currentX;
        agent.sprite.setDepth(newDepth + SPRITE_DEPTH_OFFSET);
        agent.label.setDepth(newDepth + LABEL_DEPTH_OFFSET);
        agent.badge.setDepth(newDepth + BADGE_DEPTH_OFFSET);
        this.moveAgentAlongPath(agent, remaining);
      },
    });
  }

  private getDirectionFromDelta(dx: number, dy: number): number {
    if (dx > 0 && dy > 0) return DIR_SOUTH;
    if (dx < 0 && dy < 0) return DIR_NORTH;
    if (dx > 0 && dy < 0) return DIR_EAST;
    if (dx < 0 && dy > 0) return DIR_WEST;
    if (dx > 0) return DIR_EAST;
    if (dx < 0) return DIR_WEST;
    if (dy > 0) return DIR_SOUTH;
    return DIR_NORTH;
  }
}
