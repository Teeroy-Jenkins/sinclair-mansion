/**
 * NPC Combat Stats Loader
 *
 * Loads NPC combat statistics from npc-combat-stats.json
 * Used by the canonical combat evaluator for NPC defence and attack calculations.
 */
import fs from "fs";
import path from "path";

import type { AttackType } from "../game/combat/AttackType";
import { logger } from "../utils/logger";

export interface NpcCombatStats {
    name: string;
    combatLevel: number;
    hitpoints: number;
    attackLevel: number;
    strengthLevel: number;
    defenceLevel: number;
    magicLevel: number;
    rangedLevel: number;
    attackSpeed: number;
    attackType: AttackType;
    attackStyle?: string;
    maxHit: number;
    aggressive: boolean;
    aggressiveRadius?: number;
    aggressiveTimer?: number;
    aggroTargetDelay?: number;
    poisonous?: boolean;
    venomous?: boolean;
    slayerLevel?: number;
    slayerXp?: number;
    attackBonus?: number;
    strengthBonus?: number;
    magicBonus?: number;
    rangedBonus?: number;
    defenceBonuses?: {
        stab: number;
        slash: number;
        crush: number;
        magic: number;
        ranged: number;
    };
    immunities?: string[];
    species?: string[];
    isBoss?: boolean;
    /** Primary combat spell for magic NPCs (Earth Strike, etc.). */
    spellId?: number;
    /** Weighted equally when picking a cast; preferred over spellId when set. */
    spellIds?: number[];
}

interface NpcCombatStatsFile {
    $comment?: string;
    npcs: Record<string, NpcCombatStats>;
}

type RawMonsterAggressionEntry = {
    aggressive?: unknown;
    combat_level?: unknown;
};

export interface NpcAggressionMetadata {
    aggressive: boolean;
    combatLevel?: number;
}

// Singleton cache
let npcStatsCache: Map<number, NpcCombatStats> | null = null;
let npcAggressionMetadataCache: Map<number, NpcAggressionMetadata> | null = null;

function resolveNpcAggressionIndexPath(): string | undefined {
    const candidates = [
        path.resolve(__dirname, "../../data/npc-aggression.json"),
        path.resolve("data/npc-aggression.json"),
        path.resolve("server/data/npc-aggression.json"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
}

function resolveMonstersCompletePath(): string | undefined {
    const candidates = [
        path.resolve("references/monsters-complete.json"),
        path.resolve(__dirname, "../../../references/monsters-complete.json"),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate));
}

function extractObjectAt(
    text: string,
    startIndex: number,
): { json: string; nextIndex: number } | undefined {
    if (text[startIndex] !== "{") return undefined;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = startIndex; i < text.length; i++) {
        const ch = text[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === "{") {
            depth++;
            continue;
        }
        if (ch === "}") {
            depth--;
            if (depth === 0) {
                return {
                    json: text.slice(startIndex, i + 1),
                    nextIndex: i + 1,
                };
            }
        }
    }
    return undefined;
}

function loadNpcAggressionMetadata(): Map<number, NpcAggressionMetadata> {
    if (npcAggressionMetadataCache) {
        return npcAggressionMetadataCache;
    }

    npcAggressionMetadataCache = new Map();

    // Prefer the slim committed index (built from osrsbox-db).
    const indexPath = resolveNpcAggressionIndexPath();
    if (indexPath) {
        try {
            const raw = JSON.parse(fs.readFileSync(indexPath, "utf-8")) as {
                npcs?: Record<string, { aggressive?: unknown; combatLevel?: unknown }>;
            };
            for (const [npcIdStr, entry] of Object.entries(raw.npcs ?? {})) {
                const npcId = parseInt(npcIdStr, 10);
                if (!Number.isFinite(npcId) || typeof entry?.aggressive !== "boolean") continue;
                const combatLevel =
                    typeof entry.combatLevel === "number" && Number.isFinite(entry.combatLevel)
                        ? Math.trunc(entry.combatLevel)
                        : undefined;
                npcAggressionMetadataCache.set(npcId, {
                    aggressive: entry.aggressive,
                    combatLevel,
                });
            }
            logger.info(
                `[NpcCombatStats] Loaded ${npcAggressionMetadataCache.size} NPC aggression flags from ${path.basename(indexPath)}`,
            );
            return npcAggressionMetadataCache;
        } catch (error) {
            logger.warn("[NpcCombatStats] Failed to load npc-aggression.json:", error);
            npcAggressionMetadataCache.clear();
        }
    }

    // Fallback: stream-parse the full osrsbox monsters dump if present locally.
    const filePath = resolveMonstersCompletePath();
    if (!filePath) {
        return npcAggressionMetadataCache;
    }

    try {
        const text = fs.readFileSync(filePath, "utf-8");
        let index = text.indexOf("{");
        if (index === -1) return npcAggressionMetadataCache;
        index++;
        while (index < text.length) {
            while (index < text.length && /[\s,]/.test(text[index])) index++;
            if (index >= text.length || text[index] !== '"') break;
            const keyEnd = text.indexOf('"', index + 1);
            if (keyEnd === -1) break;
            const npcIdStr = text.slice(index + 1, keyEnd);
            index = keyEnd + 1;
            while (index < text.length && /[\s:]/.test(text[index])) index++;
            const extracted = extractObjectAt(text, index);
            if (!extracted) break;
            let entry: RawMonsterAggressionEntry;
            try {
                entry = JSON.parse(extracted.json) as RawMonsterAggressionEntry;
            } catch {
                break;
            }
            const npcId = parseInt(npcIdStr, 10);
            if (!Number.isFinite(npcId) || typeof entry?.aggressive !== "boolean") {
                index = extracted.nextIndex;
                continue;
            }
            const combatLevel =
                typeof entry.combat_level === "number" && Number.isFinite(entry.combat_level)
                    ? Math.trunc(entry.combat_level)
                    : undefined;
            npcAggressionMetadataCache.set(npcId, {
                aggressive: entry.aggressive,
                combatLevel,
            });
            index = extracted.nextIndex;
        }
        logger.info(
            `[NpcCombatStats] Loaded ${npcAggressionMetadataCache.size} NPC aggression flags from monsters-complete.json`,
        );
    } catch (error) {
        logger.warn("[NpcCombatStats] Failed to load supplemental aggression metadata:", error);
        npcAggressionMetadataCache.clear();
    }

    return npcAggressionMetadataCache;
}

/**
 * Load NPC combat stats from JSON file
 * Results are cached after first load
 */
export function loadNpcCombatStats(): Map<number, NpcCombatStats> {
    if (npcStatsCache) {
        return npcStatsCache;
    }

    const filePath = path.resolve(__dirname, "../../data/npc-combat-stats.json");

    if (!fs.existsSync(filePath)) {
        logger.warn(`[NpcCombatStats] File not found: ${filePath}`);
        npcStatsCache = new Map();
        return npcStatsCache;
    }

    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        const data: NpcCombatStatsFile = JSON.parse(raw);

        npcStatsCache = new Map();

        for (const [npcIdStr, stats] of Object.entries(data.npcs)) {
            const npcId = parseInt(npcIdStr, 10);
            if (!isNaN(npcId)) {
                npcStatsCache.set(npcId, stats);
            }
        }

        logger.info(`[NpcCombatStats] Loaded ${npcStatsCache.size} NPC combat profiles`);
    } catch (error) {
        logger.error("[NpcCombatStats] Failed to load:", error);
        npcStatsCache = new Map();
    }

    return npcStatsCache;
}

/**
 * Get combat stats for a specific NPC by type ID
 */
export function getNpcCombatStats(npcTypeId: number): NpcCombatStats | undefined {
    const cache = loadNpcCombatStats();
    return cache.get(npcTypeId);
}

export function getNpcAggressionMetadata(npcTypeId: number): NpcAggressionMetadata | undefined {
    return loadNpcAggressionMetadata().get(npcTypeId);
}

/**
 * Convert NpcCombatStats to the runtime NPC combat profile format.
 */
export function toNpcCombatProfile(stats: NpcCombatStats): {
    defenceLevel: number;
    magicLevel: number;
    rangedLevel: number;
    attackLevel: number;
    strengthLevel: number;
    strengthBonus: number;
    attackBonus: number;
    magicBonus: number;
    rangedBonus: number;
    hitpoints: number;
    maxHit: number;
    attackSpeed: number;
    attackType: AttackType;
    species: string[];
    bonuses: {
        stab: number;
        slash: number;
        crush: number;
        magic: number;
        ranged: number;
    };
} {
    return {
        defenceLevel: stats.defenceLevel,
        magicLevel: stats.magicLevel,
        rangedLevel: stats.rangedLevel,
        attackLevel: stats.attackLevel,
        strengthLevel: stats.strengthLevel,
        strengthBonus: stats.strengthBonus ?? 0,
        attackBonus: stats.attackBonus ?? 0,
        magicBonus: stats.magicBonus ?? 0,
        rangedBonus: stats.rangedBonus ?? 0,
        hitpoints: stats.hitpoints,
        maxHit: stats.maxHit,
        attackSpeed: stats.attackSpeed,
        attackType: stats.attackType,
        species: stats.species ?? [],
        bonuses: stats.defenceBonuses ?? {
            stab: 0,
            slash: 0,
            crush: 0,
            magic: 0,
            ranged: 0,
        },
    };
}

/**
 * Get an NPC combat profile in runtime format.
 */
export function getNpcCombatProfile(npcTypeId: number) {
    const stats = getNpcCombatStats(npcTypeId);
    if (!stats) return undefined;
    return toNpcCombatProfile(stats);
}

/**
 * Check if NPC is aggressive (osrsbox index first, then curated combat stats).
 */
export function isNpcAggressive(npcTypeId: number): boolean {
    const metadata = getNpcAggressionMetadata(npcTypeId);
    if (metadata) {
        return metadata.aggressive;
    }
    const stats = getNpcCombatStats(npcTypeId);
    if (stats?.aggressive !== undefined) {
        return !!stats.aggressive;
    }
    return (stats?.aggressiveRadius ?? 0) > 0;
}

/**
 * Get NPC aggression radius
 */
export function getNpcAggroRadius(npcTypeId: number): number {
    const stats = getNpcCombatStats(npcTypeId);
    if (stats?.aggressiveRadius !== undefined) {
        return Math.max(0, stats.aggressiveRadius | 0);
    }
    return isNpcAggressive(npcTypeId) ? 3 : 0;
}

/**
 * Check if NPC is poisonous
 */
export function isNpcPoisonous(npcTypeId: number): boolean {
    const stats = getNpcCombatStats(npcTypeId);
    return stats?.poisonous ?? false;
}

/**
 * Check if NPC is venomous
 */
export function isNpcVenomous(npcTypeId: number): boolean {
    const stats = getNpcCombatStats(npcTypeId);
    return stats?.venomous ?? false;
}

/**
 * Get NPC species tags (for slayer helm, salve amulet, etc.)
 */
export function getNpcSpecies(npcTypeId: number): string[] {
    const stats = getNpcCombatStats(npcTypeId);
    return stats?.species ?? [];
}

/**
 * Clear the cache (for testing or hot-reloading)
 */
export function clearNpcStatsCache(): void {
    npcStatsCache = null;
    npcAggressionMetadataCache = null;
}
