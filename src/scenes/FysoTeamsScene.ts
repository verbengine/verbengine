import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { cartToIso, isoToCart } from './iso-math';
import { BubbleText } from '../engine/BubbleText';
import type { AgentDef, AgentStatus, FysoGameOptions, PodRect } from '../types/fyso-teams';

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

/** Spritesheet layout: 7 cols x 3 rows, each frame 16x32
 *  Columns: walk_0 | walk_1 | walk_2 | type_0 | type_1 | read_0 | read_1
 */
const SPRITE_COLS = 7;
const WALK_CYCLE = [0, 1, 2, 1];
/** Sit animation uses the 'type' frames (cols 3-4) on the south-facing row. */
const SIT_FRAMES = [3, 4];
/** Pixel offset applied to sitting character sprites so they rest on the chair. */
const SIT_Y_OFFSET = 6;

/** Direction indices */
const DIR_SOUTH = 0;
const DIR_NORTH = 1;
const DIR_EAST = 2;
const DIR_WEST = 3;

/** Walkable tile types — floor and chair. Desks (3) block pathfinding. */
const WALKABLE_TILES = [0, 4];
/** Minimum pod dimensions (tiles). Required to fit desk + chair. */
const MIN_POD_DIM = 2;

/** Status badge colors per status */
const STATUS_COLORS: Record<AgentStatus, number> = {
  idle: 0x888888,
  wander: 0x9c27b0,
  working: 0x4caf50,
  talking: 0x2196f3,
  walking: 0xff9800,
  done: 0x8bc34a,
  error: 0xf44336,
};

/**
 * Statuses that represent a persistent *behavior* (vs. transient animation
 * states like `walking` and `talking`). When movement or talking finishes,
 * the agent returns to its behavior status.
 */
const BEHAVIOR_STATUSES: ReadonlySet<AgentStatus> = new Set([
  'idle',
  'wander',
  'working',
  'done',
  'error',
]);

/** Badge radius in pixels (pre-zoom) */
const BADGE_RADIUS = 4;

/** Wander behavior: min pause between wander ticks (ms). */
const WANDER_MIN_PAUSE_MS = 2000;
/** Wander behavior: max pause between wander ticks (ms). */
const WANDER_MAX_PAUSE_MS = 6000;
/** Wander behavior: attempts to find a walkable target before giving up on a tick. */
const WANDER_PICK_ATTEMPTS = 10;

/** Normalize a hue angle to [0, 360). */
function normalizeHue(hue: number): number {
  return ((hue % 360) + 360) % 360;
}

/** Return true if two axis-aligned pod rectangles overlap. */
function podsOverlap(a: PodRect, b: PodRect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
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
  /**
   * Persistent behavior status to return to after transient states
   * (walking/talking) end. Mirrors `status` when `status` is itself a
   * behavior status.
   */
  baseStatus: AgentStatus;
  currentX: number;
  currentY: number;
  isMoving: boolean;
  /** Whether the agent sprite is currently in the seated (typing) pose. */
  isSeated: boolean;
  pod: PodRect;
  /** Tile where the agent's desk is rendered (non-walkable). */
  deskTile: { x: number; y: number };
  /** Tile where the agent sits when working (walkable). */
  chairTile: { x: number; y: number };
  /** Desk sprite rendered above the pod. Destroyed on removeAgent. */
  deskImage: Phaser.GameObjects.Image;
  /** Chair sprite rendered under the agent. Destroyed on removeAgent. */
  chairImage: Phaser.GameObjects.Image;
  /** Laptop sprite — only present while status is 'working'. */
  laptopImage?: Phaser.GameObjects.Image;
  activeTween?: Phaser.Tweens.Tween;
  wanderEvent?: Phaser.Time.TimerEvent;
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
    // Deep clone so per-pod desk placement doesn't mutate the consumer's map.
    const source = data.mapData ?? DEFAULT_MAP_DATA;
    this.mapData = source.map((row) => row.slice());
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
    this.load.image('fyso-chair', `${base}/assets/tiles/chair.png`);
    this.load.image('fyso-laptop', `${base}/assets/tiles/laptop_nano.png`);
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

    this.validatePod(def.id, def.pod);

    // Place desk + chair in the pod. Desk goes at the center-top so the
    // chair (immediately south of it) leaves the rest of the pod free for
    // wandering.
    const deskX = def.pod.x + Math.floor(def.pod.w / 2);
    const deskY = def.pod.y;
    const chairX = deskX;
    const chairY = deskY + 1;

    if (chairY >= def.pod.y + def.pod.h) {
      throw new Error(
        `Agent '${def.id}' pod is too short to place a chair below the desk.`,
      );
    }

    // Block the desk tile for pathfinding. The chair stays walkable.
    this.mapData[deskY][deskX] = 3;
    this.easystar.setGrid(this.mapData);

    const deskScreen = this.gridToScreen(deskX, deskY);
    const deskImage = this.add.image(
      Math.round(deskScreen.x),
      Math.round(deskScreen.y + this.tileHeight / 2),
      'fyso-desk',
    );
    deskImage.setScale(this.nanoScale);
    deskImage.setOrigin(0.5, 0.5);
    deskImage.setDepth(deskY + deskX + 0.5);

    const chairScreen = this.gridToScreen(chairX, chairY);
    const chairImage = this.add.image(
      Math.round(chairScreen.x),
      Math.round(chairScreen.y + this.tileHeight / 2),
      'fyso-chair',
    );
    chairImage.setScale(this.nanoScale);
    chairImage.setOrigin(0.5, 0.5);
    // Chair sits behind the agent but in front of the floor.
    chairImage.setDepth(chairY + chairX + 0.4);

    const status: AgentStatus = def.status ?? 'idle';

    const effectiveSprite = this.getHueShiftedSpriteKey(def.sprite, def.hueShift ?? 0);
    this.setupAgentAnimations(effectiveSprite);

    // Spawn at the chair tile.
    const { x, y } = this.gridToScreen(chairX, chairY);
    const sx = Math.round(x);
    const sy = Math.round(y + this.tileHeight / 2);

    const sprite = this.add.sprite(sx, sy, effectiveSprite, 0);
    sprite.setScale(this.charScale);
    sprite.setOrigin(0.5, 1.0);
    sprite.setDepth(chairY + chairX + SPRITE_DEPTH_OFFSET);
    sprite.play(`${effectiveSprite}-idle-south`);

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
      .setDepth(chairY + chairX + LABEL_DEPTH_OFFSET);

    const badge = this.add.graphics();
    badge.setDepth(chairY + chairX + BADGE_DEPTH_OFFSET);
    this.drawBadge(badge, sx, labelY - 10, status);

    const baseStatus: AgentStatus = BEHAVIOR_STATUSES.has(status) ? status : 'idle';

    const state: AgentState = {
      def: { ...def, sprite: effectiveSprite },
      sprite,
      label,
      badge,
      status,
      baseStatus,
      currentX: chairX,
      currentY: chairY,
      isMoving: false,
      isSeated: false,
      pod: def.pod,
      deskTile: { x: deskX, y: deskY },
      chairTile: { x: chairX, y: chairY },
      deskImage,
      chairImage,
    };

    this.agents.set(def.id, state);

    if (baseStatus === 'working') {
      this.enterWorkingState(state);
    } else if (baseStatus === 'wander') {
      this.scheduleWanderTick(state);
    }
  }

  // ── Pod validation ────────────────────────────────────────────

  /**
   * Validate a pod before spawning: dimensions, map bounds, walkability, and
   * non-overlap with other agents' pods. Throws with a descriptive message on
   * failure so library consumers get a clear error.
   */
  private validatePod(agentId: string, pod: PodRect): void {
    if (pod.w < MIN_POD_DIM || pod.h < MIN_POD_DIM) {
      throw new Error(
        `Agent '${agentId}' pod must be at least ${MIN_POD_DIM}x${MIN_POD_DIM} tiles (got ${pod.w}x${pod.h}).`,
      );
    }
    if (
      pod.x < 0 ||
      pod.y < 0 ||
      pod.x + pod.w > this.mapCols ||
      pod.y + pod.h > this.mapRows
    ) {
      throw new Error(
        `Agent '${agentId}' pod (${pod.x},${pod.y} ${pod.w}x${pod.h}) is outside the map bounds (${this.mapCols}x${this.mapRows}).`,
      );
    }

    for (let y = pod.y; y < pod.y + pod.h; y++) {
      for (let x = pod.x; x < pod.x + pod.w; x++) {
        if (!WALKABLE_TILES.includes(this.mapData[y][x])) {
          throw new Error(
            `Agent '${agentId}' pod cell (${x},${y}) is not walkable (tile=${this.mapData[y][x]}).`,
          );
        }
      }
    }

    for (const [otherId, other] of this.agents) {
      if (podsOverlap(pod, other.pod)) {
        throw new Error(
          `Agent '${agentId}' pod overlaps with agent '${otherId}'.`,
        );
      }
    }
  }

  removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    agent.activeTween?.stop();
    agent.wanderEvent?.remove();
    agent.sprite.destroy();
    agent.label.destroy();
    agent.badge.destroy();
    agent.deskImage.destroy();
    agent.chairImage.destroy();
    agent.laptopImage?.destroy();

    // Free the desk tile so the pod area becomes walkable again.
    this.mapData[agent.deskTile.y][agent.deskTile.x] = 0;
    this.easystar.setGrid(this.mapData);

    this.agents.delete(id);
  }

  moveAgent(id: string, targetX: number, targetY: number): void {
    const agent = this.agents.get(id);
    if (!agent || agent.isMoving) return;

    // Can't walk while seated — stand up first. The laptop stays visible
    // only while baseStatus is 'working'; standUp is idempotent.
    if (agent.isSeated) {
      this.standUp(agent);
    }

    this.setAgentStatus(id, 'walking');

    this.easystar.findPath(
      agent.currentX,
      agent.currentY,
      targetX,
      targetY,
      (path) => {
        // Guard against the agent being removed while easystar was
        // resolving the path asynchronously — its sprite/label/badge
        // would already be destroyed.
        if (!this.agents.has(id)) return;
        if (!path || path.length < 2) {
          this.setAgentStatus(id, agent.baseStatus);
          return;
        }
        this.moveAgentAlongPath(agent, path.slice(1));
      },
    );
  }

  setAgentStatus(id: string, status: AgentStatus): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    // Update baseStatus only when transitioning to a persistent behavior.
    // Transient states (walking/talking) leave baseStatus untouched so the
    // agent can return to its behavior after movement or dialogue ends.
    if (BEHAVIOR_STATUSES.has(status)) {
      const prevBase = agent.baseStatus;
      agent.baseStatus = status;

      // Wander lifecycle.
      if (status === 'wander' && prevBase !== 'wander') {
        this.scheduleWanderTick(agent);
      } else if (status !== 'wander' && prevBase === 'wander') {
        agent.wanderEvent?.remove();
        agent.wanderEvent = undefined;
      }

      // Working lifecycle — walk to the chair and sit with a laptop.
      if (status === 'working' && prevBase !== 'working') {
        this.enterWorkingState(agent);
      } else if (status !== 'working' && prevBase === 'working') {
        this.exitWorkingState(agent);
      }
    }

    agent.status = status;
    const { x, y } = agent.sprite;
    const labelY = y - CHAR_H * this.charScale - 5;
    this.drawBadge(agent.badge, x, labelY - 10, status);
  }

  showAgentMessage(id: string, text: string, duration?: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;

    const { x, y } = agent.sprite;
    const bubbleY = y - CHAR_H * this.charScale - 20;
    const ms = duration ?? 3000;

    this.bubble.showNamedBubble(x, bubbleY, agent.def.name, text, ms);
    this.setAgentStatus(id, 'talking');

    this.time.delayedCall(ms, () => {
      // Restore the persistent behavior status rather than whatever
      // transient status the agent had before talking — capturing
      // `agent.status` directly would re-enter a stale 'walking' state.
      if (this.agents.has(id) && agent.status === 'talking') {
        this.setAgentStatus(id, agent.baseStatus);
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

  // ── Wander behavior ───────────────────────────────────────────

  /**
   * Schedule the next wander tick for an agent. Uses a random delay between
   * WANDER_MIN_PAUSE_MS and WANDER_MAX_PAUSE_MS. Each tick re-arms itself, so
   * the behavior runs indefinitely until the agent is removed or its `wander`
   * flag is cleared.
   */
  private scheduleWanderTick(agent: AgentState, delayMs?: number): void {
    const delay =
      delayMs ?? Phaser.Math.Between(WANDER_MIN_PAUSE_MS, WANDER_MAX_PAUSE_MS);
    agent.wanderEvent = this.time.delayedCall(delay, () => this.tickWander(agent));
  }

  /**
   * Wander tick: if the agent is idle and wander is still enabled, pick a
   * random walkable tile inside the agent's pod and move there. Always
   * reschedules itself.
   */
  private tickWander(agent: AgentState): void {
    if (!this.agents.has(agent.def.id)) return;
    if (agent.baseStatus !== 'wander') return;

    if (!agent.isMoving && agent.status !== 'talking') {
      const target = this.pickRandomPodTile(agent);
      if (target) {
        this.moveAgent(agent.def.id, target.x, target.y);
      }
    }

    this.scheduleWanderTick(agent);
  }

  /**
   * Pick a random walkable tile inside the agent's pod (excluding the current
   * position and the desk). Returns null if no walkable tile can be found.
   */
  private pickRandomPodTile(agent: AgentState): { x: number; y: number } | null {
    const { pod, currentX, currentY } = agent;
    for (let i = 0; i < WANDER_PICK_ATTEMPTS; i++) {
      const x = Phaser.Math.Between(pod.x, pod.x + pod.w - 1);
      const y = Phaser.Math.Between(pod.y, pod.y + pod.h - 1);
      if (x === currentX && y === currentY) continue;
      const tile = this.mapData[y][x];
      if (!WALKABLE_TILES.includes(tile)) continue;
      return { x, y };
    }
    return null;
  }

  // ── Working behavior (sit + laptop) ───────────────────────────

  /**
   * Transition an agent into the working state. Walks to the chair (if not
   * already there) and sits down with a laptop. If already on the chair, sits
   * immediately.
   */
  private enterWorkingState(agent: AgentState): void {
    const { chairTile } = agent;
    if (agent.currentX === chairTile.x && agent.currentY === chairTile.y) {
      this.sitDown(agent);
    } else if (!agent.isMoving) {
      // Walk to the chair. moveAgentAlongPath's end-of-path handler detects
      // baseStatus === 'working' and sits the agent down on arrival.
      this.moveAgent(agent.def.id, chairTile.x, chairTile.y);
    }
    // If isMoving is true, the in-progress move will finish and
    // moveAgentAlongPath will detect baseStatus === 'working' and handle
    // the sit (or walk-to-chair) automatically.
  }

  /** Transition an agent out of the working state: stand up and hide laptop. */
  private exitWorkingState(agent: AgentState): void {
    this.standUp(agent);
  }

  /**
   * Snap the agent sprite into the seated pose, draw the laptop sprite on the
   * desk, and lock the character's south-facing typing animation.
   */
  private sitDown(agent: AgentState): void {
    if (agent.isSeated) return;
    agent.isSeated = true;

    const spriteKey = agent.def.sprite;
    agent.sprite.play(`${spriteKey}-sit-south`);
    agent.sprite.setFlipX(false);
    // Nudge sprite downward so the character visually rests on the chair.
    agent.sprite.y += SIT_Y_OFFSET * this.charScale;

    // Draw the laptop on top of the desk.
    const deskScreen = this.gridToScreen(agent.deskTile.x, agent.deskTile.y);
    const laptop = this.add.image(
      Math.round(deskScreen.x),
      Math.round(deskScreen.y + this.tileHeight / 2 - 2),
      'fyso-laptop',
    );
    laptop.setScale(this.nanoScale);
    laptop.setOrigin(0.5, 0.5);
    laptop.setDepth(agent.deskTile.y + agent.deskTile.x + 0.6);
    agent.laptopImage = laptop;
  }

  /** Reverse of sitDown: restore the idle pose and remove the laptop. */
  private standUp(agent: AgentState): void {
    if (!agent.isSeated) return;
    agent.isSeated = false;

    const spriteKey = agent.def.sprite;
    agent.sprite.y -= SIT_Y_OFFSET * this.charScale;
    agent.sprite.play(`${spriteKey}-idle-south`);

    agent.laptopImage?.destroy();
    agent.laptopImage = undefined;
  }

  // ── Animations ────────────────────────────────────────────────

  private setupAgentAnimations(spriteKey: string): void {
    this.createCharacterAnimations(spriteKey);
  }

  /**
   * Return a sprite key for a hue-shifted variant of `baseKey`. If `hueShift`
   * is 0, the base key is returned unchanged. Otherwise, the base spritesheet
   * image is drawn to an offscreen canvas with `filter: hue-rotate(Xdeg)` and
   * registered as a new Phaser spritesheet texture. Results are cached, so
   * subsequent calls with the same arguments reuse the same texture.
   *
   * Mirrors the approach used in fyso_world's renderer (getHueShiftedSprite).
   */
  private getHueShiftedSpriteKey(baseKey: string, hueShift: number): string {
    const hue = normalizeHue(hueShift);
    if (hue === 0) return baseKey;

    const variantKey = `${baseKey}-hue-${hue}`;
    if (this.textures.exists(variantKey)) return variantKey;

    const baseTexture = this.textures.get(baseKey);
    const source = baseTexture.getSourceImage(0) as HTMLImageElement | HTMLCanvasElement;
    if (!source) return baseKey;

    const width = (source as HTMLImageElement).naturalWidth ?? source.width;
    const height = (source as HTMLImageElement).naturalHeight ?? source.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return baseKey;
    ctx.imageSmoothingEnabled = false;
    ctx.filter = `hue-rotate(${hue}deg)`;
    ctx.drawImage(source, 0, 0);

    this.textures.addSpriteSheet(variantKey, canvas as unknown as HTMLImageElement, {
      frameWidth: CHAR_W,
      frameHeight: CHAR_H,
    });

    return variantKey;
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

    // Sit (typing) animation — south-facing only. Uses the type_0/type_1
    // frames from the spritesheet so the character looks like they're
    // working at a laptop.
    const sitKey = `${spriteKey}-sit-south`;
    if (!this.anims.exists(sitKey)) {
      const sitRow = DIR_SOUTH; // south-facing row
      this.anims.create({
        key: sitKey,
        frames: SIT_FRAMES.map((col) => ({ key: spriteKey, frame: sitRow * SPRITE_COLS + col })),
        frameRate: Math.round(1000 / (FRAME_DURATION_MS * 2)),
        repeat: -1,
      });
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
    // Guard against the agent being removed mid-tween — its game objects
    // would already be destroyed.
    if (!this.agents.has(agent.def.id)) return;

    if (path.length === 0) {
      agent.isMoving = false;
      const spriteKey = agent.def.sprite;
      agent.sprite.play(`${spriteKey}-idle-south`);
      const prevStatus =
        agent.status === 'walking' ? agent.baseStatus : agent.status;
      this.setAgentStatus(agent.def.id, prevStatus);
      // If the agent finished walking while in the working base status,
      // either sit down (if they arrived at the chair) or walk back to the
      // chair. setAgentStatus doesn't trigger enterWorkingState when the
      // base is already 'working', so we handle the follow-up here.
      if (agent.baseStatus === 'working') {
        const atChair =
          agent.currentX === agent.chairTile.x &&
          agent.currentY === agent.chairTile.y;
        if (atChair) {
          this.sitDown(agent);
        } else {
          this.moveAgent(agent.def.id, agent.chairTile.x, agent.chairTile.y);
        }
      }
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
        if (!this.agents.has(agent.def.id)) return;
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
