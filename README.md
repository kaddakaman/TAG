# TAG - The Adventurer's Guild

An isometric action RPG for mobile, in the spirit of Diablo, with RuneScape / New World style life skills and Dark Souls style respawning wilds. It's an **Android app (APK)**, and it also runs in any modern browser. You can play it with **touch (an on-screen virtual gamepad)**, **a physical gamepad** or **a keyboard**.

Everything is drawn procedurally, so there are no art assets to manage, and the character customisation you choose is visible in game.

## Play it on your Android phone

You don't need a computer for this.

1. On your Android phone, open this link in Chrome: **https://github.com/kaddakaman/TAG/releases/latest**
2. Under **Assets**, tap **TAG.apk** to download it.
3. When it finishes, tap the download to open it, then tap **Install**.
   - If the phone says it can't install apps from this source, tap **Settings**, turn on **Allow from this source**, then go back and tap **Install**.
   - If Google Play Protect warns that the app is unrecognised, tap **More details**, then **Install anyway**. This happens for any app that isn't from the Play Store.
4. Open **TAG** from your app drawer. It always plays in landscape and full screen.

**To get a newer version**, repeat the same steps. It installs over the old one and keeps your saved games.

Your saved games live inside the app, so uninstalling the app deletes them.

APK files only work on Android. iPhones can't install them, but they can play the browser version below.

### How the APK gets made

Every time the game's code changes on GitHub, GitHub's servers automatically build a fresh `TAG.apk` and put it on the Releases page (see `.github/workflows/android.yml`). You can watch a build under the repository's **Actions** tab; each one takes about five minutes.

The Android app itself lives in `android/` and uses [Capacitor](https://capacitorjs.com/) to wrap the game.

**About the signing key.** Every version of the app is signed with the same key, which is what lets updates install over the old app and keep your saves. The key is stored **encrypted** in `android/app/tag-release.jks.enc`. Only GitHub's build can unlock it, using a password kept in a repository secret called `KEYSTORE_PASSWORD`. Keep a private copy of that password too: if it's lost, you'd need a new key, and updates would then need a reinstall.

To set up the secret (once):
1. On GitHub, open the repository and go to **Settings**, then **Secrets and variables**, then **Actions**.
2. Tap **New repository secret**.
3. For **Name**, enter `KEYSTORE_PASSWORD`. For **Secret**, paste the password. Then tap **Add secret**.
4. Go to the **Actions** tab, open **Build Android APK**, tap **Run workflow**, then **Run workflow** again.

## Play it in a browser on your computer

1. Install **Node.js** from [nodejs.org](https://nodejs.org) (the **LTS** button).
2. On GitHub, click **Code**, then **Download ZIP**, and unzip it.
3. Open a terminal in the unzipped folder (the one containing `package.json`).
   - **Windows:** click the folder's address bar, type `cmd` and press Enter.
   - **Mac:** open Terminal, type `cd ` (with a space), drag the folder in, and press Enter.
4. Type `npm install` and press Enter. You only need to do this the first time.
5. Type `npm run dev` and press Enter, then open the **Local** address it prints (`http://localhost:5173`).
   To stop it, press **Ctrl + C** in the terminal.

### Developer commands

```bash
npm run dev        # dev server (reachable from devices on the same Wi-Fi via the printed Network URL)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # unit + headless world simulation tests
npx cap sync android                                  # copy a fresh build into the Android project
cd android && ./gradlew assembleRelease               # build the APK locally (needs the Android SDK)
```

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
android/      the Android app project (Capacitor) that wraps the game into an APK
.github/      the automatic APK build that runs on GitHub
public/       PWA manifest, icon, service worker
```

Content is data-driven. To add an enemy, item, recipe, quest or ability, add an entry to the relevant file in `src/data/`.

## Publishing to app stores

The Android project in `android/` can be opened in Android Studio to produce a Play Store bundle (`./gradlew bundleRelease`). Before you upload, replace the signing key with a private one.

An iOS version can be added the same way (`npm i @capacitor/ios && npx cap add ios`), but building it needs a Mac with Xcode.
