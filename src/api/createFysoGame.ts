import Phaser from 'phaser';
import { FysoTeamsScene } from '../scenes/FysoTeamsScene';
import { FysoSceneBridge } from './FysoSceneBridge';
import type { FysoGameOptions } from '../types/fyso-teams';

const SCENE_KEY = 'FysoTeamsScene';

/**
 * Create a self-contained Phaser game mounted inside `container` and return
 * both the raw game instance and a FysoSceneBridge for programmatic control.
 *
 * Only FysoTeamsScene is registered — no MenuScene, no AdventureScene.
 *
 * @param container — The DOM element that will host the Phaser canvas.
 * @param options   — Optional configuration (dimensions, zoom, basePath, mapData).
 */
export function createFysoGame(
  container: HTMLElement,
  options?: FysoGameOptions,
): { game: Phaser.Game; bridge: FysoSceneBridge } {
  const gameOptions: FysoGameOptions = options ?? {};

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: container,
    backgroundColor: '#1a1a2e',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
    scene: [FysoTeamsScene],
  };

  const game = new Phaser.Game(config);

  // Pass options to the scene via scene init data when the scene starts.
  game.events.once(Phaser.Core.Events.READY, () => {
    game.scene.start(SCENE_KEY, gameOptions);
  });

  const bridge = new FysoSceneBridge(game, SCENE_KEY);

  return { game, bridge };
}
