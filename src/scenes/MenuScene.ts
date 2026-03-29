import Phaser from "phaser";

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

  private buildDOM(): void {
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
      justify-content: center;
      font-family: monospace;
      color: #e0e0e0;
      background: rgba(26, 26, 46, 0.95);
    `;

    const title = document.createElement("h1");
    title.textContent = "VerbEngine";
    title.style.cssText = "font-size: 36px; margin: 0 0 8px 0; color: #fff; letter-spacing: 2px;";
    container.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = "Isometric point-and-click adventure engine";
    subtitle.style.cssText = "font-size: 14px; margin: 0 0 40px 0; color: #888;";
    container.appendChild(subtitle);

    const btnStyle = (bg: string) => `
      padding: 14px 36px; font-size: 16px; font-family: monospace;
      background: ${bg}; border: none; border-radius: 6px;
      color: #fff; cursor: pointer; margin: 6px;
    `;

    const adventureBtn = document.createElement("button");
    adventureBtn.textContent = "Play Adventure";
    adventureBtn.style.cssText = btnStyle("#9a4aff");
    adventureBtn.addEventListener("click", () => {
      this.removeDOM();
      this.scene.start("AdventureScene");
    });
    container.appendChild(adventureBtn);

    const isoBtn = document.createElement("button");
    isoBtn.textContent = "Iso Demo";
    isoBtn.style.cssText = btnStyle("#2a7a4a");
    isoBtn.addEventListener("click", () => {
      this.removeDOM();
      this.scene.start("IsoScene");
    });
    container.appendChild(isoBtn);

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
