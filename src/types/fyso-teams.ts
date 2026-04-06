/**
 * Type definitions for Fyso Teams integration.
 */

export type AgentStatus =
  | 'idle'
  | 'wander'
  | 'working'
  | 'talking'
  | 'walking'
  | 'done'
  | 'error';

/**
 * A rectangular pod assigned to an agent.
 *
 * The pod is the agent's private workspace: all cells must be walkable floor at
 * spawn time (no walls, desks, or other pods inside). Verbengine places a desk
 * and a chair inside the pod automatically and uses it as the boundary for
 * wander behavior.
 */
export interface PodRect {
  /** Column of the pod's top-left corner (0-indexed). */
  x: number;
  /** Row of the pod's top-left corner (0-indexed). */
  y: number;
  /** Width in tiles. Minimum 2. */
  w: number;
  /** Height in tiles. Minimum 2. */
  h: number;
}

export interface AgentDef {
  id: string;
  name: string;
  sprite: string;
  /**
   * Workspace assigned to this agent. Verbengine places a desk at the
   * pod's center-top and a chair immediately below the desk. The agent spawns
   * standing on its chair. Pods must not overlap with other pods, walls, or
   * decorations.
   */
  pod: PodRect;
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
