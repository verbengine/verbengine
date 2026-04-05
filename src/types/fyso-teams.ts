/**
 * Type definitions for Fyso Teams integration.
 */

export type AgentStatus =
  | 'idle'
  | 'working'
  | 'talking'
  | 'walking'
  | 'done'
  | 'error';

export interface AgentDef {
  id: string;
  name: string;
  sprite: string;
  gridX: number;
  gridY: number;
  status?: AgentStatus;
  /** Hue rotation in degrees (0-360). Applied as a color tint. */
  hueShift?: number;
}

export interface FysoGameOptions {
  /** Camera zoom level (default: 2) */
  zoom?: number;
  /** Asset base path (default: '') */
  basePath?: string;
  /** Injectable map data (default: built-in office map) */
  mapData?: number[][];
}
