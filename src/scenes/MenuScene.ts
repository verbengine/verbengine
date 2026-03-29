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
      top: 0;
      left: 0;
      width: ${canvas.width}px;
      height: ${canvas.height}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 40px 20px;
      box-sizing: border-box;
      font-family: monospace;
      color: #e0e0e0;
      background: rgba(26, 26, 46, 0.95);
      overflow-y: auto;
    `;

    // Title
    const title = document.createElement("h1");
    title.textContent = "VerbEngine";
    title.style.cssText = `
      font-size: 36px;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: 2px;
    `;
    container.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = "AI-powered point-and-click adventures";
    subtitle.style.cssText = `
      font-size: 14px;
      margin: 0 0 32px 0;
      color: #888;
    `;
    container.appendChild(subtitle);

    // Button section
    const buttonSection = document.createElement("div");
    buttonSection.style.cssText = `
      width: 100%;
      max-width: 560px;
      margin-bottom: 24px;
    `;

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
    `;

    const isoBtn = document.createElement("button");
    isoBtn.id = "menu-iso-btn";
    isoBtn.textContent = "Iso Demo";
    isoBtn.style.cssText = this.buttonStyle("#2a7a4a");
    buttonRow.appendChild(isoBtn);

    const adventureBtn = document.createElement("button");
    adventureBtn.id = "menu-adventure-btn";
    adventureBtn.textContent = "Play Adventure";
    adventureBtn.style.cssText = this.buttonStyle("#9a4aff");
    buttonRow.appendChild(adventureBtn);

    buttonSection.appendChild(buttonRow);
    container.appendChild(buttonSection);

    parent.style.position = "relative";
    parent.appendChild(container);
    this.container = container;

    // Event listeners
    isoBtn.addEventListener("click", () => this.navigateToIsoScene());
    adventureBtn.addEventListener("click", () => this.navigateToAdventureScene());
  }

  private buttonStyle(bgColor: string): string {
    return `
      padding: 10px 24px;
      font-size: 14px;
      font-family: monospace;
      background: ${bgColor};
      border: none;
      border-radius: 6px;
      color: #ffffff;
      cursor: pointer;
      transition: opacity 0.2s;
    `;
  }

  private navigateToIsoScene(): void {
    this.removeDOM();
    this.scene.start("IsoScene");
  }

  private navigateToAdventureScene(): void {
    this.removeDOM();
    this.scene.start("AdventureScene");
  }

  private removeDOM(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
