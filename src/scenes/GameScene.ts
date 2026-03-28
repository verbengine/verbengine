import Phaser from 'phaser';
import { InkEngine } from '../engine/InkEngine';
import { SceneRenderer } from '../engine/SceneRenderer';
import { DialoguePanel } from '../engine/DialoguePanel';
import { InventoryBar } from '../engine/InventoryBar';
import {
  Adventure,
  SceneMetadata,
  SceneData,
  Exit,
} from '../types/adventure';

const NOTHING_HAPPENS = 'Nothing happens.';
const END_MESSAGE = 'The End.';

export interface GameSceneData {
  adventure: Adventure;
}

export interface GameLoopDeps {
  inkEngine: InkEngine;
  sceneMetadata: SceneMetadata;
  renderScene: (sceneData: SceneData) => void;
  clearScene: () => void;
  showText: (text: string) => void;
  showChoices: (choices: string[]) => void;
  addItem: (item: string) => void;
  removeItem: (item: string) => void;
  getSelectedItem: () => string | null;
  clearSelection: () => void;
  getInventoryItems: () => string[];
}

/**
 * Extracts the orchestration logic from GameScene for testability.
 * All Phaser-dependent rendering is delegated to the injected components.
 */
export class GameLoop {
  private inkEngine: InkEngine;
  private sceneMetadata: SceneMetadata;
  private currentSceneName: string;
  private currentChoices: Array<{ index: number; text: string }> = [];

  private renderSceneFn: (sceneData: SceneData) => void;
  private clearSceneFn: () => void;
  private showTextFn: (text: string) => void;
  private showChoicesFn: (choices: string[]) => void;
  private addItemFn: (item: string) => void;
  private removeItemFn: (item: string) => void;
  private getSelectedItemFn: () => string | null;
  private clearSelectionFn: () => void;
  private getInventoryItemsFn: () => string[];

  constructor(deps: GameLoopDeps) {
    this.inkEngine = deps.inkEngine;
    this.sceneMetadata = deps.sceneMetadata;
    this.currentSceneName = '';
    this.renderSceneFn = deps.renderScene;
    this.clearSceneFn = deps.clearScene;
    this.showTextFn = deps.showText;
    this.showChoicesFn = deps.showChoices;
    this.addItemFn = deps.addItem;
    this.removeItemFn = deps.removeItem;
    this.getSelectedItemFn = deps.getSelectedItem;
    this.clearSelectionFn = deps.clearSelection;
    this.getInventoryItemsFn = deps.getInventoryItems;
  }

  /**
   * Start the game: continue the ink story and render the first scene.
   */
  start(): void {
    const output = this.inkEngine.continueStory();
    this.processOutput(output.text, output.choices);
  }

  /**
   * Handle left-click on a hotspot or character.
   * Finds a matching Ink choice by ink_target and selects it.
   * If an inventory item is selected, looks for a use(item) choice instead.
   */
  handleInteraction(inkTarget: string): void {
    const selectedItem = this.getSelectedItemFn();

    if (selectedItem) {
      this.handleUseItem(selectedItem, inkTarget);
      return;
    }

    this.selectInkChoice(inkTarget);
  }

  /**
   * Handle right-click on a hotspot or character: show description.
   */
  handleLook(label: string, description?: string): void {
    const text = description ?? `You look at the ${label}.`;
    this.showTextFn(text);
  }

  /**
   * Handle left-click on an exit.
   * Checks requires condition via InkEngine variables, then advances the Ink
   * story to the target scene's knot before switching the visual scene.
   */
  handleExit(exit: Exit): void {
    if (exit.requires) {
      const value = this.inkEngine.getVariable(exit.requires);
      if (!value) {
        const itemName = exit.requires.replace(/^has_/, '');
        this.showTextFn(`You need ${itemName} to go there.`);
        return;
      }
    }

    const targetScene = exit.target_scene;
    const sceneData = this.sceneMetadata.scenes[targetScene];
    if (!sceneData) {
      this.showTextFn(NOTHING_HAPPENS);
      return;
    }

    // Find and select the Ink choice that navigates to the target scene.
    // Match by target_scene name appearing in the choice text.
    const matchIndex = this.findChoiceByTarget(targetScene, this.currentChoices);

    if (matchIndex !== -1) {
      this.inkEngine.chooseChoice(matchIndex);
      const result = this.inkEngine.continueStory();
      this.syncInventory();
      this.processOutput(result.text, result.choices);
    } else {
      // No matching Ink choice found — switch visually only as fallback
      this.switchScene(targetScene, sceneData);
    }
  }

  /**
   * Handle a dialogue choice selection from the DialoguePanel.
   */
  handleChoiceSelected(choiceIndex: number): void {
    this.inkEngine.chooseChoice(choiceIndex);
    const output = this.inkEngine.continueStory();
    this.syncInventory();
    this.processOutput(output.text, output.choices);
  }

  /**
   * Returns the current scene name for external queries.
   */
  getCurrentSceneName(): string {
    return this.currentSceneName;
  }

  /**
   * Returns current available choices (for testing).
   */
  getCurrentChoices(): Array<{ index: number; text: string }> {
    return this.currentChoices;
  }

  /**
   * Process story output: detect scene changes, show text/choices, sync inventory.
   */
  private processOutput(
    text: string,
    choices: Array<{ index: number; text: string }>
  ): void {
    this.currentChoices = choices;

    if (this.inkEngine.isEnded) {
      this.showTextFn(text ? `${text}\n\n${END_MESSAGE}` : END_MESSAGE);
      return;
    }

    const detectedScene = this.detectSceneFromTags();
    if (detectedScene && detectedScene !== this.currentSceneName) {
      const sceneData = this.sceneMetadata.scenes[detectedScene];
      if (sceneData) {
        this.switchScene(detectedScene, sceneData);
      }
    }

    if (text) {
      this.showTextFn(text);
    }

    if (choices.length > 0) {
      this.showChoicesFn(choices.map((c) => c.text));
    }

    this.syncInventory();
  }

  /**
   * Detect scene name from Ink tags, or as a fallback, from the available
   * choices matching a scene's hotspot/character ink_targets or exit targets.
   */
  private detectSceneFromTags(): string | null {
    // Primary: match by Ink tags
    const tags = this.inkEngine.getCurrentTags();
    for (const tag of tags) {
      if (this.sceneMetadata.scenes[tag]) {
        return tag;
      }
    }

    // Fallback: match by choice text containing scene-specific ink_targets
    return this.detectSceneFromChoices();
  }

  /**
   * Detect the current scene by matching available choices against
   * hotspot/character ink_targets and exit target_scenes defined in metadata.
   * Returns the scene with the most matches, or null if none found.
   */
  private detectSceneFromChoices(): string | null {
    const choiceTexts = this.currentChoices.map((c) => c.text.toLowerCase());
    if (choiceTexts.length === 0) return null;

    let bestScene: string | null = null;
    let bestScore = 0;

    for (const [sceneName, sceneData] of Object.entries(this.sceneMetadata.scenes)) {
      let score = 0;

      for (const hotspot of sceneData.hotspots) {
        const target = hotspot.ink_target.replace(/_/g, ' ').toLowerCase();
        const label = hotspot.label.toLowerCase();
        const labelWords = label.split(/\s+/).filter((w) => w.length >= 4);
        if (choiceTexts.some((ct) =>
          ct.includes(target) ||
          ct.includes(hotspot.ink_target.toLowerCase()) ||
          ct.includes(label) ||
          labelWords.some((w) => ct.includes(w))
        )) {
          score++;
        }
      }

      for (const character of sceneData.characters) {
        const target = character.ink_target.replace(/_/g, ' ').toLowerCase();
        const label = character.label.toLowerCase();
        const labelWords = label.split(/\s+/).filter((w) => w.length >= 4);
        if (choiceTexts.some((ct) =>
          ct.includes(target) ||
          ct.includes(character.ink_target.toLowerCase()) ||
          ct.includes(label) ||
          labelWords.some((w) => ct.includes(w))
        )) {
          score++;
        }
      }

      for (const exit of sceneData.exits) {
        if (choiceTexts.some((ct) => ct.includes(exit.target_scene.toLowerCase()))) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestScene = sceneName;
      }
    }

    return bestScene;
  }

  /**
   * Switch visual scene: clear old, render new.
   */
  private switchScene(sceneName: string, sceneData: SceneData): void {
    this.currentSceneName = sceneName;
    this.clearSceneFn();
    this.renderSceneFn(sceneData);
  }

  /**
   * Find an Ink choice whose text contains the ink_target and select it.
   * Uses the tracked currentChoices rather than calling continueStory again.
   */
  private selectInkChoice(inkTarget: string): void {
    const matchIndex = this.findChoiceByTarget(inkTarget, this.currentChoices);

    if (matchIndex === -1) {
      this.showTextFn(NOTHING_HAPPENS);
      return;
    }

    this.inkEngine.chooseChoice(matchIndex);
    const result = this.inkEngine.continueStory();
    this.syncInventory();
    this.processOutput(result.text, result.choices);
  }

  /**
   * Try to use an inventory item on a target.
   * Looks for a choice containing use(item) or the item name + target.
   */
  private handleUseItem(item: string, inkTarget: string): void {
    this.clearSelectionFn();

    const usePattern = `use(${item})`;
    const matchIndex = this.currentChoices.findIndex(
      (c) =>
        c.text.toLowerCase().includes(usePattern.toLowerCase()) ||
        (c.text.toLowerCase().includes(item.toLowerCase()) &&
          c.text.toLowerCase().includes(inkTarget.toLowerCase()))
    );

    if (matchIndex === -1) {
      this.showTextFn(`You can't use ${item} here.`);
      return;
    }

    this.inkEngine.chooseChoice(matchIndex);
    const result = this.inkEngine.continueStory();
    this.syncInventory();
    this.processOutput(result.text, result.choices);
  }

  /**
   * Find a choice index whose text matches the ink_target.
   */
  private findChoiceByTarget(
    inkTarget: string,
    choices: Array<{ index: number; text: string }>
  ): number {
    const exact = choices.find(
      (c) => c.text.toLowerCase() === inkTarget.toLowerCase()
    );
    if (exact) return exact.index;

    const partial = choices.find((c) =>
      c.text.toLowerCase().includes(inkTarget.toLowerCase())
    );
    if (partial) return partial.index;

    const normalized = inkTarget.replace(/_/g, ' ').toLowerCase();
    const normalizedMatch = choices.find((c) =>
      c.text.toLowerCase().includes(normalized)
    );
    if (normalizedMatch) return normalizedMatch.index;

    // Try matching just the suffix after the scene prefix (e.g. "beach_ship" -> "ship")
    const underscoreIdx = inkTarget.indexOf('_');
    if (underscoreIdx !== -1) {
      const suffix = inkTarget.slice(underscoreIdx + 1).replace(/_/g, ' ').toLowerCase();
      const suffixMatch = choices.find((c) =>
        c.text.toLowerCase().includes(suffix)
      );
      if (suffixMatch) return suffixMatch.index;
    }

    return -1;
  }

  /**
   * Scan Ink variables for has_* pattern and sync inventory.
   * Items with has_<item>=true are added; false are removed.
   */
  private syncInventory(): void {
    const currentItems = this.getInventoryItemsFn();
    const sceneNames = Object.keys(this.sceneMetadata.scenes);

    const possibleItems = new Set<string>();
    for (const sceneName of sceneNames) {
      const scene = this.sceneMetadata.scenes[sceneName];
      for (const hotspot of scene.hotspots) {
        possibleItems.add(hotspot.id);
      }
    }

    for (const itemId of possibleItems) {
      const varName = `has_${itemId}`;
      const value = this.inkEngine.getVariable(varName);
      if (value === true && !currentItems.includes(itemId)) {
        this.addItemFn(itemId);
      } else if (value === false && currentItems.includes(itemId)) {
        this.removeItemFn(itemId);
      }
    }
  }
}

/**
 * GameScene — main Phaser scene that orchestrates the adventure gameplay.
 * Integrates InkEngine, SceneRenderer, DialoguePanel, and InventoryBar.
 */
export class GameScene extends Phaser.Scene {
  private gameLoop: GameLoop | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    const { adventure } = data;

    const inkEngine = new InkEngine();
    inkEngine.loadStory(adventure.ink_script);

    const sceneRenderer = new SceneRenderer(this);
    const dialoguePanel = new DialoguePanel(this);
    const inventoryBar = new InventoryBar(this);

    // Enable right-click
    this.input.mouse?.disableContextMenu();

    this.gameLoop = new GameLoop({
      inkEngine,
      sceneMetadata: adventure.scene_metadata,
      renderScene: (sceneData) => sceneRenderer.renderScene(sceneData),
      clearScene: () => sceneRenderer.clearScene(),
      showText: (text) => dialoguePanel.showText(text),
      showChoices: (choices) => dialoguePanel.showChoices(choices),
      addItem: (item) => inventoryBar.addItem(item),
      removeItem: (item) => inventoryBar.removeItem(item),
      getSelectedItem: () => inventoryBar.getSelectedItem(),
      clearSelection: () => inventoryBar.clearSelection(),
      getInventoryItems: () => inventoryBar.getItems(),
    });

    // Wire up click handlers
    sceneRenderer.onHotspotClick((hotspot) => {
      this.gameLoop?.handleInteraction(hotspot.ink_target);
    });

    sceneRenderer.onCharacterClick((character) => {
      this.gameLoop?.handleInteraction(character.ink_target);
    });

    sceneRenderer.onHotspotRightClick((hotspot) => {
      this.gameLoop?.handleLook(hotspot.label);
    });

    sceneRenderer.onCharacterRightClick((character) => {
      this.gameLoop?.handleLook(character.label);
    });

    sceneRenderer.onExitClick((exit) => {
      this.gameLoop?.handleExit(exit);
    });

    dialoguePanel.onChoiceSelected((index) => {
      this.gameLoop?.handleChoiceSelected(index);
    });
  }

  create(): void {
    this.gameLoop?.start();
  }
}
