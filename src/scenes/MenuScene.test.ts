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
    value: { start: vi.fn() },
    writable: true,
  });

  return scene;
}

describe("MenuScene", () => {
  let scene: MenuScene;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: fetch resolves with empty array so the try branch succeeds cleanly
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
    });
    scene = createMenuScene();
  });

  afterEach(() => {
    scene.shutdown();
    const container = document.getElementById("game-container");
    if (container) container.remove();
  });

  describe("DOM element creation", () => {
    it("creates the menu container on create()", async () => {
      scene.create();
      // buildDOM is async; wait for next tick
      await vi.waitFor(() => {
        const el = document.getElementById("menu-scene");
        expect(el).not.toBeNull();
      });
    });

    it("shows VerbEngine title", async () => {
      scene.create();
      await vi.waitFor(() => {
        const el = document.getElementById("menu-scene");
        expect(el).not.toBeNull();
        expect(el!.textContent).toContain("VerbEngine");
      });
    });

    it("shows 'Choose your adventure' subtitle", async () => {
      scene.create();
      await vi.waitFor(() => {
        const el = document.getElementById("menu-scene");
        expect(el!.textContent).toContain("Choose your adventure");
      });
    });
  });

  describe("DOM cleanup", () => {
    it("removes DOM elements on shutdown()", async () => {
      scene.create();
      await vi.waitFor(() => {
        expect(document.getElementById("menu-scene")).not.toBeNull();
      });
      scene.shutdown();
      expect(document.getElementById("menu-scene")).toBeNull();
    });

    it("handles shutdown before create() without throwing", () => {
      expect(() => scene.shutdown()).not.toThrow();
    });
  });

  describe("Game card rendering", () => {
    it("fetches /games.json on create()", async () => {
      scene.create();
      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/games.json");
      });
    });

    it("renders a card for each game returned by /games.json", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve([
            { id: "game-1", title: "First Game", color: "#ff0000" },
            { id: "game-2", title: "Second Game", color: "#00ff00" },
          ]),
      });

      scene.create();

      await vi.waitFor(() => {
        const menuEl = document.getElementById("menu-scene");
        expect(menuEl!.textContent).toContain("First Game");
        expect(menuEl!.textContent).toContain("Second Game");
      });
    });

    it("falls back to built-in games list when fetch fails", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      scene.create();

      await vi.waitFor(() => {
        const menuEl = document.getElementById("menu-scene");
        // The hardcoded fallback includes "The Missing USB"
        expect(menuEl!.textContent).toContain("The Missing USB");
      });
    });

    it("navigates to AdventureScene with verbFilePath when a verb-based card is clicked", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve([
            {
              id: "game-1",
              title: "Pirate Game",
              color: "#0000ff",
              verb: "/dsl/examples/pirate/adventure.verb",
            },
          ]),
      });

      scene.create();

      await vi.waitFor(() => {
        const menuEl = document.getElementById("menu-scene");
        expect(menuEl!.textContent).toContain("Pirate Game");
      });

      // Click the card by finding a span with the title text
      const spans = document.querySelectorAll("#menu-scene span");
      const card = Array.from(spans).find((s) => s.textContent === "Pirate Game")
        ?.parentElement as HTMLElement;
      expect(card).toBeTruthy();
      card.click();

      const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
      expect(sceneManager.start).toHaveBeenCalledWith("AdventureScene", {
        verbFilePath: "/dsl/examples/pirate/adventure.verb",
      });
    });

    it("removes DOM when a card is clicked", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve([
            {
              id: "game-1",
              title: "Click Game",
              color: "#333",
              scene: "IsoScene",
            },
          ]),
      });

      scene.create();

      await vi.waitFor(() => {
        expect(document.getElementById("menu-scene")).not.toBeNull();
      });

      const spans = document.querySelectorAll("#menu-scene span");
      const card = Array.from(spans).find((s) => s.textContent === "Click Game")
        ?.parentElement as HTMLElement;
      card.click();

      expect(document.getElementById("menu-scene")).toBeNull();
    });

    it("navigates to scene key when a scene-based card is clicked", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve([
            { id: "game-1", title: "Iso World", color: "#333", scene: "IsoScene" },
          ]),
      });

      scene.create();

      await vi.waitFor(() => {
        const menuEl = document.getElementById("menu-scene");
        expect(menuEl!.textContent).toContain("Iso World");
      });

      const spans = document.querySelectorAll("#menu-scene span");
      const card = Array.from(spans).find((s) => s.textContent === "Iso World")
        ?.parentElement as HTMLElement;
      card.click();

      const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
      expect(sceneManager.start).toHaveBeenCalledWith("IsoScene");
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
    });
  });
});
