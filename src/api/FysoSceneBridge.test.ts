import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FysoSceneBridge } from './FysoSceneBridge';
import type { AgentDef } from '../types/fyso-teams';

// ── Mock FysoTeamsScene ───────────────────────────────────────────

function createMockScene() {
  return {
    spawnAgent: vi.fn(),
    removeAgent: vi.fn(),
    moveAgent: vi.fn(),
    setAgentStatus: vi.fn(),
    showAgentMessage: vi.fn(),
    focusAgent: vi.fn(),
    enableInput: vi.fn(),
    disableInput: vi.fn(),
  };
}

function createMockGame(scene: ReturnType<typeof createMockScene> | null = createMockScene()) {
  return {
    scene: {
      getScene: vi.fn().mockReturnValue(scene),
    },
    destroy: vi.fn(),
  };
}

// ── Helpers ───────────────────────────────────────────────────────

const SCENE_KEY = 'FysoTeamsScene';

function agentDef(overrides?: Partial<AgentDef>): AgentDef {
  return {
    id: 'agent-1',
    name: 'Alice',
    sprite: 'char_0',
    pod: { x: 2, y: 2, w: 3, h: 3 },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('FysoSceneBridge', () => {
  let scene: ReturnType<typeof createMockScene>;
  let game: ReturnType<typeof createMockGame>;
  let bridge: FysoSceneBridge;

  beforeEach(() => {
    scene = createMockScene();
    game = createMockGame(scene);
    // Cast to satisfy TypeScript — we are testing bridge logic, not Phaser types
    bridge = new FysoSceneBridge(game as unknown as import('phaser').Game, SCENE_KEY);
  });

  // ── spawnAgent ────────────────────────────────────────────────

  describe('spawnAgent', () => {
    it('delegates to scene.spawnAgent', () => {
      const def = agentDef();
      bridge.spawnAgent(def);
      expect(scene.spawnAgent).toHaveBeenCalledOnce();
      expect(scene.spawnAgent).toHaveBeenCalledWith(def);
    });

    it('passes agent id, name, sprite, and pod', () => {
      const def = agentDef({ id: 'bob', name: 'Bob', pod: { x: 5, y: 7, w: 4, h: 3 } });
      bridge.spawnAgent(def);
      const call = scene.spawnAgent.mock.calls[0][0] as AgentDef;
      expect(call.id).toBe('bob');
      expect(call.name).toBe('Bob');
      expect(call.pod).toEqual({ x: 5, y: 7, w: 4, h: 3 });
    });

    it('throws when scene is not found', () => {
      const noSceneGame = createMockGame(null);
      const badBridge = new FysoSceneBridge(
        noSceneGame as unknown as import('phaser').Game,
        SCENE_KEY,
      );
      expect(() => badBridge.spawnAgent(agentDef())).toThrow("Scene 'FysoTeamsScene' not found");
    });
  });

  // ── removeAgent ───────────────────────────────────────────────

  describe('removeAgent', () => {
    it('delegates to scene.removeAgent with the given id', () => {
      bridge.removeAgent('agent-1');
      expect(scene.removeAgent).toHaveBeenCalledWith('agent-1');
    });

    it('is safe when called with a non-existent id (scene handles it)', () => {
      // Bridge should pass through — scene is responsible for the no-op behaviour
      expect(() => bridge.removeAgent('does-not-exist')).not.toThrow();
      expect(scene.removeAgent).toHaveBeenCalledWith('does-not-exist');
    });
  });

  // ── moveAgent ─────────────────────────────────────────────────

  describe('moveAgent', () => {
    it('delegates with correct id and coordinates', () => {
      bridge.moveAgent('agent-1', 10, 12);
      expect(scene.moveAgent).toHaveBeenCalledWith('agent-1', 10, 12);
    });
  });

  // ── setAgentStatus ────────────────────────────────────────────

  describe('setAgentStatus', () => {
    it('delegates status update to scene', () => {
      bridge.setAgentStatus('agent-1', 'working');
      expect(scene.setAgentStatus).toHaveBeenCalledWith('agent-1', 'working');
    });

    it('can set every valid status', () => {
      const statuses = ['idle', 'wander', 'working', 'talking', 'walking', 'done', 'error'] as const;
      for (const status of statuses) {
        bridge.setAgentStatus('agent-1', status);
      }
      expect(scene.setAgentStatus).toHaveBeenCalledTimes(statuses.length);
    });
  });

  // ── showAgentMessage ──────────────────────────────────────────

  describe('showAgentMessage', () => {
    it('delegates with text', () => {
      bridge.showAgentMessage('agent-1', 'Hello!');
      expect(scene.showAgentMessage).toHaveBeenCalledWith('agent-1', 'Hello!', undefined);
    });

    it('passes optional duration to scene', () => {
      bridge.showAgentMessage('agent-1', 'Hi', 5000);
      expect(scene.showAgentMessage).toHaveBeenCalledWith('agent-1', 'Hi', 5000);
    });
  });

  // ── focusAgent ────────────────────────────────────────────────

  describe('focusAgent', () => {
    it('delegates to scene.focusAgent', () => {
      bridge.focusAgent('agent-1');
      expect(scene.focusAgent).toHaveBeenCalledWith('agent-1');
    });
  });

  // ── enableInput / disableInput ────────────────────────────────

  describe('input control', () => {
    it('enableInput delegates to scene', () => {
      bridge.enableInput();
      expect(scene.enableInput).toHaveBeenCalledOnce();
    });

    it('disableInput delegates to scene', () => {
      bridge.disableInput();
      expect(scene.disableInput).toHaveBeenCalledOnce();
    });
  });

  // ── destroy ───────────────────────────────────────────────────

  describe('destroy', () => {
    it('calls game.destroy(true)', () => {
      bridge.destroy();
      expect(game.destroy).toHaveBeenCalledWith(true);
    });

    it('does not interact with the scene on destroy', () => {
      bridge.destroy();
      expect(scene.spawnAgent).not.toHaveBeenCalled();
      expect(scene.removeAgent).not.toHaveBeenCalled();
    });
  });

  // ── Scene not found ───────────────────────────────────────────

  describe('when scene is unavailable', () => {
    let badBridge: FysoSceneBridge;

    beforeEach(() => {
      const noSceneGame = createMockGame(null);
      badBridge = new FysoSceneBridge(
        noSceneGame as unknown as import('phaser').Game,
        SCENE_KEY,
      );
    });

    it('throws on removeAgent', () => {
      expect(() => badBridge.removeAgent('x')).toThrow("Scene 'FysoTeamsScene' not found");
    });

    it('throws on moveAgent', () => {
      expect(() => badBridge.moveAgent('x', 0, 0)).toThrow();
    });

    it('throws on setAgentStatus', () => {
      expect(() => badBridge.setAgentStatus('x', 'idle')).toThrow();
    });

    it('throws on showAgentMessage', () => {
      expect(() => badBridge.showAgentMessage('x', 'hi')).toThrow();
    });

    it('throws on focusAgent', () => {
      expect(() => badBridge.focusAgent('x')).toThrow();
    });

    it('throws on enableInput', () => {
      expect(() => badBridge.enableInput()).toThrow();
    });

    it('throws on disableInput', () => {
      expect(() => badBridge.disableInput()).toThrow();
    });
  });
});
