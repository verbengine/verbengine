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
  CombineDef,
  Condition,
  ConditionalInteraction,
  ExitDef,
  GameState,
  HotspotDef,
  InteractionEvent,
  InteractionResult,
  ItemDef,
  SceneDef,
} from '../types/adventure-v2';
import { SerializedGameState } from './SaveManager';

type SceneChangeCallback = (sceneId: string) => void;
type InventoryChangeCallback = (inventory: string[]) => void;
type WinCallback = () => void;
type InteractionCallback = (event: InteractionEvent) => void;

export class AdventureEngine {
  private readonly adventure: AdventureData;
  private state: GameState;

  private sceneChangeCallbacks: SceneChangeCallback[] = [];
  private inventoryChangeCallbacks: InventoryChangeCallback[] = [];
  private winCallbacks: WinCallback[] = [];
  private interactionCallbacks: InteractionCallback[] = [];

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

  /**
   * Restore the engine to a previously saved state.
   * Fires sceneChange and inventoryChange callbacks so the UI can react.
   */
  loadState(saved: SerializedGameState): void {
    this.state = {
      currentScene: saved.currentScene,
      inventory: [...saved.inventory],
      flags: new Set<string>(saved.flags),
      removedHotspots: new Set<string>(saved.removedHotspots),
    };

    this.notifySceneChange(this.state.currentScene);
    this.notifyInventoryChange();
  }

  getCurrentScene(): SceneDef {
    return this.adventure.scenes[this.state.currentScene];
  }

  getSceneDescription(): string | undefined {
    return this.getCurrentScene().description;
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

    if (withItem) {
      const match = hotspot.use.find(
        (u) => u.condition?.type === 'has' && u.condition.target === withItem
      );
      if (match) {
        this.executeActions(match.actions);
        this.notifyInteraction({
          verb: 'use',
          targetId: hotspotId,
          condition: match.condition
            ? { type: match.condition.type, target: match.condition.target, result: true }
            : undefined,
          actions: match.actions,
          text: match.text,
        });
        return { text: match.text, actions: match.actions };
      }
      return null;
    }

    if (hotspot.take) {
      this.executeActions(hotspot.take.actions);
      this.notifyInteraction({
        verb: 'take',
        targetId: hotspotId,
        actions: hotspot.take.actions,
        text: hotspot.take.text,
      });
      return { text: hotspot.take.text, actions: hotspot.take.actions };
    }

    const defaultUse = hotspot.use.find((u) => !u.condition);
    if (defaultUse) {
      this.executeActions(defaultUse.actions);
      this.notifyInteraction({
        verb: 'use',
        targetId: hotspotId,
        actions: defaultUse.actions,
        text: defaultUse.text,
      });
      return { text: defaultUse.text, actions: defaultUse.actions };
    }

    return null;
  }

  interactCharacter(characterId: string): InteractionResult | null {
    const character = this.getCharacter(characterId);
    if (!character) {
      return null;
    }

    for (const interaction of character.talk) {
      if (interaction.condition && this.evaluateCondition(interaction.condition)) {
        this.executeActions(interaction.actions);
        this.notifyInteraction({
          verb: 'talk',
          targetId: characterId,
          condition: {
            type: interaction.condition.type,
            target: interaction.condition.target,
            result: true,
          },
          actions: interaction.actions,
          text: interaction.text,
        });
        return { text: interaction.text, actions: interaction.actions };
      }
    }

    const defaultTalk = character.talk.find((t) => !t.condition);
    if (defaultTalk) {
      this.executeActions(defaultTalk.actions);
      this.notifyInteraction({
        verb: 'talk',
        targetId: characterId,
        actions: defaultTalk.actions,
        text: defaultTalk.text,
      });
      return { text: defaultTalk.text, actions: defaultTalk.actions };
    }

    return null;
  }

  lookAt(targetId: string): InteractionResult | null {
    const scene = this.getCurrentScene();

    const hotspot = scene.hotspots.find((h) => h.id === targetId);
    if (hotspot) {
      this.notifyInteraction({ verb: 'look', targetId, actions: [], text: hotspot.look });
      return { text: hotspot.look, actions: [] };
    }

    const character = scene.characters.find((c) => c.id === targetId);
    if (character) {
      this.notifyInteraction({ verb: 'look', targetId, actions: [], text: character.look });
      return { text: character.look, actions: [] };
    }

    const exit = scene.exits.find((e) => e.id === targetId);
    if (exit) {
      this.notifyInteraction({ verb: 'look', targetId, actions: [], text: exit.look });
      return { text: exit.look, actions: [] };
    }

    return null;
  }

  interactExit(exitId: string): InteractionResult | null {
    const exit = this.getExit(exitId);
    if (!exit) {
      return null;
    }

    if (exit.requires && !this.hasItem(exit.requires)) {
      const result = { text: exit.locked ?? 'You cannot go there yet.', actions: [] as Action[] };
      this.notifyInteraction({
        verb: 'exit',
        targetId: exitId,
        condition: { type: 'has', target: exit.requires, result: false },
        actions: result.actions,
        text: result.text,
      });
      return result;
    }

    const goAction: Action = { type: 'go', target: exit.target };
    this.executeActions([goAction]);
    this.notifyInteraction({
      verb: 'exit',
      targetId: exitId,
      actions: [goAction],
      text: exit.look,
    });
    return { text: exit.look, actions: [goAction] };
  }

  combineItems(itemA: string, itemB: string): InteractionResult | null {
    if (!this.hasItem(itemA) || !this.hasItem(itemB)) {
      return null;
    }

    const combinations: CombineDef[] = this.adventure.combinations ?? [];
    const match = combinations.find(
      (c) =>
        (c.itemA === itemA && c.itemB === itemB) ||
        (c.itemA === itemB && c.itemB === itemA)
    );

    if (!match) {
      return null;
    }

    this.executeActions(match.actions);
    this.notifyInteraction({
      verb: 'use',
      targetId: `${itemA}+${itemB}`,
      actions: match.actions,
      text: match.text,
    });
    return { text: match.text, actions: match.actions };
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

  onInteraction(callback: InteractionCallback): void {
    this.interactionCallbacks.push(callback);
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

  private notifyInteraction(event: InteractionEvent): void {
    for (const cb of this.interactionCallbacks) {
      cb(event);
    }
  }
}
