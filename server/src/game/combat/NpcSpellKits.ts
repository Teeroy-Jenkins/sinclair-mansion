/**
 * Data-driven NPC spell kits for magic attackers.
 *
 * Prefer `spellIds` on npc-combat-stats.json (single source of truth).
 * Optional hardcoded fallbacks remain only for NPCs not yet curated.
 *
 * Dark wizards (wiki):
 * - Level 7 / 11 → Water Strike
 * - Level 20 / 22 / 23 → Earth Strike
 *
 * @see https://oldschool.runescape.wiki/w/Dark_wizard
 */

import { getNpcCombatStats } from "../../data/npcCombatStats";

export const SPELL_WATER_STRIKE = 3275;
export const SPELL_EARTH_STRIKE = 3277;

export type NpcSpellKitEntry = {
    spellId: number;
    weight: number;
};

export type NpcSpellKit = {
    spells: readonly NpcSpellKitEntry[];
};

function kitFromSpellIds(spellIds: readonly number[]): NpcSpellKit | undefined {
    const spells: NpcSpellKitEntry[] = [];
    for (const raw of spellIds) {
        const spellId = Math.trunc(raw);
        if (!(spellId > 0)) continue;
        spells.push({ spellId, weight: 1 });
    }
    return spells.length > 0 ? { spells } : undefined;
}

/**
 * Resolve the spell kit for an NPC type.
 * Combat-stats `spellIds` wins when present.
 */
export function getNpcSpellKit(npcTypeId: number): NpcSpellKit | undefined {
    const stats = getNpcCombatStats(npcTypeId);
    if (stats?.spellIds && stats.spellIds.length > 0) {
        return kitFromSpellIds(stats.spellIds);
    }
    if (typeof stats?.spellId === "number" && stats.spellId > 0) {
        return kitFromSpellIds([stats.spellId]);
    }
    return undefined;
}

/**
 * Pick a spell from the NPC's kit. Returns undefined if the NPC has no kit.
 */
export function pickNpcSpellId(
    npcTypeId: number,
    random: () => number = Math.random,
): number | undefined {
    const kit = getNpcSpellKit(npcTypeId);
    if (!kit || kit.spells.length === 0) {
        return undefined;
    }
    if (kit.spells.length === 1) {
        return kit.spells[0].spellId;
    }
    let total = 0;
    for (const entry of kit.spells) {
        total += Math.max(0, entry.weight);
    }
    if (!(total > 0)) {
        return kit.spells[0].spellId;
    }
    let roll = random() * total;
    for (const entry of kit.spells) {
        roll -= Math.max(0, entry.weight);
        if (roll < 0) {
            return entry.spellId;
        }
    }
    return kit.spells[kit.spells.length - 1].spellId;
}
