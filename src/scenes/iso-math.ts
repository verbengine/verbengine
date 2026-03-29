/**
 * Isometric coordinate conversion utilities.
 *
 * Standard 2:1 isometric projection where tile width = 2 * tile height.
 */

export interface IsoPoint {
  x: number;
  y: number;
}

/**
 * Convert cartesian grid coordinates to isometric screen coordinates.
 * The returned point is the CENTER of the tile diamond.
 */
export function cartToIso(
  cartX: number,
  cartY: number,
  tileWidth: number,
  tileHeight: number,
): IsoPoint {
  return {
    x: (cartX - cartY) * (tileWidth / 2),
    y: (cartX + cartY) * (tileHeight / 2),
  };
}

/**
 * Convert isometric screen coordinates back to cartesian grid coordinates.
 * Returns fractional values — caller should Math.floor() for tile indices.
 */
export function isoToCart(
  isoX: number,
  isoY: number,
  tileWidth: number,
  tileHeight: number,
): IsoPoint {
  const halfW = tileWidth / 2;
  const halfH = tileHeight / 2;
  return {
    x: (isoX / halfW + isoY / halfH) / 2,
    y: (isoY / halfH - isoX / halfW) / 2,
  };
}
