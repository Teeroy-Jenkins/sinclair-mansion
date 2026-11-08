export interface NpcCombatAnimations {
    attack: number;
    defence: number;
    death: number;
    idle: number;
    walk: number;
}

export interface NpcDefinition {
    readonly id: number;
    readonly name?: string;
    readonly animations: NpcCombatAnimations;
}

export interface PartialNpcCombatAnimations {
    readonly attack?: number;
    readonly defence?: number;
    readonly block?: number;
    readonly death?: number;
    readonly idle?: number;
    readonly walk?: number;
}

const INVALID_ANIMATION = -1;

/** Small safety net for iconic NPCs not present in the combat-definition data. */
const NPC_COMBAT_ANIMATION_FALLBACKS = new Map<number, PartialNpcCombatAnimations>([
    [1, { attack: 422, defence: 424, death: 836 }],
    [7, { attack: 6184, defence: 6188, death: 6182 }],
    [15, { attack: 390, defence: 391, death: 392 }],
]);

export function getNpcCombatAnimationFallback(
    npcTypeId: number,
): PartialNpcCombatAnimations | undefined {
    return NPC_COMBAT_ANIMATION_FALLBACKS.get(Math.trunc(npcTypeId));
}

/**
 * Resolves a complete animation archetype.
 *
 * Explicit NPC data wins, followed by the iconic fallback registry and then
 * the server's general combat defaults. Cache-derived idle/walk sequences stay
 * authoritative for locomotion.
 */
export function resolveNpcCombatAnimations(options: {
    npcTypeId: number;
    configured?: PartialNpcCombatAnimations;
    defaults?: PartialNpcCombatAnimations;
    idle?: number;
    walk?: number;
}): NpcCombatAnimations {
    const fallback = getNpcCombatAnimationFallback(options.npcTypeId);
    const configured = options.configured;
    const defaults = options.defaults;

    return {
        attack: firstValidAnimation(
            configured?.attack,
            fallback?.attack,
            defaults?.attack,
        ),
        defence: firstValidAnimation(
            configured?.defence,
            configured?.block,
            fallback?.defence,
            fallback?.block,
            defaults?.defence,
            defaults?.block,
        ),
        death: firstValidAnimation(
            configured?.death,
            fallback?.death,
            defaults?.death,
        ),
        idle: firstValidAnimation(options.idle, configured?.idle, defaults?.idle),
        walk: firstValidAnimation(options.walk, configured?.walk, defaults?.walk),
    };
}

function firstValidAnimation(...candidates: Array<number | undefined>): number {
    for (const candidate of candidates) {
        if (candidate !== undefined && Number.isFinite(candidate) && candidate > 0) {
            return Math.trunc(candidate);
        }
    }
    return INVALID_ANIMATION;
}
