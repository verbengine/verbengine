/**
 * TypeScript interfaces for VerbEngine DSL v2 data model.
 *
 * These types represent the structured adventure definition produced
 * by the DSL v2 parser and consumed by the Phaser runtime.
 */

export interface ItemDef {
  id: string;
  name: string;
  description: string;
}

export interface Condition {
  type: 'has' | 'flag';
  target: string;
}

export interface Action {
  type: 'get' | 'remove' | 'go' | 'win' | 'set' | 'remove_hotspot';
  target?: string;
}

export interface ConditionalInteraction {
  condition?: Condition;
  text: string;
  actions: Action[];
}

export interface HotspotDef {
  id: string;
  position: [number, number];
  look: string;
  use: ConditionalInteraction[];
  take?: { actions: Action[]; text: string };
}

export interface CharacterDef {
  id: string;
  position: [number, number];
  sprite: string;
  look: string;
  talk: ConditionalInteraction[];
}

export interface ExitDef {
  id: string;
  position: [number, number];
  target: string;
  requires?: string;
  locked?: string;
  look: string;
}

export interface SceneDef {
  id: string;
  map: string;
  hotspots: HotspotDef[];
  characters: CharacterDef[];
  exits: ExitDef[];
}

export interface AdventureData {
  title: string;
  startScene: string;
  items: Record<string, ItemDef>;
  scenes: Record<string, SceneDef>;
}

export interface GameState {
  currentScene: string;
  inventory: string[];
  flags: Set<string>;
  removedHotspots: Set<string>;
}

export interface InteractionResult {
  text: string;
  actions: Action[];
}
