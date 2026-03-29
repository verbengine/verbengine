import { describe, it, expect } from 'vitest';
import { cartToIso, isoToCart } from './iso-math';

const TILE_W = 64;
const TILE_H = 32;

describe('cartToIso', () => {
  it('converts origin (0,0) to screen origin', () => {
    const result = cartToIso(0, 0, TILE_W, TILE_H);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('converts (1,0) to right-down diagonal', () => {
    const result = cartToIso(1, 0, TILE_W, TILE_H);
    expect(result.x).toBe(32); // tileWidth / 2
    expect(result.y).toBe(16); // tileHeight / 2
  });

  it('converts (0,1) to left-down diagonal', () => {
    const result = cartToIso(0, 1, TILE_W, TILE_H);
    expect(result.x).toBe(-32);
    expect(result.y).toBe(16);
  });

  it('converts (1,1) to straight down', () => {
    const result = cartToIso(1, 1, TILE_W, TILE_H);
    expect(result.x).toBe(0);
    expect(result.y).toBe(32);
  });

  it('converts (3,5) correctly', () => {
    const result = cartToIso(3, 5, TILE_W, TILE_H);
    // isoX = (3-5) * 32 = -64
    // isoY = (3+5) * 16 = 128
    expect(result.x).toBe(-64);
    expect(result.y).toBe(128);
  });
});

describe('isoToCart', () => {
  it('converts screen origin back to (0,0)', () => {
    const result = isoToCart(0, 0, TILE_W, TILE_H);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('converts (32,16) back to (1,0)', () => {
    const result = isoToCart(32, 16, TILE_W, TILE_H);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });

  it('converts (-32,16) back to (0,1)', () => {
    const result = isoToCart(-32, 16, TILE_W, TILE_H);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  it('converts (0,32) back to (1,1)', () => {
    const result = isoToCart(0, 32, TILE_W, TILE_H);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(1);
  });
});

describe('round-trip conversion', () => {
  const testCases = [
    [0, 0],
    [1, 0],
    [0, 1],
    [5, 3],
    [9, 9],
    [4, 7],
  ];

  for (const [cx, cy] of testCases) {
    it(`cartToIso -> isoToCart preserves (${cx},${cy})`, () => {
      const iso = cartToIso(cx, cy, TILE_W, TILE_H);
      const cart = isoToCart(iso.x, iso.y, TILE_W, TILE_H);
      expect(cart.x).toBeCloseTo(cx);
      expect(cart.y).toBeCloseTo(cy);
    });
  }
});

describe('screen-to-tile conversion with map offset', () => {
  // Simulates the IsoScene screenToGrid logic:
  // 1. Subtract offset to get relative coords
  // 2. Run isoToCart to get fractional tile coords
  // 3. Floor to get tile indices
  const OFFSET_X = 480; // canvas width / 2
  const OFFSET_Y = 80;

  function screenToTile(
    sx: number,
    sy: number,
  ): { col: number; row: number } | null {
    const relX = sx - OFFSET_X;
    const relY = sy - OFFSET_Y;
    const cart = isoToCart(relX, relY, TILE_W, TILE_H);
    const col = Math.floor(cart.x);
    const row = Math.floor(cart.y);
    if (col < 0 || col >= 10 || row < 0 || row >= 10) return null;
    return { col, row };
  }

  it('clicking the center of tile (0,0) returns (0,0)', () => {
    // Tile (0,0) center is at screen (OFFSET_X, OFFSET_Y)
    const result = screenToTile(OFFSET_X, OFFSET_Y);
    expect(result).toEqual({ col: 0, row: 0 });
  });

  it('clicking the center of tile (1,0) returns (1,0)', () => {
    const iso = cartToIso(1, 0, TILE_W, TILE_H);
    const result = screenToTile(iso.x + OFFSET_X, iso.y + OFFSET_Y);
    expect(result).toEqual({ col: 1, row: 0 });
  });

  it('clicking the center of tile (0,1) returns (0,1)', () => {
    const iso = cartToIso(0, 1, TILE_W, TILE_H);
    const result = screenToTile(iso.x + OFFSET_X, iso.y + OFFSET_Y);
    expect(result).toEqual({ col: 0, row: 1 });
  });

  it('clicking the center of tile (5,5) returns (5,5)', () => {
    const iso = cartToIso(5, 5, TILE_W, TILE_H);
    const result = screenToTile(iso.x + OFFSET_X, iso.y + OFFSET_Y);
    expect(result).toEqual({ col: 5, row: 5 });
  });

  it('clicking the center of tile (9,9) returns (9,9)', () => {
    const iso = cartToIso(9, 9, TILE_W, TILE_H);
    const result = screenToTile(iso.x + OFFSET_X, iso.y + OFFSET_Y);
    expect(result).toEqual({ col: 9, row: 9 });
  });

  it('clicking slightly inside tile (3,2) still returns (3,2)', () => {
    const iso = cartToIso(3, 2, TILE_W, TILE_H);
    // Offset by 1 pixel from center — safely within the same tile
    const result = screenToTile(iso.x + OFFSET_X + 1, iso.y + OFFSET_Y + 1);
    expect(result).toEqual({ col: 3, row: 2 });
  });

  it('returns null for clicks outside the map bounds', () => {
    // Click far to the left — negative col
    const result = screenToTile(0, 80);
    expect(result).toBeNull();
  });

  it('every tile center maps back to its own tile', () => {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const iso = cartToIso(col, row, TILE_W, TILE_H);
        const result = screenToTile(iso.x + OFFSET_X, iso.y + OFFSET_Y);
        expect(result).toEqual({ col, row });
      }
    }
  });
});
