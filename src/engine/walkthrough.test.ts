/**
 * Adventure walkthrough tests — full playthrough simulations.
 *
 * Each test parses a .verb file, creates an AdventureEngine, and simulates
 * the player solving the adventure step-by-step. This ensures engine changes
 * don't break existing adventures.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseVerb } from './VerbParser';
import { AdventureEngine } from './AdventureEngine';

function loadAdventure(relativePath: string): AdventureEngine {
  const fullPath = resolve(__dirname, '../../', relativePath);
  const source = readFileSync(fullPath, 'utf-8');
  const data = parseVerb(source);
  return new AdventureEngine(data);
}

// ─────────────────────────────────────────────────────────
// The Missing USB — full walkthrough
// ─────────────────────────────────────────────────────────

describe('Walkthrough: The Missing USB', () => {
  function createEngine(): AdventureEngine {
    return loadAdventure('dsl/examples/missing-usb/adventure.verb');
  }

  it('parses without errors', () => {
    const engine = createEngine();
    expect(engine.getState().currentScene).toBe('oficina');
  });

  it('starts with empty inventory and no flags', () => {
    const engine = createEngine();
    expect(engine.getInventory()).toEqual([]);
    expect(engine.hasFlag('any')).toBe(false);
  });

  it('can look at hotspots and characters', () => {
    const engine = createEngine();
    const desk = engine.getHotspot('escritorio_ana');
    expect(desk).toBeDefined();
    expect(desk!.look).toContain('messy desk');

    const ana = engine.getCharacter('ana');
    expect(ana).toBeDefined();
    expect(ana!.look).toContain('Ana');
  });

  it('lookAt returns correct text for hotspot, character, and exit', () => {
    const engine = createEngine();

    const deskLook = engine.lookAt('escritorio_ana');
    expect(deskLook).not.toBeNull();
    expect(deskLook!.text).toContain('messy desk');
    expect(deskLook!.actions).toEqual([]);

    const anaLook = engine.lookAt('ana');
    expect(anaLook).not.toBeNull();
    expect(anaLook!.text).toContain('Ana');
    expect(anaLook!.actions).toEqual([]);

    const exitLook = engine.lookAt('pasillo_norte');
    expect(exitLook).not.toBeNull();
    expect(exitLook!.text).toBeTruthy();
    expect(exitLook!.actions).toEqual([]);
  });

  it('lookAt returns null for non-existent target', () => {
    const engine = createEngine();
    expect(engine.lookAt('does_not_exist')).toBeNull();
  });

  it('complete walkthrough reaches win condition', () => {
    const engine = createEngine();
    let won = false;
    engine.onWin(() => { won = true; });

    // Step 1: Talk to Ana (no USB yet)
    const anaTalk1 = engine.interactCharacter('ana');
    expect(anaTalk1).not.toBeNull();
    expect(anaTalk1!.text).toContain('USB drive');

    // Step 2: Take USB from coffee machine
    const takeUsb = engine.interactHotspot('cafetera');
    expect(takeUsb).not.toBeNull();
    expect(engine.hasItem('usb_drive')).toBe(true);

    // Step 3: Talk to Ana with USB
    const anaTalk2 = engine.interactCharacter('ana');
    expect(anaTalk2!.text).toContain('found it');
    expect(anaTalk2!.text).toContain('Carlos');

    // Step 4: Talk to Carlos with USB → get server key
    const carlosTalk = engine.interactCharacter('carlos');
    expect(carlosTalk!.text).toContain('server key');
    expect(engine.hasItem('server_key')).toBe(true);

    // Step 5: Use server key on server door
    const door = engine.interactHotspot('puerta_server', 'server_key');
    expect(door).not.toBeNull();
    expect(engine.getState().currentScene).toBe('server_room');

    // Step 6: Use USB on main server → win!
    const server = engine.interactHotspot('servidor_principal', 'usb_drive');
    expect(server).not.toBeNull();
    expect(won).toBe(true);
  });

  it('Carlos refuses to help without USB', () => {
    const engine = createEngine();
    const result = engine.interactCharacter('carlos');
    expect(result!.text).toContain('busy');
    expect(engine.hasItem('server_key')).toBe(false);
  });

  it('server door is locked without key', () => {
    const engine = createEngine();
    // Try the exit directly
    const exit = engine.interactExit('puerta_server');
    // puerta_server is a hotspot, not an exit — try the actual exit
    const northExit = engine.interactExit('pasillo_norte');
    expect(northExit).not.toBeNull();
    expect(engine.getState().currentScene).toBe('pasillo');

    // Try server room exit without key
    const serverExit = engine.interactExit('server_room_este');
    expect(serverExit).not.toBeNull();
    expect(serverExit!.text).toContain('key card');
    expect(engine.getState().currentScene).toBe('pasillo'); // still in pasillo
  });

  it('can navigate between scenes via exits', () => {
    const engine = createEngine();
    expect(engine.getState().currentScene).toBe('oficina');

    engine.interactExit('pasillo_norte');
    expect(engine.getState().currentScene).toBe('pasillo');

    engine.interactExit('oficina_sur');
    expect(engine.getState().currentScene).toBe('oficina');
  });
});

// ─────────────────────────────────────────────────────────
// The Phantom Code — full walkthrough
// ─────────────────────────────────────────────────────────

describe('Walkthrough: The Phantom Code', () => {
  function createEngine(): AdventureEngine {
    return loadAdventure('dsl/examples/phantom-code/adventure.verb');
  }

  it('parses without errors', () => {
    const engine = createEngine();
    expect(engine.getState().currentScene).toBe('recepcion');
  });

  it('starts with empty inventory and no flags', () => {
    const engine = createEngine();
    expect(engine.getInventory()).toEqual([]);
  });

  it('has all expected items defined', () => {
    const engine = createEngine();
    const expectedItems = [
      'badge_visitante', 'cafe', 'pendrive', 'llave_deposito',
      'documento_secreto', 'password_papel', 'evidencia_completa',
    ];
    for (const itemId of expectedItems) {
      expect(engine.getItem(itemId)).toBeDefined();
    }
  });

  it('office doors are locked without badge', () => {
    const engine = createEngine();
    const result = engine.interactExit('oficinas');
    expect(result!.text).toContain('badge');
    expect(engine.getState().currentScene).toBe('recepcion');
  });

  it('lookAt returns correct text for hotspot, character, and exit', () => {
    const engine = createEngine();

    const recepcionistLook = engine.lookAt('recepcionista');
    expect(recepcionistLook).not.toBeNull();
    expect(recepcionistLook!.text).toBeTruthy();
    expect(recepcionistLook!.actions).toEqual([]);

    const exitLook = engine.lookAt('oficinas');
    expect(exitLook).not.toBeNull();
    expect(exitLook!.text).toBeTruthy();
    expect(exitLook!.actions).toEqual([]);
  });

  it('complete walkthrough reaches win condition', () => {
    const engine = createEngine();
    let won = false;
    engine.onWin(() => { won = true; });

    // === RECEPCION ===
    // Get visitor badge from receptionist
    const receptionTalk = engine.interactCharacter('recepcionista');
    expect(receptionTalk!.text).toContain('visitor badge');
    expect(engine.hasItem('badge_visitante')).toBe(true);

    // Go to office (now unlocked)
    engine.interactExit('oficinas');
    expect(engine.getState().currentScene).toBe('oficina_abierta');

    // === OFICINA ABIERTA ===
    // Take password note from dev desk
    const takePassword = engine.interactHotspot('escritorio_dev');
    expect(takePassword).not.toBeNull();
    expect(engine.hasItem('password_papel')).toBe(true);

    // Take coffee
    const takeCoffee = engine.interactHotspot('maquina_cafe');
    expect(takeCoffee).not.toBeNull();
    expect(engine.hasItem('cafe')).toBe(true);

    // Talk to dev senior with password → sets knows_about_ricardo
    const devTalk = engine.interactCharacter('dev_senior');
    expect(devTalk!.text).toContain('Ricardo');
    expect(engine.hasFlag('knows_about_ricardo')).toBe(true);

    // Go to CEO office
    engine.interactExit('oficina_ceo');
    expect(engine.getState().currentScene).toBe('oficina_ceo');

    // === OFICINA CEO ===
    // Take USB from plant
    const takePendrive = engine.interactHotspot('planta_ceo');
    expect(takePendrive).not.toBeNull();
    expect(engine.hasItem('pendrive')).toBe(true);

    // Take storage key from drawer
    const takeKey = engine.interactHotspot('cajon_ceo');
    expect(takeKey).not.toBeNull();
    expect(engine.hasItem('llave_deposito')).toBe(true);

    // Go back to open office
    engine.interactExit('oficina_abierta_sur');
    expect(engine.getState().currentScene).toBe('oficina_abierta');

    // Go to basement (now unlocked with key)
    engine.interactExit('escaleras');
    expect(engine.getState().currentScene).toBe('sotano');

    // === SOTANO ===
    // Use password on old server
    const serverAccess = engine.interactHotspot('servidor_viejo', 'password_papel');
    expect(serverAccess).not.toBeNull();
    expect(engine.hasFlag('accessed_server')).toBe(true);

    // Take secret document from evidence box
    const takeDoc = engine.interactHotspot('caja_evidencia');
    expect(takeDoc).not.toBeNull();
    expect(engine.hasItem('documento_secreto')).toBe(true);

    // Use document on workstation → get complete evidence
    const combineEvidence = engine.interactHotspot('computadora_sotano', 'documento_secreto');
    expect(combineEvidence).not.toBeNull();
    expect(engine.hasItem('evidencia_completa')).toBe(true);
    expect(engine.hasItem('documento_secreto')).toBe(false); // removed
    expect(engine.hasItem('pendrive')).toBe(false); // removed

    // Go to parking lot (now unlocked with evidence)
    engine.interactExit('estacionamiento');
    expect(engine.getState().currentScene).toBe('estacionamiento');

    // === ESTACIONAMIENTO ===
    // Use evidence on journalist's car → win!
    const handOver = engine.interactHotspot('auto_periodista', 'evidencia_completa');
    expect(handOver).not.toBeNull();
    expect(handOver!.text).toContain('THE END');
    expect(won).toBe(true);
  });

  it('basement is locked without storage key', () => {
    const engine = createEngine();
    // Get badge and go to office
    engine.interactCharacter('recepcionista');
    engine.interactExit('oficinas');

    const result = engine.interactExit('escaleras');
    expect(result!.text).toContain('locked');
    expect(engine.getState().currentScene).toBe('oficina_abierta');
  });

  it('parking lot is locked without complete evidence', () => {
    const engine = createEngine();
    // Get badge, go to office, get key, go to basement
    engine.interactCharacter('recepcionista');
    engine.interactExit('oficinas');
    engine.interactExit('oficina_ceo');
    engine.interactHotspot('cajon_ceo'); // get key
    engine.interactExit('oficina_abierta_sur');
    engine.interactExit('escaleras');

    const result = engine.interactExit('estacionamiento');
    expect(result!.text).toContain('evidence');
    expect(engine.getState().currentScene).toBe('sotano');
  });

  it('CEO reacts to having the USB', () => {
    const engine = createEngine();
    engine.interactCharacter('recepcionista');
    engine.interactExit('oficinas');
    engine.interactExit('oficina_ceo');
    engine.interactHotspot('planta_ceo'); // get pendrive

    const ceoTalk = engine.interactCharacter('ceo');
    expect(ceoTalk!.text).toContain('company property');
  });

  it('tracks all scene transitions via callbacks', () => {
    const engine = createEngine();
    const scenes: string[] = [];
    engine.onSceneChange((s) => scenes.push(s));

    engine.interactCharacter('recepcionista');
    engine.interactExit('oficinas');
    engine.interactExit('oficina_ceo');
    engine.interactExit('oficina_abierta_sur');

    expect(scenes).toEqual(['oficina_abierta', 'oficina_ceo', 'oficina_abierta']);
  });
});
