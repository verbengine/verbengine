VAR has_rope = false
VAR has_key = false

-> beach

=== beach ===
You stand on a sandy beach. A wrecked ship leans against the rocks. Palm trees sway in the wind.

+ [Look at the ship] -> beach_ship
+ [Look at the palm trees] -> beach_palms
+ {has_key} [Go north to the cave] -> cave
+ [Go east to the village] -> village

= beach_ship
The ship's hull is cracked open. Inside you spot a coil of rope.
+ [Take the rope]
  ~ has_rope = true
  You grab the rope. Could be useful.
  -> beach
+ [Leave it] -> beach

= beach_palms
Tall palm trees with coconuts. Nothing special, but the shade is nice.
-> beach

=== cave ===
A dark cave. Water drips from the ceiling. You see a chest in the corner.

+ [Look at the chest] -> cave_chest
+ [Go south to the beach] -> beach

= cave_chest
{has_rope:
  You tie the rope to the chest and pull it open. Gold coins spill everywhere! You've found Blackbeard's treasure!
  -> END
- else:
  The chest is wedged tight. You need something to pull it open.
  -> cave
}

=== village ===
A small fishing village. An old sailor sits on a barrel, muttering to himself.

+ [Talk to the sailor] -> village_sailor
+ [Go west to the beach] -> beach

= village_sailor
"Arrr, looking for the cave, are ye? You'll need the key. I dropped it somewhere on the beach... near the ship, I think."
~ has_key = true
-> village
