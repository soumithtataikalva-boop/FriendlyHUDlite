# FHUD 5.01

FriendlyHUD for the supplied Vanilla Scripts 5.01 baseline. Original author: wghost81 / Wasteland Ghost. Original credits and documentation are retained in `modFriendlyHUD/README.txt` and `README_RUS.txt`.

## Installation

1. Back up your game configuration and user settings. Remove the previous installed `modFriendlyHUD` folder before updating, then regenerate Script Merger outputs.
2. Copy `modFriendlyHUD` into the game's `Mods` directory.
3. Copy `modFriendlyHUD/bin/config/r4game/user_config_matrix/pc/modFHUDConfig.xml` into the matching game configuration directory. Register it in the applicable menu file lists if your installation requires it.
4. Merge the FriendlyHUD sections of the supplied `input.xml` into the game's existing input configuration.
5. Merge `input.settings.part.txt` into your user `input.settings`, and `dx12user.settings.part.txt` into the active user settings file described in the original README. Preserve existing sections and avoid duplicate keys.
6. Resolve conflicts with other mods using Script Merger.
7. For the dynamic HUD, turn the relevant modules off in vanilla video settings. Disable overlapping vanilla dynamic minimap/quest-log behavior as described in the original README.

## Port notes

Custom Cat vision controls have been removed; Cat uses the game's normal implementation. Cat remains available as an ordinary potion in the quick-item interface. Removing the previous installed mod folder before updating ensures its old Cat script override is removed too.

The menu contains 83 settings across 7 sections. Original documentation includes historical version labels and may describe removed features.

Main-menu background selection and DLC-icon hiding have been removed; the game uses its vanilla main-menu behavior. When upgrading, remove the old installed mod folder before copying this version so its deleted helper script does not remain.

This port has not been compiled or tested in the game.
