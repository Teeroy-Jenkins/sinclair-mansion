import { CombatAttributes } from "../state/CombatAttributes";
import { PlayerState } from "../../player";
import type { CombatEntity } from "./CombatTargetResolver";

/**
 * Clears queued walking while a combat freeze or stun deadline is active.
 *
 * Callers should still run the actor's normal tick step afterward. An empty
 * path lets facing, rotation, animations, combat, and non-movement actions
 * continue while only waypoint consumption is suppressed.
 */
export function interceptFrozenCombatMovement(
    entity: CombatEntity,
    currentMapClock: number,
): boolean {
    const clock = mapClock(currentMapClock);
    const immobilizedUntil = Math.max(
        entity.combatAttributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK),
        entity.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK),
    );
    if (clock >= immobilizedUntil) {
        return false;
    }

    entity.clearPath();
    if (entity instanceof PlayerState) {
        entity.clearWalkDestination();
    }
    return true;
}

export function isCombatMovementFrozen(
    entity: CombatEntity,
    currentMapClock: number,
): boolean {
    return (
        mapClock(currentMapClock) <
        Math.max(
            entity.combatAttributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK),
            entity.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK),
        )
    );
}

function mapClock(value: number): number {
    if (!Number.isFinite(value)) {
        throw new RangeError(`Combat movement clock must be finite; received ${value}`);
    }
    return Math.trunc(value);
}
