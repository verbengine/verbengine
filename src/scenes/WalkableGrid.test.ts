import { describe, it, expect } from 'vitest';
import { buildGrid, isWalkable } from './WalkableGrid';

/**
 * Tests for WalkableGrid pure utility functions.
 *
 * Cell type legend (matches AdventureScene / IsoScene conventions):
 *   0 = floor (walkable)
 *   1 = wall  (blocked)
 *   4 = chair (walkable decoration)
 */

describe('buildGrid', () => {
  it('marks floor tiles (0) as walkable', () => {
    const mapData = [[0, 1], [1, 0]];
    const grid = buildGrid(mapData, [0]);

    expect(grid[0][0]).toBe(true);
    expect(grid[0][1]).toBe(false);
    expect(grid[1][0]).toBe(false);
    expect(grid[1][1]).toBe(true);
  });

  it('marks wall tiles (1) as non-walkable', () => {
    const mapData = [[1, 1, 1], [1, 0, 1], [1, 1, 1]];
    const grid = buildGrid(mapData, [0]);

    // All border cells are walls
    for (let col = 0; col < 3; col++) {
      expect(grid[0][col]).toBe(false);
      expect(grid[2][col]).toBe(false);
    }
    expect(grid[1][0]).toBe(false);
    expect(grid[1][2]).toBe(false);
    // Interior cell is floor
    expect(grid[1][1]).toBe(true);
  });

  it('marks multiple walkable tile types correctly', () => {
    // 0 = floor, 4 = chair (both walkable), 1 = wall (blocked)
    const mapData = [[0, 4, 1]];
    const grid = buildGrid(mapData, [0, 4]);

    expect(grid[0][0]).toBe(true);  // floor
    expect(grid[0][1]).toBe(true);  // chair
    expect(grid[0][2]).toBe(false); // wall
  });

  it('returns a grid with the same dimensions as the input', () => {
    const rows = 5;
    const cols = 7;
    const mapData = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);
    const grid = buildGrid(mapData, [0]);

    expect(grid).toHaveLength(rows);
    for (const row of grid) {
      expect(row).toHaveLength(cols);
    }
  });

  it('handles an empty walkable set — all tiles blocked', () => {
    const mapData = [[0, 0], [0, 0]];
    const grid = buildGrid(mapData, []);

    for (const row of grid) {
      for (const cell of row) {
        expect(cell).toBe(false);
      }
    }
  });

  it('handles an empty map — returns empty grid', () => {
    const grid = buildGrid([], [0]);
    expect(grid).toHaveLength(0);
  });
});

describe('isWalkable', () => {
  const mapData = [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 4],
  ];
  const grid = buildGrid(mapData, [0, 4]);

  it('returns true for a walkable floor tile', () => {
    expect(isWalkable(grid, 1, 1)).toBe(true);
  });

  it('returns true for a walkable decoration tile (chair / type 4)', () => {
    expect(isWalkable(grid, 2, 2)).toBe(true);
  });

  it('returns false for a wall tile', () => {
    expect(isWalkable(grid, 0, 0)).toBe(false);
  });

  it('returns false for negative x (out of bounds)', () => {
    expect(isWalkable(grid, -1, 1)).toBe(false);
  });

  it('returns false for negative y (out of bounds)', () => {
    expect(isWalkable(grid, 1, -1)).toBe(false);
  });

  it('returns false for x beyond grid width (out of bounds)', () => {
    expect(isWalkable(grid, 3, 1)).toBe(false);
  });

  it('returns false for y beyond grid height (out of bounds)', () => {
    expect(isWalkable(grid, 1, 3)).toBe(false);
  });

  it('returns false for an empty grid', () => {
    expect(isWalkable([], 0, 0)).toBe(false);
  });
});
