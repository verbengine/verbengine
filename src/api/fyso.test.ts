import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Adventure } from "../types/adventure";

const MOCK_BASE_URL = "https://api.fyso.dev";
const MOCK_CHANNEL_SLUG = "verbengine";

vi.stubEnv("VITE_FYSO_API_URL", MOCK_BASE_URL);
vi.stubEnv("VITE_FYSO_CHANNEL_SLUG", MOCK_CHANNEL_SLUG);

const makeAdventure = (overrides: Partial<Adventure> = {}): Adventure => ({
  id: "adv-001",
  title: "Pirate Island",
  prompt: "A pirate adventure",
  scenes_count: 3,
  ink_script: "=== start ===\nYou are on an island.",
  scene_metadata: {
    scenes: {
      beach: {
        description: "A sandy beach",
        background_color: "#c2b280",
        hotspots: [],
        characters: [],
        exits: [],
      },
    },
  },
  status: "ready",
  created_at: "2026-03-28T10:00:00Z",
  ...overrides,
});

describe("Fyso API client", () => {
  let createAdventure: typeof import("./fyso").createAdventure;
  let getAdventure: typeof import("./fyso").getAdventure;
  let listAdventures: typeof import("./fyso").listAdventures;
  let FysoApiError: typeof import("./fyso").FysoApiError;

  const fetchSpy = vi.fn<(...args: Parameters<typeof fetch>) => Promise<Response>>();

  beforeEach(async () => {
    vi.stubGlobal("fetch", fetchSpy);
    const mod = await import("./fyso");
    createAdventure = mod.createAdventure;
    getAdventure = mod.getAdventure;
    listAdventures = mod.listAdventures;
    FysoApiError = mod.FysoApiError;
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  function mockFetchResponse(body: unknown, status = 200): void {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  describe("createAdventure", () => {
    it("sends POST to the create-adventure tool and returns an Adventure", async () => {
      const adventure = makeAdventure();
      mockFetchResponse({
        success: true,
        data: { id: adventure.id, data: adventure },
        meta: { executionTimeMs: 120 },
      });

      const result = await createAdventure("A pirate adventure", 3);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        `${MOCK_BASE_URL}/api/channels/${MOCK_CHANNEL_SLUG}/tools/create-adventure/execute`
      );
      expect(options?.method).toBe("POST");
      expect(JSON.parse(options?.body as string)).toEqual({
        prompt: "A pirate adventure",
        scenes_count: 3,
      });

      expect(result.id).toBe("adv-001");
      expect(result.title).toBe("Pirate Island");
      expect(result.status).toBe("ready");
    });

    it("throws FysoApiError on HTTP error", async () => {
      mockFetchResponse({ success: false, error: "Rate limited" }, 429);

      try {
        await createAdventure("test", 1);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FysoApiError);
        expect((error as InstanceType<typeof FysoApiError>).status).toBe(429);
        expect((error as InstanceType<typeof FysoApiError>).message).toBe("Rate limited");
      }
    });
  });

  describe("getAdventure", () => {
    it("fetches an adventure by ID", async () => {
      const adventure = makeAdventure({ id: "adv-042" });
      mockFetchResponse({
        success: true,
        data: { records: [adventure], total: 1 },
        meta: { executionTimeMs: 30 },
      });

      const result = await getAdventure("adv-042");

      expect(result.id).toBe("adv-042");
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe(
        `${MOCK_BASE_URL}/api/channels/${MOCK_CHANNEL_SLUG}/tools/get-adventure/execute`
      );
    });

    it("throws FysoApiError when adventure is not found", async () => {
      mockFetchResponse({
        success: true,
        data: { records: [], total: 0 },
        meta: { executionTimeMs: 10 },
      });

      await expect(getAdventure("nonexistent")).rejects.toThrow("Adventure not found");
    });
  });

  describe("listAdventures", () => {
    it("returns all adventures", async () => {
      const adventures = [
        makeAdventure({ id: "adv-001", title: "Pirate Island" }),
        makeAdventure({ id: "adv-002", title: "Space Station" }),
      ];
      mockFetchResponse({
        success: true,
        data: { records: adventures, total: 2 },
        meta: { executionTimeMs: 25 },
      });

      const result = await listAdventures();

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Pirate Island");
      expect(result[1].title).toBe("Space Station");
    });

    it("returns empty array when no adventures exist", async () => {
      mockFetchResponse({
        success: true,
        data: { records: [], total: 0 },
        meta: { executionTimeMs: 5 },
      });

      const result = await listAdventures();

      expect(result).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("throws when Fyso returns success: false", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, error: "Internal error" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      await expect(listAdventures()).rejects.toThrow("Fyso API returned success: false");
    });

    it("includes status code in FysoApiError", async () => {
      mockFetchResponse({ success: false, message: "Not authorized" }, 401);

      try {
        await listAdventures();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(FysoApiError);
        expect((error as InstanceType<typeof FysoApiError>).status).toBe(401);
        expect((error as InstanceType<typeof FysoApiError>).message).toBe("Not authorized");
      }
    });
  });
});
