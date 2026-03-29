#!/bin/bash
# Generate pixel art isometric tiles using ImageMagick
# All tiles use limited palettes and no anti-aliasing for authentic pixel art look

TILE_DIR="public/assets/tiles"
CHAR_DIR="public/assets/characters"

mkdir -p "$TILE_DIR" "$CHAR_DIR"

# ============================================================
# Floor tile: stone (64x32 isometric diamond)
# ============================================================
convert -size 64x32 xc:none \
  -fill '#5a5a6e' -draw "polygon 32,0 63,15 32,31 0,15" \
  -fill '#4e4e62' -draw "polygon 32,2 61,15 32,29 2,15" \
  \( -size 64x32 xc:none \
     -fill '#636376' -draw "point 10,8" -draw "point 20,12" -draw "point 35,6" \
     -draw "point 45,18" -draw "point 15,20" -draw "point 50,10" \
     -draw "point 25,14" -draw "point 40,22" -draw "point 8,14" \
     -draw "point 55,14" -draw "point 30,20" -draw "point 18,6" \
     -fill '#444458' -draw "point 12,10" -draw "point 28,8" -draw "point 42,14" \
     -draw "point 22,18" -draw "point 48,20" -draw "point 5,12" \
     -draw "point 38,10" -draw "point 52,16" -draw "point 16,14" \
     -draw "point 33,24" -draw "point 58,12" -draw "point 26,22" \
  \) -composite \
  -fill '#5a5a6e' -draw "line 32,0 63,15" -draw "line 63,15 32,31" \
  -draw "line 32,31 0,15" -draw "line 0,15 32,0" \
  "$TILE_DIR/floor-stone.png"

# ============================================================
# Floor tile: dirt (64x32 isometric diamond)
# ============================================================
convert -size 64x32 xc:none \
  -fill '#7a6040' -draw "polygon 32,0 63,15 32,31 0,15" \
  -fill '#6e5438' -draw "polygon 32,2 61,15 32,29 2,15" \
  \( -size 64x32 xc:none \
     -fill '#8a7050' -draw "point 10,8" -draw "point 22,12" -draw "point 36,6" \
     -draw "point 46,18" -draw "point 14,20" -draw "point 50,10" \
     -draw "point 28,14" -draw "point 42,22" -draw "point 8,14" \
     -fill '#5e4830' -draw "point 12,10" -draw "point 30,8" -draw "point 44,14" \
     -draw "point 20,18" -draw "point 48,20" -draw "point 6,12" \
     -draw "point 38,10" -draw "point 54,16" \
  \) -composite \
  -fill '#7a6040' -draw "line 32,0 63,15" -draw "line 63,15 32,31" \
  -draw "line 32,31 0,15" -draw "line 0,15 32,0" \
  "$TILE_DIR/floor-dirt.png"

# ============================================================
# Floor tile: stone-tile variant (64x32, lighter with grid pattern)
# ============================================================
convert -size 64x32 xc:none \
  -fill '#6a6a7e' -draw "polygon 32,0 63,15 32,31 0,15" \
  -fill '#5e5e72' -draw "polygon 32,2 61,15 32,29 2,15" \
  \( -size 64x32 xc:none \
     -fill '#525266' -draw "line 32,4 55,15" -draw "line 32,4 8,15" \
     -draw "line 32,27 55,15" -draw "line 32,27 8,15" \
     -fill '#727286' -draw "point 20,10" -draw "point 44,10" \
     -draw "point 20,20" -draw "point 44,20" \
  \) -composite \
  -fill '#6a6a7e' -draw "line 32,0 63,15" -draw "line 63,15 32,31" \
  -draw "line 32,31 0,15" -draw "line 0,15 32,0" \
  "$TILE_DIR/floor-stone-tile.png"

# ============================================================
# Floor tile: planks (64x32, wood pattern)
# ============================================================
convert -size 64x32 xc:none \
  -fill '#8a7050' -draw "polygon 32,0 63,15 32,31 0,15" \
  -fill '#7e6444' -draw "polygon 32,2 61,15 32,29 2,15" \
  \( -size 64x32 xc:none \
     -fill '#6e5838' -draw "line 16,4 48,20" -draw "line 12,8 44,24" \
     -draw "line 20,2 52,18" \
     -fill '#96784e' -draw "point 24,8" -draw "point 38,14" -draw "point 18,16" \
     -draw "point 46,12" -draw "point 30,20" \
  \) -composite \
  -fill '#8a7050' -draw "line 32,0 63,15" -draw "line 63,15 32,31" \
  -draw "line 32,31 0,15" -draw "line 0,15 32,0" \
  "$TILE_DIR/floor-planks.png"

# ============================================================
# Wall tile: stone (64x48, isometric block with depth)
# ============================================================
convert -size 64x48 xc:none \
  -fill '#3a3a4e' -draw "polygon 32,0 63,15 32,31 0,15" \
  -fill '#2e2e42' -draw "polygon 0,15 32,31 32,47 0,31" \
  -fill '#24243a' -draw "polygon 32,31 63,15 63,31 32,47" \
  \( -size 64x48 xc:none \
     -fill '#444458' -draw "point 20,6" -draw "point 40,10" -draw "point 30,4" \
     -fill '#323246' -draw "point 10,12" -draw "point 50,12" \
     -fill '#363648' -draw "point 8,22" -draw "point 16,26" -draw "point 24,30" \
     -draw "point 12,34" -draw "point 20,38" \
     -fill '#2a2a3e' -draw "point 40,24" -draw "point 48,28" -draw "point 56,22" \
     -draw "point 44,32" -draw "point 52,26" \
  \) -composite \
  -fill '#3a3a4e' -draw "line 32,0 63,15" -draw "line 63,15 32,31" \
  -draw "line 32,31 0,15" -draw "line 0,15 32,0" \
  -fill '#2e2e42' -draw "line 0,15 0,31" -draw "line 0,31 32,47" -draw "line 32,47 32,31" \
  -fill '#24243a' -draw "line 63,15 63,31" -draw "line 63,31 32,47" -draw "line 32,47 32,31" \
  "$TILE_DIR/wall-stone.png"

# ============================================================
# Barrel decoration (32x32 pixel art)
# ============================================================
convert -size 32x32 xc:none \
  -fill '#8a6030' -draw "roundrectangle 8,6 24,28 3,3" \
  -fill '#7a5020' -draw "line 8,10 24,10" -draw "line 8,16 24,16" \
  -draw "line 8,22 24,22" \
  -fill '#9a7040' -draw "line 10,6 10,28" -draw "line 22,6 22,28" \
  -fill '#6a4418' -draw "rectangle 8,8 24,12" \
  -fill '#8a6030' -draw "rectangle 9,9 23,11" \
  -fill '#6a4418' -draw "rectangle 8,20 24,24" \
  -fill '#8a6030' -draw "rectangle 9,21 23,23" \
  "$TILE_DIR/barrel.png"

# ============================================================
# Chest decoration (32x32 pixel art)
# ============================================================
convert -size 32x32 xc:none \
  -fill '#6a4418' -draw "rectangle 6,12 26,26" \
  -fill '#8a5c28' -draw "rectangle 8,14 24,24" \
  -fill '#6a4418' -draw "rectangle 6,10 26,14" \
  -fill '#8a5c28' -draw "rectangle 8,10 24,13" \
  -fill '#c8a848' -draw "rectangle 14,16 18,20" \
  -fill '#daba58' -draw "rectangle 15,17 17,19" \
  "$TILE_DIR/chest.png"

# ============================================================
# Crate decoration (32x32 pixel art)
# ============================================================
convert -size 32x32 xc:none \
  -fill '#7a5828' -draw "rectangle 6,8 26,28" \
  -fill '#8a6838' -draw "rectangle 8,10 24,26" \
  -fill '#6a4818' -draw "line 6,8 26,28" -draw "line 26,8 6,28" \
  -fill '#7a5828' -draw "rectangle 6,8 26,10" \
  -draw "rectangle 6,26 26,28" \
  -draw "rectangle 6,8 8,28" \
  -draw "rectangle 24,8 26,28" \
  "$TILE_DIR/crate.png"

# ============================================================
# Table decoration (32x32 pixel art)
# ============================================================
convert -size 32x32 xc:none \
  -fill '#7a5828' -draw "rectangle 4,10 28,14" \
  -fill '#8a6838' -draw "rectangle 6,11 26,13" \
  -fill '#6a4818' -draw "rectangle 6,14 8,26" \
  -draw "rectangle 24,14 26,26" \
  -fill '#5a3c10' -draw "rectangle 7,14 7,24" \
  -draw "rectangle 25,14 25,24" \
  "$TILE_DIR/table.png"

# ============================================================
# Torch decoration (24x32 pixel art)
# ============================================================
convert -size 24x32 xc:none \
  -fill '#5a5a6e' -draw "rectangle 10,12 14,28" \
  -fill '#4a4a5e' -draw "rectangle 11,13 13,27" \
  -fill '#e8a020' -draw "polygon 12,4 8,12 16,12" \
  -fill '#f0c040' -draw "polygon 12,6 10,11 14,11" \
  -fill '#f8e060' -draw "point 12,8" -draw "point 12,9" \
  "$TILE_DIR/torch.png"

echo "Tile assets generated."

# ============================================================
# Hero spritesheet: 4 directions x 3 frames = 12 frames
# Each frame is 32x32, total: 96x128
# Layout: 3 columns (walk1, walk2, walk3) x 4 rows (S, N, E, W)
# ============================================================

# Helper: draw a single frame of the hero
# Args: output_file direction frame
# direction: S=0, N=1, E=2, W=3
# frame: 0=stand, 1=step_left, 2=step_right

HERO_FRAMES=""

for dir in 0 1 2 3; do
  for frame in 0 1 2; do
    FNAME="/tmp/hero_${dir}_${frame}.png"

    # Body colors
    SKIN="#e8b888"
    HAIR="#4a2810"
    SHIRT="#2855a8"
    PANTS="#3a3a4e"
    BOOTS="#4a2810"

    # Base body - slightly different per direction
    # Leg offset for walk cycle
    if [ "$frame" = "0" ]; then
      LLEG_X=12; RLEG_X=18
    elif [ "$frame" = "1" ]; then
      LLEG_X=10; RLEG_X=20
    else
      LLEG_X=14; RLEG_X=16
    fi

    if [ "$dir" = "0" ]; then
      # South (facing camera)
      convert -size 32x32 xc:none \
        -fill "$HAIR" -draw "rectangle 12,2 20,6" \
        -fill "$SKIN" -draw "rectangle 13,6 19,10" \
        -fill "$SKIN" -draw "point 14,8" -draw "point 18,8" \
        -fill '#2a1808' -draw "point 14,7" -draw "point 18,7" \
        -fill "$SKIN" -draw "point 16,9" \
        -fill "$SHIRT" -draw "rectangle 11,10 21,18" \
        -fill "$SHIRT" -draw "rectangle 8,11 11,16" \
        -fill "$SHIRT" -draw "rectangle 21,11 24,16" \
        -fill "$SKIN" -draw "rectangle 8,16 10,18" \
        -fill "$SKIN" -draw "rectangle 22,16 24,18" \
        -fill "$PANTS" -draw "rectangle 12,18 20,24" \
        -fill "$BOOTS" -draw "rectangle $LLEG_X,24 $(($LLEG_X+3)),28" \
        -fill "$BOOTS" -draw "rectangle $RLEG_X,24 $(($RLEG_X+3)),28" \
        "$FNAME"
    elif [ "$dir" = "1" ]; then
      # North (facing away)
      convert -size 32x32 xc:none \
        -fill "$HAIR" -draw "rectangle 12,2 20,8" \
        -fill "$SHIRT" -draw "rectangle 11,8 21,18" \
        -fill "$SHIRT" -draw "rectangle 8,9 11,16" \
        -fill "$SHIRT" -draw "rectangle 21,9 24,16" \
        -fill "$SKIN" -draw "rectangle 8,16 10,18" \
        -fill "$SKIN" -draw "rectangle 22,16 24,18" \
        -fill "$PANTS" -draw "rectangle 12,18 20,24" \
        -fill "$BOOTS" -draw "rectangle $LLEG_X,24 $(($LLEG_X+3)),28" \
        -fill "$BOOTS" -draw "rectangle $RLEG_X,24 $(($RLEG_X+3)),28" \
        "$FNAME"
    elif [ "$dir" = "2" ]; then
      # East (facing right)
      convert -size 32x32 xc:none \
        -fill "$HAIR" -draw "rectangle 13,2 21,7" \
        -fill "$SKIN" -draw "rectangle 15,6 22,10" \
        -fill '#2a1808' -draw "point 20,7" \
        -fill "$SKIN" -draw "point 21,9" \
        -fill "$SHIRT" -draw "rectangle 12,10 22,18" \
        -fill "$SHIRT" -draw "rectangle 22,11 26,16" \
        -fill "$SKIN" -draw "rectangle 26,14 28,18" \
        -fill "$PANTS" -draw "rectangle 13,18 21,24" \
        -fill "$BOOTS" -draw "rectangle $LLEG_X,24 $(($LLEG_X+3)),28" \
        -fill "$BOOTS" -draw "rectangle $RLEG_X,24 $(($RLEG_X+3)),28" \
        "$FNAME"
    else
      # West (facing left)
      convert -size 32x32 xc:none \
        -fill "$HAIR" -draw "rectangle 11,2 19,7" \
        -fill "$SKIN" -draw "rectangle 10,6 17,10" \
        -fill '#2a1808' -draw "point 12,7" \
        -fill "$SKIN" -draw "point 11,9" \
        -fill "$SHIRT" -draw "rectangle 10,10 20,18" \
        -fill "$SHIRT" -draw "rectangle 6,11 10,16" \
        -fill "$SKIN" -draw "rectangle 4,14 6,18" \
        -fill "$PANTS" -draw "rectangle 11,18 19,24" \
        -fill "$BOOTS" -draw "rectangle $LLEG_X,24 $(($LLEG_X+3)),28" \
        -fill "$BOOTS" -draw "rectangle $RLEG_X,24 $(($RLEG_X+3)),28" \
        "$FNAME"
    fi

    HERO_FRAMES="$HERO_FRAMES $FNAME"
  done
done

# Combine into spritesheet: 3 columns x 4 rows = 96x128
# Row 0: South frames (0,1,2)
# Row 1: North frames (0,1,2)
# Row 2: East frames (0,1,2)
# Row 3: West frames (0,1,2)
convert \
  \( /tmp/hero_0_0.png /tmp/hero_0_1.png /tmp/hero_0_2.png +append \) \
  \( /tmp/hero_1_0.png /tmp/hero_1_1.png /tmp/hero_1_2.png +append \) \
  \( /tmp/hero_2_0.png /tmp/hero_2_1.png /tmp/hero_2_2.png +append \) \
  \( /tmp/hero_3_0.png /tmp/hero_3_1.png /tmp/hero_3_2.png +append \) \
  -append "$CHAR_DIR/hero.png"

echo "Hero spritesheet generated."

# Clean up temp files
rm -f /tmp/hero_*.png

echo "All assets generated successfully!"
