import { describe, it, expect } from 'vitest';

describe('VerbEngine bootstrap', () => {
  it('should have required project files', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const root = path.resolve(import.meta.dirname, '..');
    const requiredFiles = [
      'index.html',
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'src/main.ts',
      'src/config.ts',
    ];

    for (const file of requiredFiles) {
      expect(fs.existsSync(path.join(root, file)), `${file} should exist`).toBe(true);
    }
  });

  it('should have correct package.json configuration', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const root = path.resolve(import.meta.dirname, '..');
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

    expect(pkg.name).toBe('verbengine');
    expect(pkg.version).toBe('0.1.0');
    expect(pkg.type).toBe('module');
    expect(pkg.license).toBe('MIT');
    expect(pkg.scripts.dev).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
    expect(pkg.scripts.test).toBeDefined();
    expect(pkg.dependencies.phaser).toBeDefined();
    expect(pkg.dependencies.inkjs).toBeUndefined();
  });

  it('should have game config with fullscreen responsive canvas', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const configSource = fs.readFileSync(
      path.join(import.meta.dirname, 'config.ts'),
      'utf-8'
    );

    expect(configSource).toContain('game-container');
    expect(configSource).toContain('RESIZE');
    expect(configSource).toContain("width: '100%'");
    expect(configSource).toContain("height: '100%'");
    expect(configSource).toContain('pixelArt: true');
    expect(configSource).toContain('antialias: false');
    expect(configSource).toContain('roundPixels: true');
  });
});
