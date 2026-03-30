const KONAMI_SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

const TIMEOUT_MS = 2000;

export class KonamiListener {
  private position = 0;
  private lastKeyTime = 0;
  private readonly onActivate: () => void;
  private readonly handler: (e: KeyboardEvent) => void;

  constructor(onActivate: () => void) {
    this.onActivate = onActivate;
    this.handler = (e: KeyboardEvent) => this.handleKey(e);
    window.addEventListener('keydown', this.handler);
  }

  private handleKey(e: KeyboardEvent): void {
    const now = Date.now();

    if (this.position > 0 && now - this.lastKeyTime > TIMEOUT_MS) {
      this.position = 0;
    }

    this.lastKeyTime = now;

    const expected = KONAMI_SEQUENCE[this.position];
    const key = e.key.toLowerCase();
    const expectedLower = expected.toLowerCase();

    if (key === expectedLower || e.key === expected) {
      this.position++;
      if (this.position === KONAMI_SEQUENCE.length) {
        this.position = 0;
        this.onActivate();
      }
    } else {
      this.position = 0;
    }
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handler);
  }
}
