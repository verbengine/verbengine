export type AdventureStatus = "generating" | "ready" | "error";

export interface Hotspot {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ink_target: string;
}

export interface Character {
  id: string;
  label: string;
  x: number;
  y: number;
  ink_target: string;
}

export interface Exit {
  direction: "north" | "south" | "east" | "west";
  target_scene: string;
  requires?: string;
  x: number;
  y: number;
}

export interface SceneData {
  description: string;
  background_color: string;
  hotspots: Hotspot[];
  characters: Character[];
  exits: Exit[];
}

export interface SceneMetadata {
  scenes: Record<string, SceneData>;
}

export interface Adventure {
  id: string;
  title: string;
  prompt: string;
  scenes_count: number;
  ink_script: string;
  scene_metadata: SceneMetadata;
  status: AdventureStatus;
  created_at: string;
}
