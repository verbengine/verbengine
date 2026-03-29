import { describe, it, expect } from 'vitest';
import type {
  ItemDef,
  Condition,
  Action,
  ConditionalInteraction,
  HotspotDef,
  CharacterDef,
  ExitDef,
  SceneDef,
  AdventureData,
  GameState,
  InteractionResult,
} from './adventure-v2';

describe('DSL v2 type interfaces', () => {
  it('creates a valid ItemDef', () => {
    const item: ItemDef = {
      id: 'key',
      name: 'Rusty Key',
      description: 'An old rusty key found in the garden.',
    };
    expect(item.id).toBe('key');
    expect(item.name).toBe('Rusty Key');
    expect(item.description).toContain('rusty');
  });

  it('creates Condition with has type', () => {
    const cond: Condition = { type: 'has', target: 'key' };
    expect(cond.type).toBe('has');
    expect(cond.target).toBe('key');
  });

  it('creates Condition with flag type', () => {
    const cond: Condition = { type: 'flag', target: 'door_opened' };
    expect(cond.type).toBe('flag');
    expect(cond.target).toBe('door_opened');
  });

  it('creates Action with target', () => {
    const action: Action = { type: 'get', target: 'key' };
    expect(action.type).toBe('get');
    expect(action.target).toBe('key');
  });

  it('creates Action without target', () => {
    const action: Action = { type: 'win' };
    expect(action.type).toBe('win');
    expect(action.target).toBeUndefined();
  });

  it('creates all Action types', () => {
    const types: Action['type'][] = ['get', 'remove', 'go', 'win', 'set', 'remove_hotspot'];
    const actions: Action[] = types.map((type) => ({ type, target: 'test' }));
    expect(actions).toHaveLength(6);
    expect(actions.map((a) => a.type)).toEqual(types);
  });

  it('creates ConditionalInteraction with condition', () => {
    const interaction: ConditionalInteraction = {
      condition: { type: 'has', target: 'key' },
      text: 'You unlock the door with the rusty key.',
      actions: [
        { type: 'remove', target: 'key' },
        { type: 'set', target: 'door_opened' },
      ],
    };
    expect(interaction.condition?.type).toBe('has');
    expect(interaction.actions).toHaveLength(2);
  });

  it('creates ConditionalInteraction without condition (default)', () => {
    const interaction: ConditionalInteraction = {
      text: 'The door is locked.',
      actions: [],
    };
    expect(interaction.condition).toBeUndefined();
    expect(interaction.text).toBe('The door is locked.');
  });

  it('creates a valid HotspotDef', () => {
    const hotspot: HotspotDef = {
      id: 'chest',
      position: [120, 80],
      look: 'A wooden treasure chest.',
      use: [
        {
          condition: { type: 'has', target: 'key' },
          text: 'You open the chest with the key!',
          actions: [
            { type: 'remove', target: 'key' },
            { type: 'get', target: 'gold' },
          ],
        },
        {
          text: 'The chest is locked.',
          actions: [],
        },
      ],
      take: {
        text: 'You pick up the chest.',
        actions: [{ type: 'get', target: 'chest' }],
      },
    };
    expect(hotspot.position).toEqual([120, 80]);
    expect(hotspot.use).toHaveLength(2);
    expect(hotspot.take?.text).toContain('pick up');
  });

  it('creates HotspotDef without take', () => {
    const hotspot: HotspotDef = {
      id: 'painting',
      position: [200, 40],
      look: 'A portrait of the baron.',
      use: [{ text: 'Nothing happens.', actions: [] }],
    };
    expect(hotspot.take).toBeUndefined();
  });

  it('creates a valid CharacterDef', () => {
    const character: CharacterDef = {
      id: 'guard',
      position: [160, 100],
      sprite: 'guard_idle',
      look: 'A stern-looking guard blocks the gate.',
      talk: [
        {
          condition: { type: 'has', target: 'pass' },
          text: 'The guard nods and lets you through.',
          actions: [{ type: 'set', target: 'gate_open' }],
        },
        {
          text: 'Halt! You need a pass to enter.',
          actions: [],
        },
      ],
    };
    expect(character.sprite).toBe('guard_idle');
    expect(character.talk).toHaveLength(2);
  });

  it('creates a valid ExitDef', () => {
    const exit: ExitDef = {
      id: 'north_gate',
      position: [150, 0],
      target: 'castle_courtyard',
      requires: 'gate_open',
      locked: 'The gate is locked shut.',
      look: 'A large iron gate leads north.',
    };
    expect(exit.target).toBe('castle_courtyard');
    expect(exit.requires).toBe('gate_open');
    expect(exit.locked).toContain('locked');
  });

  it('creates ExitDef without requires/locked', () => {
    const exit: ExitDef = {
      id: 'south_path',
      position: [150, 190],
      target: 'village_square',
      look: 'A dirt path leads south to the village.',
    };
    expect(exit.requires).toBeUndefined();
    expect(exit.locked).toBeUndefined();
  });

  it('creates a valid SceneDef', () => {
    const scene: SceneDef = {
      id: 'garden',
      map: 'garden_map',
      hotspots: [
        {
          id: 'fountain',
          position: [100, 60],
          look: 'A stone fountain.',
          use: [{ text: 'The water is ice cold.', actions: [] }],
        },
      ],
      characters: [],
      exits: [
        {
          id: 'east_door',
          position: [310, 100],
          target: 'kitchen',
          look: 'A wooden door leads east.',
        },
      ],
    };
    expect(scene.id).toBe('garden');
    expect(scene.hotspots).toHaveLength(1);
    expect(scene.characters).toHaveLength(0);
    expect(scene.exits).toHaveLength(1);
  });

  it('creates a valid AdventureData', () => {
    const adventure: AdventureData = {
      title: 'The Secret of Monkey Island',
      startScene: 'harbor',
      items: {
        sword: {
          id: 'sword',
          name: 'Rubber Sword',
          description: 'A rubber sword. Not very sharp.',
        },
      },
      scenes: {
        harbor: {
          id: 'harbor',
          map: 'harbor_map',
          hotspots: [],
          characters: [],
          exits: [],
        },
      },
    };
    expect(adventure.title).toBe('The Secret of Monkey Island');
    expect(adventure.startScene).toBe('harbor');
    expect(adventure.items['sword'].name).toBe('Rubber Sword');
    expect(adventure.scenes['harbor'].id).toBe('harbor');
  });

  it('creates a valid GameState', () => {
    const state: GameState = {
      currentScene: 'garden',
      inventory: ['key', 'sword'],
      flags: new Set(['door_opened', 'talked_to_guard']),
      removedHotspots: new Set(['chest']),
    };
    expect(state.currentScene).toBe('garden');
    expect(state.inventory).toContain('key');
    expect(state.flags.has('door_opened')).toBe(true);
    expect(state.removedHotspots.has('chest')).toBe(true);
  });

  it('creates a valid InteractionResult', () => {
    const result: InteractionResult = {
      text: 'You pick up the key.',
      actions: [{ type: 'get', target: 'key' }],
    };
    expect(result.text).toContain('key');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('get');
  });
});
