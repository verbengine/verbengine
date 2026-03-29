/**
 * VerbParser — parses .verb DSL files into AdventureData.
 *
 * Implements a tokenizer + recursive descent parser for the VerbEngine DSL v2 format.
 */

import type {
  Action,
  AdventureData,
  CharacterDef,
  Condition,
  ConditionalInteraction,
  ExitDef,
  HotspotDef,
  ItemDef,
  SceneDef,
} from '../types/adventure-v2';

// --- Token types ---

type TokenType =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'lbrace'
  | 'rbrace'
  | 'lbracket'
  | 'rbracket'
  | 'lparen'
  | 'rparen'
  | 'colon'
  | 'comma'
  | 'arrow'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
  line: number;
}

const KEYWORDS = new Set([
  'adventure',
  'start',
  'items',
  'scene',
  'hotspot',
  'character',
  'exit',
  'map',
  'name',
  'description',
  'look',
  'use',
  'take',
  'talk',
  'sprite',
  'target',
  'requires',
  'locked',
  'has',
  'flag',
]);

// --- Tokenizer ---

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;

  while (pos < source.length) {
    const ch = source[pos];

    // Newlines
    if (ch === '\n') {
      line++;
      pos++;
      continue;
    }

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      pos++;
      continue;
    }

    // Single-line comments
    if (ch === '/' && source[pos + 1] === '/') {
      while (pos < source.length && source[pos] !== '\n') pos++;
      continue;
    }

    // Arrow ->
    if (ch === '-' && source[pos + 1] === '>') {
      tokens.push({ type: 'arrow', value: '->', line });
      pos += 2;
      continue;
    }

    // String literal
    if (ch === '"') {
      pos++;
      let str = '';
      const startLine = line;
      while (pos < source.length && source[pos] !== '"') {
        if (source[pos] === '\\' && source[pos + 1] === '"') {
          str += '"';
          pos += 2;
        } else {
          if (source[pos] === '\n') line++;
          str += source[pos];
          pos++;
        }
      }
      if (pos >= source.length) {
        throw new Error(`Line ${startLine}: Unterminated string literal`);
      }
      pos++; // skip closing "
      tokens.push({ type: 'string', value: str, line: startLine });
      continue;
    }

    // Number (integers)
    if (ch >= '0' && ch <= '9') {
      let num = '';
      const startLine = line;
      while (pos < source.length && source[pos] >= '0' && source[pos] <= '9') {
        num += source[pos];
        pos++;
      }
      tokens.push({ type: 'number', value: num, line: startLine });
      continue;
    }

    // Identifiers and keywords
    if (isIdentStart(ch)) {
      let ident = '';
      const startLine = line;
      while (pos < source.length && isIdentChar(source[pos])) {
        ident += source[pos];
        pos++;
      }
      const type: TokenType = KEYWORDS.has(ident) ? 'keyword' : 'identifier';
      tokens.push({ type, value: ident, line: startLine });
      continue;
    }

    // Single-character tokens
    const singleTokens: Record<string, TokenType> = {
      '{': 'lbrace',
      '}': 'rbrace',
      '[': 'lbracket',
      ']': 'rbracket',
      '(': 'lparen',
      ')': 'rparen',
      ':': 'colon',
      ',': 'comma',
    };

    if (singleTokens[ch]) {
      tokens.push({ type: singleTokens[ch], value: ch, line });
      pos++;
      continue;
    }

    throw new Error(`Line ${line}: Unexpected character '${ch}'`);
  }

  tokens.push({ type: 'eof', value: '', line });
  return tokens;
}

function isIdentStart(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentChar(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9');
}

// --- Parser ---

class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse(): AdventureData {
    this.expect('keyword', 'adventure');
    const title = this.expectString();
    this.expect('lbrace');

    let startScene = '';
    let items: Record<string, ItemDef> = {};
    const scenes: Record<string, SceneDef> = {};

    while (!this.check('rbrace')) {
      const token = this.peek();

      if (token.type === 'keyword' && token.value === 'start') {
        this.advance();
        this.expect('colon');
        startScene = this.expectIdentifier();
      } else if (token.type === 'keyword' && token.value === 'items') {
        items = this.parseItems();
      } else if (token.type === 'keyword' && token.value === 'scene') {
        const scene = this.parseScene();
        scenes[scene.id] = scene;
      } else {
        throw this.error(`Unexpected token '${token.value}'`);
      }
    }

    this.expect('rbrace');

    if (!startScene) {
      throw new Error('Missing start scene declaration');
    }

    return { title, startScene, items, scenes };
  }

  // --- Items ---

  private parseItems(): Record<string, ItemDef> {
    this.expect('keyword', 'items');
    this.expect('lbrace');

    const items: Record<string, ItemDef> = {};

    while (!this.check('rbrace')) {
      const id = this.expectIdentifier();
      this.expect('lbrace');

      let name = '';
      let description = '';

      while (!this.check('rbrace')) {
        const prop = this.peek();
        if (prop.type === 'keyword' && prop.value === 'name') {
          this.advance();
          this.expect('colon');
          name = this.expectString();
        } else if (prop.type === 'keyword' && prop.value === 'description') {
          this.advance();
          this.expect('colon');
          description = this.expectString();
        } else {
          throw this.error(`Unexpected property '${prop.value}' in item '${id}'`);
        }
      }

      this.expect('rbrace');
      items[id] = { id, name, description };
    }

    this.expect('rbrace');
    return items;
  }

  // --- Scene ---

  private parseScene(): SceneDef {
    this.expect('keyword', 'scene');
    const id = this.expectIdentifier();
    this.expect('lbrace');

    let map = '';
    const hotspots: HotspotDef[] = [];
    const characters: CharacterDef[] = [];
    const exits: ExitDef[] = [];

    while (!this.check('rbrace')) {
      const token = this.peek();

      if (token.type === 'keyword' && token.value === 'map') {
        this.advance();
        this.expect('colon');
        map = this.expectString();
      } else if (token.type === 'keyword' && token.value === 'hotspot') {
        hotspots.push(this.parseHotspot());
      } else if (token.type === 'keyword' && token.value === 'character') {
        characters.push(this.parseCharacter());
      } else if (token.type === 'keyword' && token.value === 'exit') {
        exits.push(this.parseExit());
      } else {
        throw this.error(`Unexpected token '${token.value}' in scene '${id}'`);
      }
    }

    this.expect('rbrace');
    return { id, map, hotspots, characters, exits };
  }

  // --- Position ---

  private parsePosition(): [number, number] {
    this.expect('lbracket');
    const x = this.expectNumber();
    this.expect('comma');
    const y = this.expectNumber();
    this.expect('rbracket');
    return [x, y];
  }

  // --- Hotspot ---

  private parseHotspot(): HotspotDef {
    this.expect('keyword', 'hotspot');
    const id = this.expectIdentifier();
    const position = this.parsePosition();
    this.expect('lbrace');

    let look = '';
    const use: ConditionalInteraction[] = [];
    let take: { actions: Action[]; text: string } | undefined;

    while (!this.check('rbrace')) {
      const token = this.peek();

      if (token.type === 'keyword' && token.value === 'look') {
        this.advance();
        this.expect('colon');
        look = this.expectString();
      } else if (token.type === 'keyword' && token.value === 'use') {
        use.push(this.parseConditionalInteraction('use'));
      } else if (token.type === 'keyword' && token.value === 'take') {
        take = this.parseTake();
      } else {
        throw this.error(`Unexpected property '${token.value}' in hotspot '${id}'`);
      }
    }

    this.expect('rbrace');
    return { id, position, look, use, take };
  }

  // --- Character ---

  private parseCharacter(): CharacterDef {
    this.expect('keyword', 'character');
    const id = this.expectIdentifier();
    const position = this.parsePosition();
    this.expect('lbrace');

    let sprite = '';
    let look = '';
    const talk: ConditionalInteraction[] = [];

    while (!this.check('rbrace')) {
      const token = this.peek();

      if (token.type === 'keyword' && token.value === 'sprite') {
        this.advance();
        this.expect('colon');
        sprite = this.expectString();
      } else if (token.type === 'keyword' && token.value === 'look') {
        this.advance();
        this.expect('colon');
        look = this.expectString();
      } else if (token.type === 'keyword' && token.value === 'talk') {
        talk.push(this.parseConditionalInteraction('talk'));
      } else {
        throw this.error(`Unexpected property '${token.value}' in character '${id}'`);
      }
    }

    this.expect('rbrace');
    return { id, position, sprite, look, talk };
  }

  // --- Exit ---

  private parseExit(): ExitDef {
    this.expect('keyword', 'exit');
    const id = this.expectIdentifier();
    const position = this.parsePosition();
    this.expect('lbrace');

    let target = '';
    let requires: string | undefined;
    let locked: string | undefined;
    let look = '';

    while (!this.check('rbrace')) {
      const token = this.peek();

      if (token.type === 'keyword' && token.value === 'target') {
        this.advance();
        this.expect('colon');
        target = this.expectIdentifier();
      } else if (token.type === 'keyword' && token.value === 'requires') {
        this.advance();
        this.expect('colon');
        requires = this.expectIdentifier();
      } else if (token.type === 'keyword' && token.value === 'locked') {
        this.advance();
        this.expect('colon');
        locked = this.expectString();
      } else if (token.type === 'keyword' && token.value === 'look') {
        this.advance();
        this.expect('colon');
        look = this.expectString();
      } else {
        throw this.error(`Unexpected property '${token.value}' in exit '${id}'`);
      }
    }

    this.expect('rbrace');

    const exitDef: ExitDef = { id, position, target, look };
    if (requires !== undefined) exitDef.requires = requires;
    if (locked !== undefined) exitDef.locked = locked;
    return exitDef;
  }

  // --- Conditional interaction (use/talk) ---

  private parseConditionalInteraction(verb: string): ConditionalInteraction {
    this.expect('keyword', verb);

    let condition: Condition | undefined;

    // Check for condition: use(item) or talk(has item)
    if (this.check('lparen')) {
      this.advance(); // (
      if (this.peek().value === 'has') {
        this.advance(); // has
        const target = this.expectIdentifier();
        condition = { type: 'has', target };
      } else if (this.peek().value === 'flag') {
        this.advance(); // flag
        const target = this.expectIdentifier();
        condition = { type: 'flag', target };
      } else {
        // use(item_id) — shorthand for has condition
        const target = this.expectIdentifier();
        condition = { type: 'has', target };
      }
      this.expect('rparen');
    }

    this.expect('colon');

    // Parse optional actions before text, or text then actions
    const actions: Action[] = [];
    let text = '';

    // Actions can appear before or after the text
    while (this.check('arrow')) {
      actions.push(this.parseAction());
    }

    if (this.check('string')) {
      text = this.expectString();
    }

    // Actions can also appear after text
    while (this.check('arrow')) {
      actions.push(this.parseAction());
    }

    const interaction: ConditionalInteraction = { text, actions };
    if (condition) interaction.condition = condition;
    return interaction;
  }

  // --- Take ---

  private parseTake(): { actions: Action[]; text: string } {
    this.expect('keyword', 'take');
    this.expect('colon');

    const actions: Action[] = [];

    while (this.check('arrow')) {
      actions.push(this.parseAction());
    }

    const text = this.expectString();
    return { actions, text };
  }

  // --- Action ---

  private parseAction(): Action {
    this.expect('arrow');
    const token = this.peek();

    if (token.type === 'keyword' && token.value === 'has') {
      // "has" is a keyword but could be identifier in action context — shouldn't happen
      throw this.error(`Unexpected 'has' in action context`);
    }

    // Actions: get(x), remove(x), go(x), win, set(x), remove_hotspot(x)
    const actionName = this.expectIdentOrKeyword();

    if (actionName === 'win') {
      return { type: 'win' };
    }

    const validActions = new Set(['get', 'remove', 'go', 'set', 'remove_hotspot']);
    if (!validActions.has(actionName)) {
      throw this.error(`Unknown action '${actionName}'`);
    }

    this.expect('lparen');
    const target = this.expectIdentifier();
    this.expect('rparen');

    return { type: actionName as Action['type'], target };
  }

  // --- Helpers ---

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private check(type: TokenType, value?: string): boolean {
    const token = this.peek();
    if (token.type !== type) return false;
    if (value !== undefined && token.value !== value) return false;
    return true;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw this.error(
        `Expected ${type}${value ? ` '${value}'` : ''}, got ${token.type} '${token.value}'`
      );
    }
    if (value !== undefined && token.value !== value) {
      throw this.error(`Expected '${value}', got '${token.value}'`);
    }
    return this.advance();
  }

  private expectString(): string {
    return this.expect('string').value;
  }

  private expectIdentifier(): string {
    // Accept both identifier and keyword tokens as identifiers
    // (scene IDs etc. may collide with keywords like "exit", "target")
    const token = this.peek();
    if (token.type === 'identifier' || token.type === 'keyword') {
      this.advance();
      return token.value;
    }
    throw this.error(`Expected identifier, got ${token.type} '${token.value}'`);
  }

  private expectIdentOrKeyword(): string {
    const token = this.peek();
    if (token.type === 'identifier' || token.type === 'keyword') {
      this.advance();
      return token.value;
    }
    throw this.error(`Expected identifier or keyword, got ${token.type} '${token.value}'`);
  }

  private expectNumber(): number {
    const token = this.expect('number');
    return parseInt(token.value, 10);
  }

  private error(message: string): Error {
    const token = this.peek();
    return new Error(`Line ${token.line}: ${message}`);
  }
}

// --- Public API ---

export function parseVerb(source: string): AdventureData {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parse();
}
