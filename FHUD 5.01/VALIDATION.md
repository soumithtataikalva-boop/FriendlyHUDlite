# Static validation

Command: `python3 "FHUD 5.01/tests/validate_package.py"` from the repository root.

- 70 package files retained; the Cat vision script override was intentionally removed.
- 43 untouched package files remain byte-identical to the supplied mod.
- All 29 original vanilla/mod script hash pairs verified, including the removed override's provenance.
- Both XML files parse; 8 menu sections and 85 settings remain, with unique setting IDs per section.
- Delimiters balance in all 36 remaining scripts.
- No custom Cat vision setting keys remain in scripts, XML, settings templates or source translations; both obsolete translation IDs are removed from CSV sources.
- Original mod and vanilla folders remain unchanged.
- Compiled localization bundles are retained; obsolete option labels are unreferenced and have no active functionality.
- PORT_CHANGES.diff includes all package edits and the deleted override.
- Game compilation and in-game behavior: NOT RUN (game/toolchain unavailable).

## Review regression checks

Command: `node --test "FHUD 5.01/tests/logic.cjs"` from the repository root.

14 tests passed, 0 failed, 0 skipped. The harness executes selected production method bodies through a restricted JavaScript syntax adapter and mocks engine services. Covered cases include absent player/HUD/helper, zero and interrupted fades, overlapping visibility reasons, all radial listener cleanup, empty item categories, fixed hotkey slots, zero/fractional prices, marker ID limits, sprite reuse and completed-POI modes.

This is hosted logic validation, not game compilation. Engine lifecycles, WitcherScript type/dispatch behavior, assets and Flash rendering still need in-game testing.
