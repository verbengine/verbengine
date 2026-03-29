import { describe, it, expect } from 'vitest';
import { parseVerb } from './VerbParser';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('VerbParser', () => {
  // --- Full adventure parsing ---

  it('parses the missing-usb adventure.verb file', () => {
    const source = readFileSync(
      resolve(__dirname, '../../dsl/examples/missing-usb/adventure.verb'),
      'utf-8'
    );
    const data = parseVerb(source);

    expect(data.title).toBe('The Missing USB');
    expect(data.startScene).toBe('oficina');
    expect(Object.keys(data.items)).toHaveLength(3);
    expect(Object.keys(data.scenes)).toHaveLength(3);
  });

  it('produces correct item definitions from missing-usb', () => {
    const source = readFileSync(
      resolve(__dirname, '../../dsl/examples/missing-usb/adventure.verb'),
      'utf-8'
    );
    const data = parseVerb(source);

    expect(data.items['usb_drive']).toEqual({
      id: 'usb_drive',
      name: 'USB Drive',
      description: 'A small black USB drive with a red sticker',
    });
    expect(data.items['server_key']).toEqual({
      id: 'server_key',
      name: 'Server Room Key',
      description: 'A metallic key card',
    });
  });

  it('produces correct scene structure from missing-usb', () => {
    const source = readFileSync(
      resolve(__dirname, '../../dsl/examples/missing-usb/adventure.verb'),
      'utf-8'
    );
    const data = parseVerb(source);

    const oficina = data.scenes['oficina'];
    expect(oficina.map).toBe('maps/oficina.json');
    expect(oficina.hotspots).toHaveLength(3);
    expect(oficina.characters).toHaveLength(2);
    expect(oficina.exits).toHaveLength(1);

    const pasillo = data.scenes['pasillo'];
    expect(pasillo.exits).toHaveLength(2);
    expect(pasillo.hotspots).toHaveLength(0);
  });

  // --- Title and start ---

  it('parses adventure title and start scene', () => {
    const data = parseVerb(`
      adventure "My Game" {
        start: intro
        items {}
        scene intro {
          map: "map1"
        }
      }
    `);
    expect(data.title).toBe('My Game');
    expect(data.startScene).toBe('intro');
  });

  // --- Items block ---

  it('parses items block with multiple items', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {
          key {
            name: "Golden Key"
            description: "A shiny golden key"
          }
          gem {
            name: "Ruby Gem"
            description: "A deep red gemstone"
          }
        }
        scene room { map: "m" }
      }
    `);
    expect(Object.keys(data.items)).toHaveLength(2);
    expect(data.items['key'].name).toBe('Golden Key');
    expect(data.items['gem'].description).toBe('A deep red gemstone');
  });

  // --- Hotspot parsing ---

  it('parses hotspot with look, use, and conditional use', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          hotspot desk [4, 3] {
            look: "A wooden desk."
            use: "Nothing happens."
            use(key): "You unlock the drawer!"
          }
        }
      }
    `);
    const hotspot = data.scenes['room'].hotspots[0];
    expect(hotspot.id).toBe('desk');
    expect(hotspot.position).toEqual([4, 3]);
    expect(hotspot.look).toBe('A wooden desk.');
    expect(hotspot.use).toHaveLength(2);

    // Unconditional use
    expect(hotspot.use[0].condition).toBeUndefined();
    expect(hotspot.use[0].text).toBe('Nothing happens.');

    // Conditional use
    expect(hotspot.use[1].condition).toEqual({ type: 'has', target: 'key' });
    expect(hotspot.use[1].text).toBe('You unlock the drawer!');
  });

  it('parses hotspot with take action', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          hotspot shelf [2, 5] {
            look: "A dusty shelf."
            take: -> get(coin) "You pick up a coin."
          }
        }
      }
    `);
    const hotspot = data.scenes['room'].hotspots[0];
    expect(hotspot.take).toBeDefined();
    expect(hotspot.take!.actions).toEqual([{ type: 'get', target: 'coin' }]);
    expect(hotspot.take!.text).toBe('You pick up a coin.');
  });

  // --- Character parsing ---

  it('parses character with sprite, look, talk, and conditional talk', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          character npc1 [8, 4] {
            sprite: "guard"
            look: "A stern-looking guard."
            talk: "Go away."
            talk(has badge): "Welcome, officer."
          }
        }
      }
    `);
    const char = data.scenes['room'].characters[0];
    expect(char.id).toBe('npc1');
    expect(char.position).toEqual([8, 4]);
    expect(char.sprite).toBe('guard');
    expect(char.look).toBe('A stern-looking guard.');
    expect(char.talk).toHaveLength(2);
    expect(char.talk[0].text).toBe('Go away.');
    expect(char.talk[0].condition).toBeUndefined();
    expect(char.talk[1].text).toBe('Welcome, officer.');
    expect(char.talk[1].condition).toEqual({ type: 'has', target: 'badge' });
  });

  it('parses character with talk action after text', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          character vendor [3, 7] {
            sprite: "vendor"
            look: "A friendly vendor."
            talk(has gold): "Here you go." -> get(potion)
          }
        }
      }
    `);
    const char = data.scenes['room'].characters[0];
    expect(char.talk).toHaveLength(1);
    expect(char.talk[0].text).toBe('Here you go.');
    expect(char.talk[0].actions).toEqual([{ type: 'get', target: 'potion' }]);
  });

  // --- Exit parsing ---

  it('parses exit with target and look', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          exit door_north [5, 0] {
            target: hallway
            look: "A door to the north."
          }
        }
      }
    `);
    const exit = data.scenes['room'].exits[0];
    expect(exit.id).toBe('door_north');
    expect(exit.position).toEqual([5, 0]);
    expect(exit.target).toBe('hallway');
    expect(exit.look).toBe('A door to the north.');
    expect(exit.requires).toBeUndefined();
    expect(exit.locked).toBeUndefined();
  });

  it('parses exit with requires and locked', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          exit vault [10, 5] {
            target: vault_room
            requires: vault_key
            look: "A heavy vault door."
            locked: "You need the vault key."
          }
        }
      }
    `);
    const exit = data.scenes['room'].exits[0];
    expect(exit.requires).toBe('vault_key');
    expect(exit.locked).toBe('You need the vault key.');
  });

  // --- Actions parsing ---

  it('parses -> get(item) action', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          hotspot box [1, 1] {
            look: "A box."
            take: -> get(gem) "You find a gem."
          }
        }
      }
    `);
    expect(data.scenes['room'].hotspots[0].take!.actions[0]).toEqual({
      type: 'get',
      target: 'gem',
    });
  });

  it('parses -> go(scene) action in conditional use', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          hotspot portal [6, 6] {
            look: "A swirling portal."
            use(orb): -> go(other_world) "You step through the portal."
          }
        }
      }
    `);
    const use = data.scenes['room'].hotspots[0].use[0];
    expect(use.actions).toEqual([{ type: 'go', target: 'other_world' }]);
  });

  it('parses -> win action', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          hotspot trophy [3, 3] {
            look: "The trophy."
            use(medal): -> win "You win the game!"
          }
        }
      }
    `);
    const use = data.scenes['room'].hotspots[0].use[0];
    expect(use.actions).toEqual([{ type: 'win' }]);
    expect(use.text).toBe('You win the game!');
  });

  it('parses -> set(flag) action', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          hotspot lever [2, 2] {
            look: "A rusty lever."
            use: -> set(lever_pulled) "You pull the lever."
          }
        }
      }
    `);
    const use = data.scenes['room'].hotspots[0].use[0];
    expect(use.actions).toEqual([{ type: 'set', target: 'lever_pulled' }]);
  });

  it('parses -> remove_hotspot(id) action', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          hotspot rock [9, 9] {
            look: "A loose rock."
            take: -> get(stone) -> remove_hotspot(rock) "You take the stone."
          }
        }
      }
    `);
    const take = data.scenes['room'].hotspots[0].take!;
    expect(take.actions).toHaveLength(2);
    expect(take.actions[0]).toEqual({ type: 'get', target: 'stone' });
    expect(take.actions[1]).toEqual({ type: 'remove_hotspot', target: 'rock' });
  });

  // --- Conditions ---

  it('parses flag condition in talk', () => {
    const data = parseVerb(`
      adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          character guard [1, 1] {
            sprite: "guard"
            look: "A guard."
            talk: "Halt!"
            talk(flag bribed_guard): "Pass, friend."
          }
        }
      }
    `);
    const talk = data.scenes['room'].characters[0].talk;
    expect(talk[1].condition).toEqual({ type: 'flag', target: 'bribed_guard' });
    expect(talk[1].text).toBe('Pass, friend.');
  });

  // --- Error handling ---

  it('throws error with line number for unexpected token', () => {
    expect(() =>
      parseVerb(`adventure "Test" {
        start: room
        items {}
        scene room {
          map: "m"
          unknown_thing [1, 2] {}
        }
      }`)
    ).toThrow(/Line \d+/);
  });

  it('throws error for unterminated string', () => {
    expect(() => parseVerb(`adventure "unterminated`)).toThrow(/Unterminated string/);
  });

  it('throws error for missing start scene', () => {
    expect(() =>
      parseVerb(`adventure "Test" { items {} scene room { map: "m" } }`)
    ).toThrow(/Missing start scene/);
  });

  it('throws error for unexpected character', () => {
    expect(() => parseVerb(`adventure @`)).toThrow(/Unexpected character/);
  });

  // --- Multiple scenes ---

  it('parses multiple scenes correctly', () => {
    const data = parseVerb(`
      adventure "Multi" {
        start: a
        items {}
        scene a {
          map: "map_a"
          exit to_b [5, 0] {
            target: b
            look: "To B."
          }
        }
        scene b {
          map: "map_b"
          exit to_a [5, 10] {
            target: a
            look: "To A."
          }
        }
      }
    `);
    expect(Object.keys(data.scenes)).toHaveLength(2);
    expect(data.scenes['a'].exits[0].target).toBe('b');
    expect(data.scenes['b'].exits[0].target).toBe('a');
  });

  // --- Comments ---

  it('ignores single-line comments', () => {
    const data = parseVerb(`
      // This is a comment
      adventure "Test" {
        start: room // inline comment
        items {}
        scene room {
          map: "m"
        }
      }
    `);
    expect(data.title).toBe('Test');
    expect(data.startScene).toBe('room');
  });
});
