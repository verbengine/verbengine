import type { Adventure, SceneMetadata } from "../types/adventure";
import { getAdventure } from "../api/fyso";
import pirateMetadata from "../../dsl/examples/pirate-adventure/metadata.json";
import pirateStoryJson from "../../dsl/examples/pirate-adventure/story.json";

const STATIC_ADVENTURE_ID = "pirate-adventure";

/**
 * Reads the `adventure` query parameter from the current URL.
 * Returns null if not present.
 */
export function getAdventureIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("adventure");
}

/**
 * Loads the static pirate adventure from bundled example files.
 */
export function loadStaticAdventure(): Adventure {
  return {
    id: STATIC_ADVENTURE_ID,
    title: "Pirate Adventure",
    prompt: "A pirate adventure on a tropical island",
    scenes_count: 3,
    ink_script: JSON.stringify(pirateStoryJson),
    scene_metadata: pirateMetadata as SceneMetadata,
    status: "ready",
    created_at: new Date().toISOString(),
  };
}

/**
 * Loads an adventure either from the Fyso API (if URL param present)
 * or falls back to the static pirate adventure.
 */
export async function loadAdventure(): Promise<Adventure> {
  const adventureId = getAdventureIdFromUrl();

  if (adventureId) {
    return getAdventure(adventureId);
  }

  return loadStaticAdventure();
}
