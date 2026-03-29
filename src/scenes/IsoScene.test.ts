import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Tests for IsoScene — Fyso World style tileset and large multi-room map.
 *
 * Since IsoScene is a Phaser.Scene that requires a running game instance,
 * we test the data layer (map structure, asset files) rather than rendering.
 * The iso-math coordinate tests cover the math used by gridToScreen/screenToGrid.
 */

/** Re-declare map constants to verify structure independently */
const MAP_COLS = 25;
const MAP_ROWS = 25;

/**
 * Cell types (matching IsoScene.ts):
 * 0 = office floor (walkable)
 * 1 = wall plain (blocked)
 * 2 = wall window (blocked)
 * 3 = desk (blocked decoration)
 * 4 = chair (walkable decoration)
 * 5 = bookshelf (blocked decoration)
 * 6 = barrel (blocked decoration)
 */
const MAP_DATA: number[][] = [
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
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
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

const WALKABLE_TILES = [0, 4];

/** Wall types (blocked non-decoration) */
const WALL_TILES = [1, 2];

/** Blocked decoration types */
const BLOCKED_DECO = [3, 5, 6];

describe('IsoScene map data (25x25 multi-room)', () => {
  it('has correct dimensions', () => {
    expect(MAP_DATA).toHaveLength(MAP_ROWS);
    for (const row of MAP_DATA) {
      expect(row).toHaveLength(MAP_COLS);
    }
  });

  it('has walls on all border cells', () => {
    for (let col = 0; col < MAP_COLS; col++) {
      expect(MAP_DATA[0][col]).toBe(1);
      expect(MAP_DATA[MAP_ROWS - 1][col]).toBe(1);
    }
    for (let row = 0; row < MAP_ROWS; row++) {
      expect(MAP_DATA[row][0]).toBe(1);
      expect(MAP_DATA[row][MAP_COLS - 1]).toBe(1);
    }
  });

  it('has a large number of walkable tiles for pathfinding', () => {
    let walkableCount = 0;
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (WALKABLE_TILES.includes(MAP_DATA[row][col])) {
          walkableCount++;
        }
      }
    }
    // 25x25 map with 23x23 interior = 529 cells; expect many walkable
    expect(walkableCount).toBeGreaterThan(200);
  });

  it('character spawn position (1,1) is walkable', () => {
    expect(WALKABLE_TILES.includes(MAP_DATA[1][1])).toBe(true);
  });

  it('has doorways connecting rooms (floor tiles in wall rows)', () => {
    // Row 10 should have doorways (floor tiles between walls)
    const row10 = MAP_DATA[10];
    const hasFloorInRow10 = row10.some((cell) => WALKABLE_TILES.includes(cell));
    expect(hasFloorInRow10).toBe(true);

    // Row 13 should have doorways
    const row13 = MAP_DATA[13];
    const hasFloorInRow13 = row13.some((cell) => WALKABLE_TILES.includes(cell));
    expect(hasFloorInRow13).toBe(true);
  });

  it('uses wall-plain and wall-window types', () => {
    const cellTypes = new Set<number>();
    for (const row of MAP_DATA) {
      for (const cell of row) {
        cellTypes.add(cell);
      }
    }
    expect(cellTypes.has(1)).toBe(true); // wall plain
    expect(cellTypes.has(2)).toBe(true); // wall window
  });

  it('uses decoration types: desk, chair, bookshelf, barrel', () => {
    const cellTypes = new Set<number>();
    for (const row of MAP_DATA) {
      for (const cell of row) {
        cellTypes.add(cell);
      }
    }
    expect(cellTypes.has(3)).toBe(true); // desk
    expect(cellTypes.has(4)).toBe(true); // chair
    expect(cellTypes.has(5)).toBe(true); // bookshelf
    expect(cellTypes.has(6)).toBe(true); // barrel
  });

  it('has multiple distinct rooms separated by walls', () => {
    // Vertical wall at col 10 (top section)
    let wallCountCol10 = 0;
    for (let row = 0; row <= 10; row++) {
      if (WALL_TILES.includes(MAP_DATA[row][10])) {
        wallCountCol10++;
      }
    }
    expect(wallCountCol10).toBeGreaterThan(5);

    // Vertical wall at col 16 (top section)
    let wallCountCol16 = 0;
    for (let row = 0; row <= 10; row++) {
      if (WALL_TILES.includes(MAP_DATA[row][16])) {
        wallCountCol16++;
      }
    }
    expect(wallCountCol16).toBeGreaterThan(5);
  });
});

describe('Fyso World tileset assets', () => {
  const publicDir = path.resolve(__dirname, '../../public');

  const tileFiles = [
    'assets/tiles/floor_office.png',
    'assets/tiles/wall_plain.png',
    'assets/tiles/wall_window.png',
    'assets/tiles/desk.png',
    'assets/tiles/chair.png',
    'assets/tiles/bookshelf.png',
    'assets/tiles/barrel.png',
  ];

  const characterFiles = [
    'assets/characters/char_0.png',
    'assets/characters/char_1.png',
  ];

  for (const file of [...tileFiles, ...characterFiles]) {
    it(`asset file exists: ${file}`, () => {
      const fullPath = path.join(publicDir, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  }

  it('tile images are PNG files', () => {
    for (const file of tileFiles) {
      const fullPath = path.join(publicDir, file);
      const buffer = fs.readFileSync(fullPath);
      // PNG magic bytes: 137 80 78 71
      expect(buffer[0]).toBe(137);
      expect(buffer[1]).toBe(80);
      expect(buffer[2]).toBe(78);
      expect(buffer[3]).toBe(71);
    }
  });

  it('character spritesheets are PNG files', () => {
    for (const file of characterFiles) {
      const fullPath = path.join(publicDir, file);
      const buffer = fs.readFileSync(fullPath);
      expect(buffer[0]).toBe(137);
      expect(buffer[1]).toBe(80);
    }
  });
});

describe('IsoScene source structure', () => {
  const readSource = (): string =>
    fs.readFileSync(path.resolve(__dirname, './IsoScene.ts'), 'utf-8');

  it('exports IsoScene class', () => {
    expect(readSource()).toContain('export class IsoScene');
  });

  it('preload() loads Fyso World tile images and char spritesheet', () => {
    const src = readSource();
    expect(src).toContain("this.load.image(FLOOR_KEY");
    expect(src).toContain("this.load.image('tile-wall-plain'");
    expect(src).toContain("this.load.image('tile-wall-window'");
    expect(src).toContain("this.load.spritesheet('char_0'");
  });

  it('uses Phaser Image objects for tiles with correct origins', () => {
    const src = readSource();
    expect(src).toContain('this.add.image(');
    expect(src).toContain('setScale(ZOOM)');
    expect(src).not.toContain('drawDiamond');
    // Floor tiles use origin (0.5, 0) — top-center aligned with diamond top point
    expect(src).toContain('setOrigin(0.5, 0)');
    // Uses Math.round for integer pixel positions (avoids sub-pixel blur)
    expect(src).toContain('Math.round');
  });

  it('keeps hover highlight with Graphics overlay', () => {
    const src = readSource();
    expect(src).toContain('drawHoverHighlight');
    expect(src).toContain('hoverHighlight');
  });

  it('keeps pathfinding with EasyStar', () => {
    const src = readSource();
    expect(src).toContain('easystar');
    expect(src).toContain('findPath');
    expect(src).toContain('moveAlongPath');
  });

  it('has directional walking with 4 directions', () => {
    const src = readSource();
    expect(src).toContain('DIR_SOUTH');
    expect(src).toContain('DIR_NORTH');
    expect(src).toContain('DIR_EAST');
    expect(src).toContain('DIR_WEST');
    expect(src).toContain('setCharacterDirection');
  });

  it('creates walk and idle animations for each direction', () => {
    const src = readSource();
    expect(src).toContain('char-walk-south');
    expect(src).toContain('char-walk-north');
    expect(src).toContain('char-walk-east');
    expect(src).toContain('char-walk-west');
    expect(src).toContain('char-idle-south');
    expect(src).toContain('char-idle-north');
    expect(src).toContain('char-idle-east');
    expect(src).toContain('char-idle-west');
  });

  it('uses ZOOM for pixel art rendering at 3x', () => {
    const src = readSource();
    expect(src).toContain('ZOOM = 3');
    expect(src).toContain('CHAR_SCALE');
  });

  it('uses Fyso World tile dimensions (32x16 base)', () => {
    const src = readSource();
    expect(src).toContain('TILE_WIDTH = 32');
    expect(src).toContain('TILE_HEIGHT = 16');
  });

  it('uses Fyso World character dimensions (16x32)', () => {
    const src = readSource();
    expect(src).toContain('CHAR_W = 16');
    expect(src).toContain('CHAR_H = 32');
  });

  it('has camera follow for the large map', () => {
    const src = readSource();
    expect(src).toContain('startFollow');
    expect(src).toContain('setBounds');
    expect(src).toContain('setScrollFactor(0)');
  });

  it('re-centers UI text on window resize', () => {
    const src = readSource();
    expect(src).toContain("this.scale.on('resize'");
    expect(src).toContain('this.scale.width');
  });

  it('uses two-pass rendering (floors then decorations)', () => {
    const src = readSource();
    expect(src).toContain('Pass 1');
    expect(src).toContain('Pass 2');
  });

  it('positions character at diamond center with bottom-center origin', () => {
    const src = readSource();
    expect(src).toContain('setOrigin(0.5, 1.0)');
    expect(src).toContain('SCALED_TILE_H / 2');
  });

  it('flips sprite horizontally for west direction', () => {
    const src = readSource();
    expect(src).toContain('setFlipX');
  });

  it('uses MOVE_SPEED for tween duration', () => {
    const src = readSource();
    expect(src).toContain('MOVE_SPEED');
    expect(src).toContain('stepDuration');
  });
});
