import Phaser from "phaser";

interface GameEntry {
  id: string;
  title: string;
  color: string;
  verb?: string;
  scene?: string;
}

export class MenuScene extends Phaser.Scene {
  private container: HTMLDivElement | null = null;

  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    this.buildDOM();
  }

  shutdown(): void {
    this.removeDOM();
  }

  private async buildDOM(): Promise<void> {
    this.removeDOM();

    const canvas = this.game.canvas;
    const parent = canvas.parentElement ?? document.body;

    const container = document.createElement("div");
    container.id = "menu-scene";
    container.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: monospace;
      color: #e0e0e0;
      background: rgba(26, 26, 46, 0.97);
      overflow-y: auto;
    `;

    const header = document.createElement("div");
    header.style.cssText = "text-align: center; padding: 30px 0 20px 0;";

    const title = document.createElement("h1");
    title.textContent = "VerbEngine";
    title.style.cssText = "font-size: 32px; margin: 0 0 6px 0; color: #fff; letter-spacing: 2px;";
    header.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = "Choose your adventure";
    subtitle.style.cssText = "font-size: 13px; margin: 0; color: #888;";
    header.appendChild(subtitle);

    container.appendChild(header);

    const grid = document.createElement("div");
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 12px;
      padding: 10px 24px 30px 24px;
      max-width: 600px;
      width: 100%;
    `;

    let games: GameEntry[] = [];
    try {
      const response = await fetch("/games.json");
      games = await response.json();
    } catch {
      games = [
        { id: "missing-usb", title: "The Missing USB", color: "#9a4aff", verb: "/dsl/examples/missing-usb/adventure.verb" },
      ];
    }

    for (const game of games) {
      const card = document.createElement("div");
      card.style.cssText = `
        background: ${game.color};
        border-radius: 8px;
        padding: 16px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        min-height: 100px;
        transition: transform 0.15s, box-shadow 0.15s;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;

      const label = document.createElement("span");
      label.textContent = game.title;
      label.style.cssText = "font-size: 13px; font-weight: bold; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,0.5);";
      card.appendChild(label);

      card.addEventListener("mouseenter", () => {
        card.style.transform = "scale(1.06)";
        card.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)";
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "scale(1)";
        card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      });

      card.addEventListener("click", () => {
        this.removeDOM();
        if (game.scene) {
          this.scene.start(game.scene);
        } else if (game.verb) {
          this.scene.start("AdventureScene", { verbFilePath: game.verb });
        }
      });

      grid.appendChild(card);
    }

    container.appendChild(grid);
    parent.style.position = "relative";
    parent.appendChild(container);
    this.container = container;
  }

  private removeDOM(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
