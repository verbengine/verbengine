import Phaser from 'phaser';

/**
 * AdventureScene — placeholder for the DSL v2 playable adventure scene.
 *
 * The full implementation will be merged from feature/49-e2e-dsl-v2.
 */
export class AdventureScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AdventureScene' });
  }

  create(): void {
    this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2,
        'AdventureScene — coming soon',
        { fontFamily: 'monospace', fontSize: '18px', color: '#888888' },
      )
      .setOrigin(0.5);
  }
}
