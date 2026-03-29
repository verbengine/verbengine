import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { IsoScene } from './scenes/IsoScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    parent: 'game-container',
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scene: [MenuScene, BootScene, GameScene, IsoScene],
};
