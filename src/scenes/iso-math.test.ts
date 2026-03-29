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
