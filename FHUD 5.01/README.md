# FHUD 5.01

FriendlyHUD port candidate based on the user-supplied `Vanilla Scripts 5.01` scripts and FriendlyHUD archive. Original author: wghost81 / Wasteland Ghost. Original credits and documentation are retained in `modFriendlyHUD/README.txt` and `README_RUS.txt`.

## Status

All 29 game-script overrides were reconstructed from the supplied vanilla files plus the audited FriendlyHUD changes. All original features, compatibility hooks, settings, localization, textures, and input definitions are retained. The original source folders are unchanged.

The supplied FriendlyHUD scripts already match the supplied vanilla code outside the audited mod changes. This is a conservative port, not a rewrite. `PORT_MANIFEST.json` records baseline and original-mod hashes for each game override and lists additional corrections.

Corrections in this candidate:

- Treat a zero-second HUD fade as immediate hiding, without division by zero.
- Check that an NPC has a merchant component before inspecting its merchant type.
- Pass an actual boolean to `SetEnabled` and explicitly parse the DLC visibility setting.
- Restore vanilla zero-weight tooltip hiding when stash quantity display is disabled.
- Remove the extra dialogue SHOW diagnostic log.
- Initialize minimap alpha even when dialogue/cutscenes pause its fade.

The mod's stash stack-splitting, alchemy merchant improvements, journal marker fallback, and quest-map sound suppression are intentionally retained as FriendlyHUD features. Disabling menu options does not remove every mod behavior.

## Installation

1. Back up existing game configuration and user settings. Remove the previous installed `modFriendlyHUD` and regenerate old Script Merger outputs when updating; do not install both versions together.
2. Copy this folder's `modFriendlyHUD` directory into the game's `Mods` directory.
3. Copy `modFriendlyHUD/bin/config/r4game/user_config_matrix/pc/modFHUDConfig.xml` into the matching game `bin/config/r4game/user_config_matrix/pc` directory. Register it in the game's applicable menu file lists if required by your installation, preserving existing entries.
4. Merge the FriendlyHUD sections of the supplied `input.xml` into the game's existing `input.xml`. Do not replace input configuration used by other mods.
5. Merge `input.settings.part.txt` into your user `input.settings`, and `dx12user.settings.part.txt` into the active user settings file described in the original README. Preserve existing sections and avoid duplicate keys.
6. Resolve conflicts with other mods using Script Merger.
7. For the dynamic HUD, turn the relevant modules off in vanilla video settings. Disable overlapping vanilla dynamic minimap/quest-log behavior as described in the original README.

## Validation and remaining checks

Static validation checks XML, delimiter balance against the original scripts, preservation of unchanged assets/helpers, baseline hashes, and presence of all 29 overrides. Results are recorded in `VALIDATION.md`.

The game and its script compiler are not present in this cloud workspace. This candidate has not been compiled or run in the game. The 5.01 version label comes from the supplied baseline and was not independently authenticated. Texture/Flash assets and localized strings were retained from the supplied mod and need in-game compatibility verification.

Before release, check:

- Load an existing save and start a new game without script errors.
- Exercise combat, sword drawing, damage/healing, Witcher senses, hold/pin hotkeys, fading including 0 seconds, minimap transitions, and quest tracking.
- Exercise 3D markers and compass, all marker filters, map zoom, and map-filter synchronization.
- Exercise radial potions/bombs/oils/buffs with keyboard and controller; check pause and crossbow switching.
- Exercise inventory defaults/new flags, tooltips, stash stack splitting, crafting counts, and alchemy with and without a merchant.
- Exercise Cat indoors/outdoors/at night, journal silence/hiding, enemy display settings, main-menu selection, and DLC icons.

No runtime compatibility claim is made until these checks pass.
