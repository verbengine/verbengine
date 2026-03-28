/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Adventure } from "../types/adventure";

describe("BootScene", () => {
  describe("getAdventureIdFromUrl", () => {
    let getAdventureIdFromUrl: typeof import("./adventure-loader").getAdventureIdFromUrl;

    beforeEach(async () => {
      const mod = await import("./adventure-loader");
      getAdventureIdFromUrl = mod.getAdventureIdFromUrl;
    });

    it("returns the adventure ID when present in URL", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("http://localhost?adventure=adv-123"),
      });
      expect(getAdventureIdFromUrl()).toBe("adv-123");
    });

    it("returns null when no adventure param is present", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("http://localhost"),
      });
      expect(getAdventureIdFromUrl()).toBeNull();
    });

    it("returns null when URL has other params but not adventure", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("http://localhost?debug=true&lang=en"),
      });
      expect(getAdventureIdFromUrl()).toBeNull();
    });

    it("returns the adventure ID with other params present", () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("http://localhost?debug=true&adventure=adv-456&lang=en"),
      });
      expect(getAdventureIdFromUrl()).toBe("adv-456");
    });
  });

  describe("loadStaticAdventure", () => {
    it("returns a valid Adventure object with pirate adventure data", async () => {
      const { loadStaticAdventure } = await import("./adventure-loader");
      const adventure = loadStaticAdventure();

      expect(adventure.id).toBe("pirate-adventure");
      expect(adventure.title).toBe("Pirate Adventure");
      expect(adventure.status).toBe("ready");
      expect(adventure.scenes_count).toBe(3);
      expect(adventure.scene_metadata.scenes.beach).toBeDefined();
      expect(adventure.scene_metadata.scenes.cave).toBeDefined();
      expect(adventure.scene_metadata.scenes.village).toBeDefined();
    });

    it("returns ink_script as a valid JSON string", async () => {
      const { loadStaticAdventure } = await import("./adventure-loader");
      const adventure = loadStaticAdventure();

      const parsed = JSON.parse(adventure.ink_script);
      expect(parsed.inkVersion).toBeDefined();
      expect(parsed.root).toBeDefined();
    });

    it("ink_script works with inkjs Story runtime", async () => {
      const { Story } = await import("inkjs");
      const { loadStaticAdventure } = await import("./adventure-loader");
      const adventure = loadStaticAdventure();

      const story = new Story(adventure.ink_script);
      let text = "";
      while (story.canContinue) {
        text += story.Continue();
      }

      expect(text).toContain("sandy beach");
      expect(story.currentChoices.length).toBeGreaterThan(0);
    });
  });

  describe("loadAdventure routing", () => {
    it("calls getAdventure when URL has adventure param", async () => {
      const mockAdventure: Adventure = {
        id: "adv-remote",
        title: "Remote Adventure",
        prompt: "test",
        scenes_count: 1,
        ink_script: "{}",
        scene_metadata: { scenes: {} },
        status: "ready",
        created_at: "2026-03-28T00:00:00Z",
      };

      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("http://localhost?adventure=adv-remote"),
      });

      vi.stubEnv("VITE_FYSO_API_URL", "https://api.fyso.dev");
      vi.stubEnv("VITE_FYSO_CHANNEL_SLUG", "verbengine");

      const fysoModule = await import("../api/fyso");
      const getAdventureSpy = vi
        .spyOn(fysoModule, "getAdventure")
        .mockResolvedValue(mockAdventure);

      const { loadAdventure } = await import("./adventure-loader");
      const result = await loadAdventure();

      expect(getAdventureSpy).toHaveBeenCalledWith("adv-remote");
      expect(result.id).toBe("adv-remote");

      getAdventureSpy.mockRestore();
    });

    it("loads static adventure when no URL param", async () => {
      Object.defineProperty(window, "location", {
        writable: true,
        value: new URL("http://localhost"),
      });

      const { loadAdventure } = await import("./adventure-loader");
      const result = await loadAdventure();

      expect(result.id).toBe("pirate-adventure");
      expect(result.title).toBe("Pirate Adventure");
    });
  });
});
