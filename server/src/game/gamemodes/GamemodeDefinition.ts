import type { InterfaceService } from "../../widgets/InterfaceService";
import type { WidgetAction } from "../../widgets/WidgetManager";
import type { GameEventBus } from "../events/GameEventBus";
import type { StaticGroundItemSpawn } from "../items/GroundItemManager";
import type { NpcSpawnConfig, NpcState } from "../npc";
import type { PlayerState } from "../player";
import type { IScriptRegistry, ScriptServices } from "../scripts/types";

export interface GamemodeUiController {
    normalizeSideJournalState(
        player: PlayerState,
        incomingStateVarp?: number,
    ): { tab: number; stateVarp: number };

    applySideJournalUi(player: PlayerState): void;

    queueTutorialOverlay(
        player: PlayerState,
        opts?: { queueFlashsideVarbitOnStep3?: boolean },
    ): void;

    handleWidgetClose(player: PlayerState, groupId: number): void;

    handleWidgetOpen(player: PlayerState, groupId: number): void;

    activateQuestTab(playerId: number): void;

    shouldActivateQuestTabOnLogin(player: PlayerState): boolean;

    getSideJournalBootstrapState(player: PlayerState): {
        varps: Record<number, number>;
        varbits: Record<number, number>;
    };
}

export interface GamemodeQuestListQuest {
    key: string;
}

export interface GamemodeQuestListGroup {
    title: string;
    quests: readonly (string | GamemodeQuestListQuest)[];
}

export interface GamemodeBridge {
    getPlayer(playerId: number): PlayerState | undefined;
    queueVarp(playerId: number, varpId: number, value: number): void;
    queueVarbit(playerId: number, varbitId: number, value: number): void;
    queueNotification(playerId: number, notification: unknown): void;
    queueWidgetEvent(playerId: number, event: WidgetAction): void;
    queueClientScript(playerId: number, scriptId: number, ...args: (number | string)[]): void;
    sendGameMessage(player: PlayerState, text: string): void;
}

/**
 * Server-level services exposed to gamemodes during initialization.
 * Any gamemode feature (banking, shops, etc.) can use these to interact with
 * core server systems without importing server internals.
 */
export interface GamemodeServerServices {
    getPlayer(playerId: number): PlayerState | undefined;
    getInventory(player: PlayerState): Array<{ itemId: number; quantity: number }>;
    getEquipArray(player: PlayerState): number[];
    getEquipQtyArray(player: PlayerState): number[];
    computeEquipmentStatBonuses(player: PlayerState): number[];
    resolveBaseAttackSpeed(player: PlayerState): number;
    pickAttackSpeed(player: PlayerState): number;
    addItemToInventory(
        player: PlayerState,
        itemId: number,
        quantity: number,
    ): { slot: number; added: number };
    sendInventorySnapshot(playerId: number): void;
    refreshAppearance(player: PlayerState): void;
    refreshCombatWeapon(player: PlayerState): {
        categoryChanged: boolean;
        weaponItemChanged: boolean;
    };
    sendAppearanceUpdate(playerId: number): void;
    queueCombatSnapshot(
        playerId: number,
        category: number,
        weaponItemId: number,
        autoRetaliate: boolean,
        styleSlot: number,
        activePrayers: string[],
        combatSpellId?: number,
    ): void;
    /** A game message to `targetPlayerIds`, or public chat said by `playerId` (overhead and chatbox). */
    queueChatMessage(opts: {
        messageType: string;
        text: string;
        targetPlayerIds?: number[];
        playerId?: number;
        from?: string;
    }): void;
    queueVarbit(playerId: number, varbitId: number, value: number): void;
    queueWidgetEvent(playerId: number, event: unknown): void;
    queueGamemodeSnapshot(key: string, playerId: number, payload: unknown): void;
    registerSnapshotEncoder(
        key: string,
        encoder: (
            playerId: number,
            payload: unknown,
        ) =>
            | {
                  message: string | Uint8Array;
                  context: string;
              }
            | undefined,
        onSent?: (playerId: number, payload: unknown) => void,
    ): void;
    getObjType(itemId: number): unknown;
    spawnNpc(config: NpcSpawnConfig): NpcState | undefined;
    removeNpc(npcId: number): boolean;
    emitLocChange(
        oldId: number,
        newId: number,
        tile: { x: number; y: number },
        level: number,
        opts?: {
            oldTile?: { x: number; y: number };
            newTile?: { x: number; y: number };
            oldRotation?: number;
            newRotation?: number;
            newShape?: number;
        },
    ): void;
    addCollisionFlags(x: number, y: number, level: number, flags: number): void;
    removeCollisionFlags(x: number, y: number, level: number, flags: number): void;
    registerStaticGroundItem(spawn: StaticGroundItemSpawn): void;
    getInterfaceService(): InterfaceService | undefined;
    /**
     * Deal damage to an NPC from the gamemode itself (e.g. one NPC fighting another, which the
     * engine's combat doesn't do), with a hitsplat everyone nearby sees. 0 shows a block.
     */
    hitNpc(npc: NpcState, damage: number): { hpCurrent: number; hpMax: number };
    /**
     * Add an AI player (a bot, like 2009scape's AIPlayer) that the gamemode drives. To everyone
     * else it's a player: synced, attackable, with its own inventory, gear and prayers.
     */
    addPlayerBot(opts: {
        name: string;
        x: number;
        y: number;
        level: number;
        gender: number;
        kits: number[];
        colors: number[];
    }): PlayerState | undefined;
    removePlayerBot(bot: PlayerState): void;
    /** Selectable identity kits for each body part (0-6) of a gender, as the character designer offers. */
    getIdentityKits(gender: number): number[][];
    /** Choose an inventory option for a player (a bot acting for itself): Eat, Wield, Drink... */
    useInventoryItem(player: PlayerState, slot: number, option: string): void;
    /** Cast a combat spell on a player, as if the caster had clicked it on them. */
    castSpellOnPlayer(caster: PlayerState, target: PlayerState, spellId: number): void;
    /** Attack a player, through the same checks as clicking Attack on them. */
    attackPlayer(attacker: PlayerState, target: PlayerState): boolean;
    /** Break off any fight this player (person or bot) is in, as if they had walked away. */
    stopCombat?(player: PlayerState): void;
    getCurrentTick(): number;
    registerTickCallback(callback: (tick: number) => void): void;
    eventBus: GameEventBus;
    logger: {
        debug(message: string, ...args: unknown[]): void;
        info(message: string, ...args: unknown[]): void;
        warn(message: string, ...args: unknown[]): void;
    };
}

export interface GamemodeInitContext {
    npcTypeLoader: { load: (id: number) => { name?: string } | undefined } | undefined;
    objTypeLoader: { load: (id: number) => { name?: string } | undefined } | undefined;
    bridge: GamemodeBridge;
    serverServices: GamemodeServerServices;
}

export interface HandshakeBridge {
    sendVarp(varpId: number, value: number): void;
    sendVarbit(varbitId: number, value: number): void;
    queueVarp(playerId: number, varpId: number, value: number): void;
    queueVarbit(playerId: number, varbitId: number, value: number): void;
    queueNotification(playerId: number, notification: unknown): void;
}

export interface XpAwardContext {
    source: "skill" | "combat" | "quest" | "other";
    actionId?: string;
    spellId?: number;
}

export interface GamemodeDefinition {
    readonly id: string;
    readonly name: string;
    /** When true, any username logs in without a password (no account registration). */
    readonly passwordlessLogin?: boolean;

    // === XP ===
    getDefaultSkillXp?(skillId: number): number | undefined;
    getSkillXpMultiplier(player: PlayerState): number;
    /** Fine-grained XP adjustment. If defined, returns the final XP to award (not a multiplier). */
    getSkillXpAward?(
        player: PlayerState,
        skillId: number,
        baseXp: number,
        context?: XpAwardContext,
    ): number;

    // === Drops ===
    getDropRateMultiplier(player: PlayerState | undefined): number;
    transformDropItemId(npcTypeId: number, itemId: number, player: PlayerState | undefined): number;
    /** Override or provide a custom drop table for an NPC type. */
    getDropTable?(npcTypeId: number): import("../drops/types").NpcDropTableDefinition | undefined;
    /** Provide additional drops beyond the base table. */
    getSupplementalDrops?(
        npcTypeId: number,
        player: PlayerState,
    ): import("../drops/types").NpcDropEntryDefinition[];
    /** Provide per-NPC loot distribution config (highest-damage, shared, etc.). */
    getLootDistributionConfig?(
        npcTypeId: number,
    ): import("../combat/DamageTracker").NpcLootConfig | undefined;

    // === Player Rules ===
    canInteract(player: PlayerState): boolean;
    /** Whether the player may walk; leave undefined to follow canInteract. */
    canMove?(player: PlayerState): boolean | undefined;
    canInteractWithNpc?(player: PlayerState, npcTypeId: number, option: string): boolean;
    /** Allow a loc option even when canInteract says no (option is lower-cased). */
    canInteractWithLoc?(player: PlayerState, locId: number, option: string): boolean;
    /** PvP outside the Wilderness: return false (with a reason message) to refuse an attack. */
    canAttackPlayer?(attacker: PlayerState, target: PlayerState): boolean;
    /**
     * A player's attack on another player was resolved: a hit or a miss (a splash) has landed
     * on `target`. Clicking Attack or walking up to someone doesn't call this; only a swing,
     * shot or spell that actually reaches them does.
     */
    onPlayerHit?(attacker: PlayerState, target: PlayerState): void;
    /** Return false to stop a player auto-retaliating against another player (e.g. a truce). */
    mayRetaliateAgainstPlayer?(defender: PlayerState): boolean;
    /**
     * Rename an NPC menu option by op number (e.g. make op 2 "Attack" on an NPC whose cache
     * type has none). Return undefined to keep the cache option.
     */
    resolveNpcOption?(player: PlayerState, npc: NpcState, opNum: number): string | undefined;
    /** The same for scenery (locs): name an op the cache type leaves empty. */
    resolveLocOption?(player: PlayerState, locId: number, opNum: number): string | undefined;
    /** Return true to let a player cast a spell without its Magic level (runes are still needed). */
    ignoresSpellLevel?(player: PlayerState, spellId: number): boolean;
    /**
     * A player died. Return true to take over the aftermath: the engine then only restores
     * their stats and unlocks them (no item drop, no respawn teleport). `at` is where they were
     * when their hitpoints hit 0 (the death animation plays before this is called).
     */
    onPlayerDeath?(player: PlayerState, killer: PlayerState | undefined, at?: { x: number; y: number; level: number }): boolean;

    // === Player Lifecycle ===
    initializePlayer(player: PlayerState): void;
    serializePlayerState(player: PlayerState): Record<string, unknown> | undefined;
    deserializePlayerState(player: PlayerState, data: Record<string, unknown>): void;
    onNpcKill(playerId: number, npcTypeId: number, combatLevel?: number): void;
    onItemCraft?(playerId: number, itemId: number, count: number): void;

    // === Login / Handshake ===
    /** Varbit defaults applied during login (diary unlocks, xp drops, etc.). */
    getLoginVarbits?(player: PlayerState): Array<[varbitId: number, value: number]>;
    /** Varp defaults applied during login (volume, music track, etc.). */
    getLoginVarps?(player: PlayerState): Array<[varpId: number, value: number]>;
    isTutorialActive(player: PlayerState): boolean;
    isTutorialPreStart?(player: PlayerState): boolean;
    getSpawnLocation(player: PlayerState): { x: number; y: number; level: number };
    onPlayerHandshake(player: PlayerState, bridge: HandshakeBridge): void;
    onPlayerLogin(player: PlayerState, bridge: GamemodeBridge): void;
    /** Called after player state is restored during reconnect handshake. */
    onPlayerRestore?(player: PlayerState): void;
    onPostDesignComplete?(player: PlayerState): void;
    resolveAccountStage?(player: PlayerState): void;

    // === Varp / Widget Events ===
    onVarpTransmit?(
        player: PlayerState,
        varpId: number,
        value: number,
        previousValue: number,
    ): void;
    onWidgetOpen?(player: PlayerState, groupId: number): void;

    // === Music ===
    /**
     * The music area the player is in, overriding the map region's (OSRS plays one track per
     * region). Return an area id (the same id means "no change, keep playing") and its track;
     * undefined falls back to the region.
     */
    getMusicArea?(player: PlayerState): { areaId: number; trackId: number; trackName: string } | undefined;

    /** Handle a resume_pausebutton click. Return true if consumed. */
    onResumePauseButton?(player: PlayerState, widgetId: number, childIndex: number): boolean;

    // === Chat ===
    /** Return true to consume a public chat message instead of broadcasting it normally. */
    onPublicChat?(player: PlayerState, text: string): boolean;

    // === Tick ===
    onPlayerTick?(player: PlayerState, nowMs: number): void;
    onPlayerDisconnect?(playerId: number): void;

    // === Display ===
    getPlayerTypes(
        player: PlayerState,
        isAdmin: boolean,
    ): import("../../../../client/rs/chat/PlayerType").PlayerType[];

    // === Scripts ===
    registerHandlers(registry: IScriptRegistry, services: ScriptServices): void;
    getGamemodeServices?(): Record<string, unknown>;
    /** Mutate the ScriptServices object to add gamemode-provided methods. */
    contributeScriptServices?(services: ScriptServices): void;

    // === UI Controller ===
    createUiController?(bridge: GamemodeUiBridge): GamemodeUiController;

    // === Quest List ===
    getQuestListGroups?(player: PlayerState): readonly GamemodeQuestListGroup[];

    // === Content Data ===
    /** Controls boot-time loading of server/data/npc-spawns.json. */
    shouldLoadDefaultNpcSpawns(): boolean;
    getContentDataPacket?(): Uint8Array | null;

    /** Extra fields for the server's public /status reply (e.g. the hosted game, for browsers). */
    getStatusInfo?(): Record<string, unknown>;

    /** Resolve a room code to a server address via LAN discovery (returns undefined if not found). */
    resolveRoomCode?(code: string): string | undefined;

    // === Server Lifecycle ===
    initialize(context: GamemodeInitContext): void;
    dispose?(): void;
}

export interface GamemodeUiBridge {
    queueWidgetEvent(playerId: number, action: WidgetAction): void;
    queueVarp(playerId: number, varpId: number, value: number): void;
    queueVarbit(playerId: number, varbitId: number, value: number): void;
    isWidgetGroupOpenInLedger(playerId: number, groupId: number): boolean;
}
