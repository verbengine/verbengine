import Phaser from 'phaser';

const BAR_HEIGHT = 40;
const BAR_WIDTH = 960;
const BAR_Y = 0;
const BAR_COLOR = 0x1a1a2e;
const ITEM_FONT_SIZE = '16px';
const ITEM_COLOR = '#ffffff';
const ITEM_SELECTED_COLOR = '#f1c40f';
const ITEM_PADDING = 16;
const ITEM_START_X = 12;

interface InventoryEntry {
  text: Phaser.GameObjects.Text;
  item: string;
}

export class InventoryBar {
  private scene: Phaser.Scene;
  private background: Phaser.GameObjects.Rectangle;
  private entries: InventoryEntry[] = [];
  private selectedItem: string | null = null;
  private selectionCallback: ((item: string | null) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.background = scene.add
      .rectangle(BAR_WIDTH / 2, BAR_Y + BAR_HEIGHT / 2, BAR_WIDTH, BAR_HEIGHT, BAR_COLOR)
      .setDepth(100)
      .setScrollFactor(0);
  }

  addItem(item: string): void {
    const existing = this.entries.find((e) => e.item === item);
    if (existing) {
      return;
    }

    const x = this.getNextX();
    const text = this.scene.add
      .text(x, BAR_Y + BAR_HEIGHT / 2, item, {
        fontSize: ITEM_FONT_SIZE,
        color: ITEM_COLOR,
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5)
      .setDepth(101)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    text.on('pointerdown', () => {
      this.handleItemClick(item);
    });

    this.entries.push({ text, item });
  }

  removeItem(item: string): void {
    const index = this.entries.findIndex((e) => e.item === item);
    if (index === -1) {
      return;
    }

    if (this.selectedItem === item) {
      this.clearSelection();
    }

    this.entries[index].text.destroy();
    this.entries.splice(index, 1);
    this.repositionItems();
  }

  getSelectedItem(): string | null {
    return this.selectedItem;
  }

  clearSelection(): void {
    if (this.selectedItem !== null) {
      const entry = this.entries.find((e) => e.item === this.selectedItem);
      if (entry) {
        entry.text.setColor(ITEM_COLOR);
      }
      this.selectedItem = null;
      this.notifySelectionChange();
    }
  }

  getItems(): string[] {
    return this.entries.map((e) => e.item);
  }

  onItemSelected(callback: (item: string | null) => void): void {
    this.selectionCallback = callback;
  }

  private handleItemClick(item: string): void {
    if (this.selectedItem === item) {
      this.clearSelection();
    } else {
      // Deselect previous
      if (this.selectedItem !== null) {
        const prev = this.entries.find((e) => e.item === this.selectedItem);
        if (prev) {
          prev.text.setColor(ITEM_COLOR);
        }
      }

      this.selectedItem = item;
      const entry = this.entries.find((e) => e.item === item);
      if (entry) {
        entry.text.setColor(ITEM_SELECTED_COLOR);
      }
      this.notifySelectionChange();
    }
  }

  private notifySelectionChange(): void {
    if (this.selectionCallback) {
      this.selectionCallback(this.selectedItem);
    }
  }

  private getNextX(): number {
    if (this.entries.length === 0) {
      return ITEM_START_X;
    }

    const last = this.entries[this.entries.length - 1];
    return last.text.x + last.text.width + ITEM_PADDING;
  }

  private repositionItems(): void {
    let x = ITEM_START_X;
    for (const entry of this.entries) {
      entry.text.setX(x);
      x += entry.text.width + ITEM_PADDING;
    }
  }
}
