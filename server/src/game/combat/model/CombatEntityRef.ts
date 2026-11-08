/** Entity categories addressable by the combat engine. */
export const CombatEntityType = Object.freeze({
    Player: "player",
    Npc: "npc",
} as const);

export type CombatEntityType = (typeof CombatEntityType)[keyof typeof CombatEntityType];

export interface PlayerCombatEntityRef {
    readonly type: typeof CombatEntityType.Player;
    readonly id: number;
}

export interface NpcCombatEntityRef {
    readonly type: typeof CombatEntityType.Npc;
    readonly id: number;
}

/** A stable, serializable reference resolved through the world entity registries. */
export type CombatEntityRef = PlayerCombatEntityRef | NpcCombatEntityRef;

function assertEntityId(id: number): void {
    if (!Number.isSafeInteger(id)) {
        throw new RangeError(`Combat entity id must be a safe integer; received ${id}`);
    }
}

export function playerCombatEntityRef(id: number): PlayerCombatEntityRef {
    assertEntityId(id);
    return Object.freeze({ type: CombatEntityType.Player, id });
}

export function npcCombatEntityRef(id: number): NpcCombatEntityRef {
    assertEntityId(id);
    return Object.freeze({ type: CombatEntityType.Npc, id });
}

export function combatEntityRef(type: CombatEntityType, id: number): CombatEntityRef {
    return type === CombatEntityType.Player ? playerCombatEntityRef(id) : npcCombatEntityRef(id);
}

export function isSameCombatEntity(
    first: CombatEntityRef | null | undefined,
    second: CombatEntityRef | null | undefined,
): boolean {
    return first != null && second != null && first.type === second.type && first.id === second.id;
}

export function combatEntityRefKey(entity: CombatEntityRef): string {
    return `${entity.type}:${entity.id}`;
}
