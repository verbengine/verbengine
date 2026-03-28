import Phaser from 'phaser';
import { MenuScene } from './scenes/MenuScene';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scene: [MenuScene, BootScene, GameScene],
};
