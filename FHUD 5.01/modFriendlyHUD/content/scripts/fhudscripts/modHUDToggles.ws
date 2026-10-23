//---=== modFriendlyHUD ===---
function IsHUDGroupEnabledForReason( modNames : array< string >, reason : string ) : bool
{
	var hud : CR4ScriptedHud;
	var module : CR4HudModuleBase;
	var i : int;
	
	hud = (CR4ScriptedHud)theGame.GetHud(); 
	if ( hud ) 
	{
		for( i = 0; i < modNames.Size(); i += 1 )
		{
			module = (CR4HudModuleBase)hud.GetHudModule( modNames[i] );
			if ( module )
			{
				return module.IsEnabledForReason( reason );
			}
		}
	}
	return false;
}

function ToggleHUDModule( modName : string, toggle : bool, reason : string )
{
	var hud : CR4ScriptedHud;
	
	hud = (CR4ScriptedHud)theGame.GetHud(); 
	if ( hud ) 
	{
		hud.SetEnabledTemporarily( modName, toggle, true, reason );
	}
}

function ToggleBuffsModule( toggle : bool, reason : string )
{
	ToggleHUDModule( "BuffsModule", toggle, reason );
}

function ToggleFHUDGroup( modules : array< string >, toggle : bool, reason : string )
{
	var hud : CR4ScriptedHud;
	hud = (CR4ScriptedHud)theGame.GetHud();
	if( hud )
		hud.ToggleModulesTemporarily( modules, toggle, reason );
}

function ToggleEssentialModules( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.essentialModules, toggle, reason );
}

function ToggleMinimapModules( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.minimapModules, toggle, reason );
}

function ToggleQuestsModules( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.questsModules, toggle, reason );
}

function ToggleCharacterModules( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.characterModules, toggle, reason );
}

function ToggleCombatModules( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.combatModules, toggle, reason );
}

function ToggleWSModules( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.witcherSensesModules, toggle, reason );
}

function ToggleMeditModules( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.meditationModules, toggle, reason );
}

function ToggleModulesToShowInRadialMenu( toggle : bool, reason : string )
{
	var config : CModFriendlyHUDConfig;
	config = GetFHUDConfig();
	if( config )
		ToggleFHUDGroup( config.radialMenuModules, toggle, reason );
}

//---=== modFriendlyHUD ===---
