/**
 * AdventureScene — playable isometric adventure scene powered by DSL v2.
 *
 * Loads a .verb file, parses it with VerbParser, initializes AdventureEngine,
 * and renders the adventure using the same isometric rendering approach as IsoScene.
 * Integrates InteractionHandler + BubbleText for click-to-interact gameplay.
 */

import Phaser from 'phaser';
import EasyStar from 'easystarjs';
import { cartToIso, isoToCart } from './iso-math';
import { parseVerb } from '../engine/VerbParser';
import { AdventureEngine } from '../engine/AdventureEngine';
import { InteractionHandler } from '../engine/InteractionHandler';
import { BubbleText } from '../engine/BubbleText';
import { KonamiListener } from '../engine/KonamiListener';
import { DebugPanel } from '../engine/DebugPanel';
import { HotspotHighlighter } from './HotspotHighlighter';
import type {
  AdventureData,
  HotspotDef,
  CharacterDef,
  ExitDef,
} from '../types/adventure-v2';

// ── Tile constants (same as IsoScene) ─────────────────────────────
const TILE_WIDTH = 32;
const TILE_HEIGHT = 16;
const ZOOM = 3;
const SCALED_TILE_W = TILE_WIDTH * ZOOM;
const SCALED_TILE_H = TILE_HEIGHT * ZOOM;

const CHAR_W = 16;
const CHAR_H = 32;
const CHAR_SCALE = ZOOM;
const MOVE_SPEED = 2.5;
const FRAME_DURATION_MS = 150;

const SPRITE_COLS = 7;
const WALK_CYCLE = [0, 1, 2, 1];

const DIR_SOUTH = 0;
const DIR_NORTH = 1;
const DIR_EAST = 2;
const DIR_WEST = 3;

/** Walkable cell types */
const WALKABLE_TILES = [0, 4];

/** Texture keys for cell types */
const FLOOR_KEY = 'tile-floor-carpet';
const DECO_KEY: Record<number, string> = {
  3: 'tile-desk',
  4: 'tile-desk', // chair reuses desk texture
  5: 'tile-bookshelf-nano',
  6: 'tile-plant-nano',
  7: 'tile-coffee-nano',
};

const NANO_SCALE = SCALED_TILE_W / 711;

const HOVER_COLOR = 0xffffff;
const TARGET_COLOR = 0xffff00;
const BLOCKED_COLOR = 0xff3333;
const HOTSPOT_COLOR = 0x00ccff;
const CHARACTER_COLOR = 0xffcc00;
const EXIT_COLOR = 0x00ff66;

/** Map JSON structure */
interface MapData {
  cols: number;
  rows: number;
  playerStart: [number, number];
  data: number[][];
}

/** Tile lookup entry to identify what occupies a grid cell */
interface TileLookupEntry {
  hotspot?: HotspotDef;
  character?: CharacterDef;
  exit?: ExitDef;
}

/** Runtime NPC sprite state */
interface NpcSpriteState {
  character: CharacterDef;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

export class AdventureScene extends Phaser.Scene {
  // Adventure data
  private adventure!: AdventureData;
  private engine!: AdventureEngine;
  private interactionHandler!: InteractionHandler;
  private bubbleText!: BubbleText;

  // Map state
  private mapData!: MapData;
  private tileLookup: Map<string, TileLookupEntry> = new Map();

  // Rendering
  private tileImages: Phaser.GameObjects.Image[][] = [];
  private decorationImages: Phaser.GameObjects.Image[] = [];
  private hotspotMarkers: Phaser.GameObjects.Graphics[] = [];
  private exitMarkers: Phaser.GameObjects.Graphics[] = [];
  private npcSprites: NpcSpriteState[] = [];
  private characterSprite!: Phaser.GameObjects.Sprite;
  private targetHighlight!: Phaser.GameObjects.Graphics;
  private hoverHighlight!: Phaser.GameObjects.Graphics;

  // Inventory UI
  private inventoryContainer: Phaser.GameObjects.Container | null = null;
  private inventoryTexts: Phaser.GameObjects.Text[] = [];

  // Win overlay
  private winOverlay: Phaser.GameObjects.Container | null = null;

  // Player state
  private charGridX = 0;
  private charGridY = 0;
  private charDirection = DIR_SOUTH;
  private hoverCol = -1;
  private hoverRow = -1;
  private isMoving = false;
  private moveCallback: (() => void) | null = null;

  // Debug
  private debugPanel: DebugPanel | null = null;
  private konamiListener: KonamiListener | null = null;

  // Hotspot highlighter
  private hotspotHighlighter: HotspotHighlighter | null = null;

  // Pathfinding
  private easystar!: EasyStar.js;

  // Verb file path
  private verbFilePath = '/dsl/examples/missing-usb/adventure.verb';
  private verbBaseDir = '/dsl/examples/missing-usb';

  constructor() {
    super({ key: 'AdventureScene' });
  }

  init(data?: { verbFilePath?: string }): void {
    if (data?.verbFilePath) {
      this.verbFilePath = data.verbFilePath;
      this.verbBaseDir = data.verbFilePath.substring(0, data.verbFilePath.lastIndexOf('/'));
    }
  }

  preload(): void {
    // Floor and wall tiles
    this.load.image(FLOOR_KEY, '/assets/tiles/floor_carpet.png');
    this.load.image('tile-wall-plain', '/assets/tiles/wall_nano.png');
    this.load.image('tile-wall-window', '/assets/tiles/wall_window_nano.png');

    // Decorations
    this.load.image('tile-desk', '/assets/tiles/desk.png');
    this.load.image('tile-bookshelf-nano', '/assets/tiles/bookshelf_nano.png');
    this.load.image('tile-plant-nano', '/assets/tiles/plant_nano.png');
    this.load.image('tile-coffee-nano', '/assets/tiles/coffee_nano.png');

    // Character spritesheets
    const charSprites = ['char_0', 'char_1', 'char_2', 'char_3'];
    for (const sprite of charSprites) {
      this.load.spritesheet(sprite, `/assets/characters/${sprite}.png`, {
        frameWidth: CHAR_W,
        frameHeight: CHAR_H,
      });
    }
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#2c2c3a');

    this.setupAnimations();

    // Load and parse the .verb file
    try {
      const response = await fetch(this.verbFilePath);
      const verbSource = await response.text();
      this.adventure = parseVerb(verbSource);
    } catch {
      this.showErrorText('Failed to load adventure file.');
      return;
    }

    // Initialize engine
    this.engine = new AdventureEngine(this.adventure);
    this.bubbleText = new BubbleText(this);

    // Initialize interaction handler
    this.interactionHandler = new InteractionHandler(
      this.engine,
      this.bubbleText,
      {
        walkTo: (x: number, y: number, onArrive: () => void) => {
          this.walkPlayerTo(x, y, onArrive);
        },
        getPlayerPosition: () => ({ x: this.charGridX, y: this.charGridY }),
        onSceneChange: (sceneId: string) => {
          this.loadAdventureScene(sceneId);
        },
        onInventoryChange: (inventory: string[]) => {
          this.updateInventoryUI(inventory);
        },
        onWin: () => {
          this.showWinOverlay();
        },
      },
    );

    // Register engine callbacks
    this.engine.onSceneChange((sceneId: string) => {
      this.loadAdventureScene(sceneId);
    });
    this.engine.onInventoryChange((inventory: string[]) => {
      this.updateInventoryUI(inventory);
    });
    this.engine.onWin(() => {
      this.showWinOverlay();
    });

    // Load the start scene map
    await this.loadMapForScene(this.adventure.startScene);

    // Create game objects
    this.createCharacter();
    this.createTargetHighlight();
    this.createHoverHighlight();
    this.hotspotHighlighter = new HotspotHighlighter(this, SCALED_TILE_W, SCALED_TILE_H);
    this.setupInput();
    this.setupCamera();
    this.createInventoryUI();
    this.createUIOverlay();

    // Debug mode — activated by Konami Code
    this.debugPanel = new DebugPanel(this, this.engine);
    this.konamiListener = new KonamiListener(() => {
      this.debugPanel?.toggle();
    });
  }

  // ── Animations (reused from IsoScene) ───────────────────────────

  private setupAnimations(): void {
    const sprites = ['char_0', 'char_1', 'char_2', 'char_3'];

    for (const spriteKey of sprites) {
      const walkDirs = [
        { key: `${spriteKey}-walk-south`, row: 0 },
        { key: `${spriteKey}-walk-north`, row: 1 },
        { key: `${spriteKey}-walk-east`, row: 2 },
        { key: `${spriteKey}-walk-west`, row: 2 },
      ];

      for (const { key, row } of walkDirs) {
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: WALK_CYCLE.map((col) => ({
              key: spriteKey,
              frame: row * SPRITE_COLS + col,
            })),
            frameRate: Math.round(1000 / FRAME_DURATION_MS),
            repeat: -1,
          });
        }
      }

      const idleDirs = [
        { key: `${spriteKey}-idle-south`, row: 0 },
        { key: `${spriteKey}-idle-north`, row: 1 },
        { key: `${spriteKey}-idle-east`, row: 2 },
        { key: `${spriteKey}-idle-west`, row: 2 },
      ];

      for (const { key, row } of idleDirs) {
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: [{ key: spriteKey, frame: row * SPRITE_COLS + 0 }],
            frameRate: 1,
            repeat: 0,
          });
        }
      }
    }
  }

  // ── Coordinate helpers (same as IsoScene) ───────────────────────

  private gridToScreen(gx: number, gy: number): { x: number; y: number } {
    return cartToIso(gx, gy, SCALED_TILE_W, SCALED_TILE_H);
  }

  private screenToGrid(sx: number, sy: number): { col: number; row: number } | null {
    const worldPoint = this.cameras.main.getWorldPoint(sx, sy);
    const cart = isoToCart(worldPoint.x, worldPoint.y, SCALED_TILE_W, SCALED_TILE_H);
    const col = Math.floor(cart.x);
    const row = Math.floor(cart.y);

    if (!this.mapData || col < 0 || col >= this.mapData.cols || row < 0 || row >= this.mapData.rows) {
      return null;
    }
    return { col, row };
  }

  // ── Map loading and rendering ───────────────────────────────────

  private async loadMapForScene(sceneId: string): Promise<void> {
    const sceneDef = this.adventure.scenes[sceneId];
    if (!sceneDef) return;

    // Load map JSON
    const mapFile = sceneDef.map.endsWith('.json') ? sceneDef.map : `maps/${sceneDef.map}.json`;
    const mapPath = `${this.verbBaseDir}/${mapFile}`;
    try {
      const response = await fetch(mapPath);
      this.mapData = await response.json() as MapData;
    } catch {
      this.showErrorText(`Failed to load map: ${sceneDef.map}`);
      return;
    }

    // Clear previous scene objects
    this.clearSceneObjects();

    // Build tile lookup from adventure data
    this.buildTileLookup(sceneDef.hotspots, sceneDef.characters, sceneDef.exits);

    // Register interactables with the hotspot highlighter
    if (this.hotspotHighlighter) {
      const removedHotspots = this.engine.getState().removedHotspots;
      const visibleHotspots = sceneDef.hotspots.filter(h => !removedHotspots.has(h.id));
      this.hotspotHighlighter.setInteractables(visibleHotspots, sceneDef.characters, sceneDef.exits);
    }

    // Setup pathfinder
    this.setupPathfinder();

    // Render the map
    this.drawMap();

    // Place hotspot markers
    this.placeHotspotMarkers(sceneDef.hotspots);

    // Place NPC sprites
    this.placeCharacterSprites(sceneDef.characters);

    // Place exit indicators
    this.placeExitMarkers(sceneDef.exits);

    // Position player at map's playerStart
    this.charGridX = this.mapData.playerStart[0];
    this.charGridY = this.mapData.playerStart[1];

    if (this.characterSprite) {
      const pos = this.gridToScreen(this.charGridX, this.charGridY);
      this.characterSprite.setPosition(
        Math.round(pos.x),
        Math.round(pos.y + SCALED_TILE_H / 2),
      );
      this.updateCharacterDepth();
    }

    // Update camera bounds
    this.updateCameraBounds();
  }

  private loadAdventureScene(sceneId: string): void {
    this.bubbleText.clearAll();
    this.loadMapForScene(sceneId);
  }

  private clearSceneObjects(): void {
    // Clear tile images
    for (const row of this.tileImages) {
      for (const img of row) {
        if (img) img.destroy();
      }
    }
    this.tileImages = [];

    // Clear decorations
    for (const img of this.decorationImages) {
      img.destroy();
    }
    this.decorationImages = [];

    // Clear hotspot markers
    for (const marker of this.hotspotMarkers) {
      marker.destroy();
    }
    this.hotspotMarkers = [];

    // Clear exit markers
    for (const marker of this.exitMarkers) {
      marker.destroy();
    }
    this.exitMarkers = [];

    // Clear NPC sprites
    for (const npc of this.npcSprites) {
      npc.sprite.destroy();
      npc.label.destroy();
    }
    this.npcSprites = [];

    this.tileLookup.clear();
  }

  private buildTileLookup(
    hotspots: HotspotDef[],
    characters: CharacterDef[],
    exits: ExitDef[],
  ): void {
    this.tileLookup.clear();

    const removedHotspots = this.engine.getState().removedHotspots;

    for (const hotspot of hotspots) {
      if (removedHotspots.has(hotspot.id)) continue;
      const key = `${hotspot.position[0]},${hotspot.position[1]}`;
      const entry = this.tileLookup.get(key) ?? {};
      entry.hotspot = hotspot;
      this.tileLookup.set(key, entry);
    }

    for (const character of characters) {
      const key = `${character.position[0]},${character.position[1]}`;
      const entry = this.tileLookup.get(key) ?? {};
      entry.character = character;
      this.tileLookup.set(key, entry);
    }

    for (const exit of exits) {
      const key = `${exit.position[0]},${exit.position[1]}`;
      const entry = this.tileLookup.get(key) ?? {};
      entry.exit = exit;
      this.tileLookup.set(key, entry);
    }
  }

  private setupPathfinder(): void {
    this.easystar = new EasyStar.js();
    this.easystar.setGrid(this.mapData.data);
    this.easystar.setAcceptableTiles(WALKABLE_TILES);
    this.easystar.enableDiagonals();
    this.easystar.enableCornerCutting();
  }

  private drawMap(): void {
    const { cols, rows, data } = this.mapData;
    this.tileImages = [];
    this.decorationImages = [];

    // Pass 1: floors and walls
    for (let row = 0; row < rows; row++) {
      this.tileImages[row] = [];
      for (let col = 0; col < cols; col++) {
        const cellType = data[row][col];
        const { x, y } = this.gridToScreen(col, row);
        const sx = Math.round(x);
        const sy = Math.round(y);

        if (cellType === 1 || cellType === 2) {
          // Wall tiles
          const floorImg = this.add.image(sx, sy, FLOOR_KEY);
          floorImg.setScale(NANO_SCALE);
          floorImg.setOrigin(0.5, 0);
          floorImg.setDepth(row + col);
          this.tileImages[row][col] = floorImg;

          const wallImg = this.add.image(sx, sy + SCALED_TILE_H, 'tile-wall-plain');
          wallImg.setScale(NANO_SCALE);
          wallImg.setOrigin(0.5, 1.0);
          wallImg.setDepth(row + col + 0.3);
          this.decorationImages.push(wallImg);
        } else {
          const floorImg = this.add.image(sx, sy, FLOOR_KEY);
          floorImg.setScale(NANO_SCALE);
          floorImg.setOrigin(0.5, 0);
          floorImg.setDepth(row + col);
          this.tileImages[row][col] = floorImg;
        }
      }
    }

    // Pass 2: decorations
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellType = data[row][col];
        const decoKey = DECO_KEY[cellType];
        if (!decoKey) continue;

        const { x, y } = this.gridToScreen(col, row);
        const decoImg = this.add.image(
          Math.round(x),
          Math.round(y + SCALED_TILE_H / 2),
          decoKey,
        );
        decoImg.setScale(NANO_SCALE);
        decoImg.setOrigin(0.5, 0.5);
        decoImg.setDepth(row + col + 0.5);
        this.decorationImages.push(decoImg);
      }
    }
  }

  // ── Hotspot markers ─────────────────────────────────────────────

  private placeHotspotMarkers(hotspots: HotspotDef[]): void {
    const removedHotspots = this.engine.getState().removedHotspots;

    for (const hotspot of hotspots) {
      if (removedHotspots.has(hotspot.id)) continue;

      const [gx, gy] = hotspot.position;
      const marker = this.add.graphics();
      this.drawDiamondOutline(marker, gx, gy, HOTSPOT_COLOR, 0.5);
      marker.setDepth(998);
      this.hotspotMarkers.push(marker);
    }
  }

  // ── Character (NPC) sprites ─────────────────────────────────────

  private placeCharacterSprites(characters: CharacterDef[]): void {
    for (const character of characters) {
      const [gx, gy] = character.position;
      const { x, y } = this.gridToScreen(gx, gy);

      const spriteKey = character.sprite || 'char_1';
      const sprite = this.add.sprite(
        Math.round(x),
        Math.round(y + SCALED_TILE_H / 2),
        spriteKey,
        0,
      );
      sprite.setScale(CHAR_SCALE);
      sprite.setOrigin(0.5, 1.0);
      sprite.setDepth(gy + gx + 0.8);

      const idleKey = `${spriteKey}-idle-south`;
      if (this.anims.exists(idleKey)) {
        sprite.play(idleKey);
      }

      // Name label above NPC
      const label = this.add.text(
        Math.round(x),
        Math.round(y + SCALED_TILE_H / 2 - CHAR_H * CHAR_SCALE - 5),
        character.id,
        {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffffff',
          backgroundColor: '#00000088',
          padding: { x: 3, y: 1 },
        },
      ).setOrigin(0.5, 1.0).setDepth(gy + gx + 0.9);

      this.npcSprites.push({ character, sprite, label });
    }
  }

  // ── Exit markers ────────────────────────────────────────────────

  private placeExitMarkers(exits: ExitDef[]): void {
    for (const exit of exits) {
      const [gx, gy] = exit.position;
      const marker = this.add.graphics();
      this.drawDiamondOutline(marker, gx, gy, EXIT_COLOR, 0.6);
      marker.setDepth(998);
      this.exitMarkers.push(marker);
    }
  }

  // ── Player character ────────────────────────────────────────────

  private createCharacter(): void {
    const { x, y } = this.gridToScreen(this.charGridX, this.charGridY);
    this.characterSprite = this.add.sprite(
      Math.round(x),
      Math.round(y + SCALED_TILE_H / 2),
      'char_0',
      0,
    );
    this.characterSprite.setScale(CHAR_SCALE);
    this.characterSprite.setOrigin(0.5, 1.0);
    this.updateCharacterDepth();

    const idleKey = 'char_0-idle-south';
    if (this.anims.exists(idleKey)) {
      this.characterSprite.play(idleKey);
    }
  }

  private updateCharacterDepth(): void {
    this.characterSprite.setDepth(this.charGridY + this.charGridX + 0.8);
  }

  private setCharacterDirection(dx: number, dy: number): void {
    if (dx > 0 && dy > 0) this.charDirection = DIR_SOUTH;
    else if (dx < 0 && dy < 0) this.charDirection = DIR_NORTH;
    else if (dx > 0 && dy < 0) this.charDirection = DIR_EAST;
    else if (dx < 0 && dy > 0) this.charDirection = DIR_WEST;
    else if (dx > 0) this.charDirection = DIR_EAST;
    else if (dx < 0) this.charDirection = DIR_WEST;
    else if (dy > 0) this.charDirection = DIR_SOUTH;
    else if (dy < 0) this.charDirection = DIR_NORTH;

    this.characterSprite.setFlipX(this.charDirection === DIR_WEST);
  }

  private getWalkAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `char_0-walk-${dirNames[this.charDirection]}`;
  }

  private getIdleAnimKey(): string {
    const dirNames = ['south', 'north', 'east', 'west'];
    return `char_0-idle-${dirNames[this.charDirection]}`;
  }

  // ── Highlights ──────────────────────────────────────────────────

  private createTargetHighlight(): void {
    this.targetHighlight = this.add.graphics();
    this.targetHighlight.setDepth(1000);
  }

  private createHoverHighlight(): void {
    this.hoverHighlight = this.add.graphics();
    this.hoverHighlight.setDepth(999);
  }

  private drawDiamondOutline(
    graphics: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    color: number,
    alpha: number,
  ): void {
    const { x, y } = this.gridToScreen(col, row);
    const hw = SCALED_TILE_W / 2;
    graphics.lineStyle(2, color, alpha);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.lineTo(x + hw, y + SCALED_TILE_H / 2);
    graphics.lineTo(x, y + SCALED_TILE_H);
    graphics.lineTo(x - hw, y + SCALED_TILE_H / 2);
    graphics.closePath();
    graphics.strokePath();
  }

  private drawFilledDiamond(
    graphics: Phaser.GameObjects.Graphics,
    col: number,
    row: number,
    color: number,
    alpha: number,
  ): void {
    const { x, y } = this.gridToScreen(col, row);
    const hw = SCALED_TILE_W / 2;
    graphics.fillStyle(color, alpha);
    graphics.beginPath();
    graphics.moveTo(x, y);
    graphics.lineTo(x + hw, y + SCALED_TILE_H / 2);
    graphics.lineTo(x, y + SCALED_TILE_H);
    graphics.lineTo(x - hw, y + SCALED_TILE_H / 2);
    graphics.closePath();
    graphics.fillPath();
  }

  private showTargetHighlight(col: number, row: number, color: number): void {
    this.targetHighlight.clear();
    this.drawFilledDiamond(this.targetHighlight, col, row, color, 0.4);
    this.time.delayedCall(400, () => {
      this.targetHighlight.clear();
    });
  }

  private drawHoverHighlight(col: number, row: number): void {
    this.hoverHighlight.clear();
    const { x, y } = this.gridToScreen(col, row);
    const hw = SCALED_TILE_W / 2;

    // Check if this tile has something interactive
    const key = `${col},${row}`;
    const entry = this.tileLookup.get(key);
    const highlightColor = entry ? HOTSPOT_COLOR : HOVER_COLOR;

    this.hoverHighlight.lineStyle(2, highlightColor, 0.8);
    this.hoverHighlight.beginPath();
    this.hoverHighlight.moveTo(x, y);
    this.hoverHighlight.lineTo(x + hw, y + SCALED_TILE_H / 2);
    this.hoverHighlight.lineTo(x, y + SCALED_TILE_H);
    this.hoverHighlight.lineTo(x - hw, y + SCALED_TILE_H / 2);
    this.hoverHighlight.closePath();
    this.hoverHighlight.strokePath();

    this.hoverHighlight.fillStyle(highlightColor, 0.15);
    this.hoverHighlight.beginPath();
    this.hoverHighlight.moveTo(x, y);
    this.hoverHighlight.lineTo(x + hw, y + SCALED_TILE_H / 2);
    this.hoverHighlight.lineTo(x, y + SCALED_TILE_H);
    this.hoverHighlight.lineTo(x - hw, y + SCALED_TILE_H / 2);
    this.hoverHighlight.closePath();
    this.hoverHighlight.fillPath();
  }

  // ── Camera ──────────────────────────────────────────────────────

  private setupCamera(): void {
    this.updateCameraBounds();
    this.cameras.main.startFollow(this.characterSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _go: unknown[], _dx: number, deltaY: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.002, 0.3, 3);
      cam.setZoom(newZoom);
    });

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
        cam.startFollow(this.characterSprite, true, 0.1, 0.1);
      }
    });
  }

  private updateCameraBounds(): void {
    if (!this.mapData) return;
    const { cols, rows } = this.mapData;

    const topLeft = this.gridToScreen(0, 0);
    const topRight = this.gridToScreen(cols, 0);
    const bottomLeft = this.gridToScreen(0, rows);
    const bottomRight = this.gridToScreen(cols, rows);

    const minX = Math.min(topLeft.x, bottomLeft.x) - SCALED_TILE_W;
    const maxX = Math.max(topRight.x, bottomRight.x) + SCALED_TILE_W;
    const minY = Math.min(topLeft.y, topRight.y) - SCALED_TILE_H * 2;
    const maxY = Math.max(bottomLeft.y, bottomRight.y) + SCALED_TILE_H * 2;

    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
  }

  // ── Input ───────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMoving) return;

      const grid = this.screenToGrid(pointer.x, pointer.y);
      if (!grid) return;

      const { col, row } = grid;
      const key = `${col},${row}`;
      const entry = this.tileLookup.get(key);

      // Check if clicking on an interactive tile
      if (entry) {
        const screenPos = this.gridToScreen(col, row);
        const worldX = col;
        const worldY = row;

        if (entry.hotspot) {
          this.showTargetHighlight(col, row, TARGET_COLOR);
          this.interactionHandler.handleHotspotClick(
            entry.hotspot.id,
            worldX,
            worldY,
          );
          return;
        }
        if (entry.character) {
          this.showTargetHighlight(col, row, TARGET_COLOR);
          this.interactionHandler.handleCharacterClick(
            entry.character.id,
            worldX,
            worldY,
          );
          return;
        }
        if (entry.exit) {
          this.showTargetHighlight(col, row, TARGET_COLOR);
          this.interactionHandler.handleExitClick(
            entry.exit.id,
            worldX,
            worldY,
          );
          return;
        }
      }

      // Regular movement to empty tile
      const cellType = this.mapData.data[row][col];
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
        this.hoverHighlight.clear();
        this.hotspotHighlighter?.clearHover();
        this.hoverCol = -1;
        this.hoverRow = -1;
        this.input.setDefaultCursor('default');
        return;
      }

      const { col, row } = grid;
      if (col === this.hoverCol && row === this.hoverRow) return;

      this.hoverCol = col;
      this.hoverRow = row;
      this.drawHoverHighlight(col, row);

      const isInteractive = this.hotspotHighlighter?.updateHover(col, row) ?? false;
      this.input.setDefaultCursor(isInteractive ? 'pointer' : 'default');
    });

    // Tab key: toggle reveal of all interactive tiles
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      if (this.hotspotHighlighter) {
        if (this.hotspotHighlighter.isShowingAll()) {
          this.hotspotHighlighter.hideAll();
        } else {
          this.hotspotHighlighter.showAll();
        }
      }
    });
  }

  // ── Movement ────────────────────────────────────────────────────

  private walkPlayerTo(targetX: number, targetY: number, onArrive: () => void): void {
    if (targetX === this.charGridX && targetY === this.charGridY) {
      onArrive();
      return;
    }

    // Ensure target is within bounds and walkable
    if (
      targetX < 0 || targetX >= this.mapData.cols ||
      targetY < 0 || targetY >= this.mapData.rows
    ) {
      onArrive();
      return;
    }

    this.moveCallback = onArrive;
    this.findAndMoveTo(targetX, targetY);
  }

  private findAndMoveTo(targetCol: number, targetRow: number): void {
    this.easystar.findPath(
      this.charGridX,
      this.charGridY,
      targetCol,
      targetRow,
      (path) => {
        if (!path || path.length < 2) {
          // Path not found — fire callback immediately
          if (this.moveCallback) {
            const cb = this.moveCallback;
            this.moveCallback = null;
            cb();
          }
          return;
        }
        this.moveAlongPath(path.slice(1));
      },
    );
    this.easystar.calculate();
  }

  private moveAlongPath(path: Array<{ x: number; y: number }>): void {
    if (path.length === 0) {
      this.isMoving = false;
      const idleKey = this.getIdleAnimKey();
      if (this.anims.exists(idleKey)) {
        this.characterSprite.play(idleKey);
      }

      // Fire arrival callback
      if (this.moveCallback) {
        const cb = this.moveCallback;
        this.moveCallback = null;
        cb();
      }
      return;
    }

    this.isMoving = true;
    const next = path[0];
    const remaining = path.slice(1);

    const dx = next.x - this.charGridX;
    const dy = next.y - this.charGridY;
    this.setCharacterDirection(dx, dy);

    const walkKey = this.getWalkAnimKey();
    if (this.anims.exists(walkKey) && this.characterSprite.anims.currentAnim?.key !== walkKey) {
      this.characterSprite.play(walkKey);
    }

    const from = this.gridToScreen(this.charGridX, this.charGridY);
    const to = this.gridToScreen(next.x, next.y);
    const charOffsetY = SCALED_TILE_H / 2;
    const stepDuration = (1 / MOVE_SPEED) * 1000;
    const tweenTarget = { x: from.x, y: from.y + charOffsetY };

    this.tweens.add({
      targets: tweenTarget,
      x: to.x,
      y: to.y + charOffsetY,
      duration: stepDuration,
      ease: 'Linear',
      onUpdate: () => {
        this.characterSprite.setPosition(
          Math.round(tweenTarget.x),
          Math.round(tweenTarget.y),
        );
      },
      onComplete: () => {
        this.charGridX = next.x;
        this.charGridY = next.y;
        const pos = this.gridToScreen(this.charGridX, this.charGridY);
        this.characterSprite.setPosition(
          Math.round(pos.x),
          Math.round(pos.y + charOffsetY),
        );
        this.updateCharacterDepth();
        this.moveAlongPath(remaining);
      },
    });
  }

  // ── Inventory UI ────────────────────────────────────────────────

  private createInventoryUI(): void {
    this.inventoryContainer = this.add.container(0, 0);
    this.inventoryContainer.setScrollFactor(0);
    this.inventoryContainer.setDepth(2000);

    // Background bar
    const bg = this.add.rectangle(
      this.scale.width / 2,
      20,
      this.scale.width,
      40,
      0x1a1a2e,
      0.85,
    );
    bg.setScrollFactor(0);
    this.inventoryContainer.add(bg);

    // Label
    const label = this.add.text(10, 10, 'Inventory:', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#888888',
    }).setScrollFactor(0);
    this.inventoryContainer.add(label);

    this.updateInventoryUI([]);

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      bg.setPosition(gameSize.width / 2, 20);
      bg.setSize(gameSize.width, 40);
    });
  }

  private updateInventoryUI(inventory: string[]): void {
    // Remove old item texts
    for (const txt of this.inventoryTexts) {
      txt.destroy();
    }
    this.inventoryTexts = [];

    if (!this.inventoryContainer) return;

    let offsetX = 110;
    for (const itemId of inventory) {
      const itemDef = this.engine.getItem(itemId);
      const displayName = itemDef ? itemDef.name : itemId;
      const isSelected = this.interactionHandler.getSelectedItem() === itemId;

      const itemText = this.add.text(offsetX, 8, `[${displayName}]`, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: isSelected ? '#ffcc00' : '#e0e0e0',
        backgroundColor: isSelected ? '#444400' : '#333333',
        padding: { x: 6, y: 4 },
      }).setScrollFactor(0).setInteractive({ useHandCursor: true });

      itemText.on('pointerdown', () => {
        const currentSelected = this.interactionHandler.getSelectedItem();
        if (currentSelected === itemId) {
          this.interactionHandler.setSelectedItem(null);
        } else {
          this.interactionHandler.setSelectedItem(itemId);
        }
        this.updateInventoryUI(this.engine.getInventory());
      });

      this.inventoryContainer.add(itemText);
      this.inventoryTexts.push(itemText);
      offsetX += itemText.width + 8;
    }
  }

  // ── Win overlay ─────────────────────────────────────────────────

  private showWinOverlay(): void {
    if (this.winOverlay) return;

    const w = this.scale.width;
    const h = this.scale.height;

    const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7)
      .setScrollFactor(0);

    const winText = this.add.text(w / 2, h / 2 - 30, 'You Win!', {
      fontFamily: 'monospace',
      fontSize: '48px',
      color: '#f1c40f',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);

    const restartBtn = this.add.text(w / 2, h / 2 + 40, '[ Restart ]', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#2a7a4a',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

    restartBtn.on('pointerdown', () => {
      this.winOverlay?.destroy();
      this.winOverlay = null;
      this.scene.restart();
    });

    const menuBtn = this.add.text(w / 2, h / 2 + 90, '[ Menu ]', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#aaaaaa',
      backgroundColor: '#333333',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });

    menuBtn.on('pointerdown', () => {
      this.winOverlay?.destroy();
      this.winOverlay = null;
      this.scene.start('MenuScene');
    });

    this.winOverlay = this.add.container(0, 0, [bg, winText, restartBtn, menuBtn]);
    this.winOverlay.setDepth(5000);
    this.winOverlay.setScrollFactor(0);
  }

  // ── UI overlay ──────────────────────────────────────────────────

  private createUIOverlay(): void {
    const backBtn = this.add.text(16, 50, '< Back', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 8, y: 4 },
    }).setInteractive({ useHandCursor: true })
      .setScrollFactor(0)
      .setDepth(2000)
      .on('pointerdown', () => {
        this.scene.start('MenuScene');
      });

    const titleText = this.add.text(this.scale.width / 2, 50, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cccccc',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(2000);

    if (this.adventure) {
      titleText.setText(this.adventure.title);
    }

    this.cameras.main.ignore([backBtn, titleText]);
    if (this.inventoryContainer) {
      this.cameras.main.ignore(this.inventoryContainer);
    }

    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      titleText.setX(gameSize.width / 2);
    });
  }

  // ── Error display ───────────────────────────────────────────────

  private showErrorText(message: string): void {
    this.add.text(this.scale.width / 2, this.scale.height / 2, message, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ff4444',
    }).setOrigin(0.5);
  }

  shutdown(): void {
    this.konamiListener?.destroy();
    this.debugPanel?.destroy();
    this.hotspotHighlighter?.destroy();
  }
}
