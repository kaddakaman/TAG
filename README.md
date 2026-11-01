# TAG - The Adventurer's Guild

An isometric action RPG for mobile, in the spirit of Diablo, with RuneScape / New World style life skills and Dark Souls style respawning wilds. It runs in any modern mobile or desktop browser, can be installed as a PWA, and is playable with **touch (virtual gamepad)**, **a physical gamepad** or **keyboard**.

Everything is drawn procedurally on an HTML5 canvas, so there are no art assets to manage, and the character customisation you choose is visible in game.

## Running it

```bash
npm install
npm run dev        # dev server (also reachable from your phone on the same Wi-Fi via the printed network URL)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # unit + headless world simulation tests
```

To play on a phone, open the dev or preview URL, then use **Add to Home Screen** to install it fullscreen. Landscape is recommended.

## Features

### Characters
- **Three classes**: Fighter, Mage and Ranger, each with its own weapons, armour types and resource (Stamina, Mana, Focus).
- **Customisation**: name, gender, four hair styles per gender, skin tone, hair colour, and **primary / secondary / tertiary clothing colours**. These are visible on your character (tunic, trousers, belt, trim and cape), on top of equipped helmets, shoulder plates and weapons.
- **D&D-style attributes** (STR, DEX, CON, INT, WIS, CHA): 5 points per level to spend however you like. Each attribute matters, from damage and carry weight to cooldowns and vendor prices.
- **Combat level comes from combat only**: killing enemies and finishing combat quests. Life skills never grant combat experience.

### Class abilities (1 skill point per level, 5 ranks each, with prerequisites and level gates)
| Class | Trees | Major attacks |
|---|---|---|
| Fighter | **Blades** (sword), **Axes**, **Hammers** (mace), **Warfare** (any weapon / shield) | Bladestorm, Executioner, Earthshaker |
| Mage | **Fire**, **Frost**, **Lightning**, **Arcane** | Meteor, Blizzard, Thunderstorm |
| Ranger | **Archery**, **Poisons**, **Survival** | Arrow Rain, Plague Volley, Call of the Wild |

Fighter techniques require the matching weapon equipped (Cleave needs a sword, Rend an axe, and so on). Mages choose a school and conjure stronger versions of it. Rangers loose multishots, coat arrows in poison, set traps and summon spirit wolves. Abilities go on a 4-slot action bar.

### The world
- **Hearthvale**, the home settlement: the Adventurer's Guild, bounty board, blacksmith, merchant, inn, herbalist, warehouse, town hall, guard captain and fisherman. Practice gathering spots sit inside the walls.
- **Six regions**, each harder the further they are from town: Greenmeadow Fields (1-4), Whisperwood (4-8), Barrowmoor (8-12), Ironfang Highlands (12-17), Silverleaf Glade (17-22) and The Ashen Wastes (22-28). Each is procedurally generated from a fixed seed, with camps, wanderers, elites, a boss, resources and a waystone. Enemy level rises as you go deeper.
- **Enemy factions with distinct behaviour**: beasts (wolves, boars, spiders, bears), bandits and cultists, goblins, undead (skeletons, zombies, ghouls, wraiths), orcs and ogres, elves and treants, and monsters (imps, golems, hellhounds, drakes). Behaviours include melee, ranged kiting, casters, chargers and swarms. Special attacks include charges, telegraphed slams, novas, fire breath, volleys, summons, heals, roots, webs, blinks, meteors and enrage.
- **Bosses**: Grizzlemaw, Skitter the Brood Mother, Morteth the Hollow King, Warchief Gorrak, Sylvaris the Thornqueen and Ashmaw the Cinder Drake.

### Dark Souls style respawning
- **Returning to town respawns every enemy** in every region you've cleared, whether you walk back, use a waystone, recall or die.
- Experience falls off as you out-level enemies, and reaches **zero at 5 levels above** them. Each full clear of a region (followed by a town visit) also reduces its experience.
- **Dying** drops half your carried gold in a satchel where you fell. Get back alive to recover it; die first and it's gone.

### Quests and bounties
- **Guild contracts**: a 12-quest story chain from Guildmaster Aldric. Killing a region's boss opens the road to the next region.
- **Villager requests**: the blacksmith wants ore, the innkeeper wants cooked fish, the herbalist wants herbs, the fisherman wants trout, the guard captain wants bandits dealt with. Rewards include tool upgrades and unlocks such as potion brewing.
- **Bounty board**: three fresh bounties every time you return to town. They include hunts, **wanted elites** that spawn in the world while the bounty is active, **supply requests** for a specific ore, log, fish or herb, and **kitchen orders** for cooked meals.

### Life skills: Mining, Woodcutting, Fishing, Foraging, Cooking
- Gather from ore veins, trees, fishing pools and herb patches. Higher-tier nodes need higher skill levels, and better tools (upgraded at the blacksmith) gather faster.
- **Ore → blacksmith**: forge weapons, off-hands, armour and jewellery for your class (Copper → Iron → Steel → Mithril → Adamant). Forged gear is always Uncommon or better.
- **Logs → campfire**: light a fire in the field from your bag, then cook at it. Standing near a campfire also speeds up life regeneration.
- **Cooking → food buffs**: meals heal and grant a 5-minute *Well Fed* stat bonus. Higher cooking levels burn less food.
- **Herbs → potions**: Old Maren brews healing potions once you've helped her.

### Inventory and loot
- **Weight-based inventory**: no slot grid. Over your carry limit you're **Overburdened and can only walk**. Auto-pickup never overburdens you; pick up heavier loot by hand if you want to push on. Strength and some gear raise the limit.
- **Quality hierarchy**: Common, Uncommon, Rare, Epic and Legendary, with more affixes and higher value at each tier. Rare+ drops get a light beam.
- Drops are biased toward your class but not exclusive to it. Items list the classes that can use them and compare against what you're wearing.
- **Personal storage** in town starts at 20 slots and grows with town donations.
- **The Guild Vault** is shared by **all save slots**. Found a staff on your fighter? Vault it for your mage.

### Hearthvale grows
Donate gold to the Steward to raise the town through six levels. Each level expands storage, hires more guards (who fight alongside you when **raiders attack the town**), improves vendor stock and prices, unlocks better metals at the forge, and replaces the palisade with stone walls.

### Saving
- **Six save slots**, each a separate character with their own town progress. The Guild Vault is shared across slots.
- The game autosaves on zone changes, every 45 seconds, and when the app is backgrounded. You can also save from the pause menu.

## Controls

| Action | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Move | Drag anywhere on the left half (floating stick) | WASD / Arrows | Left stick |
| Attack (auto-targets) | Sword button (hold) | Space / J (hold) | A (hold) |
| Abilities 1-4 | Ability buttons | 1 2 3 4 | X, B, RB, RT |
| Interact / talk / gather / pick up | Context button | E | Y |
| Potion | Potion button | Q | LB |
| Inventory | Bag | I | Back/Select |
| Journal / Skills / Hero / Map | HUD buttons | L / K / C / M | D-pad up / down / left / right |
| Pause menu | ☰ | Esc | Start |
| Menus | Tap | Mouse | D-pad/stick to move, A select, B back, LB/RB switch tabs |

The HUD switches automatically between the touch layout and a compact desktop/gamepad bar that shows key hints. You can force touch controls on or off in Settings.

## Project layout

```
src/
  data/       game content: classes, abilities, items & affixes, enemies, zones, life skills & recipes, quests, town & NPCs
  systems/    rules with no rendering: stats, items/loot, session (inventory, xp, quests, bounties, town), crafting, vendors, saving
  world/      simulation: map + procedural generation, entities, enemy AI, player abilities, the World loop
  render/     isometric canvas renderer, procedural character/creature/prop drawing
  input/      unified input (keyboard, touch joystick, Gamepad API)
  ui/         DOM HUD, panels (inventory, skills, shops, forge, ...), title / slots / character creation
tests/        vitest suites, including headless world simulations
public/       PWA manifest, icon, service worker
```

Content is data-driven. To add an enemy, item, recipe, quest or ability, add an entry to the relevant file in `src/data/`.

## Shipping to app stores

The game is a static web app, so it can be wrapped with [Capacitor](https://capacitorjs.com/) for Android and iOS:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init TAG com.example.tag --web-dir=dist
npm run build && npx cap add android && npx cap open android
```
