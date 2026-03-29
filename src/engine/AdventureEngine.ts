/**
 * AdventureEngine — state machine for inventory, flags, and scene transitions.
 *
 * Manages the runtime state of a DSL v2 adventure: current scene, inventory,
 * flags, removed hotspots, and event callbacks. Evaluates conditions and
 * executes actions triggered by player interactions.
 */

import {
  Action,
  AdventureData,
  CharacterDef,
  Condition,
  ConditionalInteraction,
  ExitDef,
  GameState,
  HotspotDef,
  InteractionResult,
  ItemDef,
  SceneDef,
} from '../types/adventure-v2';

type SceneChangeCallback = (sceneId: string) => void;
type InventoryChangeCallback = (inventory: string[]) => void;
type WinCallback = () => void;

export class AdventureEngine {
  private readonly adventure: AdventureData;
  private state: GameState;

  private sceneChangeCallbacks: SceneChangeCallback[] = [];
  private inventoryChangeCallbacks: InventoryChangeCallback[] = [];
  private winCallbacks: WinCallback[] = [];

  constructor(adventure: AdventureData) {
    this.adventure = adventure;
    this.state = {
      currentScene: adventure.startScene,
      inventory: [],
      flags: new Set<string>(),
      removedHotspots: new Set<string>(),
    };
  }

  // --- State ---

  getState(): GameState {
    return this.state;
  }

  getCurrentScene(): SceneDef {
    return this.adventure.scenes[this.state.currentScene];
  }

  getInventory(): string[] {
    return [...this.state.inventory];
  }

  hasItem(itemId: string): boolean {
    return this.state.inventory.includes(itemId);
  }

  hasFlag(flagName: string): boolean {
    return this.state.flags.has(flagName);
  }

  // --- Interactions ---

  interactHotspot(hotspotId: string, withItem?: string): InteractionResult | null {
    const hotspot = this.getHotspot(hotspotId);
    if (!hotspot || this.isHotspotRemoved(hotspotId)) {
      return null;
    }

    // If an item is provided, look for a matching use(item) conditional
    if (withItem) {
      const match = hotspot.use.find(
        (u) => u.condition?.type === 'has' && u.condition.target === withItem
      );
      if (match) {
        this.executeActions(match.actions);
        return { text: match.text, actions: match.actions };
      }
      return null;
    }

    // If hotspot has a take action, execute it
    if (hotspot.take) {
      this.executeActions(hotspot.take.actions);
      return { text: hotspot.take.text, actions: hotspot.take.actions };
    }

    // Fall back to default use (no condition)
    const defaultUse = hotspot.use.find((u) => !u.condition);
    if (defaultUse) {
      this.executeActions(defaultUse.actions);
      return { text: defaultUse.text, actions: defaultUse.actions };
    }

    return null;
  }

  interactCharacter(characterId: string): InteractionResult | null {
    const character = this.getCharacter(characterId);
    if (!character) {
      return null;
    }

    // Find first matching conditional talk
    for (const interaction of character.talk) {
      if (interaction.condition && this.evaluateCondition(interaction.condition)) {
        this.executeActions(interaction.actions);
        return { text: interaction.text, actions: interaction.actions };
      }
    }

    // Fall back to default talk (no condition)
    const defaultTalk = character.talk.find((t) => !t.condition);
    if (defaultTalk) {
      this.executeActions(defaultTalk.actions);
      return { text: defaultTalk.text, actions: defaultTalk.actions };
    }

    return null;
  }

  interactExit(exitId: string): InteractionResult | null {
    const exit = this.getExit(exitId);
    if (!exit) {
      return null;
    }

    // Check requires condition
    if (exit.requires && !this.hasItem(exit.requires)) {
      return { text: exit.locked ?? 'You cannot go there yet.', actions: [] };
    }

    // Requirements met — execute go action
    const goAction: Action = { type: 'go', target: exit.target };
    this.executeActions([goAction]);
    return { text: exit.look, actions: [goAction] };
  }

  // --- Actions ---

  executeActions(actions: Action[]): void {
    for (const action of actions) {
      switch (action.type) {
        case 'get':
          if (action.target && !this.hasItem(action.target)) {
            this.state.inventory.push(action.target);
            this.notifyInventoryChange();
          }
          break;

        case 'remove':
          if (action.target) {
            const index = this.state.inventory.indexOf(action.target);
            if (index !== -1) {
              this.state.inventory.splice(index, 1);
              this.notifyInventoryChange();
            }
          }
          break;

        case 'go':
          if (action.target && this.adventure.scenes[action.target]) {
            this.state.currentScene = action.target;
            this.notifySceneChange(action.target);
          }
          break;

        case 'win':
          this.notifyWin();
          break;

        case 'set':
          if (action.target) {
            this.state.flags.add(action.target);
          }
          break;

        case 'remove_hotspot':
          if (action.target) {
            this.state.removedHotspots.add(action.target);
          }
          break;
      }
    }
  }

  // --- Queries ---

  getHotspot(id: string): HotspotDef | undefined {
    return this.getCurrentScene().hotspots.find((h) => h.id === id);
  }

  getCharacter(id: string): CharacterDef | undefined {
    return this.getCurrentScene().characters.find((c) => c.id === id);
  }

  getExit(id: string): ExitDef | undefined {
    return this.getCurrentScene().exits.find((e) => e.id === id);
  }

  getItem(id: string): ItemDef | undefined {
    return this.adventure.items[id];
  }

  isHotspotRemoved(id: string): boolean {
    return this.state.removedHotspots.has(id);
  }

  // --- Events ---

  onSceneChange(callback: SceneChangeCallback): void {
    this.sceneChangeCallbacks.push(callback);
  }

  onInventoryChange(callback: InventoryChangeCallback): void {
    this.inventoryChangeCallbacks.push(callback);
  }

  onWin(callback: WinCallback): void {
    this.winCallbacks.push(callback);
  }

  // --- Private helpers ---

  private evaluateCondition(condition: Condition): boolean {
    switch (condition.type) {
      case 'has':
        return this.hasItem(condition.target);
      case 'flag':
        return this.hasFlag(condition.target);
      default:
        return false;
    }
  }

  private notifySceneChange(sceneId: string): void {
    for (const cb of this.sceneChangeCallbacks) {
      cb(sceneId);
    }
  }

  private notifyInventoryChange(): void {
    for (const cb of this.inventoryChangeCallbacks) {
      cb(this.getInventory());
    }
  }

  private notifyWin(): void {
    for (const cb of this.winCallbacks) {
      cb();
    }
  }
}
