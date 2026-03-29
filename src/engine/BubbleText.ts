import Phaser from 'phaser';

const BUBBLE_DEPTH = 1500;
const BUBBLE_BG_COLOR = 0x1a1a2e;
const BUBBLE_BG_ALPHA = 0.9;
const BUBBLE_PADDING_X = 12;
const BUBBLE_PADDING_Y = 10;
const BUBBLE_CORNER_RADIUS = 8;
const BUBBLE_MAX_WIDTH = 250;
const BUBBLE_DEFAULT_DURATION = 3000;
const TEXT_COLOR = '#e0e0e0';
const TEXT_FONT_SIZE = '13px';
const TEXT_FONT_FAMILY = 'monospace';
const NAME_COLOR = '#f1c40f';

interface BubbleEntry {
  container: Phaser.GameObjects.Container;
  timer: Phaser.Time.TimerEvent;
}

export class BubbleText {
  private scene: Phaser.Scene;
  private activeBubbles: BubbleEntry[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  showBubble(x: number, y: number, text: string, duration?: number): void {
    const effectiveDuration = duration ?? BUBBLE_DEFAULT_DURATION;

    const textObject = this.scene.add.text(0, 0, text, {
      fontFamily: TEXT_FONT_FAMILY,
      fontSize: TEXT_FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2 },
    });

    const bgWidth = Math.min(textObject.width + BUBBLE_PADDING_X * 2, BUBBLE_MAX_WIDTH);
    const bgHeight = textObject.height + BUBBLE_PADDING_Y * 2;

    const background = this.scene.add.graphics();
    background.fillStyle(BUBBLE_BG_COLOR, BUBBLE_BG_ALPHA);
    background.fillRoundedRect(0, 0, bgWidth, bgHeight, BUBBLE_CORNER_RADIUS);

    textObject.setPosition(BUBBLE_PADDING_X, BUBBLE_PADDING_Y);

    const container = this.scene.add.container(x - bgWidth / 2, y - bgHeight, [
      background,
      textObject,
    ]);
    container.setDepth(BUBBLE_DEPTH);
    container.setSize(bgWidth, bgHeight);
    container.setInteractive();

    const entry: BubbleEntry = {
      container,
      timer: this.scene.time.addEvent({
        delay: effectiveDuration,
        callback: () => this.removeBubble(entry),
      }),
    };

    container.on('pointerdown', () => {
      this.removeBubble(entry);
    });

    this.activeBubbles.push(entry);
  }

  showNamedBubble(
    x: number,
    y: number,
    name: string,
    text: string,
    duration?: number
  ): void {
    const effectiveDuration = duration ?? BUBBLE_DEFAULT_DURATION;

    const nameObject = this.scene.add.text(0, 0, name, {
      fontFamily: TEXT_FONT_FAMILY,
      fontSize: TEXT_FONT_SIZE,
      color: NAME_COLOR,
      fontStyle: 'bold',
      wordWrap: { width: BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2 },
    });

    const textObject = this.scene.add.text(0, 0, text, {
      fontFamily: TEXT_FONT_FAMILY,
      fontSize: TEXT_FONT_SIZE,
      color: TEXT_COLOR,
      wordWrap: { width: BUBBLE_MAX_WIDTH - BUBBLE_PADDING_X * 2 },
    });

    const contentWidth = Math.max(nameObject.width, textObject.width);
    const bgWidth = Math.min(contentWidth + BUBBLE_PADDING_X * 2, BUBBLE_MAX_WIDTH);
    const nameHeight = nameObject.height;
    const gapBetween = 4;
    const bgHeight = BUBBLE_PADDING_Y + nameHeight + gapBetween + textObject.height + BUBBLE_PADDING_Y;

    const background = this.scene.add.graphics();
    background.fillStyle(BUBBLE_BG_COLOR, BUBBLE_BG_ALPHA);
    background.fillRoundedRect(0, 0, bgWidth, bgHeight, BUBBLE_CORNER_RADIUS);

    nameObject.setPosition(BUBBLE_PADDING_X, BUBBLE_PADDING_Y);
    textObject.setPosition(BUBBLE_PADDING_X, BUBBLE_PADDING_Y + nameHeight + gapBetween);

    const container = this.scene.add.container(x - bgWidth / 2, y - bgHeight, [
      background,
      nameObject,
      textObject,
    ]);
    container.setDepth(BUBBLE_DEPTH);
    container.setSize(bgWidth, bgHeight);
    container.setInteractive();

    const entry: BubbleEntry = {
      container,
      timer: this.scene.time.addEvent({
        delay: effectiveDuration,
        callback: () => this.removeBubble(entry),
      }),
    };

    container.on('pointerdown', () => {
      this.removeBubble(entry);
    });

    this.activeBubbles.push(entry);
  }

  clearAll(): void {
    const bubbles = [...this.activeBubbles];
    for (const entry of bubbles) {
      this.removeBubble(entry);
    }
  }

  private removeBubble(entry: BubbleEntry): void {
    const index = this.activeBubbles.indexOf(entry);
    if (index === -1) return;

    entry.timer.remove();
    entry.container.destroy();
    this.activeBubbles.splice(index, 1);
  }
}
