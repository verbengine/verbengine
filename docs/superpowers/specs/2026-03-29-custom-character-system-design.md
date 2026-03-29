# Custom Pixel Art Character System

## Overview

Layered character customization system for VerbEngine. Characters are composed from 5 independent layers (body, hair, torso, legs, accessories) with palette swap for color variations. Layers are composited at load time into a single spritesheet using OffscreenCanvas, making the runtime rendering path identical to the current monolithic sprite system.

Serves two audiences:
- **Adventure authors** define character appearances via config/DSL when designing games
- **Players** select their character appearance (future UI — MVP is config-only)

## Layer System

### Layers (render order, bottom to top)

| # | Layer | Variants (MVP) | Palette Colors |
|---|-------|----------------|----------------|
| 1 | body | slim, standard | 3: `#FF0000` (light), `#CC0000` (mid), `#990000` (dark) |
| 2 | legs | pants, skirt | 2: `#FFFF00` (main), `#CCCC00` (shadow) |
| 3 | torso | shirt, jacket, armor | 2: `#0000FF` (main), `#0000CC` (shadow) |
| 4 | hair | short, long, spiky | 2: `#00FF00` (main), `#00CC00` (shadow) |
| 5 | accessory | cape, sword | 2: `#FF00FF` (main), `#CC00CC` (shadow) |

### Placeholder Color Convention

Each layer uses a distinct primary color as placeholder. These are pure RGB primaries that never appear in actual pixel art. At compose time, placeholders are swapped for the author/player's chosen colors.

**Total MVP assets:** 12 base spritesheets (2 + 2 + 3 + 3 + 2). Color variations are unlimited via palette swap.

### Asset Format

Each layer variant is a PNG spritesheet: **112x96 pixels** (7 columns x 3 rows of 16x32 frames).

Grid layout matches existing character spritesheets:
- **Columns:** walk0, walk1, walk2, type0, type1, read0, read1
- **Rows:** DOWN (0), UP (1), RIGHT (2)
- **West:** handled by horizontal flip of RIGHT row

Background is fully transparent except for the layer's pixels, painted in placeholder colors.

## Runtime Compositing

### When

- Once on character creation/load
- Re-composited only if appearance config changes

### How

1. Load 5 layer PNGs (spritesheets with transparency)
2. For each pixel in each layer: if color matches a placeholder, replace with chosen color
3. Draw layers in order (body → legs → torso → hair → accessory) onto an `OffscreenCanvas` (112x96)
4. Register the resulting canvas as a Phaser texture via `this.textures.addCanvas()`
5. Create spritesheet frames from that texture (same 7x3 grid, 16x32 frames)
6. Existing animation system works without changes

### Palette Swap Algorithm

```typescript
function paletteSwap(
  imageData: ImageData,
  replacements: Map<string, string> // placeholder hex → target hex
): void {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const hex = rgbToHex(data[i], data[i+1], data[i+2]);
    const target = replacements.get(hex);
    if (target && data[i+3] > 0) { // only non-transparent pixels
      const [r, g, b] = hexToRgb(target);
      data[i] = r;
      data[i+1] = g;
      data[i+2] = b;
    }
  }
}
```

### Performance

Compositing 5 layers of 112x96 = ~54K pixels total. On OffscreenCanvas this takes <1ms. Negligible even on mobile.

## Character Definition API

### Interface

```typescript
interface CharacterAppearance {
  body: { shape: 'slim' | 'standard'; skin: string };
  hair: { style: 'short' | 'long' | 'spiky'; color: string };
  torso: { style: 'shirt' | 'jacket' | 'armor'; color: string };
  legs: { style: 'pants' | 'skirt'; color: string };
  accessory?: { style: 'cape' | 'sword'; color: string };
}
```

All `color` fields are hex strings (e.g. `'#2c1810'`). The compositor derives shadow tones automatically by darkening the main color.

### Usage in NPC Definition

```typescript
{
  id: 'npc_elena',
  name: 'Elena',
  sprite: 'custom',              // flag: use layer system
  appearance: {
    body: { shape: 'slim', skin: '#c68642' },
    hair: { style: 'long', color: '#2c1810' },
    torso: { style: 'jacket', color: '#4a6741' },
    legs: { style: 'pants', color: '#3d3d5c' },
    accessory: { style: 'cape', color: '#8b1a1a' }
  },
  gridX: 5, gridY: 3,
  direction: 0,
  dialogue: 'elena_intro'
}
```

### Backwards Compatibility

- `sprite: 'char_0'` (or any non-`'custom'` value) works exactly as today
- Only `sprite: 'custom'` triggers the layer compositor
- No changes to existing NPC rendering path

### Player Character

The protagonist also uses `CharacterAppearance` in the adventure config. Future: a character creator UI sets these values before the adventure starts.

## File Structure

```
public/assets/characters/
├── layers/
│   ├── body_slim.png          # 112x96, placeholder colors
│   ├── body_standard.png
│   ├── hair_short.png
│   ├── hair_long.png
│   ├── hair_spiky.png
│   ├── torso_shirt.png
│   ├── torso_jacket.png
│   ├── torso_armor.png
│   ├── legs_pants.png
│   ├── legs_skirt.png
│   ├── acc_cape.png
│   └── acc_sword.png
├── char_0.png                 # legacy (unchanged)
├── char_1.png
├── char_2.png
└── char_3.png

src/
├── engine/
│   └── CharacterCompositor.ts # compositing + palette swap
├── types/
│   └── character.ts           # CharacterAppearance interface
└── scenes/
    └── IsoScene.ts            # modified: detect 'custom', call compositor
```

## Asset Creation Strategy

### MVP Approach (Hybrid)

1. **Reference generation:** Use PixelLab `create_character` to generate 2-3 complete characters with animations as visual reference
2. **Hand-draw layers:** Create 12 base layer spritesheets (16x32 × 21 frames) using placeholder colors, guided by PixelLab references
3. **Recolor multiplication:** The palette swap system provides unlimited color variations from these 12 bases
4. **Future AI-assist:** Explore generating layers directly with AI once alignment/consistency can be guaranteed

### Nanobanana Prompts (for single-pose reference)

Body base:
```
isometric pixel art character body silhouette, slim build humanoid figure,
no hair no clothing just bare body shape, chibi proportions, standing idle
pose facing camera, skin colored in solid red #FF0000 with darker red
#CC0000 shading and darkest #990000 for deepest shadows, 16-bit pixel art
style, 1px black outline, flat shading with max 3 tones, bright solid
green #00FF00 background for chroma key removal, total image width 711 pixels
```

Hair:
```
isometric pixel art character hair only, short messy hairstyle seen from
front, chibi proportions matching 16x32 character head, NO face NO body
just the hair, colored in solid green #00FF00 with darker #00CC00 shading,
16-bit pixel art style, 1px black outline, flat shading with max 2 tones,
bright solid magenta #FF00FF background for chroma key removal, total image
width 711 pixels
```

Torso:
```
isometric pixel art character shirt only, simple t-shirt seen from front,
chibi proportions matching 16x32 character torso area, NO head NO legs
just the upper body clothing, colored in solid blue #0000FF with darker
#0000CC shading, 16-bit pixel art style, 1px black outline, flat shading
with max 2 tones, bright solid green #00FF00 background for chroma key
removal, total image width 711 pixels
```

Legs:
```
isometric pixel art character pants only, simple straight pants seen from
front, chibi proportions matching 16x32 character leg area, NO torso NO
feet just the pants, colored in solid yellow #FFFF00 with darker #CCCC00
shading, 16-bit pixel art style, 1px black outline, flat shading with
max 2 tones, bright solid green #00FF00 background for chroma key removal,
total image width 711 pixels
```

Accessory:
```
isometric pixel art character cape only, short flowing cape seen from front,
chibi proportions matching 16x32 character, NO body just the cape accessory,
colored in solid magenta #FF00FF with darker #CC00CC shading, 16-bit pixel
art style, 1px black outline, flat shading with max 2 tones, bright solid
green #00FF00 background for chroma key removal, total image width 711 pixels
```

## Testing Strategy

### Unit Tests
- `CharacterCompositor.compose()` — verify layers are stacked in correct order
- `paletteSwap()` — verify placeholder colors are replaced, transparent pixels untouched
- Texture registration — verify Phaser texture is created with correct dimensions and frame config

### Visual Test Page
- Standalone HTML page showing all layer combinations
- Color picker controls for each layer
- Real-time recompositing on color change
- Useful for validating pixel alignment across frames and directions

### Integration Test
- NPC with `sprite: 'custom'` + full `appearance` config in IsoScene
- Verify walk/idle/type animations play correctly
- Verify depth sorting and interaction work as with legacy sprites

## Scope

### In Scope (MVP)
- CharacterCompositor class with palette swap
- CharacterAppearance interface and type definitions
- Integration with IsoScene NPC system
- 12 placeholder layer spritesheets (can be simple colored rectangles initially)
- Backwards compatibility with legacy `char_0..3` sprites
- Unit tests for compositor

### Not in Scope (Future)
- Character creator UI (v0.3.0+)
- AI-generated layer assets (requires alignment R&D)
- Facial features layer (too few pixels at 16x32)
- Animated accessories (cape physics, weapon swing)
- Save/load character appearance to Fyso backend
- Layer blending modes (multiply, overlay)

## Complexity Assessment

**Overall: Medium**

- **Engine code:** ~200-300 lines (compositor + palette swap + IsoScene integration)
- **Asset work:** 12 spritesheets of 21 frames at 16x32 — significant pixel art effort
- **Risk:** layer alignment across all 21 frames is the hardest part. Misaligned pixels break the illusion instantly at 3x zoom
- **Mitigation:** start with body layer, validate alignment on all frames before drawing remaining layers. Visual test page catches issues early
