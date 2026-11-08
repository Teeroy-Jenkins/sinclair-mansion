import path from "path";

import type { EnumTypeLoader } from "../../../../client/rs/config/enumtype/EnumTypeLoader";
import type { NpcSoundType } from "../../audio/NpcSoundLookup";
import { logger } from "../../utils/logger";
import type { ServerServices } from "../ServerServices";
import type { NpcCombatProfile, NpcState } from "../npc";
import {
    type NpcCombatAnimations,
    type NpcDefinition,
    resolveNpcCombatAnimations,
} from "../npc/NpcDefinition";

/**
 * Loads and provides NPC combat definitions, stats, special attack data,
 * and NPC sound lookups. Extracted from WSServer.
 */
export class CombatDataService {
    private npcCombatDefs?: Record<
        string,
        { attack?: number; block?: number; death?: number; deathSound?: number }
    >;
    private npcCombatDefaults?: {
        attack: number;
        block: number;
        death: number;
        deathSound: number;
    };
    private npcCombatStats?: Record<string, Record<string, unknown>>;
    private specialAttackCostUnitsByWeapon?: Map<number, number>;
    private specialAttackDescriptionByWeapon?: Map<number, string>;
    private specialAttackDefaultDescription?: string;

    constructor(private readonly services: ServerServices) {}

    // --- NPC combat definitions ---

    loadNpcCombatDefs(): void {
        if (this.npcCombatDefs) return;
        try {
            const raw = require(path.resolve(__dirname, "../../../data/npc-combat-defs.json")) as {
                defaults?: {
                    humanoid?: {
                        attack?: number;
                        block?: number;
                        death?: number;
                        deathSound?: number;
                    };
                };
                npcs?: Record<
                    string,
                    {
                        anims?: { attack?: number; block?: number; death?: number };
                        sounds?: { death?: number };
                        deathSound?: number;
                    }
                >;
                refs?: { npcs?: Array<[number, number, number, number?]> };
            };
            const defaultsRaw = raw?.defaults?.humanoid;
            this.npcCombatDefaults = {
                attack: defaultsRaw?.attack ?? 422,
                block: defaultsRaw?.block ?? 424,
                death: defaultsRaw?.death ?? 836,
                deathSound: defaultsRaw?.deathSound ?? 512,
            };
            const entries: Record<
                string,
                { attack?: number; block?: number; death?: number; deathSound?: number }
            > = {};
            const npcs = raw?.npcs;
            if (npcs && typeof npcs === "object") {
                for (const [key, val] of Object.entries(npcs)) {
                    if (!val || typeof val !== "object") continue;
                    entries[key] = {
                        attack: val.anims?.attack,
                        block: val.anims?.block,
                        death: val.anims?.death,
                        deathSound: val.sounds?.death ?? val.deathSound,
                    };
                }
            }
            // Additional sequences derived from references, kept in the same
            // file to avoid multiple sources of truth. Manual entries win.
            for (const row of raw?.refs?.npcs ?? []) {
                const [npcId, attack, block, death] = row;
                if (!(npcId > 0) || !(attack >= 0) || !(block >= 0)) continue;
                const idKey = String(npcId);
                if (entries[idKey]) continue;
                entries[idKey] = {
                    attack,
                    block,
                    death: death !== undefined && death >= 0 ? death : undefined,
                };
            }
            this.npcCombatDefs = entries;
            logger.info(
                `[combat] loaded ${Object.keys(entries).length} NPC combat definitions`,
            );
        } catch (err) {
            logger.warn("[combat] failed to load npc-combat-defs.json", err);
            this.npcCombatDefs = {};
            this.npcCombatDefaults = { attack: 422, block: 424, death: 836, deathSound: 512 };
        }
    }

    loadNpcCombatStats(): void {
        if (this.npcCombatStats) return;
        try {
            const raw = require(path.resolve(__dirname, "../../../data/npc-combat-stats.json"));
            this.npcCombatStats = raw ?? {};
        } catch {
            this.npcCombatStats = {};
        }
    }

    getNpcCombatSequences(typeId: number): {
        block?: number;
        attack?: number;
        death?: number;
    } {
        const animations = this.getNpcCombatAnimations(typeId);
        return {
            block: animations.defence,
            attack: animations.attack,
            death: animations.death,
        };
    }

    getNpcCombatAnimations(npc: NpcState | number): NpcCombatAnimations {
        this.loadNpcCombatDefs();
        const typeId = typeof npc === "number" ? Math.trunc(npc) : npc.typeId;
        const idle = typeof npc === "number" ? undefined : npc.idleSeqId;
        const walk = typeof npc === "number" ? undefined : npc.walkSeqId;
        const key = String(typeId);
        const entry = this.npcCombatDefs?.[key];
        return resolveNpcCombatAnimations({
            npcTypeId: typeId,
            configured: entry,
            defaults: this.npcCombatDefaults,
            idle,
            walk,
        });
    }

    getNpcDefinition(npc: NpcState): NpcDefinition {
        return {
            id: npc.typeId,
            name: npc.name,
            animations: this.getNpcCombatAnimations(npc),
        };
    }

    resolveNpcCombatProfile(npc: NpcState): NpcCombatProfile {
        return npc.combat;
    }

    getNpcParamValue(npc: NpcState, paramKey: number): number | undefined {
        try {
            const npcType = this.services.npcManager?.getNpcType?.(npc.typeId);
            const params = npcType?.params;
            if (!params) return undefined;
            const val = params.get(paramKey);
            return typeof val === "number" ? val : undefined;
        } catch {
            return undefined;
        }
    }

    // --- Special attack data ---

    loadSpecialAttackCacheData(enumTypeLoader: EnumTypeLoader): void {
        try {
            const costEnum = enumTypeLoader.load(906);
            const costMap = new Map<number, number>();
            for (let i = 0; i < costEnum.keys.length; i++) {
                costMap.set(costEnum.keys[i], costEnum.intValues[i]);
            }
            this.specialAttackCostUnitsByWeapon = costMap;
        } catch (err) {
            logger.warn("[cache] failed to load special attack cost enum (906)", err);
        }

        try {
            const descEnum = enumTypeLoader.load(1739);
            const descMap = new Map<number, string>();
            for (let i = 0; i < descEnum.keys.length; i++) {
                const val = descEnum.stringValues[i] ?? "";
                if (val) descMap.set(descEnum.keys[i], val);
            }
            this.specialAttackDescriptionByWeapon = descMap;
            this.specialAttackDefaultDescription = descEnum.defaultString || undefined;
        } catch (err) {
            logger.warn("[cache] failed to load special attack description enum (1739)", err);
        }
    }

    getWeaponSpecialCostPercent(weaponItemId: number): number | undefined {
        const units = this.specialAttackCostUnitsByWeapon?.get(weaponItemId);
        if (units === undefined || units <= 0) return undefined;
        return Math.max(1, Math.min(100, Math.ceil(units / 10)));
    }

    getWeaponSpecialDescription(weaponItemId: number): string | undefined {
        const direct = this.specialAttackDescriptionByWeapon?.get(weaponItemId);
        if (direct) return direct;
        return this.specialAttackDefaultDescription;
    }

    // --- NPC sound methods ---

    getNpcSoundFromTable88(typeId: number, soundType: NpcSoundType): number | undefined {
        if (!this.services.npcSoundLookup) return undefined;
        try {
            const npcTypeLoader = this.services.dataLoaderService.getNpcTypeLoader();
            if (!npcTypeLoader) return undefined;
            const npcType = npcTypeLoader.load(typeId);
            if (!npcType) return undefined;
            return this.services.npcSoundLookup.getSoundForNpc(npcType, soundType);
        } catch {
            return undefined;
        }
    }

    getNpcDeathSoundFromDefs(typeId: number): { deathSound?: number } | undefined {
        this.loadNpcCombatDefs();
        return this.npcCombatDefs?.[String(typeId)];
    }

    getNpcCombatDefaultDeathSound(): number {
        this.loadNpcCombatDefs();
        return this.npcCombatDefaults?.deathSound ?? 512;
    }

    getNpcDeathSoundId(npc: NpcState): number | undefined {
        const table88 = this.getNpcSoundFromTable88(npc.typeId, "death");
        if (table88 !== undefined) return table88;

        this.loadNpcCombatDefs();
        const entry = this.npcCombatDefs?.[String(npc.typeId)];
        if (entry?.deathSound !== undefined) return entry.deathSound;

        return undefined;
    }

    getNpcAttackSoundId(npc: NpcState): number {
        const NPC_ATTACK_SOUND = 394;
        const table88 = this.getNpcSoundFromTable88(npc.typeId, "attack");
        return table88 ?? NPC_ATTACK_SOUND;
    }

    getNpcHitSoundId(npc: NpcState): number | undefined {
        return this.getNpcSoundFromTable88(npc.typeId, "hit");
    }

    getNpcDefendSoundId(npc: NpcState): number | undefined {
        return this.getNpcSoundFromTable88(npc.typeId, "defend");
    }
}
