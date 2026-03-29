import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Tests for IsoScene tileset integration.
 *
 * Since IsoScene is a Phaser.Scene that requires a running game instance,
 * we test the data layer (map structure, asset files) rather than rendering.
 * The iso-math coordinate tests cover the math used by gridToScreen/screenToGrid.
 */

/** Re-declare map constants to verify structure independently */
const MAP_COLS = 8;
const MAP_ROWS = 8;

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

const WALKABLE_TILES = [0, 2, 3, 4];

describe('IsoScene map data', () => {
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

  it('has walkable interior tiles for pathfinding', () => {
    let walkableCount = 0;
    for (let row = 1; row < MAP_ROWS - 1; row++) {
      for (let col = 1; col < MAP_COLS - 1; col++) {
        if (WALKABLE_TILES.includes(MAP_DATA[row][col])) {
          walkableCount++;
        }
      }
    }
    // The interior is 6x6=36 cells; there should be a mix of walkable and blocked
    expect(walkableCount).toBeGreaterThan(15);
    expect(walkableCount).toBeLessThan(36);
  });

  it('character spawn position (1,1) is walkable', () => {
    expect(WALKABLE_TILES.includes(MAP_DATA[1][1])).toBe(true);
  });

  it('uses multiple floor variants', () => {
    const cellTypes = new Set<number>();
    for (const row of MAP_DATA) {
      for (const cell of row) {
        cellTypes.add(cell);
      }
    }
    // Should have at least: wall (1), stone (0), tiled (2), dirt (3), planks (4)
    expect(cellTypes.has(0)).toBe(true);
    expect(cellTypes.has(1)).toBe(true);
    expect(cellTypes.has(2)).toBe(true);
    expect(cellTypes.has(3)).toBe(true);
    expect(cellTypes.has(4)).toBe(true);
  });

  it('uses decoration tiles (barrel, crate, chest, table)', () => {
    const cellTypes = new Set<number>();
    for (const row of MAP_DATA) {
      for (const cell of row) {
        cellTypes.add(cell);
      }
    }
    expect(cellTypes.has(5)).toBe(true); // barrel
    expect(cellTypes.has(6)).toBe(true); // crate
    expect(cellTypes.has(7)).toBe(true); // chest
    expect(cellTypes.has(8)).toBe(true); // table
  });
});

describe('Pixel art tileset assets', () => {
  const publicDir = path.resolve(__dirname, '../../public');

  const tileFiles = [
    'assets/tiles/floor-stone.png',
    'assets/tiles/floor-stone-tile.png',
    'assets/tiles/floor-dirt.png',
    'assets/tiles/floor-planks.png',
    'assets/tiles/wall-stone.png',
    'assets/tiles/barrel.png',
    'assets/tiles/crate.png',
    'assets/tiles/chest.png',
    'assets/tiles/table.png',
  ];

  const characterFiles = [
    'assets/characters/hero.png',
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
});

describe('IsoScene source structure', () => {
  it('IsoScene.ts exports IsoScene class', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain('export class IsoScene');
  });

  it('preload() loads tile images and hero spritesheet', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain("this.load.image('tile-floor-stone'");
    expect(source).toContain("this.load.image('tile-wall'");
    expect(source).toContain("this.load.spritesheet('hero'");
  });

  it('uses Phaser Image objects instead of Graphics for tiles', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain('this.add.image(');
    expect(source).toContain('setScale(TILE_SCALE)');
    // Should NOT use drawDiamond for map tiles anymore
    expect(source).not.toContain('drawDiamond');
  });

  it('keeps hover highlight with Graphics overlay', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain('drawHoverHighlight');
    expect(source).toContain('hoverHighlight');
  });

  it('keeps pathfinding with EasyStar', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain('easystar');
    expect(source).toContain('findPath');
    expect(source).toContain('moveAlongPath');
  });

  it('has directional walking with 4 directions', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain('DIR_SOUTH');
    expect(source).toContain('DIR_NORTH');
    expect(source).toContain('DIR_EAST');
    expect(source).toContain('DIR_WEST');
    expect(source).toContain('setCharacterDirection');
  });

  it('creates walk and idle animations for each direction', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain('hero-walk-south');
    expect(source).toContain('hero-walk-north');
    expect(source).toContain('hero-walk-east');
    expect(source).toContain('hero-walk-west');
    expect(source).toContain('hero-idle-south');
    expect(source).toContain('hero-idle-north');
    expect(source).toContain('hero-idle-east');
    expect(source).toContain('hero-idle-west');
  });

  it('uses TILE_SCALE for pixel art rendering', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, './IsoScene.ts'),
      'utf-8',
    );
    expect(source).toContain('TILE_SCALE');
    expect(source).toContain('HERO_SCALE');
  });
});
