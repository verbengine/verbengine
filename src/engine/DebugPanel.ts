import Phaser from 'phaser';
import { AdventureEngine } from './AdventureEngine';
import type { InteractionEvent } from '../types/adventure-v2';

const PANEL_WIDTH = 300;
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.8;
const TEXT_COLOR = '#00ff00';
const FONT_SIZE = '12px';
const FONT_FAMILY = 'Courier, monospace';
const PADDING = 10;
const DEPTH = 9999;

export class DebugPanel {
  private readonly scene: Phaser.Scene;
  private readonly engine: AdventureEngine;
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly debugText: Phaser.GameObjects.Text;
  private lastInteraction: InteractionEvent | null = null;

  constructor(scene: Phaser.Scene, engine: AdventureEngine) {
    this.scene = scene;
    this.engine = engine;

    const { width, height } = scene.scale;

    this.container = scene.add.container(width - PANEL_WIDTH, 0);
    this.container.setDepth(DEPTH);
    this.container.setScrollFactor(0);

    this.bg = scene.add.rectangle(PANEL_WIDTH / 2, height / 2, PANEL_WIDTH, height, BG_COLOR);
    this.bg.setOrigin(0.5, 0.5);
    this.bg.setAlpha(BG_ALPHA);

    this.debugText = scene.add.text(PADDING, PADDING, '', {
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: PANEL_WIDTH - PADDING * 2 },
    });
    this.debugText.setOrigin(0, 0);

    this.container.add([this.bg, this.debugText]);
    this.container.setVisible(false);

    engine.onSceneChange(() => this.refresh());
    engine.onInventoryChange(() => this.refresh());
    engine.onInteraction((event: InteractionEvent) => {
      this.lastInteraction = event;
      this.refresh();
    });
  }

  toggle(): void {
    const newVisible = !this.container.visible;
    this.container.setVisible(newVisible);
    if (newVisible) {
      this.refresh();
    }
  }

  refresh(): void {
    this.debugText.setText(this.buildDebugText());
  }

  buildDebugText(): string {
    const state = this.engine.getState();
    const currentScene = this.engine.getCurrentScene();
    const lines: string[] = [];

    lines.push(`== SCENE: ${currentScene.id} ==`);
    lines.push('');
    if (currentScene.hotspots.length > 0) {
      lines.push('Hotspots:');
      for (const h of currentScene.hotspots) {
        const removed = state.removedHotspots.has(h.id) ? ' [REMOVED]' : '';
        lines.push(`  ${h.id} [${h.position[0]},${h.position[1]}]${removed}`);
      }
    }
    if (currentScene.characters.length > 0) {
      lines.push('Characters:');
      for (const c of currentScene.characters) {
        lines.push(`  ${c.id} [${c.position[0]},${c.position[1]}]`);
      }
    }
    if (currentScene.exits.length > 0) {
      lines.push('Exits:');
      for (const e of currentScene.exits) {
        lines.push(`  ${e.id} [${e.position[0]},${e.position[1]}] -> ${e.target}`);
      }
    }

    lines.push('');
    lines.push('== INVENTORY ==');
    if (state.inventory.length === 0) {
      lines.push('  (empty)');
    } else {
      for (const itemId of state.inventory) {
        const item = this.engine.getItem(itemId);
        const name = item ? item.name : '?';
        lines.push(`  ${itemId} (${name})`);
      }
    }

    lines.push('');
    lines.push('== FLAGS ==');
    if (state.flags.size === 0) {
      lines.push('  (none)');
    } else {
      for (const flag of state.flags) {
        lines.push(`  ${flag}`);
      }
    }

    lines.push('');
    lines.push('== REMOVED HOTSPOTS ==');
    if (state.removedHotspots.size === 0) {
      lines.push('  (none)');
    } else {
      for (const id of state.removedHotspots) {
        lines.push(`  ${id}`);
      }
    }

    lines.push('');
    lines.push('== LAST INTERACTION ==');
    if (!this.lastInteraction) {
      lines.push('  (no interactions yet)');
    } else {
      const ev = this.lastInteraction;
      lines.push(`  verb: ${ev.verb}`);
      lines.push(`  target: ${ev.targetId}`);
      if (ev.condition) {
        lines.push(`  condition: ${ev.condition.type}(${ev.condition.target}) = ${ev.condition.result}`);
      }
      if (ev.actions.length > 0) {
        lines.push('  actions:');
        for (const a of ev.actions) {
          lines.push(`    ${a.type}${a.target ? `(${a.target})` : ''}`);
        }
      }
      if (ev.text) {
        lines.push(`  text: "${ev.text}"`);
      }
    }

    return lines.join('\n');
  }

  destroy(): void {
    this.container.destroy();
  }
}
