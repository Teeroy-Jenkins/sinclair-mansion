import type { AttackType } from "../AttackType";
import type { CombatEntityRef } from "./CombatEntityRef";

export const CombatAttackStyle = Object.freeze({
    Accurate: "accurate",
    Aggressive: "aggressive",
    Controlled: "controlled",
    Defensive: "defensive",
    Rapid: "rapid",
    Longrange: "longrange",
} as const);

export type CombatAttackStyle = (typeof CombatAttackStyle)[keyof typeof CombatAttackStyle];

/** Immutable traits selected for one attack cycle. */
export interface CombatAttackTraits {
    readonly type: AttackType;
    readonly style: CombatAttackStyle | null;
    readonly rangeTiles: number;
    readonly speedTicks: number;
    readonly weaponId?: number;
    readonly spellId?: number;
    readonly specialAttack?: boolean;
    readonly autocast?: boolean;
}

/**
 * Engine-neutral description of an attack after its target and traits have
 * been resolved, but before weapon plugins and hit processing run.
 */
export interface CombatAttack {
    readonly attacker: CombatEntityRef;
    readonly target: CombatEntityRef;
    readonly attackClock: number;
    readonly traits: Readonly<CombatAttackTraits>;
}
