import Phaser from "phaser";
import { loadAdventure } from "./adventure-loader";

export class BootScene extends Phaser.Scene {
  private loadingText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: "BootScene" });
  }

  create(): void {
    this.loadingText = this.add
      .text(480, 300, "Loading adventure...", {
        fontSize: "24px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.boot();
  }

  private async boot(): Promise<void> {
    try {
      const adventure = await loadAdventure();
      this.scene.start("GameScene", { adventure });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      this.showError(message);
    }
  }

  private showError(message: string): void {
    if (this.loadingText) {
      this.loadingText.destroy();
      this.loadingText = null;
    }

    this.add
      .text(480, 280, `Error: ${message}`, {
        fontSize: "18px",
        color: "#ff4444",
        fontFamily: "monospace",
        wordWrap: { width: 700 },
      })
      .setOrigin(0.5);

    this.add
      .text(480, 340, "Press any key to retry", {
        fontSize: "16px",
        color: "#aaaaaa",
        fontFamily: "monospace",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown", () => {
      this.scene.restart();
    });
  }
}
