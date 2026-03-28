import { describe, it, expect } from "vitest";
import type {
  AdventureStatus,
  Hotspot,
  Character,
  Exit,
  SceneData,
  SceneMetadata,
  Adventure,
} from "./adventure";

describe("Adventure types", () => {
  it("should create a valid Hotspot", () => {
    const hotspot: Hotspot = {
      id: "hotspot-1",
      label: "Old lamp",
      x: 120,
      y: 80,
      width: 32,
      height: 48,
      ink_target: "examine_lamp",
    };

    expect(hotspot.id).toBe("hotspot-1");
    expect(hotspot.label).toBe("Old lamp");
    expect(hotspot.x).toBe(120);
    expect(hotspot.y).toBe(80);
    expect(hotspot.width).toBe(32);
    expect(hotspot.height).toBe(48);
    expect(hotspot.ink_target).toBe("examine_lamp");
  });

  it("should create a valid Character", () => {
    const character: Character = {
      id: "char-1",
      label: "Captain LeChuck",
      x: 200,
      y: 150,
      ink_target: "talk_lechuck",
    };

    expect(character.id).toBe("char-1");
    expect(character.label).toBe("Captain LeChuck");
    expect(character.x).toBe(200);
    expect(character.y).toBe(150);
    expect(character.ink_target).toBe("talk_lechuck");
  });

  it("should create a valid Exit without optional requires", () => {
    const exit: Exit = {
      direction: "north",
      target_scene: "forest_clearing",
      x: 160,
      y: 0,
    };

    expect(exit.direction).toBe("north");
    expect(exit.target_scene).toBe("forest_clearing");
    expect(exit.requires).toBeUndefined();
    expect(exit.x).toBe(160);
    expect(exit.y).toBe(0);
  });

  it("should create a valid Exit with optional requires", () => {
    const exit: Exit = {
      direction: "west",
      target_scene: "locked_room",
      requires: "rusty_key",
      x: 0,
      y: 100,
    };

    expect(exit.direction).toBe("west");
    expect(exit.requires).toBe("rusty_key");
  });

  it("should create a valid SceneData", () => {
    const scene: SceneData = {
      description: "A dimly lit tavern with wooden tables and a crackling fireplace.",
      background_color: "#3a2a1a",
      hotspots: [
        {
          id: "hotspot-mug",
          label: "Mysterious mug",
          x: 50,
          y: 120,
          width: 16,
          height: 20,
          ink_target: "examine_mug",
        },
      ],
      characters: [
        {
          id: "char-barkeeper",
          label: "Barkeeper",
          x: 160,
          y: 90,
          ink_target: "talk_barkeeper",
        },
      ],
      exits: [
        {
          direction: "south",
          target_scene: "town_square",
          x: 160,
          y: 190,
        },
      ],
    };

    expect(scene.hotspots).toHaveLength(1);
    expect(scene.characters).toHaveLength(1);
    expect(scene.exits).toHaveLength(1);
    expect(scene.background_color).toBe("#3a2a1a");
  });

  it("should create a valid SceneMetadata", () => {
    const metadata: SceneMetadata = {
      scenes: {
        tavern: {
          description: "A cozy tavern.",
          background_color: "#3a2a1a",
          hotspots: [],
          characters: [],
          exits: [],
        },
        town_square: {
          description: "The bustling town square.",
          background_color: "#6a8a4a",
          hotspots: [],
          characters: [],
          exits: [],
        },
      },
    };

    expect(Object.keys(metadata.scenes)).toHaveLength(2);
    expect(metadata.scenes["tavern"]).toBeDefined();
    expect(metadata.scenes["town_square"]).toBeDefined();
  });

  it("should create a valid Adventure", () => {
    const adventure: Adventure = {
      id: "adv-001",
      title: "The Secret of Monkey Island",
      prompt: "A pirate adventure on a Caribbean island",
      scenes_count: 3,
      ink_script: "=== start ===\nYou arrive at the island.\n+ [Look around] -> look_around",
      scene_metadata: {
        scenes: {
          start: {
            description: "A sandy beach with palm trees.",
            background_color: "#c2a866",
            hotspots: [],
            characters: [],
            exits: [
              {
                direction: "north",
                target_scene: "jungle_path",
                x: 160,
                y: 0,
              },
            ],
          },
        },
      },
      status: "ready",
      created_at: "2026-03-28T12:00:00Z",
    };

    expect(adventure.id).toBe("adv-001");
    expect(adventure.title).toBe("The Secret of Monkey Island");
    expect(adventure.scenes_count).toBe(3);
    expect(adventure.status).toBe("ready");
    expect(adventure.scene_metadata.scenes["start"]).toBeDefined();
  });

  it("should accept all valid AdventureStatus values", () => {
    const statuses: AdventureStatus[] = ["generating", "ready", "error"];

    expect(statuses).toHaveLength(3);
    statuses.forEach((status) => {
      expect(typeof status).toBe("string");
    });
  });

  it("should accept all valid Exit directions", () => {
    const directions: Exit["direction"][] = ["north", "south", "east", "west"];

    expect(directions).toHaveLength(4);
  });
});
