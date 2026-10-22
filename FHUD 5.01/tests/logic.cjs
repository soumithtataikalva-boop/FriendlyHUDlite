// Runs selected production WitcherScript logic with mocked engine services.
// This restricted syntax adapter is not a WitcherScript compiler or game test.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const scripts = path.join(__dirname, '../modFriendlyHUD/content/scripts');
function method(file, name, scope, outParams = []) {
  const source = fs.readFileSync(path.join(scripts, file), 'utf8');
  const match = new RegExp('(?:function|event)\\s+' + name + '\\s*\\(([^)]*)\\)[^{]*\\{').exec(source);
  assert.ok(match, `Missing production method ${name}`);
  const start = match.index + match[0].length;
  let end = start, depth = 1, quote = '', comment = '';
  for (; depth; end++) {
    const c = source[end], next = source[end + 1];
    assert.notEqual(c, undefined, 'Unterminated function');
    if (comment === '//') { if (c === '\n') comment = ''; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = ''; end++; } continue; }
    if (quote) { if (c === '\\') end++; else if (c === quote) quote = ''; continue; }
    if (c === '/' && (next === '/' || next === '*')) { comment = c + next; end++; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  let body = source.slice(start, end - 1)
    .replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')
    .replace(/\bNULL\b/g, 'null')
    .replace(/\b(\d+(?:\.\d+)?)f\b/g, '$1')
    .replace(/\((?:float|CR4ScriptedHud|CR4HudModuleOneliners|EBuffsDisplayMode)\)/g, '')
    .replace(/\(CR4HudModuleDamagedItems\)this/g, 'this.isDamagedItems')
    .replace(/\(CR4HudModuleCompanion\)this/g, 'this.isCompanion')
    .replace(/\bvar\s+([^:;]+)\s*:\s*([\w]+(?:\s*<[^>]+>)?)\s*(=[^;]*)?;/g,
      (_, names, type, init) => 'var ' + names.trim().split(',').map(n => n.trim() + (init || ' = ' +
        (type === 'int' || type === 'float' ? '0' : type === 'bool' ? 'false' : type === 'string' ? '""' : 'null'))).join(', ') + ';')
    .replace(/\.Size\(\)/g, '.length')
    .replace(/\.Contains\(([^()]*)\)/g, '.includes($1)')
    .replace(/\.PushBack\(([^()]*)\)/g, '.push($1)')
    .replace(/\.FindFirst\(([^()]*)\)/g, '.indexOf($1)')
    .replace(/\.Erase\(([^;]*)\);/g, '.splice($1, 1);');
  const params = match[1].split(',').map(p => p.trim().replace(/^(?:out|optional)\s+/, '').split(':')[0].trim())
    .filter(p => p && !outParams.includes(p));
  const fn = new Function(...params, 'with(this) { ' + body + ' }');
  scope[name] = function (...args) { return fn.apply(scope, args); };
  return scope[name];
}
const markerFile = 'fhudscripts/modMarkers.ws';
function markerScope(delay = 3) {
  const scope = {config: {markersFadeOutDelay: delay}, fading: false, remaining: 0,
    timeDelta: 0.5, markersAlpha: 80, MaxF: Math.max, ClampF: (v,a,b) => Math.max(a,Math.min(b,v))};
  method(markerFile, 'UpdateMarkerVisibility', scope, ['fading','remaining']);
  method(markerFile, 'GetMarkerFadeAlpha', scope);
  return scope;
}
test('zero marker fade hides immediately and never returns an invalid alpha', () => {
  const s = markerScope(0);
  assert.equal(s.UpdateMarkerVisibility(false, true), false);
  assert.equal(s.fading, false);
  assert.equal(s.GetMarkerFadeAlpha(0), 0);
});
test('marker fade completes without restarting at its final frame', () => {
  const s = markerScope(1);
  assert.equal(s.UpdateMarkerVisibility(true, false), true);
  assert.equal(s.UpdateMarkerVisibility(false, true), true);
  assert.equal(s.UpdateMarkerVisibility(false, true), true);
  assert.equal(s.remaining, 0.5);
  assert.equal(s.UpdateMarkerVisibility(false, true), false);
  assert.equal(s.UpdateMarkerVisibility(false, false), false);
});
test('changing to zero duration cancels an active fade', () => {
  const s = markerScope(2); s.fading = true; s.remaining = 1; s.config.markersFadeOutDelay = 0;
  assert.equal(s.UpdateMarkerVisibility(false, true), false);
  assert.equal(s.remaining, 0);
});
function moduleScope(enabled) {
  const flash = {alpha: 100, visible: false, GetVisible() { return this.visible; },
    GetAlpha() { return this.alpha; }, SetAlpha(v) { this.alpha = v; }};
  const s = {toggleReasons: [], isFadingOut: false, isEnabledTemporarily: false,
    isShownTemporarily: false, hide: false, disable: false, fadeOutCfgTime: 0,
    isDamagedItems: false, isCompanion: false, m_bEnabled: enabled,
    GetEnabled() { return this.m_bEnabled; }, GetModuleFlash: () => flash,
    GetFHUDConfig: () => ({fadeOutTimeSeconds: 1})};
  s.m_fxSetEnabledSFF = {InvokeSelfOneArg(v) { s.m_bEnabled = v; }};
  s.m_fxShowElementSFF = {InvokeSelfTwoArgs(v) { flash.visible = v; }};
  s.FlashArgBool = v => v;
  const file = 'game/gui/hud/modules/hudModuleBase.ws';
  for (const name of ['ToggleOnTemporarily','ToggleOffTemporarily','StartFadeOut','ResetFadeOut','UpdateFadeOut','ShowElement','SetEnabled']) method(file,name,s);
  return {s,flash};
}
for (const initiallyEnabled of [true, false]) {
  test(`interrupted fade restores original enabled=${initiallyEnabled} state`, () => {
    const {s,flash} = moduleScope(initiallyEnabled);
    s.ToggleOnTemporarily('held'); s.ToggleOffTemporarily('held');
    s.UpdateFadeOut(0.25); assert.ok(flash.alpha < 100);
    s.ToggleOnTemporarily('held'); assert.equal(flash.alpha,100);
    s.ToggleOffTemporarily('held'); s.UpdateFadeOut(2);
    assert.equal(s.m_bEnabled,initiallyEnabled);
    assert.equal(flash.visible,false);
  });
}
test('overlapping visibility reasons keep the module enabled until both end', () => {
  const {s} = moduleScope(false);
  s.ToggleOnTemporarily('combat'); s.ToggleOnTemporarily('held');
  s.ToggleOffTemporarily('combat'); assert.equal(s.isFadingOut,false);
  s.ToggleOffTemporarily('held'); s.UpdateFadeOut(2); assert.equal(s.m_bEnabled,false);
});
test('settings persist without a spawned player; refresh when one exists', () => {
  let saved = 0, updated = 0;
  const s = {thePlayer: null, hasChangedOption: true, theGame: {SaveUserSettings() { saved++; }}};
  method('fhudconfig/modFriendlyHUDConfig.ws','GetFHUDConfig',s);
  method('game/gui/main_menu/ingameMenu.ws','SaveChangedSettings',s);
  s.SaveChangedSettings(); assert.equal(saved,1);
  s.thePlayer = {fHUDConfig: {UpdateUserSettings() { updated++; }}};
  s.hasChangedOption = true; s.SaveChangedSettings(); assert.equal(updated,1);
});
test('marker cache notifications tolerate missing HUD, module and helper', () => {
  const s = {theGame: {GetHud: () => null}, modMarkers: null};
  method(markerFile,'Mod3DMarkersSignalCache3DMarkers',s);
  s.Mod3DMarkersSignalCache3DMarkers(true);
  s.theGame.GetHud = () => ({GetHudModule: () => null});
  s.Mod3DMarkersSignalCache3DMarkers(true);
  method('game/gui/hud/modules/hudModuleOneliners.ws','SignalCache3DMarkers',s);
  s.theGame.GetHud = () => ({GetHudModule: () => s});
  s.Mod3DMarkersSignalCache3DMarkers(true);
  let called = 0; s.modMarkers = {SignalCache3DMarkers() { called++; }};
  s.Mod3DMarkersSignalCache3DMarkers(true); assert.equal(called,1);
});
test('all radial input registrations are removed on cleanup', () => {
  const registered = new Map();
  const s = {theInput: {RegisterListener(target, cb, action) { registered.set(action,cb); },
    UnregisterListener(target, action) { registered.delete(action); }}};
  const file = 'fhudscripts/modRadialMenuPotions.ws';
  method(file,'RegisterModInput',s); method(file,'UnregisterModInput',s);
  s.RegisterModInput(); assert.equal(registered.size,22);
  s.UnregisterModInput(); assert.equal(registered.size,0);
});
test('cycling skips placeholder-only categories and retains fixed hotkey slots', () => {
  const file = 'fhudscripts/modRadialMenuPotions.ws';
  const s = {cycle: 0, BDM_ShowPotions:0, BDM_ShowBombs:1, BDM_ShowOils:2, BDM_ShowBuffs:3,
    config:{cycleThroughBuffs:false}, potions:Array(12).fill(null), bombs:Array(8).fill(null),
    oils:[null,42], disallowOilsInCombat:false, thePlayer:{IsInCombat:()=>false},
    playerInventory:{IsIdValid:id=>id!==null}};
  method(file,'HasValidItems',s); method(file,'CycleModes',s,['cycle']);
  s.CycleModes(); assert.equal(s.cycle,2);
  let selected; s.mode=2; s.IsPressed=()=>true; s.ApplyOil=id=>{selected=id;};
  method(file,'UseItemAtIndex',s); method(file,'OnUseItem2',s);
  s.OnUseItem2({}); assert.equal(selected,42);
});
test('price formatting omits zero bases and preserves fractional bolt prices', () => {
  const s = {FloatToStringPrec:(n,p)=>n.toFixed(p), RoundMath:Math.round};
  method('game/gui/_old/components/guiTooltipComponent.ws','GetFHUDPriceComparison',s);
  const inventory={GetItemPrice:()=>0,IsItemBolt:()=>false};
  assert.equal(s.GetFHUDPriceComparison({},inventory,5),'');
  inventory.GetItemPrice=()=>5; inventory.IsItemBolt=()=>true;
  assert.equal(s.GetFHUDPriceComparison({},inventory,1),' [0.50 : 200%]');
});
test('whole-marker ID allocation stops before the compass range', () => {
  const allocated=[];
  const s = {onelinersMaxID:100500, MARKERS_END_ID:100899, bIconCurrentlyShown:true,
    bDescriptionCurrentlyShown:true,bDistanceCurrentlyShown:true,
    SetMarkerScreenPosition() {}, UpdateMarkerText(text,id) { allocated.push(id); },
    GetMarkerDistanceText:()=>'', UpdateMarkerOneliner() {}};
  method(markerFile,'UpdateMarker',s);
  for(let i=0;i<160;i++) s.UpdateMarker({onScreen:true,text:'x',description:'y'});
  assert.equal(allocated.length,399); assert.equal(Math.max(...allocated),100898);
  assert.ok(allocated.every(id=>id<100900));
});
test('unchanged marker sprites are retained; changed text or missing sprites recreate', () => {
  let created=0, removed=0; const sprites=new Map();
  const s = {MARKERS_START_ID:100500, markerTexts:Array(400).fill(''), module:{
    FXGetOneliner:id=>sprites.get(id), FXCreateOneliner(text,id) { created++;sprites.set(id,{}); },
    FXRemoveOneliner(id) { removed++;sprites.delete(id); }}};
  method(markerFile,'UpdateMarkerText',s);
  s.UpdateMarkerText('quest',100500); s.UpdateMarkerText('quest',100500);
  assert.equal(created,1); assert.equal(removed,0);
  s.UpdateMarkerText('new quest',100500); assert.equal(created,2); assert.equal(removed,1);
  sprites.clear();s.UpdateMarkerText('new quest',100500);assert.equal(created,3);
});
test('completed POI modes show/pin/force survive filtering; hidden and disabled quests do not', () => {
  const s = {MV_Hide:1,config:{markersShowDisabled:0},IsQuest:marker=>!!marker.quest};
  method(markerFile,'ShouldSkipDisabledMarker',s);
  const completed = {isDisabled:true};
  for (const mode of [0,2,3]) {
    s.config.markersShowDisabled=mode;
    assert.equal(s.ShouldSkipDisabledMarker(completed),false);
  }
  s.config.markersShowDisabled=1;assert.equal(s.ShouldSkipDisabledMarker(completed),true);
  s.config.markersShowDisabled=0;assert.equal(s.ShouldSkipDisabledMarker({isDisabled:true,quest:true}),true);
  assert.equal(s.ShouldSkipDisabledMarker({isDisabled:false}),false);
});
