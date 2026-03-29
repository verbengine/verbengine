// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Phaser
vi.mock("phaser", () => ({
  default: {
    Scene: class MockScene {
      constructor() {
        // noop
      }
    },
  },
}));

import { MenuScene } from "./MenuScene";

function createMenuScene(): MenuScene {
  const scene = new MenuScene();

  // Mock Phaser.Scene properties used by MenuScene
  const mockGame = {
    canvas: Object.assign(document.createElement("canvas"), {
      width: 960,
      height: 600,
    }),
  };
  const gameContainer = document.createElement("div");
  gameContainer.id = "game-container";
  gameContainer.appendChild(mockGame.canvas);
  document.body.appendChild(gameContainer);

  Object.defineProperty(scene, "game", { value: mockGame, writable: true });
  Object.defineProperty(scene, "scene", {
    value: {
      start: vi.fn(),
    },
    writable: true,
  });

  return scene;
}

describe("MenuScene", () => {
  let scene: MenuScene;

  beforeEach(() => {
    vi.clearAllMocks();
    scene = createMenuScene();
  });

  afterEach(() => {
    scene.shutdown();
    const container = document.getElementById("game-container");
    if (container) container.remove();
  });

  describe("DOM element creation", () => {
    it("creates the menu container on create()", () => {
      scene.create();
      const el = document.getElementById("menu-scene");
      expect(el).not.toBeNull();
    });

    it("creates an Iso Demo button", () => {
      scene.create();
      const btn = document.getElementById("menu-iso-btn") as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe("Iso Demo");
    });

    it("creates a Play Adventure button", () => {
      scene.create();
      const btn = document.getElementById("menu-adventure-btn") as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe("Play Adventure");
    });

    it("does not create old Ink-related buttons", () => {
      scene.create();
      expect(document.getElementById("menu-generate-btn")).toBeNull();
      expect(document.getElementById("menu-example-btn")).toBeNull();
      expect(document.getElementById("menu-prompt-input")).toBeNull();
      expect(document.getElementById("menu-retry-btn")).toBeNull();
    });
  });

  describe("DOM cleanup", () => {
    it("removes DOM elements on shutdown()", () => {
      scene.create();
      expect(document.getElementById("menu-scene")).not.toBeNull();

      scene.shutdown();
      expect(document.getElementById("menu-scene")).toBeNull();
    });

    it("handles shutdown when no DOM exists", () => {
      expect(() => scene.shutdown()).not.toThrow();
    });
  });

  describe("Navigation", () => {
    it("navigates to IsoScene when clicking Iso Demo", () => {
      scene.create();
      const isoBtn = document.getElementById("menu-iso-btn") as HTMLButtonElement;
      isoBtn.click();

      const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
      expect(sceneManager.start).toHaveBeenCalledWith("IsoScene");
    });

    it("removes DOM when navigating to IsoScene", () => {
      scene.create();
      const isoBtn = document.getElementById("menu-iso-btn") as HTMLButtonElement;
      isoBtn.click();

      expect(document.getElementById("menu-scene")).toBeNull();
    });

    it("navigates to AdventureScene when clicking Play Adventure", () => {
      scene.create();
      const adventureBtn = document.getElementById("menu-adventure-btn") as HTMLButtonElement;
      adventureBtn.click();

      const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
      expect(sceneManager.start).toHaveBeenCalledWith("AdventureScene");
    });

    it("removes DOM when navigating to AdventureScene", () => {
      scene.create();
      const adventureBtn = document.getElementById("menu-adventure-btn") as HTMLButtonElement;
      adventureBtn.click();

      expect(document.getElementById("menu-scene")).toBeNull();
    });
  });

  describe("Config integration", () => {
    it("MenuScene is registered in game config", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");

      const configSource = fs.readFileSync(
        path.join(import.meta.dirname, "..", "config.ts"),
        "utf-8"
      );

      expect(configSource).toContain("MenuScene");
      expect(configSource).toContain("scene: [MenuScene, IsoScene, AdventureScene]");
    });
  });
});
