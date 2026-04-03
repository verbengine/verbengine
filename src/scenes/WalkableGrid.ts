/**
 * WalkableGrid — pure utility functions for extracting walkability data from map grids.
 *
 * No Phaser dependency: fully testable in Node/Vitest without a browser or game instance.
 */

/**
 * Build a 2D boolean grid indicating which cells are walkable.
 *
 * @param mapData  - 2D array of tile type integers (rows × cols)
 * @param walkableTiles - tile type values that the player can walk on
 * @returns a 2D array of booleans, true where the tile is walkable
 */
export function buildGrid(mapData: number[][], walkableTiles: number[]): boolean[][] {
  return mapData.map((row) =>
    row.map((cell) => walkableTiles.includes(cell)),
  );
}

/**
 * Bounds-checked walkability test.
 *
 * @param grid - walkability grid produced by buildGrid
 * @param x    - column index (horizontal)
 * @param y    - row index (vertical)
 * @returns true if the cell exists and is walkable, false otherwise
 */
export function isWalkable(grid: boolean[][], x: number, y: number): boolean {
  if (y < 0 || y >= grid.length) return false;
  const row = grid[y];
  if (x < 0 || x >= row.length) return false;
  return row[x];
}
