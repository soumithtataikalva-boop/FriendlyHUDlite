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
    // Preserve quoted asset URLs when removing comments.
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, token => token.startsWith('//') || token.startsWith('/*') ? '' : token)
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

test('normal Remaster movement settings still initialize despite their historical Debug name', () => {
  const calls = [];
  const scope = {StringToFloat:parseFloat,theGame:{GetInGameConfigWrapper:()=>({GetVarValue:(group,key)=>'1'})}};
  const setters = ['SetTargetLockSwitchCooldown','SetUseNewAnimations','SetUseNewLadderAnimations',
    'SetJumpCooldown','SetLandAddCoefVal','SetLandAddTimeCoefVal','SetLandAddTimeCoefFast',
    'SetLandAddCoefWalk','SetLandAddTimeCoefWalk'];
  for(const name of setters) scope[name] = value=>calls.push(name);
  method('game/player/r4Player.ws','InitRemasterDebugSettings',scope);
  scope.InitRemasterDebugSettings();
  assert.deepEqual(calls,setters);
});
test('cycling retains Buffs when every alternative is empty or unavailable in combat', () => {
  for (const cycleThroughBuffs of [true,false]) {
    for (const blockedOil of [false,true]) {
      const s = {cycle:3, BDM_ShowPotions:0, BDM_ShowBombs:1, BDM_ShowOils:2, BDM_ShowBuffs:3,
        config:{cycleThroughBuffs}, potions:Array(12).fill(null), bombs:Array(8).fill(null),
        oils:blockedOil?[42]:Array(12).fill(null), disallowOilsInCombat:blockedOil,
        thePlayer:{IsInCombat:()=>true}, playerInventory:{IsIdValid:id=>id!==null}};
      const file = 'fhudscripts/modRadialMenuPotions.ws';
      method(file,'HasValidItems',s); method(file,'CycleModes',s,['cycle']);
      s.CycleModes();
      assert.equal(s.cycle,3,`cycleThroughBuffs=${cycleThroughBuffs}, blockedOil=${blockedOil}`);
    }
  }
});

test('shared marker styles preserve every original mapping, quest level and active style', () => {
  const fixture = require('./marker_styles.json');
  const s = {config: {markersAltTextSize: 18}, QL_NORMAL: 0, QL_HIGH: 1, QL_LOW: 2,
    GetIconSize: () => 60, GetCompassIconSize: () => 102, COMPASS_START_ID: 100900};
  const methods = ['GetMarkerIcon','GetMarkerIconBW','GetMarkerAltText','GetMarkerAltTextBW'];
  for (const f of ['GetQuestIconByLevel','GetQuestAltTextByLevel','GetMarkerIconStyled',
    'GetMarkerAltTextStyled','BuildCompassIcon','GetCompassIcon','GetCompassIcon60',...methods]) method(markerFile,f,s);
  for (const {marker,expected} of fixture.rows)
    assert.deepEqual(methods.map(f => s[f](marker)), expected, JSON.stringify(marker));
  for (const {id,expected} of fixture.compass)
    assert.deepEqual([s.GetCompassIcon(id),s.GetCompassIcon60(id)],expected);
});

test('visibility lookup retains category priority, all modes and pinned/forced overrides', () => {
  const categories = ['ActiveQuest','Quest','UserMain','UserAdditional','MapLocation','NPC',
    'POIUndiscovered','POI','POIDisabled','Misc','Herb','Enemy','EnemyDead','WSClue'];
  const settings = ['Quests','QuestsAll','User','UserAll','MapLoc','NPCs','Undiscovered',
    'POIs','Disabled','Misc','Herbs','Enemies','DeadEnemies','WSClues'];
  const s = {config: {}, MV_Show: 1, MV_Pin: 2, MV_Force: 3};
  for (const category of categories) s['Is'+category] = m => m.categories.includes(category);
  for (const f of ['GetMarkerVisibilitySetting','ShouldShowMarker','ShouldPinMarker','ShouldForceMarker']) method(markerFile,f,s);
  for (let i=0;i<categories.length;i++) for(let mode=0;mode<4;mode++) {
    for(const setting of settings)s.config['markersShow'+setting]=0;
    s.config['markersShow'+settings[i]]=mode;
    const marker={categories:categories.slice(i),pin:false,force:false};
    assert.deepEqual([s.ShouldShowMarker(marker),s.ShouldPinMarker(marker),s.ShouldForceMarker(marker)],
      [mode===1,mode===2,mode===3]);
    for(const field of ['pin','force'])assert.equal(s.ShouldShowMarker({...marker,[field]:true}),true);
  }
  const unknown={categories:[]};
  assert.deepEqual([s.ShouldShowMarker(unknown),s.ShouldPinMarker(unknown),s.ShouldForceMarker(unknown)],[false,false,false]);
});

test('controller selection compacts valid IDs while inventory lists keep missing slots and silver priority', () => {
  const file='fhudscripts/modRadialMenuPotions.ws';
  const calls=[]; const used=[];
  const items={Potion:[11,12,13],Petard:[21],SilverOil:[31,32],SteelOil:[41,42]};
  const names={11:'potion_a_upgraded',12:'potion_a',13:'potion_b',21:'bomb_a',31:'oil_a',32:'oil_b',41:'oil_a',42:'oil_c'};
  const s={playerInventory:{IsIdValid:id=>id!==-1,GetItemName:id=>names[id],
      GetItemsByTag:tag=>{calls.push(tag);return items[tag];}},GetInvalidUniqueId:()=>-1,
    StrContains:(text,part)=>text.includes(part),NameToString:v=>v,
    potionNames:['potion_a','missing','potion_b'],bombNames:['bomb_a','missing'],oilNames:['oil_a','oil_b','oil_c','missing'],
    potions:[],bombs:[],oils:[],ConsumePotion:id=>used.push(id),EquipBomb:id=>used.push(id),ApplyOil:id=>used.push(id)};
  for(const f of ['FindItemByName','GetValidItemAtIndex','GetInventoryPotions','GetInventoryBombs','GetInventoryOils',
    'PadUseCurrentPotion','PadUseCurrentBomb','PadUseCurrentOil'])method(file,f,s);
  s.GetInventoryPotions();s.GetInventoryBombs();s.GetInventoryOils();
  assert.deepEqual(calls,['Potion','Petard','SilverOil','SteelOil']);
  assert.deepEqual(s.potions,[11,-1,13]);assert.deepEqual(s.bombs,[21,-1]);assert.deepEqual(s.oils,[31,32,42,-1]);
  for(const [f,expected] of [['PadUseCurrentPotion',[11,13]],['PadUseCurrentBomb',[21]],['PadUseCurrentOil',[31,32,42]]]) {
    used.length=0;
    for(s.padCurrent=-1;s.padCurrent<5;s.padCurrent++)s[f]();
    assert.deepEqual(used,expected);
  }
});

test('interaction constants preserve all prompt modes and the global disable option', () => {
  const file='fhudconfig/modFriendlyHUDConfig.ws';
  const s={interactionShowAll:0,interactionShowIcon:1,interactionShowText:2};
  for(const f of ['ShowInteractionIcon','ShowInteractionText','ShowEntityIcon','ShowEntityText'])method(file,f,s);
  for(const disabled of [false,true])for(let mode=0;mode<4;mode++)for(const action of ['Talk','Use']) {
    Object.assign(s,{disableAllInteractionPrompts:disabled,talkBubbleMode:mode,talkButtonMode:mode,interactionButtonMode:mode});
    for(const f of ['ShowInteractionIcon','ShowEntityIcon'])assert.equal(s[f](action),!disabled&&(mode===0||mode===1));
    for(const f of ['ShowInteractionText','ShowEntityText'])assert.equal(s[f](action),!disabled&&(mode===0||mode===2));
  }
});

test('settings stages preserve the original complete statement order', () => {
  const source=fs.readFileSync(path.join(scripts,'fhudconfig/modFriendlyHUDConfig.ws'),'utf8');
  function body(name) {
    const match=new RegExp('function '+name+'\\([^]*?\\n\\t\\}').exec(source);
    assert.ok(match,name);
    return match[0].slice(match[0].indexOf('{')+1,match[0].lastIndexOf('}'));
  }
  let expanded=body('UpdateUserSettings');
  for(const stage of ['HUD','Marker','QuickItem','Inventory','Interaction','Misc','Map']) {
    const name='Read'+stage+'Settings';
    expanded=expanded.replace(name+'();',body(name));
  }
  const digest=require('node:crypto').createHash('sha256')
    .update(expanded.replace(/\/\/[^\n]*/g,'').replace(/\s/g,'')).digest('hex');
  // Captured from the pre-refactor method, with only the reset-helper rename applied.
  assert.equal(digest,'323fd803dc53423d53842c9857a7b8159d3ecd3753120521c6fbe72b43724e0d');
});

test('new-item classification preserves results across every combination of item predicates', () => {
  const predicates=['isItemReadable','isFoodItem','isIngredientItem','isWeaponItem','isArmorItem',
    'isAlchemyItem','isUpgradeItem','isItemSchematic','isToolItem','isHorseItem','IsItemTrophy',
    'IsItemDye','isQuestItem','isQuickslotItem','isItemUsable'];
  const inv={};let bits=0;
  predicates.forEach((p,i)=>inv[p]=()=>!!(bits&(1<<i)));
  const s={_playerInv:inv,thePlayer:{inv}};
  method('game/gui/menus/inventoryMenu.ws','CheckIfShouldResetNewItemFlag',s);
  for(bits=0;bits<(1<<predicates.length);bits++) {
    const [read,food,ingredient,weapon,armor,alchemy,upgrade,schematic,tool,horse,trophy,dye,quest,quick,usable]=predicates.map(p=>inv[p]());
    const junk=!(read||food||ingredient||weapon||armor||alchemy||upgrade||schematic||tool||horse||trophy);
    const expected={Ingredients:ingredient&&!dye,Quest:quest,Others:(junk||read)&&!quick&&!trophy,
      Edibles:food,Roach:horse,Alchemy:alchemy&&!food&&!usable&&!dye,
      Equipment:weapon||armor||upgrade||tool||usable||quick||dye,Unknown:false};
    for(const [category,result] of Object.entries(expected))assert.equal(s.CheckIfShouldResetNewItemFlag(1,category),result);
  }
});

test('shared projection conversion preserves success and behind-camera boolean contracts', () => {
  const s={screenPos:{X:0,Y:0},theCamera:{WorldVectorToViewRatio:()=>true},
    hud:{GetScaleformPoint:(X,Y)=>({X:X*1920,Y:Y*1080})},
    GetOppositeCameraScreenPos:()=>{s.screenPos.X=-0.5;s.screenPos.Y=0.5;}};
  for(const f of ['ConvertViewRatioToScaleform','GetScreenPos','GetScreenPosOpposite'])
    method(markerFile,f,s,['screenPos']);
  for(const front of [true,false]) {
    s.theCamera.WorldVectorToViewRatio=()=>front;
    for(const name of ['GetScreenPos','GetScreenPosOpposite']) {
      s.screenPos={X:-0.5,Y:0.5};
      assert.equal(s[name]({},false),name==='GetScreenPos'?true:!front);
      assert.deepEqual(s.screenPos,{X:480,Y:810});
    }
  }
  s.screenPos={X:0.25,Y:-0.25};
  assert.equal(s.GetScreenPos({},true),false);
  assert.deepEqual(s.screenPos,{X:0.25,Y:-0.25});
});
