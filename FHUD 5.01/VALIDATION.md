# Static validation

Command: `python3 "FHUD 5.01/tests/validate_package.py"` from the repository root.

- 69 package files retained; the Cat vision override and standalone debug command were intentionally removed.
- 40 untouched package files remain byte-identical to the supplied mod.
- All 29 original vanilla/mod script hash pairs verified, including the removed override's provenance.
- Both XML files parse; 8 menu sections and 85 settings remain, with unique setting IDs per section.
- Delimiters balance in all 35 remaining scripts.
- No custom Cat vision setting keys remain in scripts, XML, settings templates or source translations; both obsolete translation IDs are removed from CSV sources.
- Original mod and vanilla folders remain unchanged.
- Compiled localization bundles are retained; obsolete option labels are unreferenced and have no active functionality.
- PORT_CHANGES.diff includes all package edits and the deleted override.
- Game compilation and in-game behavior: NOT RUN (game/toolchain unavailable).

## Review regression checks

Command: `node --test "FHUD 5.01/tests/logic.cjs"` from the repository root.

16 tests passed, 0 failed, 0 skipped. The harness executes selected production method bodies through a restricted JavaScript syntax adapter and mocks engine services. Covered cases include absent player/HUD/helper, zero and interrupted fades, overlapping visibility reasons, all radial listener cleanup, empty item categories, fixed hotkey slots, zero/fractional prices, marker ID limits, sprite reuse and completed-POI modes.

This is hosted logic validation, not game compilation. Engine lifecycles, WitcherScript type/dispatch behavior, assets and Flash rendering still need in-game testing.

## Dead-code cleanup checks

Removed package helpers were checked for active callers in the supplied runtime files. The modifier action still exists in input definitions/settings and is polled by the hold/pin handlers. Comment-only cleanup was compared at the token level to ensure it did not remove active statements. All 16 hosted regression checks pass after cleanup.

## Vanilla restoration checks

- All 93 debug/console function definitions (signatures and bodies, ignoring whitespace) match `Vanilla Scripts 5.01` directly.
- Vanilla logging/assertions, visual-debug paths, console exposure, debug input registrations, testing-item activation and debug-fact guards are restored.
- The redundant vanilla main-menu random sample/debug log is also restored, preserving the baseline.
- FriendlyHUD-specific cleanup, prior bug fixes and Cat override removal are preserved.
- Hosted regression suite: 16 passed, 0 failed, 0 skipped.
- Engine compilation/runtime testing remains outstanding.

Radial category cycling now retains its original view when all alternatives are empty or disallowed in combat. The regression test covers both Buffs-cycling preferences and unavailable oils. This change only adds logic to the FriendlyHUD helper; vanilla files and restored vanilla code are unchanged.

## Behavior-preserving refactor checks

The current hosted suite has 23 passing tests. Shared marker styling matches pre-refactor outputs for every original case, quest difficulty, active-quest highlight state and compass direction, including unknown/default cases. The saved fixture contains 111 marker states and 10 compass IDs. Projection checks preserve both public boolean contracts. Marker visibility retains category priority and pin/force overrides. Item lists retain substring-first matching, missing slots, silver-before-steel oil priority and compact controller selection; each tag is fetched once per list initialization.

Settings stages expand to the identical original statement sequence, including the positions of module refresh, zoom validation/update, forced-marker reset and cache notification. Interaction values retain their persisted numeric meanings. New-item classification passes all 32,768 combinations of its predicates across all categories; classification is deferred until needed, and category checks stop after clearing the flag.

The custom default-tab and forced-marker reset helpers were renamed with their internal callers. No vanilla code was removed. The 93 vanilla diagnostic definitions still match the supplied baseline. Review diff regenerated; whitespace checks pass. These checks do not replace game compilation or runtime testing.
