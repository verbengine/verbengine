import Phaser from 'phaser';
import type { FysoTeamsScene } from '../scenes/FysoTeamsScene';
import type { AgentDef, AgentStatus } from '../types/fyso-teams';

/**
 * FysoSceneBridge — thin adapter between the host application and FysoTeamsScene.
 *
 * All methods delegate to FysoTeamsScene's public API. The bridge does not hold
 * any game state; FysoTeamsScene is the single source of truth.
 */
export class FysoSceneBridge {
  private game: Phaser.Game;
  private sceneKey: string;

  constructor(game: Phaser.Game, sceneKey: string) {
    this.game = game;
    this.sceneKey = sceneKey;
  }

  // ── Scene accessor ────────────────────────────────────────────

  private getScene(): FysoTeamsScene {
    const scene = this.game.scene.getScene(this.sceneKey) as FysoTeamsScene | null;
    if (!scene) {
      throw new Error(`Scene '${this.sceneKey}' not found.`);
    }
    return scene;
  }

  // ── Agent management ──────────────────────────────────────────

  /**
   * Spawn an agent on the map.
   * Throws if an agent with the same id is already spawned.
   */
  spawnAgent(def: AgentDef): void {
    this.getScene().spawnAgent(def);
  }

  /**
   * Remove an agent from the map.
   * Safe to call with a non-existent id — no error is thrown.
   */
  removeAgent(id: string): void {
    this.getScene().removeAgent(id);
  }

  /**
   * Move an agent to the given grid coordinates via pathfinding.
   */
  moveAgent(id: string, targetX: number, targetY: number): void {
    this.getScene().moveAgent(id, targetX, targetY);
  }

  /**
   * Update the status badge of an agent.
   */
  setAgentStatus(id: string, status: AgentStatus): void {
    this.getScene().setAgentStatus(id, status);
  }

  /**
   * Show a speech bubble above the agent.
   * @param duration — ms before the bubble auto-dismisses (default 3000)
   */
  showAgentMessage(id: string, text: string, duration?: number): void {
    this.getScene().showAgentMessage(id, text, duration);
  }

  /**
   * Pan the camera to follow the given agent.
   */
  focusAgent(id: string): void {
    this.getScene().focusAgent(id);
  }

  // ── Input control ─────────────────────────────────────────────

  enableInput(): void {
    this.getScene().enableInput();
  }

  disableInput(): void {
    this.getScene().disableInput();
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  /**
   * Destroy the Phaser game instance and release all resources.
   */
  destroy(): void {
    this.game.destroy(true);
  }
}
