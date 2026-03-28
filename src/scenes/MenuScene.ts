import Phaser from "phaser";
import { createAdventure, listAdventures } from "../api/fyso";
import type { Adventure } from "../types/adventure";

type MenuState = "idle" | "loading" | "error";

export class MenuScene extends Phaser.Scene {
  private container: HTMLDivElement | null = null;
  private state: MenuState = "idle";
  private adventures: Adventure[] = [];
  private errorMessage = "";

  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    this.state = "idle";
    this.adventures = [];
    this.errorMessage = "";
    this.buildDOM();
    this.fetchAdventures();
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

    // Prompt input section
    const promptSection = document.createElement("div");
    promptSection.style.cssText = `
      width: 100%;
      max-width: 560px;
      margin-bottom: 24px;
    `;

    const promptInput = document.createElement("input");
    promptInput.id = "menu-prompt-input";
    promptInput.type = "text";
    promptInput.placeholder = "Describe your adventure...";
    promptInput.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      font-size: 16px;
      font-family: monospace;
      background: #2a2a3e;
      border: 1px solid #444;
      border-radius: 6px;
      color: #e0e0e0;
      outline: none;
      box-sizing: border-box;
      margin-bottom: 12px;
    `;
    promptSection.appendChild(promptInput);

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = `
      display: flex;
      gap: 12px;
    `;

    const generateBtn = document.createElement("button");
    generateBtn.id = "menu-generate-btn";
    generateBtn.textContent = "Generate";
    generateBtn.style.cssText = this.buttonStyle("#4a9eff");
    buttonRow.appendChild(generateBtn);

    const exampleBtn = document.createElement("button");
    exampleBtn.id = "menu-example-btn";
    exampleBtn.textContent = "Play Example";
    exampleBtn.style.cssText = this.buttonStyle("#666");
    buttonRow.appendChild(exampleBtn);

    promptSection.appendChild(buttonRow);

    // Status text (loading / error)
    const statusText = document.createElement("p");
    statusText.id = "menu-status";
    statusText.style.cssText = `
      font-size: 14px;
      margin: 12px 0 0 0;
      min-height: 20px;
      color: #888;
    `;
    promptSection.appendChild(statusText);

    // Retry button (hidden by default)
    const retryBtn = document.createElement("button");
    retryBtn.id = "menu-retry-btn";
    retryBtn.textContent = "Retry";
    retryBtn.style.cssText = this.buttonStyle("#cc4444");
    retryBtn.style.display = "none";
    retryBtn.style.marginTop = "8px";
    promptSection.appendChild(retryBtn);

    container.appendChild(promptSection);

    // Adventure list section
    const listSection = document.createElement("div");
    listSection.id = "menu-adventure-list";
    listSection.style.cssText = `
      width: 100%;
      max-width: 560px;
    `;

    const listTitle = document.createElement("h2");
    listTitle.textContent = "Your Adventures";
    listTitle.style.cssText = `
      font-size: 18px;
      margin: 0 0 12px 0;
      color: #ccc;
    `;
    listSection.appendChild(listTitle);

    const listContainer = document.createElement("div");
    listContainer.id = "menu-adventures-container";
    listSection.appendChild(listContainer);

    container.appendChild(listSection);

    parent.style.position = "relative";
    parent.appendChild(container);
    this.container = container;

    // Event listeners
    generateBtn.addEventListener("click", () => this.handleGenerate(promptInput.value));
    promptInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        this.handleGenerate(promptInput.value);
      }
    });
    exampleBtn.addEventListener("click", () => this.navigateToBootScene());
    retryBtn.addEventListener("click", () => this.handleGenerate(promptInput.value));
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

  private updateStatus(): void {
    if (!this.container) return;

    const statusEl = this.container.querySelector<HTMLParagraphElement>("#menu-status");
    const generateBtn = this.container.querySelector<HTMLButtonElement>("#menu-generate-btn");
    const promptInput = this.container.querySelector<HTMLInputElement>("#menu-prompt-input");
    const retryBtn = this.container.querySelector<HTMLButtonElement>("#menu-retry-btn");

    if (!statusEl || !generateBtn || !promptInput || !retryBtn) return;

    switch (this.state) {
      case "idle":
        statusEl.textContent = "";
        statusEl.style.color = "#888";
        generateBtn.disabled = false;
        generateBtn.style.opacity = "1";
        promptInput.disabled = false;
        retryBtn.style.display = "none";
        break;
      case "loading":
        statusEl.textContent = "Generating adventure...";
        statusEl.style.color = "#4a9eff";
        generateBtn.disabled = true;
        generateBtn.style.opacity = "0.5";
        promptInput.disabled = true;
        retryBtn.style.display = "none";
        break;
      case "error":
        statusEl.textContent = this.errorMessage;
        statusEl.style.color = "#cc4444";
        generateBtn.disabled = false;
        generateBtn.style.opacity = "1";
        promptInput.disabled = false;
        retryBtn.style.display = "inline-block";
        break;
    }
  }

  private async handleGenerate(prompt: string): Promise<void> {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if (this.state === "loading") return;

    this.state = "loading";
    this.updateStatus();

    try {
      const adventure = await createAdventure(trimmed, 3);
      this.navigateToBootScene(adventure.id);
    } catch (err: unknown) {
      this.state = "error";
      this.errorMessage =
        err instanceof Error ? err.message : "Failed to generate adventure";
      this.updateStatus();
    }
  }

  private async fetchAdventures(): Promise<void> {
    try {
      this.adventures = await listAdventures();
      this.renderAdventureList();
    } catch {
      // Silently ignore list fetch errors — the list is optional
    }
  }

  private renderAdventureList(): void {
    if (!this.container) return;

    const listContainer = this.container.querySelector<HTMLDivElement>(
      "#menu-adventures-container"
    );
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (this.adventures.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No adventures yet. Generate one above!";
      empty.style.cssText = "color: #666; font-size: 13px;";
      listContainer.appendChild(empty);
      return;
    }

    for (const adventure of this.adventures) {
      const item = document.createElement("div");
      item.className = "menu-adventure-item";
      item.dataset.adventureId = adventure.id;
      item.style.cssText = `
        padding: 12px 16px;
        margin-bottom: 8px;
        background: #2a2a3e;
        border: 1px solid #333;
        border-radius: 6px;
        cursor: pointer;
        transition: border-color 0.2s;
      `;

      const itemTitle = document.createElement("div");
      itemTitle.textContent = adventure.title || "Untitled Adventure";
      itemTitle.style.cssText = "font-size: 15px; color: #e0e0e0; margin-bottom: 4px;";
      item.appendChild(itemTitle);

      const itemPrompt = document.createElement("div");
      itemPrompt.textContent = adventure.prompt;
      itemPrompt.style.cssText = `
        font-size: 12px;
        color: #888;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      `;
      item.appendChild(itemPrompt);

      const statusBadge = document.createElement("span");
      statusBadge.textContent = adventure.status;
      statusBadge.style.cssText = `
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        margin-top: 4px;
        display: inline-block;
        background: ${adventure.status === "ready" ? "#2d5a27" : adventure.status === "generating" ? "#5a4a27" : "#5a2727"};
        color: ${adventure.status === "ready" ? "#7bc67b" : adventure.status === "generating" ? "#c6b67b" : "#c67b7b"};
      `;
      item.appendChild(statusBadge);

      if (adventure.status === "ready") {
        item.addEventListener("click", () => this.navigateToBootScene(adventure.id));
      } else {
        item.style.opacity = "0.6";
        item.style.cursor = "default";
      }

      listContainer.appendChild(item);
    }
  }

  private navigateToBootScene(adventureId?: string): void {
    this.removeDOM();
    this.scene.start("BootScene", { adventureId });
  }

  private removeDOM(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
