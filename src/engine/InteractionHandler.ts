/**
 * InteractionHandler — click detection and walk-to-interact.
 *
 * Coordinates player clicks on hotspots, characters, and exits with
 * walk-to behavior: the player walks to an adjacent tile, then the
 * interaction is triggered (text bubble, state change, etc.).
 */

import { AdventureEngine } from './AdventureEngine';
import { BubbleText } from './BubbleText';
import { Action } from '../types/adventure-v2';

export interface InteractionCallbacks {
  walkTo: (x: number, y: number, onArrive: () => void) => void;
  getPlayerPosition: () => { x: number; y: number };
  onSceneChange: (sceneId: string) => void;
  onInventoryChange: (inventory: string[]) => void;
  onWin: () => void;
}

/**
 * Calculate the nearest adjacent position to the target, relative to the player.
 * Returns a position one tile closer to the player from the target.
 */
function calculateAdjacentPosition(
  targetX: number,
  targetY: number,
  playerX: number,
  playerY: number
): { x: number; y: number } {
  const dx = playerX - targetX;
  const dy = playerY - targetY;

  // If player is already adjacent or on top, stay put
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    return { x: playerX, y: playerY };
  }

  // Move one tile toward the player from the target
  const stepX = dx === 0 ? 0 : dx > 0 ? 1 : -1;
  const stepY = dy === 0 ? 0 : dy > 0 ? 1 : -1;

  return {
    x: targetX + stepX,
    y: targetY + stepY,
  };
}

export class InteractionHandler {
  private readonly engine: AdventureEngine;
  private readonly bubbleText: BubbleText;
  private readonly callbacks: InteractionCallbacks;
  private selectedItem: string | null = null;

  constructor(
    engine: AdventureEngine,
    bubbleText: BubbleText,
    callbacks: InteractionCallbacks
  ) {
    this.engine = engine;
    this.bubbleText = bubbleText;
    this.callbacks = callbacks;
  }

  /** Called when player clicks on a hotspot tile. */
  handleHotspotClick(hotspotId: string, worldX: number, worldY: number): void {
    const playerPos = this.callbacks.getPlayerPosition();
    const adjacent = calculateAdjacentPosition(worldX, worldY, playerPos.x, playerPos.y);

    this.callbacks.walkTo(adjacent.x, adjacent.y, () => {
      if (this.selectedItem) {
        this.handleUseItemOn(hotspotId, this.selectedItem, worldX, worldY);
        return;
      }

      const result = this.engine.interactHotspot(hotspotId);
      if (result) {
        this.bubbleText.showBubble(worldX, worldY, result.text);
        this.processActions(result.actions);
      }
    });
  }

  /** Called when player clicks on a character tile. */
  handleCharacterClick(characterId: string, worldX: number, worldY: number): void {
    const playerPos = this.callbacks.getPlayerPosition();
    const adjacent = calculateAdjacentPosition(worldX, worldY, playerPos.x, playerPos.y);

    this.callbacks.walkTo(adjacent.x, adjacent.y, () => {
      const character = this.engine.getCharacter(characterId);
      const result = this.engine.interactCharacter(characterId);
      if (result && character) {
        this.bubbleText.showNamedBubble(worldX, worldY, character.id, result.text);
        this.processActions(result.actions);
      }
    });
  }

  /** Called when player clicks on an exit tile. */
  handleExitClick(exitId: string, worldX: number, worldY: number): void {
    const playerPos = this.callbacks.getPlayerPosition();
    const adjacent = calculateAdjacentPosition(worldX, worldY, playerPos.x, playerPos.y);

    this.callbacks.walkTo(adjacent.x, adjacent.y, () => {
      const result = this.engine.interactExit(exitId);
      if (!result) return;

      const hasGoAction = result.actions.some((a) => a.type === 'go');
      if (hasGoAction) {
        // Scene change was triggered
        this.processActions(result.actions);
      } else {
        // Exit is locked — show locked text
        this.bubbleText.showBubble(worldX, worldY, result.text);
      }
    });
  }

  /** Called when player clicks hotspot with an inventory item selected. */
  handleUseItemOn(
    hotspotId: string,
    itemId: string,
    worldX: number,
    worldY: number
  ): void {
    const result = this.engine.interactHotspot(hotspotId, itemId);
    if (result) {
      this.bubbleText.showBubble(worldX, worldY, result.text);
      this.processActions(result.actions);
    }
  }

  /** Set the currently selected inventory item. */
  setSelectedItem(itemId: string | null): void {
    this.selectedItem = itemId;
  }

  /** Get the currently selected inventory item. */
  getSelectedItem(): string | null {
    return this.selectedItem;
  }

  /**
   * Process actions returned from an interaction, dispatching
   * the appropriate callbacks for scene changes, inventory, and win.
   */
  private processActions(actions: Action[]): void {
    for (const action of actions) {
      switch (action.type) {
        case 'get':
        case 'remove':
          this.callbacks.onInventoryChange(this.engine.getInventory());
          break;
        case 'go':
          if (action.target) {
            this.callbacks.onSceneChange(action.target);
          }
          break;
        case 'win':
          this.callbacks.onWin();
          break;
      }
    }
  }
}
