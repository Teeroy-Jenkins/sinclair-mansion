// Lean base for Sinclair Mansion. Extends BaseGamemode but strips out
// all the OSRS systems Sinclair doesn't use (banking, shops, quests, skills,
// collection log, area scripts, etc.). The equipment tab stays: players take gear off.
//
// This provides only the engine hooks Sinclair needs: combat providers,
// login varbits/varps, door/NPC/engine handlers, and the provider registry.

import { BaseGamemode, DefaultUiController } from "../../src/game/gamemodes/BaseGamemode";
import type {
    GamemodeInitContext,
    GamemodeServerServices,
    GamemodeUiBridge,
    GamemodeUiController,
    HandshakeBridge,
    IScriptRegistry,
    ScriptServices,
    GamemodeQuestListGroup,
} from "../../src/game/gamemodes/GamemodeDefinition";
import type { PlayerState } from "../../src/game/player";
import { getProviderRegistry, resetProviderRegistry } from "../../src/game/providers/ProviderRegistry";
import { createSpecialAttackProvider } from "../dev/combat/SpecialAttackRegistry";
import { createSpecialAttackVisualProvider } from "../dev/combat/SpecialAttackVisuals";
import { createInstantUtilitySpecialProvider } from "../dev/combat/RockKnockerSpecial";
import { createWeaponDataProvider } from "../dev/data/weapons";
import { createSpellDataProvider } from "../dev/data/spells";
import { createRuneDataProvider } from "../dev/data/runes";
import { createDefaultAmmoDataProvider } from "../../src/game/combat/AmmoSystem";
import { createCombatStyleSequenceProvider } from "../dev/combat/CombatStyleSequences";
import { createEquipmentBonusProvider } from "../dev/combat/EquipmentBonuses";
import { createProjectileParamsProvider } from "../dev/data/projectileParams";
import { createSpellXpProvider } from "../dev/combat/SpellXpData";
import { createSkillConfiguration } from "../dev/combat/SkillConfiguration";
import { registerDoorHandlers } from "../dev/scripts/content/doors";
import { registerKeyDoorHandlers } from "../dev/scripts/content/keyDoors";
import { registerBobHandlers } from "../dev/scripts/content/bob";
import { registerDefaultTalkHandlers } from "../dev/scripts/content/defaultTalk";
import { registerClimbingHandlers } from "../dev/scripts/content/climbing";
import { registerDemoInteractionHandlers } from "../dev/scripts/content/demoInteractions";
import { registerWildernessAccessHandlers } from "../dev/scripts/content/wildernessAccess";
import { registerBoatTravelHandlers } from "../dev/scripts/content/travel/boats";
import { registerEquipmentWidgetHandlers } from "../dev/equipment/equipmentWidgets";
import { registerSettingsWidgetHandlers } from "../dev/widgets/settingsWidgets";
import type { NpcLootConfig } from "../../src/game/combat/DamageTracker";
import { NPC_LOOT_CONFIGS } from "../dev/data/lootDistribution";
import { DEFAULT_LOGIN_VARBITS } from "../dev/data/loginVarbits";
import { DEFAULT_LOGIN_VARPS } from "../dev/data/loginVarps";

/**
 * Lean base class that provides only the engine hooks Sinclair Mansion needs.
 * Sinclair Mansion extends this directly instead of VanillaGamemode.
 */
export class SinclairBase extends BaseGamemode {
    private serverServices: GamemodeServerServices | undefined;
    private scriptServices: ScriptServices | undefined;

    // --- Loot distribution (used by combat engine) ---
    getLootDistributionConfig(npcTypeId: number): NpcLootConfig | undefined {
        return NPC_LOOT_CONFIGS.get(npcTypeId);
    }

    // --- Login varbits/varps (Sinclair overrides these, but calls super for base) ---
    override getLoginVarbits(_player: PlayerState): Array<[number, number]> {
        return DEFAULT_LOGIN_VARBITS;
    }

    override getLoginVarps(_player: PlayerState): Array<[number, number]> {
        return DEFAULT_LOGIN_VARPS;
    }

    // --- Provider registration (combat, spells, runes, etc.) ---
    private registerProviders(): void {
        const registry = getProviderRegistry();
        resetProviderRegistry();
        registry.spellXp = createSpellXpProvider();
        registry.specialAttackVisual = createSpecialAttackVisualProvider();
        registry.instantUtilitySpecial = createInstantUtilitySpecialProvider();
        registry.weaponData = createWeaponDataProvider();
        registry.specialAttack = createSpecialAttackProvider();
        registry.combatStyleSequence = createCombatStyleSequenceProvider();
        registry.skillConfiguration = createSkillConfiguration();
        registry.equipmentBonus = createEquipmentBonusProvider();
        registry.projectileParams = createProjectileParamsProvider();
        registry.spellData = createSpellDataProvider();
        registry.runeData = createRuneDataProvider();
        registry.ammoData = createDefaultAmmoDataProvider();
    }

    // --- Essential engine hooks Sinclair needs ---
    override onPlayerHandshake(player: PlayerState, bridge: HandshakeBridge): void {
        // Ensure providers are registered before first handshake
        if (!getProviderRegistry().spellXp) {
            this.registerProviders();
        }
    }

    override onPlayerDisconnect(_playerId: number): void {
        // No-op: Sinclair handles cleanup in its own override
    }

    override registerHandlers(registry: IScriptRegistry, services: ScriptServices): void {
        this.serverServices = services;
        this.scriptServices = services;

        // Register only the engine hooks Sinclair needs:
        // - Door handling (mansion doors)
        // - Key door handling
        // - Bob NPC dialogue
        // - Default talk handlers
        // - Climbing handlers
        // - Demo interactions
        // - Wilderness access
        // - Boat travel
        // - The equipment tab's Remove (and its stats view)
        // - The settings tab's dropdowns (Player / NPC 'Attack' options set their varps, as in OSRS)
        registerDoorHandlers(registry, services);
        registerKeyDoorHandlers(registry, services);
        registerBobHandlers(registry, services);
        registerDefaultTalkHandlers(registry, services);
        registerClimbingHandlers(registry, services);
        registerDemoInteractionHandlers(registry, services);
        registerWildernessAccessHandlers(registry, services);
        registerBoatTravelHandlers(registry, services);
        registerEquipmentWidgetHandlers(registry, services);
        registerSettingsWidgetHandlers(registry, services);
    }

    override initialize(context: GamemodeInitContext): void {
        this.serverServices = context.serverServices;
        this.scriptServices = context.serverServices;
        // Register combat/spell providers eagerly so initSpellWidgetMapping()
        // and test-bot creation (which happen before any player connects) work.
        if (!getProviderRegistry().spellXp) {
            this.registerProviders();
        }
    }

    // --- UI / Quest (Sinclair overrides createUiController) ---
    override createUiController(bridge: GamemodeUiBridge): GamemodeUiController {
        return new DefaultUiController();
    }

    override getQuestListGroups(_player: PlayerState): readonly GamemodeQuestListGroup[] {
        return [];
    }

    // --- Services ---
    getGamemodeServices(): Record<string, unknown> {
        return {
            serverServices: this.serverServices,
            weaponDataProvider: undefined, // Sinclair doesn't use the vanilla weapon provider
        };
    }
}
