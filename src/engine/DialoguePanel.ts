import Phaser from 'phaser';

const PANEL_Y = 450;
const PANEL_HEIGHT = 150;
const PANEL_WIDTH = 960;
const PANEL_BG_COLOR = 0x1a1a2e;
const PANEL_BORDER_COLOR = 0x3a3a5e;
const PANEL_BORDER_WIDTH = 2;
const TEXT_COLOR = '#e0e0e0';
const TEXT_HIGHLIGHT_COLOR = '#ffffff';
const TEXT_FONT_SIZE = '16px';
const TEXT_FONT_FAMILY = 'monospace';
const TEXT_PADDING_X = 20;
const TEXT_PADDING_Y = 15;
const CHOICE_LINE_HEIGHT = 28;
const CHOICE_PREFIX = '> ';

export class DialoguePanel {
  private scene: Phaser.Scene;
  private background: Phaser.GameObjects.Rectangle;
  private border: Phaser.GameObjects.Rectangle;
  private narrativeText: Phaser.GameObjects.Text | null = null;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private choiceCallback: ((index: number) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.background = scene.add.rectangle(
      PANEL_WIDTH / 2,
      PANEL_Y + PANEL_HEIGHT / 2,
      PANEL_WIDTH,
      PANEL_HEIGHT,
      PANEL_BG_COLOR
    );
    this.background.setDepth(100);

    this.border = scene.add.rectangle(
      PANEL_WIDTH / 2,
      PANEL_Y,
      PANEL_WIDTH,
      PANEL_BORDER_WIDTH,
      PANEL_BORDER_COLOR
    );
    this.border.setDepth(101);
  }

  showText(text: string): void {
    this.clearContent();

    this.narrativeText = this.scene.add.text(
      TEXT_PADDING_X,
      PANEL_Y + TEXT_PADDING_Y,
      text,
      {
        fontFamily: TEXT_FONT_FAMILY,
        fontSize: TEXT_FONT_SIZE,
        color: TEXT_COLOR,
        wordWrap: { width: PANEL_WIDTH - TEXT_PADDING_X * 2 },
      }
    );
    this.narrativeText.setDepth(102);
  }

  showChoices(choices: string[]): void {
    this.clearChoices();

    choices.forEach((choice, index) => {
      const y = PANEL_Y + TEXT_PADDING_Y + index * CHOICE_LINE_HEIGHT;
      const choiceText = this.scene.add.text(
        TEXT_PADDING_X,
        y,
        `${CHOICE_PREFIX}${choice}`,
        {
          fontFamily: TEXT_FONT_FAMILY,
          fontSize: TEXT_FONT_SIZE,
          color: TEXT_COLOR,
          wordWrap: { width: PANEL_WIDTH - TEXT_PADDING_X * 2 },
        }
      );
      choiceText.setDepth(102);
      choiceText.setInteractive({ useHandCursor: true });

      choiceText.on('pointerover', () => {
        choiceText.setColor(TEXT_HIGHLIGHT_COLOR);
      });

      choiceText.on('pointerout', () => {
        choiceText.setColor(TEXT_COLOR);
      });

      choiceText.on('pointerdown', () => {
        if (this.choiceCallback) {
          this.choiceCallback(index);
        }
      });

      this.choiceTexts.push(choiceText);
    });
  }

  onChoiceSelected(callback: (index: number) => void): void {
    this.choiceCallback = callback;
  }

  clear(): void {
    this.clearContent();
  }

  private clearContent(): void {
    if (this.narrativeText) {
      this.narrativeText.destroy();
      this.narrativeText = null;
    }
    this.clearChoices();
  }

  private clearChoices(): void {
    for (const choiceText of this.choiceTexts) {
      choiceText.destroy();
    }
    this.choiceTexts = [];
  }
}
