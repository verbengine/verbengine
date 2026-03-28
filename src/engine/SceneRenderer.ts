import Phaser from 'phaser';
import { SceneData, Hotspot, Character, Exit } from '../types/adventure';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 600;
const CHARACTER_RADIUS = 24;
const CHARACTER_COLOR = 0xe67e22;
const HOTSPOT_BORDER_COLOR = 0xffffff;
const HOTSPOT_BORDER_ALPHA = 0.3;
const HOTSPOT_FILL_ALPHA = 0.1;
const HOVER_ALPHA = 0.7;
const EXIT_FONT_SIZE = '28px';
const LABEL_FONT_SIZE = '14px';
const LABEL_COLOR = '#ffffff';

interface ExitArrow {
  direction: string;
  label: string;
}

const EXIT_ARROWS: Record<string, ExitArrow> = {
  north: { direction: 'north', label: '\u2191 EXIT' },
  south: { direction: 'south', label: '\u2193 EXIT' },
  east: { direction: 'east', label: 'EXIT \u2192' },
  west: { direction: 'west', label: '\u2190 EXIT' },
};

export function toCanvasX(normalized: number): number {
  return normalized * CANVAS_WIDTH;
}

export function toCanvasY(normalized: number): number {
  return normalized * CANVAS_HEIGHT;
}

export function toCanvasWidth(normalized: number): number {
  return normalized * CANVAS_WIDTH;
}

export function toCanvasHeight(normalized: number): number {
  return normalized * CANVAS_HEIGHT;
}

type HotspotClickCallback = (hotspot: Hotspot) => void;
type CharacterClickCallback = (character: Character) => void;
type ExitClickCallback = (exit: Exit) => void;

export class SceneRenderer {
  private scene: Phaser.Scene;
  private gameObjects: Phaser.GameObjects.GameObject[] = [];

  private hotspotClickCallbacks: HotspotClickCallback[] = [];
  private characterClickCallbacks: CharacterClickCallback[] = [];
  private exitClickCallbacks: ExitClickCallback[] = [];
  private hotspotRightClickCallbacks: HotspotClickCallback[] = [];
  private characterRightClickCallbacks: CharacterClickCallback[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  renderScene(sceneData: SceneData): void {
    this.clearScene();

    this.renderBackground(sceneData.background_color);

    for (const hotspot of sceneData.hotspots) {
      this.renderHotspot(hotspot);
    }

    for (const character of sceneData.characters) {
      this.renderCharacter(character);
    }

    for (const exit of sceneData.exits) {
      this.renderExit(exit);
    }
  }

  clearScene(): void {
    for (const obj of this.gameObjects) {
      obj.destroy();
    }
    this.gameObjects = [];
  }

  onHotspotClick(callback: HotspotClickCallback): void {
    this.hotspotClickCallbacks.push(callback);
  }

  onCharacterClick(callback: CharacterClickCallback): void {
    this.characterClickCallbacks.push(callback);
  }

  onExitClick(callback: ExitClickCallback): void {
    this.exitClickCallbacks.push(callback);
  }

  onHotspotRightClick(callback: HotspotClickCallback): void {
    this.hotspotRightClickCallbacks.push(callback);
  }

  onCharacterRightClick(callback: CharacterClickCallback): void {
    this.characterRightClickCallbacks.push(callback);
  }

  private renderBackground(color: string): void {
    const hex = Phaser.Display.Color.HexStringToColor(color).color;
    const bg = this.scene.add.rectangle(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT / 2,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      hex,
    );
    bg.setDepth(0);
    this.gameObjects.push(bg);
  }

  private renderHotspot(hotspot: Hotspot): void {
    const x = toCanvasX(hotspot.x);
    const y = toCanvasY(hotspot.y);
    const w = toCanvasWidth(hotspot.width);
    const h = toCanvasHeight(hotspot.height);

    const rect = this.scene.add.rectangle(x, y, w, h);
    rect.setStrokeStyle(2, HOTSPOT_BORDER_COLOR, HOTSPOT_BORDER_ALPHA);
    rect.setFillStyle(HOTSPOT_BORDER_COLOR, HOTSPOT_FILL_ALPHA);
    rect.setDepth(10);
    rect.setInteractive({ useHandCursor: true });

    rect.on('pointerover', () => {
      rect.setAlpha(HOVER_ALPHA);
    });
    rect.on('pointerout', () => {
      rect.setAlpha(1);
    });
    rect.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        for (const cb of this.hotspotRightClickCallbacks) {
          cb(hotspot);
        }
      } else {
        for (const cb of this.hotspotClickCallbacks) {
          cb(hotspot);
        }
      }
    });

    const label = this.scene.add.text(x, y - h / 2 - 12, hotspot.label, {
      fontSize: LABEL_FONT_SIZE,
      color: LABEL_COLOR,
    });
    label.setOrigin(0.5, 1);
    label.setDepth(11);

    this.gameObjects.push(rect, label);
  }

  private renderCharacter(character: Character): void {
    const x = toCanvasX(character.x);
    const y = toCanvasY(character.y);

    const circle = this.scene.add.circle(x, y, CHARACTER_RADIUS, CHARACTER_COLOR);
    circle.setDepth(10);
    circle.setInteractive(
      new Phaser.Geom.Circle(0, 0, CHARACTER_RADIUS),
      Phaser.Geom.Circle.Contains,
    );
    circle.input!.cursor = 'pointer';

    circle.on('pointerover', () => {
      circle.setAlpha(HOVER_ALPHA);
    });
    circle.on('pointerout', () => {
      circle.setAlpha(1);
    });
    circle.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        for (const cb of this.characterRightClickCallbacks) {
          cb(character);
        }
      } else {
        for (const cb of this.characterClickCallbacks) {
          cb(character);
        }
      }
    });

    const label = this.scene.add.text(x, y - CHARACTER_RADIUS - 8, character.label, {
      fontSize: LABEL_FONT_SIZE,
      color: LABEL_COLOR,
    });
    label.setOrigin(0.5, 1);
    label.setDepth(11);

    this.gameObjects.push(circle, label);
  }

  private renderExit(exit: Exit): void {
    const x = toCanvasX(exit.x);
    const y = toCanvasY(exit.y);
    const arrow = EXIT_ARROWS[exit.direction];
    if (!arrow) return;

    const text = this.scene.add.text(x, y, arrow.label, {
      fontSize: EXIT_FONT_SIZE,
      color: LABEL_COLOR,
      fontStyle: 'bold',
    });
    text.setOrigin(0.5, 0.5);
    text.setDepth(12);
    text.setInteractive({ useHandCursor: true });

    text.on('pointerover', () => {
      text.setAlpha(HOVER_ALPHA);
    });
    text.on('pointerout', () => {
      text.setAlpha(1);
    });
    text.on('pointerdown', () => {
      for (const cb of this.exitClickCallbacks) {
        cb(exit);
      }
    });

    this.gameObjects.push(text);
  }
}
