// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Fyso API module before importing MenuScene
vi.mock("../api/fyso", () => ({
  createAdventure: vi.fn(),
  listAdventures: vi.fn(),
}));

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

import { createAdventure, listAdventures } from "../api/fyso";
import type { Adventure } from "../types/adventure";
import { MenuScene } from "./MenuScene";

const mockedCreateAdventure = vi.mocked(createAdventure);
const mockedListAdventures = vi.mocked(listAdventures);

function createMockAdventure(overrides?: Partial<Adventure>): Adventure {
  return {
    id: "adv-1",
    title: "Pirate Adventure",
    prompt: "A pirate adventure on a tropical island",
    scenes_count: 3,
    ink_script: "-> start",
    scene_metadata: { scenes: {} },
    status: "ready",
    created_at: "2026-03-28T00:00:00Z",
    ...overrides,
  };
}

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
    mockedListAdventures.mockResolvedValue([]);
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

    it("creates a prompt input with correct placeholder", () => {
      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe("Describe your adventure...");
    });

    it("creates a Generate button", () => {
      scene.create();
      const btn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe("Generate");
    });

    it("creates a Play Example button", () => {
      scene.create();
      const btn = document.getElementById("menu-example-btn") as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toBe("Play Example");
    });

    it("creates a status text element", () => {
      scene.create();
      const status = document.getElementById("menu-status") as HTMLParagraphElement;
      expect(status).not.toBeNull();
      expect(status.textContent).toBe("");
    });

    it("creates the adventure list section", () => {
      scene.create();
      const list = document.getElementById("menu-adventure-list");
      expect(list).not.toBeNull();
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

    it("removes DOM when navigating to BootScene", () => {
      scene.create();
      const exampleBtn = document.getElementById("menu-example-btn") as HTMLButtonElement;
      exampleBtn.click();

      expect(document.getElementById("menu-scene")).toBeNull();
    });
  });

  describe("Play Example button", () => {
    it("navigates to BootScene without adventure ID", () => {
      scene.create();
      const exampleBtn = document.getElementById("menu-example-btn") as HTMLButtonElement;
      exampleBtn.click();

      const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
      expect(sceneManager.start).toHaveBeenCalledWith("BootScene", { adventureId: undefined });
    });
  });

  describe("Generate adventure", () => {
    it("does nothing when prompt is empty", async () => {
      scene.create();
      const generateBtn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      generateBtn.click();

      expect(mockedCreateAdventure).not.toHaveBeenCalled();
    });

    it("calls createAdventure with prompt text", async () => {
      const adventure = createMockAdventure();
      mockedCreateAdventure.mockResolvedValue(adventure);

      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      input.value = "A mystery in a haunted mansion";

      const generateBtn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      generateBtn.click();

      expect(mockedCreateAdventure).toHaveBeenCalledWith("A mystery in a haunted mansion", 3);
    });

    it("shows loading state while generating", () => {
      mockedCreateAdventure.mockReturnValue(new Promise(() => {
        // Never resolves — keeps loading state
      }));

      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      input.value = "Test adventure";

      const generateBtn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      generateBtn.click();

      const status = document.getElementById("menu-status") as HTMLParagraphElement;
      expect(status.textContent).toBe("Generating adventure...");
      expect(generateBtn.disabled).toBe(true);
      expect(input.disabled).toBe(true);
    });

    it("navigates to BootScene with adventure ID on success", async () => {
      const adventure = createMockAdventure({ id: "adv-42" });
      mockedCreateAdventure.mockResolvedValue(adventure);

      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      input.value = "Pirate adventure";

      const generateBtn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      generateBtn.click();

      // Wait for the async handler to resolve
      await vi.waitFor(() => {
        const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
        expect(sceneManager.start).toHaveBeenCalledWith("BootScene", { adventureId: "adv-42" });
      });
    });

    it("shows error state on failure", async () => {
      mockedCreateAdventure.mockRejectedValue(new Error("Network error"));

      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      input.value = "Test adventure";

      const generateBtn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      generateBtn.click();

      await vi.waitFor(() => {
        const status = document.getElementById("menu-status") as HTMLParagraphElement;
        expect(status.textContent).toBe("Network error");
      });

      const retryBtn = document.getElementById("menu-retry-btn") as HTMLButtonElement;
      expect(retryBtn.style.display).not.toBe("none");
    });

    it("handles Enter key to generate", () => {
      mockedCreateAdventure.mockReturnValue(new Promise(() => {
        // Never resolves
      }));

      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      input.value = "Enter key test";

      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

      expect(mockedCreateAdventure).toHaveBeenCalledWith("Enter key test", 3);
    });

    it("prevents duplicate requests while loading", () => {
      mockedCreateAdventure.mockReturnValue(new Promise(() => {
        // Never resolves
      }));

      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      input.value = "Test adventure";

      const generateBtn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      generateBtn.click();
      generateBtn.click();
      generateBtn.click();

      expect(mockedCreateAdventure).toHaveBeenCalledTimes(1);
    });
  });

  describe("Retry", () => {
    it("retry button triggers another generation attempt", async () => {
      mockedCreateAdventure.mockRejectedValueOnce(new Error("First fail"));

      scene.create();
      const input = document.getElementById("menu-prompt-input") as HTMLInputElement;
      input.value = "Retry test";

      const generateBtn = document.getElementById("menu-generate-btn") as HTMLButtonElement;
      generateBtn.click();

      // Wait for error state
      await vi.waitFor(() => {
        const status = document.getElementById("menu-status") as HTMLParagraphElement;
        expect(status.textContent).toBe("First fail");
      });

      // Now retry
      const adventure = createMockAdventure();
      mockedCreateAdventure.mockResolvedValueOnce(adventure);

      const retryBtn = document.getElementById("menu-retry-btn") as HTMLButtonElement;
      retryBtn.click();

      expect(mockedCreateAdventure).toHaveBeenCalledTimes(2);
    });
  });

  describe("Adventure list", () => {
    it("fetches adventures on create()", () => {
      scene.create();
      expect(mockedListAdventures).toHaveBeenCalled();
    });

    it("renders adventure items", async () => {
      const adventures = [
        createMockAdventure({ id: "adv-1", title: "First Adventure" }),
        createMockAdventure({ id: "adv-2", title: "Second Adventure", status: "generating" }),
      ];
      mockedListAdventures.mockResolvedValue(adventures);

      scene.create();

      await vi.waitFor(() => {
        const items = document.querySelectorAll(".menu-adventure-item");
        expect(items.length).toBe(2);
      });
    });

    it("navigates to BootScene when clicking a ready adventure", async () => {
      const adventures = [
        createMockAdventure({ id: "adv-1", title: "Ready Adventure", status: "ready" }),
      ];
      mockedListAdventures.mockResolvedValue(adventures);

      scene.create();

      await vi.waitFor(() => {
        const items = document.querySelectorAll(".menu-adventure-item");
        expect(items.length).toBe(1);
      });

      const item = document.querySelector(".menu-adventure-item") as HTMLDivElement;
      item.click();

      const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
      expect(sceneManager.start).toHaveBeenCalledWith("BootScene", { adventureId: "adv-1" });
    });

    it("does not navigate when clicking a generating adventure", async () => {
      const adventures = [
        createMockAdventure({ id: "adv-1", status: "generating" }),
      ];
      mockedListAdventures.mockResolvedValue(adventures);

      scene.create();

      await vi.waitFor(() => {
        const items = document.querySelectorAll(".menu-adventure-item");
        expect(items.length).toBe(1);
      });

      const item = document.querySelector(".menu-adventure-item") as HTMLDivElement;
      item.click();

      const sceneManager = (scene as unknown as { scene: { start: ReturnType<typeof vi.fn> } }).scene;
      expect(sceneManager.start).not.toHaveBeenCalled();
    });

    it("shows empty state when no adventures exist", async () => {
      mockedListAdventures.mockResolvedValue([]);

      scene.create();

      await vi.waitFor(() => {
        const container = document.getElementById("menu-adventures-container");
        expect(container?.textContent).toContain("No adventures yet");
      });
    });

    it("handles list fetch error silently", async () => {
      mockedListAdventures.mockRejectedValue(new Error("Fetch failed"));

      scene.create();

      // Should not throw and scene should still be functional
      await vi.waitFor(() => {
        expect(document.getElementById("menu-scene")).not.toBeNull();
      });
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
      expect(configSource).toContain("scene: [MenuScene, BootScene]");
    });
  });
});
