import fs from "fs";
import path from "path";

import { BasTypeLoader } from "../../../client/rs/config/bastype/BasTypeLoader";
import { NpcType } from "../../../client/rs/config/npctype/NpcType";
import { NpcTypeLoader } from "../../../client/rs/config/npctype/NpcTypeLoader";
import { DIRECTION_TO_ORIENTATION } from "../../../client/common/Direction";
import {
    getNpcAggressionMetadata,
    getNpcCombatStats,
    type NpcCombatStats as NpcCombatStatsData,
} from "../data/npcCombatStats";
import { PathService } from "../pathfinding/PathService";
import { CollisionFlag } from "../pathfinding/legacy/pathfinder/flag/CollisionFlag";
import { logger } from "../utils/logger";
import { MapCollisionService } from "../world/MapCollisionService";
import { BossScript, createBossScript } from "./combat/BossScriptFramework";
import { damageTracker } from "./combat/DamageTracker";
import { interceptFrozenCombatMovement } from "./combat/engine/CombatMovementInterceptor";
import { StatusHitsplat } from "./combat/HitEffects";
import { isInWilderness, multiCombatSystem } from "./combat/MultiCombatZones";
import {
    AGGRESSION_TIMER_TICKS,
    isPlayerSafeFromStandardNpcAggression,
    type PlayerAggressionState,
    TARGET_SEARCH_INTERVAL,
} from "./combat/NpcAggression";
import {
    DEFAULT_NPC_COMBAT_PROFILE,
    DEFAULT_NPC_WANDER_RADIUS,
    NpcCombatProfile,
    NpcSpawnConfig,
    NpcState,
    NpcUpdateDelta,
    NpcUpdateSnapshot,
} from "./npc";
import { MovementProcessor } from "./movement/engine/MovementProcessor";
import { StatusEffectSystem } from "./systems/StatusEffectSystem";

export type NpcStatusEvent = {
    npcId: number;
    hitsplat: StatusHitsplat;
};

export type NpcLethalStatusHitInterceptor = (event: {
    npc: NpcState;
    killerPlayerId?: number;
    proposedDamage: number;
    style: number;
    hitpointsBefore: number;
    tick: number;
}) => boolean;

/** Event emitted when an NPC wants to aggro a player */
export type NpcAggressionEvent = {
    npcId: number;
    targetPlayerId: number;
};

type GroundItemSpawner = (
    itemId: number,
    quantity: number,
    tile: { x: number; y: number; level: number },
    tick: number,
    options?: { ownerId?: number; isMonsterDrop?: boolean; privateTicks?: number },
    worldViewId?: number,
) => void;

export interface PendingNpcDrop {
    itemId: number;
    quantity: number;
    tile: { x: number; y: number; level: number };
    ownerId?: number;
    isMonsterDrop: boolean;
    worldViewId?: number;
    isWilderness: boolean;
}

type NearbyAggressionPlayer = {
    id: number;
    x: number;
    y: number;
    level: number;
    combatLevel: number;
    inCombat: boolean;
    aggressionState: PlayerAggressionState;
};

const REGION_SIZE = 32; // tiles; aligns to half a chunk for coarse spatial buckets
/** How long an idle NPC holds a pawn-facing before it clears (RSMod Npc.RESET_PAWN_FACE_DELAY). */
const RESET_PAWN_FACE_DELAY_TICKS = 25;

function normalizeNpcName(name?: string): string {
    return (name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isTrustedCombatStatsForNpc(
    npcType: NpcType,
    stats?: NpcCombatStatsData,
): stats is NpcCombatStatsData {
    if (!stats) {
        return false;
    }
    const npcName = normalizeNpcName(npcType.name);
    const statsName = normalizeNpcName(stats.name);
    return !npcName || !statsName || npcName === statsName;
}

function resolvePositiveStat(value: number, fallback: number): number {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function buildCombatProfile(npcType: NpcType, stats?: NpcCombatStatsData): NpcCombatProfile {
    if (!stats) {
        return {
            ...DEFAULT_NPC_COMBAT_PROFILE,
            attackLevel: resolvePositiveStat(
                npcType.attackLevel,
                DEFAULT_NPC_COMBAT_PROFILE.attackLevel,
            ),
            strengthLevel: resolvePositiveStat(
                npcType.strengthLevel,
                DEFAULT_NPC_COMBAT_PROFILE.strengthLevel,
            ),
            defenceLevel: resolvePositiveStat(
                npcType.defenceLevel,
                DEFAULT_NPC_COMBAT_PROFILE.defenceLevel,
            ),
            magicLevel: resolvePositiveStat(
                npcType.magicLevel,
                DEFAULT_NPC_COMBAT_PROFILE.magicLevel,
            ),
            rangedLevel: resolvePositiveStat(
                npcType.rangedLevel,
                DEFAULT_NPC_COMBAT_PROFILE.rangedLevel,
            ),
            attackSpeed: resolvePositiveStat(
                npcType.attackSpeed,
                DEFAULT_NPC_COMBAT_PROFILE.attackSpeed,
            ),
        };
    }
    return {
        attackLevel: stats.attackLevel,
        strengthLevel: stats.strengthLevel,
        defenceLevel: stats.defenceLevel,
        magicLevel: stats.magicLevel,
        rangedLevel: stats.rangedLevel,
        attackBonus: stats.attackBonus ?? 0,
        strengthBonus: stats.strengthBonus ?? 0,
        magicBonus: stats.magicBonus ?? 0,
        rangedBonus: stats.rangedBonus ?? 0,
        defenceStab: stats.defenceBonuses?.stab ?? 0,
        defenceSlash: stats.defenceBonuses?.slash ?? 0,
        defenceCrush: stats.defenceBonuses?.crush ?? 0,
        defenceMagic: stats.defenceBonuses?.magic ?? 0,
        defenceRanged: stats.defenceBonuses?.ranged ?? 0,
        maxHit: stats.maxHit,
        attackSpeed: stats.attackSpeed,
        attackType: stats.attackType,
        species: stats.species ?? [],
    };
}

type RawNpcSpawn = {
    id: number;
    name?: string;
    x: number;
    y: number;
    level: number;
    wanderRadius?: number;
    /** Movement direction index (0=SW,1=S,2=SE,3=W,4=E,5=NW,6=N,7=NE). */
    direction?: number;
    /** Optional HealthBarDefinition id (HIT_MASK) for this NPC spawn. */
    healthBarDefId?: number;
};

function clamp(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/** Numeric tile key: x (14 bits) | y (14 bits) | level (2 bits) = 30 bits */
function tileKey(x: number, y: number, level: number): number {
    return (x << 16) | (y << 2) | (level & 0x3);
}

function forEachFootprintTile(
    tileX: number,
    tileY: number,
    level: number,
    size: number,
    cb: (key: number) => void,
): void {
    const footprint = Math.max(1, size | 0);
    for (let ox = 0; ox < footprint; ox++) {
        for (let oy = 0; oy < footprint; oy++) {
            cb(tileKey(tileX + ox, tileY + oy, level));
        }
    }
}

/** Numeric region key: rx (11 bits) | ry (11 bits) | level (2 bits) = 24 bits */
function regionKey(x: number, y: number, level: number): number {
    const rx = Math.floor(x / REGION_SIZE) & 0x7ff;
    const ry = Math.floor(y / REGION_SIZE) & 0x7ff;
    return (rx << 13) | (ry << 2) | (level & 0x3);
}

export class NpcManager {
    private readonly pathService: PathService;
    private readonly movementProcessor: MovementProcessor;
    private readonly npcTypeLoader: NpcTypeLoader;
    private readonly basTypeLoader: BasTypeLoader;

    private readonly npcs = new Map<number, NpcState>();
    private readonly occupancy = new Map<number, Set<number>>();
    private readonly regionIndex = new Map<number, Set<number>>();
    /** Tile and level each NPC is filed under in `occupancy` and `regionIndex`. */
    private readonly indexedAt = new Map<number, { x: number; y: number; level: number }>();
    private readonly pendingUpdates: NpcUpdateDelta[] = [];
    private statusEffects?: StatusEffectSystem;
    private lethalStatusHitInterceptor?: NpcLethalStatusHitInterceptor;
    private maxNpcSize = 1;
    private readonly pendingRespawns = new Map<number, { npc: NpcState; respawnTick: number }>();
    private readonly pendingDeaths = new Map<
        number,
        { despawnTick: number; respawnTick: number; pendingDrops?: PendingNpcDrop[] }
    >();
    // NPCs that took a fatal hit and process their death on a later tick:
    // the death animation/despawn pipeline starts the tick after the killing hitsplat.
    private readonly pendingDeathProcessing = new Map<
        number,
        { killerPlayerId: number; deathTick: number }
    >();
    // Boss scripts for NPCs with complex combat behaviors
    private readonly bossScripts = new Map<number, BossScript>();
    private readonly lifetimeExpiryTicks = new Map<number, number>();
    private currentTick = 0;

    // NPC indices are 16-bit (0..65534, with 65535 reserved as a sentinel).
    private nextId = 1;

    private lifecycleHooks?: {
        onRemove?: (npcId: number) => void;
        onReset?: (npcId: number) => void;
    };

    private groundItemSpawner?: GroundItemSpawner;

    constructor(
        _mapService: MapCollisionService,
        pathService: PathService,
        npcTypeLoader: NpcTypeLoader,
        basTypeLoader: BasTypeLoader,
    ) {
        this.pathService = pathService;
        this.movementProcessor = new MovementProcessor(pathService);
        this.npcTypeLoader = npcTypeLoader;
        this.basTypeLoader = basTypeLoader;
    }

    setStatusEffectSystem(system: StatusEffectSystem): void {
        this.statusEffects = system;
    }

    setLethalStatusHitInterceptor(
        interceptor: NpcLethalStatusHitInterceptor | undefined,
    ): void {
        this.lethalStatusHitInterceptor = interceptor;
    }

    setLifecycleHooks(hooks: {
        onRemove?: (npcId: number) => void;
        onReset?: (npcId: number) => void;
    }): void {
        this.lifecycleHooks = hooks;
    }

    setGroundItemSpawner(spawner: GroundItemSpawner | undefined): void {
        this.groundItemSpawner = spawner;
    }

    loadFromFile(filePath: string): void {
        const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
        let raw: RawNpcSpawn[] = [];
        try {
            const json = fs.readFileSync(absPath, "utf8");
            const parsed = JSON.parse(json);
            if (Array.isArray(parsed)) {
                raw = parsed as RawNpcSpawn[];
            } else {
                logger.warn(`[NpcManager] npc spawn file ${absPath} not array`);
                return;
            }
        } catch (err) {
            logger.error(`[NpcManager] failed to load npc spawns from ${absPath}`, err);
            return;
        }

        for (const spawn of raw) {
            try {
                this.spawnNpc({
                    id: spawn.id,
                    name: spawn.name,
                    x: spawn.x,
                    y: spawn.y,
                    level: spawn.level,
                    wanderRadius: spawn.wanderRadius,
                    direction: spawn.direction,
                    healthBarDefId:
                        spawn.healthBarDefId !== undefined ? spawn.healthBarDefId : undefined,
                });
            } catch (err) {
                logger.warn(`[NpcManager] failed to spawn npc ${spawn?.id}`, err);
            }
        }

        logger.info(`[NpcManager] spawned ${this.npcs.size} NPCs from ${absPath}`);
    }

    private spawnNpc(spawn: NpcSpawnConfig): NpcState | undefined {
        if (!(spawn.id >= 0)) return undefined;
        const npcType = this.loadNpcTypeById(spawn.id);
        if (!npcType) return;

        const idleSeqId = npcType.getIdleSeqId(this.basTypeLoader);
        const walkSeqId = npcType.getWalkSeqId(this.basTypeLoader);
        const size = Math.max(1, npcType.size);
        const rotationSpeed = Math.max(1, npcType.rotationSpeed);
        const wanderRadius = Math.max(0, spawn.wanderRadius ?? DEFAULT_NPC_WANDER_RADIUS);
        this.maxNpcSize = Math.max(this.maxNpcSize, size);

        const id = this.allocateNpcId();
        const rawNpcCombatStats = getNpcCombatStats(npcType.id);
        const npcCombatStats = isTrustedCombatStatsForNpc(npcType, rawNpcCombatStats)
            ? rawNpcCombatStats
            : undefined;
        const maxHitpoints = this.deriveMaxHitpoints(npcType, npcCombatStats);
        const combatLevel = npcType.combatLevel ?? -1;
        // Attack speed is stored in cache param 14
        const attackSpeed = this.deriveAttackSpeed(npcType, npcCombatStats);
        // Prefer server-authored combat stats for aggression metadata when present.
        const isAggressive = this.deriveIsAggressive(npcType, npcCombatStats);
        const aggressionRadius = this.deriveAggressionRadius(npcCombatStats, isAggressive);
        const aggressionToleranceTicks = this.deriveAggressionToleranceTicks(npcCombatStats);
        const aggressionSearchDelayTicks = this.deriveAggressionSearchDelayTicks(npcCombatStats);
        // Load combat profile (stats, bonuses, species) - logged warning if missing
        const combatProfile = buildCombatProfile(npcType, npcCombatStats);

        const npc = new NpcState(
            id,
            npcType.id,
            size,
            idleSeqId,
            walkSeqId,
            rotationSpeed,
            { x: spawn.x, y: spawn.y, level: spawn.level },
            {
                name: spawn.name,
                wanderRadius,
                maxHitpoints,
                combatLevel,
                // Use resolved combat profile attack type as the single source of truth.
                attackType: combatProfile.attackType,
                healthBarDefId: spawn.healthBarDefId,
                attackSpeed,
                combatProfile,
                isAggressive,
                aggressionRadius,
                aggressionToleranceTicks,
                aggressionSearchDelayTicks,
                worldViewId: spawn.worldViewId,
                ownerPlayerId: spawn.ownerPlayerId,
            },
        );
        npc.setMovementPathfinder((targetX, targetY) => {
            const route = this.pathService.findPathSteps(
                {
                    from: { x: npc.tileX, y: npc.tileY, plane: npc.level },
                    to: { x: targetX, y: targetY },
                    size: npc.size,
                    worldViewId: npc.worldViewId,
                },
                { maxSteps: 128 },
            );
            return route.ok ? route.steps : undefined;
        });
        // Use direction from spawn config if provided, otherwise fall back to NPC type config
        const resolvedDirection =
            spawn.direction !== undefined ? spawn.direction & 7 : npcType.spawnDirection & 7;
        npc.rot = DIRECTION_TO_ORIENTATION[resolvedDirection] ?? 0;
        npc.orientation = npc.rot & 2047;
        npc.markSent();

        const lifetimeTicks = Math.trunc(spawn.lifetimeTicks ?? 0);
        if (lifetimeTicks > 0) {
            this.lifetimeExpiryTicks.set(id, this.currentTick + lifetimeTicks);
        }
        this.npcs.set(id, npc);
        this.addOccupancyFootprint(npc);
        this.addToRegionIndex(npc);
        this.lifecycleHooks?.onReset?.(id);

        // Initialize boss script if this NPC has one registered
        const bossScript = createBossScript(npc);
        if (bossScript) {
            this.bossScripts.set(id, bossScript);
        }
        return npc;
    }

    private allocateNpcId(): number {
        // Allocate within 0..65534, skipping 65535 (used as the updateNpcs sentinel).
        // Keep ids stable for respawns: pendingRespawns retains the npcId key.
        const MAX = 0xffff; // 65535 sentinel excluded
        for (let i = 0; i < MAX; i++) {
            const candidate = this.nextId++ & 0xffff;
            if (candidate === 0) continue;
            if (candidate === 0xffff) continue;
            if (this.npcs.has(candidate)) continue;
            if (this.pendingRespawns.has(candidate)) continue;
            return candidate;
        }
        throw new Error("[NpcManager] NPC id space exhausted (0..65534)");
    }

    private deriveMaxHitpoints(npcType: NpcType, combatStats?: NpcCombatStatsData): number {
        // Prefer explicit cache stats (NpcType opcode 77) when present.
        if (npcType.hitpoints > 0) {
            return npcType.hitpoints;
        }

        // Prefer server-side NPC combat stats (OSRS source of truth) when available.
        // This avoids guessing HP from combat level.
        const statsHp = combatStats?.hitpoints;
        if (statsHp !== undefined && Number.isFinite(statsHp) && statsHp > 0) {
            return statsHp;
        }
        try {
            const params = npcType.params;
            const hpParam = params?.get?.(50) as number | undefined;
            if (hpParam !== undefined && hpParam > 0) {
                return hpParam;
            }
        } catch (err) {
            logger.warn("[npc] failed to resolve npc hp from params", err);
        }
        const combat = npcType.combatLevel;
        if (combat > 0) {
            return Math.max(1, Math.round(combat * 3));
        }
        return 10;
    }

    /**
     * Derive attack speed from NPC cache definition.
     * OSRS attack speeds: 4 ticks is standard (men, goblins), 6 for dragons, varies by NPC.
     */
    private deriveAttackSpeed(npcType: NpcType, combatStats?: NpcCombatStatsData): number {
        // Try direct attackSpeed property on NpcType (opcode may define it)
        if (npcType.attackSpeed > 0) {
            return npcType.attackSpeed;
        }
        if (
            combatStats?.attackSpeed !== undefined &&
            Number.isFinite(combatStats.attackSpeed) &&
            combatStats.attackSpeed >= 1 &&
            combatStats.attackSpeed <= 12
        ) {
            return Math.trunc(combatStats.attackSpeed);
        }
        // Try cache param 14 (attack speed param in some cache versions)
        try {
            const params = npcType.params;
            const speedParam = params?.get?.(14) as number | undefined;
            // Only use if it's a reasonable attack speed value (1-12 ticks)
            if (speedParam !== undefined && speedParam >= 1 && speedParam <= 12) {
                return speedParam;
            }
        } catch (err) {
            logger.warn("[npc] failed to resolve npc attack speed", err);
        }
        // Default fallback: 4 ticks (2.4s) - most common NPC attack speed
        return 4;
    }

    private deriveIsAggressive(
        npcType: NpcType,
        combatStats?: NpcCombatStatsData,
    ): boolean {
        // Prefer the global osrsbox aggression index (npc-aggression.json).
        // Curated combat-stats cover only a small subset and often omit/override wrongly.
        const metadata = getNpcAggressionMetadata(npcType.id);
        if (metadata) {
            return metadata.aggressive;
        }
        if (combatStats?.aggressive !== undefined) {
            return !!combatStats.aggressive;
        }
        return (combatStats?.aggressiveRadius ?? 0) > 0;
    }

    private deriveAggressionRadius(
        combatStats: NpcCombatStatsData | undefined,
        isAggressive: boolean,
    ): number {
        if (combatStats?.aggressiveRadius !== undefined) {
            return Math.max(0, combatStats.aggressiveRadius | 0);
        }
        return isAggressive ? 3 : 0;
    }

    private deriveAggressionToleranceTicks(
        combatStats: NpcCombatStatsData | undefined,
    ): number {
        if (
            combatStats?.aggressiveTimer !== undefined &&
            Number.isFinite(combatStats.aggressiveTimer)
        ) {
            return Math.trunc(combatStats.aggressiveTimer);
        }
        return AGGRESSION_TIMER_TICKS;
    }

    private deriveAggressionSearchDelayTicks(
        combatStats: NpcCombatStatsData | undefined,
    ): number {
        if (
            combatStats?.aggroTargetDelay !== undefined &&
            Number.isFinite(combatStats.aggroTargetDelay) &&
            combatStats.aggroTargetDelay > 0
        ) {
            return Math.trunc(combatStats.aggroTargetDelay);
        }
        return TARGET_SEARCH_INTERVAL;
    }

    getById(id: number): NpcState | undefined {
        return this.npcs.get(id);
    }

    loadNpcTypeById(typeId: number): NpcType | undefined {
        try {
            return this.npcTypeLoader.load(typeId);
        } catch (err) {
            logger.warn(`[NpcManager] failed to load npc type ${typeId}`, err);
            return undefined;
        }
    }

    spawnTransientNpc(spawn: NpcSpawnConfig): NpcState | undefined {
        return this.spawnNpc(spawn);
    }

    removeNpc(npcId: number): boolean {
        const normalizedId = npcId | 0;
        if (normalizedId <= 0) return false;
        this.pendingDeaths.delete(normalizedId);
        this.pendingDeathProcessing.delete(normalizedId);
        const hadPendingRespawn = this.pendingRespawns.delete(normalizedId);
        this.lifetimeExpiryTicks.delete(normalizedId);
        const npc = this.npcs.get(normalizedId);
        if (!npc) return hadPendingRespawn;

        this.lifecycleHooks?.onRemove?.(normalizedId);
        this.npcs.delete(normalizedId);
        this.removeFromIndices(npc);
        npc.clearPath();
        npc.clearInteraction();

        const bossScript = this.bossScripts.get(normalizedId);
        if (bossScript) {
            bossScript.onDeath();
            this.bossScripts.delete(normalizedId);
        }
        return true;
    }

    removeNpcsOwnedByPlayer(playerId: number): number {
        const ownerId = Math.trunc(playerId);
        const ids = new Set<number>();
        for (const npc of this.npcs.values()) {
            if (npc.ownerPlayerId === ownerId) ids.add(npc.id);
        }
        for (const [npcId, entry] of this.pendingRespawns) {
            if (entry.npc.ownerPlayerId === ownerId) ids.add(npcId);
        }
        let removed = 0;
        for (const npcId of ids) {
            if (this.removeNpc(npcId)) removed++;
        }
        return removed;
    }

    canOccupyTile(
        tileX: number,
        tileY: number,
        level: number,
        size: number,
        ignoreNpcId?: number,
    ): boolean {
        const footprint = Math.max(1, size | 0);
        for (let ox = 0; ox < footprint; ox++) {
            for (let oy = 0; oy < footprint; oy++) {
                const worldX = tileX + ox;
                const worldY = tileY + oy;
                const flag = this.pathService.getCollisionFlagAt(worldX, worldY, level);
                if (flag === undefined) {
                    return false;
                }
                if ((flag & (CollisionFlag.FLOOR_BLOCKED | CollisionFlag.OBJECT)) !== 0) {
                    return false;
                }
                const bucket = this.occupancy.get(tileKey(worldX, worldY, level));
                if (!bucket || bucket.size === 0) continue;
                for (const occupantId of bucket) {
                    if (ignoreNpcId !== undefined && occupantId === ignoreNpcId) continue;
                    return false;
                }
            }
        }
        return true;
    }

    /** Clears all cross-system combat ownership after death processing finishes. */
    cleanupCombatState(npc: NpcState): void {
        npc.disengageCombat();
        damageTracker.clearNpc(npc);
        multiCombatSystem.removeActor(npc);
    }

    queueRespawn(npcId: number, respawnTick: number): boolean {
        const normalizedId = npcId;
        if (normalizedId <= 0) return false;
        this.pendingDeaths.delete(normalizedId);
        const existing = this.pendingRespawns.get(normalizedId);
        if (existing) {
            existing.respawnTick = Math.max(existing.respawnTick, respawnTick);
            return true;
        }
        const npc = this.npcs.get(normalizedId);
        if (!npc) return false;

        this.lifecycleHooks?.onRemove?.(normalizedId);
        this.npcs.delete(normalizedId);
        this.removeFromIndices(npc);
        npc.clearPath();
        npc.clearInteraction();

        // Clean up boss script and call death handler
        const bossScript = this.bossScripts.get(normalizedId);
        if (bossScript) {
            bossScript.onDeath();
            this.bossScripts.delete(normalizedId);
        }

        this.pendingRespawns.set(normalizedId, {
            npc,
            respawnTick: Math.max(respawnTick, 0),
        });
        return true;
    }

    queueDeath(
        npcId: number,
        despawnTick: number,
        respawnTick: number,
        drops?: PendingNpcDrop[],
    ): boolean {
        const id = npcId;
        if (id <= 0) return false;
        if (!this.npcs.has(id)) return false;
        const despawnAt = Math.max(0, despawnTick);
        const respawnAt = Math.max(0, respawnTick);
        const existing = this.pendingDeaths.get(id);
        if (existing) {
            existing.despawnTick = Math.max(existing.despawnTick, despawnAt);
            existing.respawnTick = Math.max(existing.respawnTick, respawnAt);
            if (drops && drops.length > 0) {
                existing.pendingDrops = [...(existing.pendingDrops ?? []), ...drops];
            }
            return true;
        }
        this.pendingDeaths.set(id, {
            despawnTick: despawnAt,
            respawnTick: respawnAt,
            pendingDrops: drops && drops.length > 0 ? drops : undefined,
        });
        return true;
    }

    cancelRespawn(npcId: number): boolean {
        return this.pendingRespawns.delete(npcId);
    }

    /** Schedule deferred death processing for an NPC that just took a fatal hit. */
    scheduleDeathProcessing(npcId: number, killerPlayerId: number, deathTick: number): boolean {
        if (npcId <= 0 || !this.npcs.has(npcId)) return false;
        if (this.pendingDeathProcessing.has(npcId)) return true;
        this.pendingDeathProcessing.set(npcId, {
            killerPlayerId,
            deathTick: Math.max(0, deathTick),
        });
        return true;
    }

    /** Drain death-processing entries that are due on this tick. */
    consumeDueDeathProcessing(
        currentTick: number,
    ): Array<{ npcId: number; killerPlayerId: number }> {
        if (this.pendingDeathProcessing.size === 0) return [];
        const due: Array<{ npcId: number; killerPlayerId: number }> = [];
        for (const [npcId, entry] of this.pendingDeathProcessing) {
            if (currentTick >= entry.deathTick) {
                due.push({ npcId, killerPlayerId: entry.killerPlayerId });
            }
        }
        for (const entry of due) {
            this.pendingDeathProcessing.delete(entry.npcId);
        }
        return due;
    }

    /** Return the cached type definition for an NPC or undefined if unavailable. */
    getNpcType(npc: NpcState | number): NpcType | undefined {
        const state = npc instanceof NpcState ? npc : this.getById(npc);
        if (!state) return undefined;
        return this.loadNpcTypeById(state.typeId);
    }

    /**
     * Check whether the NPC's cache-defined actions include the given option (case-insensitive).
     * Useful for validating interactions like "Bank" before applying custom behavior.
     */
    hasNpcOption(npc: NpcState | number, option: string): boolean {
        const type = this.getNpcType(npc);
        if (!type) return false;
        const target = (option ?? "").trim().toLowerCase();
        if (!target) return false;
        try {
            const actions = Array.isArray(type.actions) ? type.actions : [];
            for (const a of actions) {
                if (!a) continue;
                if (a.trim().toLowerCase() === target) return true;
            }
        } catch (err) {
            logger.warn("[npc] failed to check npc action", err);
        }
        return false;
    }

    getNearby(tileX: number, tileY: number, level: number, radius: number): NpcState[] {
        const r = Math.max(1, radius);
        const searchRadius = r + Math.max(0, this.maxNpcSize - 1);
        const out: NpcState[] = [];
        const seen = new Set<number>();
        const targetLevel = level;
        const cx = tileX;
        const cy = tileY;

        const minX = cx - searchRadius;
        const maxX = cx + searchRadius;
        const minY = cy - searchRadius;
        const maxY = cy + searchRadius;
        const minRegionX = Math.floor(minX / REGION_SIZE);
        const maxRegionX = Math.floor(maxX / REGION_SIZE);
        const minRegionY = Math.floor(minY / REGION_SIZE);
        const maxRegionY = Math.floor(maxY / REGION_SIZE);

        for (let rx = minRegionX; rx <= maxRegionX; rx++) {
            for (let ry = minRegionY; ry <= maxRegionY; ry++) {
                const key = ((rx & 0x7ff) << 13) | ((ry & 0x7ff) << 2) | (targetLevel & 0x3);
                const bucket = this.regionIndex.get(key);
                if (!bucket) continue;
                for (const npcId of bucket) {
                    if (seen.has(npcId)) continue;
                    const npc = this.npcs.get(npcId);
                    if (!npc || npc.level !== targetLevel) continue;

                    const size = Math.max(1, npc.size);
                    const minNx = npc.tileX;
                    const minNy = npc.tileY;
                    const maxNx = minNx + size - 1;
                    const maxNy = minNy + size - 1;

                    let distX = 0;
                    if (cx < minNx) distX = minNx - cx;
                    else if (cx > maxNx) distX = cx - maxNx;

                    let distY = 0;
                    if (cy < minNy) distY = minNy - cy;
                    else if (cy > maxNy) distY = cy - maxNy;

                    if (Math.max(distX, distY) <= r) {
                        out.push(npc);
                        seen.add(npcId);
                    }
                }
            }
        }

        return out;
    }

    /**
     * Collect NPC ids within a radius (coarse, region-bucket based) into `out`.
     * This is used to "activate" only nearby NPCs for ticking to keep server ticks fast.
     *
     * Note: this does not do exact distance checks; it may include NPCs slightly outside
     * the requested radius. The caller can use a conservative radius.
     */
    collectNearbyIds(
        tileX: number,
        tileY: number,
        level: number,
        radius: number,
        out: Set<number>,
    ): void {
        const r = Math.max(1, radius);
        const searchRadius = r + Math.max(0, this.maxNpcSize - 1);
        const targetLevel = level;
        const cx = tileX;
        const cy = tileY;

        const minX = cx - searchRadius;
        const maxX = cx + searchRadius;
        const minY = cy - searchRadius;
        const maxY = cy + searchRadius;
        const minRegionX = Math.floor(minX / REGION_SIZE);
        const maxRegionX = Math.floor(maxX / REGION_SIZE);
        const minRegionY = Math.floor(minY / REGION_SIZE);
        const maxRegionY = Math.floor(maxY / REGION_SIZE);

        for (let rx = minRegionX; rx <= maxRegionX; rx++) {
            for (let ry = minRegionY; ry <= maxRegionY; ry++) {
                const key = ((rx & 0x7ff) << 13) | ((ry & 0x7ff) << 2) | (targetLevel & 0x3);
                const bucket = this.regionIndex.get(key);
                if (!bucket) continue;
                for (const npcId of bucket) {
                    out.add(npcId);
                }
            }
        }
    }

    getSnapshot(): NpcUpdateSnapshot[] {
        const list: NpcUpdateSnapshot[] = [];
        for (const npc of this.npcs.values()) {
            list.push({
                id: npc.id,
                typeId: npc.typeId,
                name: npc.name,
                x: npc.x,
                y: npc.y,
                level: npc.level,
                rot: npc.rot,
                size: npc.size,
                idleSeqId: npc.idleSeqId >= 0 ? npc.idleSeqId : undefined,
                walkSeqId: npc.walkSeqId >= 0 ? npc.walkSeqId : undefined,
                spawnX: npc.spawnX,
                spawnY: npc.spawnY,
                spawnLevel: npc.spawnLevel,
            });
        }
        return list;
    }

    consumeUpdates(): NpcUpdateDelta[] {
        if (this.pendingUpdates.length === 0) return [];
        const out = this.pendingUpdates.slice();
        this.pendingUpdates.length = 0;
        return out;
    }

    /**
     * Player data for NPC aggression checks.
     */
    tick(
        currentTick: number,
        activeNpcIds?: ReadonlySet<number>,
        /**
         * Get nearby players for aggression checks.
         * Returns players within the given radius of the tile.
         */
        getNearbyPlayers?: (
            tileX: number,
            tileY: number,
            level: number,
            radius: number,
        ) => NearbyAggressionPlayer[],
    ): { statusEvents: NpcStatusEvent[]; aggressionEvents: NpcAggressionEvent[] } {
        this.currentTick = Math.max(0, Math.trunc(currentTick));
        this.pendingUpdates.length = 0;
        this.processNpcLifetimes(this.currentTick);
        this.processNpcDeaths(currentTick);
        this.processNpcRespawns(currentTick);
        const statusEvents: NpcStatusEvent[] = [];
        const aggressionEvents: NpcAggressionEvent[] = [];
        const roamBudget = { remaining: 24 };

        // NPCs must be processed in NPC ID order (ascending)
        // Reference: docs/tick-cycle-order.md
        const iterNpcs = (function* (
            npcs: Map<number, NpcState>,
            ids: ReadonlySet<number> | undefined,
        ): IterableIterator<NpcState> {
            if (!ids) {
                // Sort all NPCs by ID for
                const sortedNpcs = Array.from(npcs.values()).sort((a, b) => a.id - b.id);
                yield* sortedNpcs;
                return;
            }
            // Sort the active NPC IDs before iterating
            const sortedIds = Array.from(ids).sort((a, b) => a - b);
            for (const id of sortedIds) {
                const npc = npcs.get(id);
                if (npc) yield npc;
            }
        })(this.npcs, activeNpcIds);

        for (const npc of iterNpcs) {
            try {
                // NPC tick order is Timers → Queue → Movement → Combat
                // Reference: docs/game-engine.md lines 19-29, docs/tick-cycle-order.md

                // 1. Process status effects/timers FIRST (before movement)
                const hitpointsBeforeStatus = npc.getHitpoints();
                const statusHitsplats =
                    this.statusEffects?.processNpc(npc, currentTick) ??
                    npc.tickStatusEffects(currentTick);
                if (statusHitsplats) {
                    for (const hitsplat of statusHitsplats) {
                        statusEvents.push({ npcId: npc.id, hitsplat });
                    }
                    // Status damage (poison/venom) can be fatal: route through the
                    // deferred death pipeline like combat hits.
                    if (npc.getHitpoints() <= 0 && !npc.isDead(currentTick)) {
                        const lethalHitsplat = [...statusHitsplats]
                            .reverse()
                            .find((hitsplat) => hitsplat.amount > 0);
                        const killerPlayerId = npc.getCombatTargetPlayerId();
                        const prevented =
                            lethalHitsplat !== undefined &&
                            this.lethalStatusHitInterceptor?.({
                                npc,
                                killerPlayerId,
                                proposedDamage: lethalHitsplat.amount,
                                style: lethalHitsplat.style,
                                hitpointsBefore: hitpointsBeforeStatus,
                                tick: currentTick,
                            }) === true;
                        if (prevented) {
                            npc.heal(1);
                            lethalHitsplat.amount = Math.max(0, hitpointsBeforeStatus - 1);
                            lethalHitsplat.hpCurrent = 1;
                        } else {
                            this.scheduleDeathProcessing(
                                npc.id,
                                killerPlayerId ?? 0,
                                currentTick + 1,
                            );
                        }
                    }
                }

                const shouldRecoverToSpawn = this.shouldRecoverToSpawn(npc, currentTick);

                // 1.5. OSRS NPC Aggression: Check for players to target
                // Reference: docs/npc-behavior.md - Aggressive NPCs target nearby players
                if (
                    !shouldRecoverToSpawn &&
                    getNearbyPlayers &&
                    !npc.isInCombat(currentTick) &&
                    !npc.isDead?.(currentTick)
                ) {
                    if (npc.isAggressive) {
                        const aggroEvent = this.checkNpcAggression(
                            npc,
                            currentTick,
                            getNearbyPlayers,
                        );
                        if (aggroEvent) {
                            aggressionEvents.push(aggroEvent);
                        }
                    }
                }

                // CombatTickEngine owns pursuit. NpcManager only handles recovery and
                // idle roaming, then consumes paths queued by the combat phase.
                const combatTargetId = npc.getCombatTargetPlayerId();
                const movementFrozen = interceptFrozenCombatMovement(npc, currentTick);
                if (!movementFrozen && shouldRecoverToSpawn) {
                    if (combatTargetId !== undefined) {
                        npc.disengageCombat();
                        npc.scheduleNextAggressionCheck(currentTick);
                    }
                    this.processRecoveryNpcMovement(npc);
                } else if (!movementFrozen && combatTargetId === undefined) {
                    this.processIdleNpcMovement(npc, currentTick, roamBudget);
                }

                if (!movementFrozen) {
                    this.prunePathAgainstCurrentCollision(npc);
                }
                const moved = this.movementProcessor.processEntity(npc, currentTick);

                // Tick boss script if present
                const bossScript = this.bossScripts.get(npc.id);
                if (bossScript) {
                    bossScript.tick(currentTick);
                }
                const stepPos = npc.drainStepPositions();
                const didMove = npc.didMove();
                const didTurn = npc.didTurn();
                const teleported = npc.wasTeleported();
                const pendingSeq = npc.popPendingSeq();
                let stepSeq: number | undefined;
                const interactionDirty = npc.isInteractionDirty();
                const forcedSync = npc.consumeForcedSync();
                const directions: number[] = [];
                const traversals: number[] = [];

                if (stepPos.length > 0) {
                    const last = stepPos[stepPos.length - 1];
                    if (last.seq !== undefined) {
                        stepSeq = last.seq;
                    }
                    for (const step of stepPos) {
                        if (step.direction !== undefined) {
                            directions.push(step.direction & 7);
                            traversals.push(step.traversal & 3);
                        }
                    }
                }

                if (didMove || teleported) {
                    this.updateOccupancy(npc);
                    // OSRS: Track successful movement for stuck detection
                    npc.recordMovement(currentTick);
                } else if (npc.hasPath() && !npc.isFrozen(currentTick)) {
                    // NPC has a path but didn't move and isn't frozen - it's blocked
                    npc.recordBlocked();
                }

                // walking NPCs should head back toward spawn when lured out,
                // not hard-teleport immediately. Reserve hard resets for genuinely stuck NPCs.
                if (!npc.isPlayerFollower() && !npc.scriptControlled && npc.shouldResetDueToStuck()) {
                    npc.resetToSpawn();
                    this.updateOccupancy(npc);
                    continue; // Skip further processing this tick
                }

                // Skip update delta if nothing changed
                if (
                    !didMove &&
                    !didTurn &&
                    pendingSeq === undefined &&
                    stepSeq === undefined &&
                    !interactionDirty &&
                    !forcedSync
                ) {
                    continue;
                }

                const delta: NpcUpdateDelta = {
                    id: npc.id,
                    x: npc.x,
                    y: npc.y,
                    level: npc.level,
                    rot: npc.rot,
                    orientation: npc.getOrientation() & 2047,
                    moved: teleported || didMove,
                    turned: didTurn,
                    directions: directions.length > 0 ? directions : undefined,
                    traversals: traversals.length > 0 ? traversals : undefined,
                    typeId: npc.typeId,
                    size: npc.size,
                    spawnX: npc.spawnX,
                    spawnY: npc.spawnY,
                    spawnLevel: npc.spawnLevel,
                    snap: teleported,
                };

                if (pendingSeq && pendingSeq.seqId !== undefined) {
                    if (pendingSeq.delay > 0) {
                        // Delay not yet elapsed; requeue and skip this tick.
                        npc.queueOneShotSeq(pendingSeq.seqId, pendingSeq.delay - 1);
                    } else {
                        delta.seq = pendingSeq.seqId;
                    }
                }

                this.pendingUpdates.push(delta);
                npc.clearTeleportFlag();
                npc.consumeInteractionDirty();
                // Note: Status effects already processed at start of NPC tick ()
            } catch (err) {
                logger.warn(`[NpcManager] npc tick error`, err);
            }
        }
        return { statusEvents, aggressionEvents };
    }

    private processNpcLifetimes(currentTick: number): void {
        if (this.lifetimeExpiryTicks.size === 0) return;
        for (const [npcId, expiryTick] of [...this.lifetimeExpiryTicks]) {
            if (currentTick < expiryTick) continue;
            this.removeNpc(npcId);
        }
    }

    private prunePathAgainstCurrentCollision(npc: NpcState): void {
        const queuedSteps = npc.getPathQueue();
        if (queuedSteps.length === 0) {
            return;
        }

        const validSteps: { x: number; y: number }[] = [];
        let currentX = npc.tileX;
        let currentY = npc.tileY;

        for (const step of queuedSteps) {
            if (
                !this.pathService.canNpcStep(
                    { x: currentX, y: currentY, plane: npc.level },
                    step,
                    npc.size,
                )
            ) {
                break;
            }
            validSteps.push(step);
            currentX = step.x;
            currentY = step.y;
        }

        if (validSteps.length === queuedSteps.length) {
            return;
        }
        if (validSteps.length === 0) {
            npc.clearPath();
            return;
        }
        npc.setPath(validSteps, !!npc.running);
    }

    forEach(cb: (npc: NpcState) => void): void {
        for (const npc of this.npcs.values()) cb(npc);
    }

    /**
     * Moves the NPC's occupancy and region-index entries to where it stands now. Compares with
     * where it was last filed (level included), not with `lastTileX/Y` at its current level: a
     * teleport up or down stairs to the same x, y (the mansion's bots) changes only the level,
     * and used to leave the NPC filed on the old floor, invisible to everyone on the new one.
     */
    /** Re-file an NPC that was moved outside its own tick (a scripted teleport). */
    syncIndex(npc: NpcState): void {
        if (this.npcs.get(npc.id) === npc) this.updateOccupancy(npc);
    }

    private updateOccupancy(npc: NpcState): void {
        const at = this.indexedAt.get(npc.id);
        if (at && at.x === npc.tileX && at.y === npc.tileY && at.level === npc.level) return;
        this.removeFromIndices(npc);
        this.addOccupancyFootprint(npc);
        this.addToRegionIndex(npc);
    }

    private addOccupancyFootprint(
        npc: NpcState,
        tileX: number = npc.tileX,
        tileY: number = npc.tileY,
    ): void {
        this.indexedAt.set(npc.id, { x: tileX, y: tileY, level: npc.level });
        forEachFootprintTile(tileX, tileY, npc.level, npc.size, (key) => {
            let bucket = this.occupancy.get(key);
            if (!bucket) {
                bucket = new Set<number>();
                this.occupancy.set(key, bucket);
            }
            bucket.add(npc.id);
        });
    }

    private removeOccupancyFootprint(
        npc: NpcState,
        tileX: number = npc.tileX,
        tileY: number = npc.tileY,
        level: number = npc.level,
    ): void {
        forEachFootprintTile(tileX, tileY, level, npc.size, (key) => {
            const bucket = this.occupancy.get(key);
            if (!bucket) return;
            bucket.delete(npc.id);
            if (bucket.size === 0) {
                this.occupancy.delete(key);
            }
        });
    }

    private hasOccupancyConflict(tileX: number, tileY: number, npc: NpcState): boolean {
        let blocked = false;
        forEachFootprintTile(tileX, tileY, npc.level, npc.size, (key) => {
            if (blocked) return;
            const bucket = this.occupancy.get(key);
            if (!bucket) return;
            for (const occupantId of bucket) {
                if (occupantId !== npc.id) {
                    blocked = true;
                    return;
                }
            }
        });
        return blocked;
    }

    private maybeStartRoam(
        npc: NpcState,
        currentTick: number,
        roamBudget?: { remaining: number },
    ): void {
        // RSMod parity: Timer-based roaming check
        // canRoam() checks if timer elapsed, not facing pawn, can move, etc.
        if (npc.scriptControlled || !npc.canRoam(currentTick)) {
            return;
        }

        // RSMod parity: Always reschedule timer after attempt, regardless of success
        // Reference: npc_random_walk.plugin.kts - timer is set at end of callback
        npc.scheduleNextRoam(currentTick);

        const target = this.pickRandomTarget(npc);
        if (!target) {
            return;
        }

        if (roamBudget) {
            if (roamBudget.remaining <= 0) {
                return;
            }
            roamBudget.remaining--;
        }

        this.queueNpcPathToward(npc, target, { maxQueuedSteps: 8 });
    }

    private processIdleNpcMovement(
        npc: NpcState,
        currentTick: number,
        roamBudget?: { remaining: number },
    ): void {
        if (npc.isFacingPawn()) {
            // NPCs don't roam while facing a pawn; the facing holds for
            // RESET_PAWN_FACE_DELAY ticks and then clears.
            if (!npc.isPawnFaceHoldExpired(currentTick, RESET_PAWN_FACE_DELAY_TICKS)) {
                return;
            }
            npc.clearInteractionTarget();
            npc.clearPawnFaceHold();
        }
        this.maybeStartRoam(npc, currentTick, roamBudget);
    }

    private processRecoveryNpcMovement(npc: NpcState): void {
        npc.beginSpawnRecovery();
        this.maybeRecoverToSpawn(npc);
    }

    private maybeRecoverToSpawn(npc: NpcState): void {
        if (npc.level !== npc.spawnLevel) {
            npc.resetToSpawn();
            return;
        }
        if (npc.tileX === npc.spawnX && npc.tileY === npc.spawnY) {
            npc.stopSpawnRecovery();
            return;
        }
        this.queueNpcPathToward(npc, { x: npc.spawnX, y: npc.spawnY }, { maxQueuedSteps: 2 });
    }

    private queueNpcPathToward(
        npc: NpcState,
        target: { x: number; y: number },
        options: { maxPathCalcSteps?: number; maxQueuedSteps?: number } = {},
    ): boolean {
        if (npc.hasPath()) return false;
        const maxPathCalcSteps = Math.max(1, options.maxPathCalcSteps ?? 8);
        const maxQueuedSteps = Math.max(1, options.maxQueuedSteps ?? maxPathCalcSteps);
        const steps: { x: number; y: number }[] = [];
        let currentX = npc.tileX;
        let currentY = npc.tileY;
        const plane = npc.level;

        // NPCs use a naive step-by-step chase path and do not
        // solve around obstacles, which preserves safespot behavior.
        for (let i = 0; i < maxPathCalcSteps && steps.length < maxQueuedSteps; i++) {
            if (currentX === target.x && currentY === target.y) {
                break;
            }
            const nextStep = this.pathService.findNpcPathStep(
                { x: currentX, y: currentY, plane },
                target,
                npc.size,
            );
            if (!nextStep) {
                break;
            }
            if (nextStep.x === currentX && nextStep.y === currentY) {
                break;
            }
            steps.push(nextStep);
            currentX = nextStep.x;
            currentY = nextStep.y;
        }

        if (steps.length === 0) {
            return false;
        }
        npc.setPath(steps, false);
        return true;
    }

    /**
     * OSRS aggression targeting (wiki: Aggressiveness / Tolerance).
     *
     * Categories:
     * - Passive: isAggressive=false → never auto-attacks
     * - Standard aggressive: combat-level gate (player > 2×npc → safe; npc≥63 always)
     * - Always aggressive: Wilderness ignores combat level and tolerance
     *
     * @see https://oldschool.runescape.wiki/w/Aggressiveness
     */
    private checkNpcAggression(
        npc: NpcState,
        currentTick: number,
        getNearbyPlayers: (
            tileX: number,
            tileY: number,
            level: number,
            radius: number,
        ) => NearbyAggressionPlayer[],
    ): NpcAggressionEvent | undefined {
        if (!npc.isAggressive) return undefined;
        const npcCombatLevel = npc.getCombatLevel();
        if (npcCombatLevel <= 0) return undefined;
        if (!npc.isAggressionCheckReady(currentTick)) {
            return undefined;
        }
        npc.scheduleNextAggressionCheck(currentTick);

        // Check if NPC is in wilderness (special rules apply)
        const npcInWilderness = isInWilderness(npc.tileX, npc.tileY);

        // Check if NPC is in multi-combat zone
        const npcInMultiCombat = multiCombatSystem.isMultiCombat(npc.tileX, npc.tileY, npc.level);

        // Get players within aggression radius
        const nearbyPlayers = getNearbyPlayers(
            npc.tileX,
            npc.tileY,
            npc.level,
            npc.aggressionRadius,
        );

        if (nearbyPlayers.length === 0) return undefined;
        const playersByTile = new Map<number, NearbyAggressionPlayer[]>();
        for (const player of nearbyPlayers) {
            if (player.level !== npc.level) continue;
            const key = tileKey(player.x, player.y, player.level);
            const existing = playersByTile.get(key);
            if (existing) {
                existing.push(player);
            } else {
                playersByTile.set(key, [player]);
            }
        }

        // RSMod parity: scan the square around the NPC in tile order and stop at the
        // first tile containing any valid targets, then choose randomly from that tile.
        const radius = Math.max(0, npc.aggressionRadius);
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                const bucket = playersByTile.get(
                    tileKey(npc.tileX + dx, npc.tileY + dy, npc.level),
                );
                if (!bucket || bucket.length === 0) {
                    continue;
                }
                const validTargets = bucket.filter((player) =>
                    this.canNpcAggroPlayer(
                        npc,
                        player,
                        currentTick,
                        npcCombatLevel,
                        npcInWilderness,
                        npcInMultiCombat,
                    ),
                );
                if (validTargets.length === 0) {
                    continue;
                }
                const target =
                    validTargets[Math.floor(Math.random() * validTargets.length)] ??
                    validTargets[0];
                npc.engageCombat(target.id, currentTick, { tileX: target.x, tileY: target.y });
                return {
                    npcId: npc.id,
                    targetPlayerId: target.id,
                };
            }
        }

        return undefined;
    }

    private shouldRecoverToSpawn(npc: NpcState, currentTick: number): boolean {
        // Player followers are transient companions, not ambient roamers.
        // Their summon tile is not a "home" that they should recover back to.
        if (npc.isPlayerFollower() || npc.scriptControlled) {
            return false;
        }
        if (npc.isRecoveringToSpawn()) {
            if (
                npc.level === npc.spawnLevel &&
                npc.tileX === npc.spawnX &&
                npc.tileY === npc.spawnY &&
                !npc.hasPath()
            ) {
                npc.stopSpawnRecovery();
                return false;
            }
            return (
                npc.level !== npc.spawnLevel ||
                npc.tileX !== npc.spawnX ||
                npc.tileY !== npc.spawnY ||
                npc.hasPath()
            );
        }
        // During combat, retreat if the NPC itself stepped past the 7-tile max range.
        // Out of combat, recover if they left the smaller idle roam area.
        if (npc.isInCombat(currentTick)) {
            return npc.level !== npc.spawnLevel || npc.isTileOutsideCombatLeash(npc.tileX, npc.tileY);
        }
        return npc.level !== npc.spawnLevel || npc.isOutsideRoamArea();
    }

    private canNpcAggroPlayer(
        npc: NpcState,
        player: NearbyAggressionPlayer,
        currentTick: number,
        npcCombatLevel: number,
        npcInWilderness: boolean,
        npcInMultiCombat: boolean,
    ): boolean {
        const dx = Math.abs(player.x - npc.tileX);
        const dy = Math.abs(player.y - npc.tileY);
        const distance = Math.max(dx, dy);
        if (distance > npc.aggressionRadius) {
            return false;
        }

        // OSRS retreat interaction range: never aggro from >18 tiles of spawn.
        if (npc.isBeyondRetreatInteractionRange(player.x, player.y)) {
            return false;
        }

        // Standard "double + 1" gate. Wilderness always-aggressive NPCs skip this.
        if (
            !npcInWilderness &&
            isPlayerSafeFromStandardNpcAggression(player.combatLevel, npcCombatLevel)
        ) {
            return false;
        }

        if (
            !npcInWilderness &&
            this.hasNpcAggressionToleranceExpired(npc, player.aggressionState, currentTick)
        ) {
            return false;
        }

        if (!npcInMultiCombat && player.inCombat) {
            return false;
        }

        return true;
    }

    private hasNpcAggressionToleranceExpired(
        npc: NpcState,
        state: PlayerAggressionState,
        currentTick: number,
    ): boolean {
        const timer = npc.aggressionToleranceTicks | 0;
        if (timer === 2147483647) {
            return false;
        }
        if (timer === -2147483648) {
            return true;
        }
        return currentTick - state.entryTick >= timer;
    }

    private processNpcDeaths(currentTick: number): void {
        if (this.pendingDeaths.size === 0) return;
        for (const [npcId, entry] of Array.from(this.pendingDeaths.entries())) {
            if (currentTick < entry.despawnTick) continue;
            this.pendingDeaths.delete(npcId);

            // Spawn pending drops at despawn time (RSMod parity)
            if (entry.pendingDrops && this.groundItemSpawner) {
                for (const drop of entry.pendingDrops) {
                    this.groundItemSpawner(
                        drop.itemId,
                        drop.quantity,
                        drop.tile,
                        currentTick,
                        {
                            ownerId: drop.ownerId,
                            isMonsterDrop: drop.isMonsterDrop,
                            privateTicks: drop.isWilderness ? 0 : undefined,
                        },
                        drop.worldViewId,
                    );
                }
            }

            this.queueRespawn(npcId, entry.respawnTick);
        }
    }

    private pickRandomTarget(npc: NpcState): { x: number; y: number } | undefined {
        const radius = Math.max(0, npc.wanderRadius);
        if (radius <= 0) return undefined;
        for (let attempts = 0; attempts < 8; attempts++) {
            const dx = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
            const dy = Math.floor(Math.random() * (radius * 2 + 1)) - radius;
            const tx = clamp(npc.spawnX + dx, npc.spawnX - radius, npc.spawnX + radius);
            const ty = clamp(npc.spawnY + dy, npc.spawnY - radius, npc.spawnY + radius);
            if (tx === npc.tileX && ty === npc.tileY) continue;
            if (this.hasOccupancyConflict(tx, ty, npc)) continue;
            return { x: tx, y: ty };
        }
        return undefined;
    }

    private addToRegionIndex(npc: NpcState): void {
        const key = regionKey(npc.tileX, npc.tileY, npc.level);
        let bucket = this.regionIndex.get(key);
        if (!bucket) {
            bucket = new Set<number>();
            this.regionIndex.set(key, bucket);
        }
        bucket.add(npc.id);
    }

    private removeFromIndices(npc: NpcState): void {
        // Where it was filed, which after a teleport isn't where it stands.
        const at = this.indexedAt.get(npc.id) ?? { x: npc.tileX, y: npc.tileY, level: npc.level };
        this.indexedAt.delete(npc.id);
        this.removeOccupancyFootprint(npc, at.x, at.y, at.level);

        const region = regionKey(at.x, at.y, at.level);
        const bucket = this.regionIndex.get(region);
        if (bucket) {
            bucket.delete(npc.id);
            if (bucket.size === 0) {
                this.regionIndex.delete(region);
            }
        }
    }

    private processNpcRespawns(currentTick: number): void {
        if (this.pendingRespawns.size === 0) return;
        for (const [npcId, entry] of Array.from(this.pendingRespawns.entries())) {
            if (currentTick < entry.respawnTick) continue;

            const npc = entry.npc;
            this.pendingRespawns.delete(npcId);
            npc.resetToSpawn();
            // Prevent roaming on the same tick as respawn — without this,
            // the NPC spawns and moves in the same update, appearing as a
            // teleport to the client.
            npc.scheduleNextRoam(currentTick);
            this.npcs.set(npc.id, npc);
            this.addOccupancyFootprint(npc);
            this.addToRegionIndex(npc);
            this.lifecycleHooks?.onReset?.(npc.id);

            // Re-initialize boss script if applicable
            const bossScript = createBossScript(npc);
            if (bossScript) {
                this.bossScripts.set(npc.id, bossScript);
            }
        }
    }
}
