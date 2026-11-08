import { NpcState } from "../../../npc";
import { PlayerState } from "../../../player";
import type { ServerServices } from "../../../ServerServices";
import { STUN_TIMER } from "../../../model/timer/Timers";
import type { CombatAttack } from "../../model/CombatAttack";
import { CombatAttributes } from "../../state/CombatAttributes";
import type { WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

/** All OSRS weapons that share Shove, including poisoned dragon spear variants. */
export const DRAGON_SPEAR_ITEM_IDS = Object.freeze([
    1249, 1263, 3176, 5716, 5730, // Dragon spear variants
    11824, // Zamorakian spear
    11889, // Zamorakian hasta
]);

const SHOVE_ENERGY_COST = 25;
const SHOVE_STUN_TICKS = 5;
const SHOVE_STUN_IMMUNITY_TICKS = 1;
const SHOVE_BIND_IMMUNITY_TICKS = 5;
const SHOVE_ANIMATION_ID = 1064;
const SHOVE_CAST_GRAPHIC_ID = 253;
const SHOVE_STUN_GRAPHIC_ID = 80;
const SHOVE_SOUND_ID = 2544;

const SHOVE_SPECIAL = Object.freeze({
    energyCostPercent: SHOVE_ENERGY_COST,
    hitCount: 0,
    accuracyMultiplier: 1,
    damageMultiplier: 0,
    skipAttack: true,
    attackAnimation: SHOVE_ANIMATION_ID,
    castGraphic: { id: SHOVE_CAST_GRAPHIC_ID },
    targetGraphic: { id: SHOVE_STUN_GRAPHIC_ID },
    attackSoundId: SHOVE_SOUND_ID,
});

export const DRAGON_SPEAR_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:dragon_spear",
    itemIds: DRAGON_SPEAR_ITEM_IDS,
    specialAttackEnergyCost: SHOVE_ENERGY_COST,
    handleSpecialAttack: () => SHOVE_SPECIAL,
});

function shoveDirection(attacker: PlayerState, target: PlayerState | NpcState): [number, number] {
    const deltaX = Math.sign(target.tileX - attacker.tileX);
    const deltaY = Math.sign(target.tileY - attacker.tileY);
    if (deltaX !== 0 || deltaY !== 0) return [deltaX, deltaY];

    const directions: readonly [number, number][] = [
        [0, -1],
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
        [1, 0],
        [1, -1],
    ];
    return directions[Math.round((attacker.orientation & 2047) / 256) & 7];
}

/**
 * Combat runs after the regular movement phase. Publish the server-authored
 * step into the current frame so observers receive it this tick instead of
 * seeing the target remain on its old square until the following tick.
 */
function publishShoveStep(target: PlayerState | NpcState, services: ServerServices): void {
    const frame = services.activeFrame;
    if (!frame) return;

    const steps = target.drainStepPositions();
    if (steps.length === 0) return;

    if (target instanceof PlayerState) {
        const existing = frame.playerSteps.get(target.id) ?? [];
        frame.playerSteps.set(target.id, [...existing, ...steps]);
        return;
    }

    const directions = steps
        .map((step) => step.direction)
        .filter((direction): direction is number => direction !== undefined)
        .map((direction) => direction & 7);
    const traversals = steps.map((step) => step.traversal & 3);
    const index = frame.npcUpdates.findIndex((update) => update.id === target.id);
    const update = {
        id: target.id,
        x: target.x,
        y: target.y,
        level: target.level,
        rot: target.rot,
        orientation: target.getOrientation() & 2047,
        moved: true,
        directions,
        traversals,
        typeId: target.typeId,
        size: target.size,
        spawnX: target.spawnX,
        spawnY: target.spawnY,
        spawnLevel: target.spawnLevel,
    };
    if (index === -1) {
        frame.npcUpdates.push(update);
    } else {
        frame.npcUpdates[index] = { ...frame.npcUpdates[index], ...update };
    }
}

export function applyDragonSpearShove(
    attacker: unknown,
    target: unknown,
    currentMapClock: number,
    services: ServerServices,
): boolean {
    if (!(attacker instanceof PlayerState)) return false;
    if (!(target instanceof PlayerState) && !(target instanceof NpcState)) return false;

    if (target.size > 1) {
        services.messagingService.queueChatMessage({
            messageType: "game",
            text: "That creature is too large to knock back!",
            targetPlayerIds: [attacker.id],
        });
        return false;
    }

    const clock = Math.trunc(currentMapClock);
    if (
        clock < target.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK) ||
        clock < target.combatAttributes.get(CombatAttributes.STUN_IMMUNITY_UNTIL_CLOCK)
    ) {
        return false;
    }

    const [deltaX, deltaY] = shoveDirection(attacker, target);
    const destination = { x: target.tileX + deltaX, y: target.tileY + deltaY };
    if (
        services.pathService?.canActorStep(
            { x: target.tileX, y: target.tileY, plane: target.level },
            destination,
            target.size,
        )
    ) {
        if (target.forceStep(destination.x, destination.y)) {
            publishShoveStep(target, services);
        }
    } else {
        target.clearPath();
    }

    const stunUntil = clock + SHOVE_STUN_TICKS;
    target.combatAttributes.set(CombatAttributes.STUN_UNTIL_CLOCK, stunUntil);
    target.combatAttributes.set(
        CombatAttributes.STUN_IMMUNITY_UNTIL_CLOCK,
        stunUntil + SHOVE_STUN_IMMUNITY_TICKS,
    );
    target.combatAttributes.set(
        CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK,
        Math.max(
            target.combatAttributes.get(CombatAttributes.FREEZE_IMMUNITY_UNTIL_CLOCK),
            stunUntil + SHOVE_BIND_IMMUNITY_TICKS,
        ),
    );
    target.combatAttributes.set(
        CombatAttributes.ATTACK_DELAY,
        Math.max(target.combatAttributes.get(CombatAttributes.ATTACK_DELAY), stunUntil),
    );
    // Movement processing is authoritative for both NPCs and players. Use its
    // existing lock rather than only clearing this tick's queued route.
    target.holdMovementUntil(stunUntil);

    // Shove has no damage hitsplat, so it cannot rely on the ordinary
    // damage-retaliation path to give an idle NPC combat focus.
    if (target instanceof NpcState && target.getCombatTargetPlayerId() === undefined) {
        target.engageCombat(attacker.id, clock, {
            tileX: attacker.tileX,
            tileY: attacker.tileY,
        });
    }

    if (target instanceof PlayerState) {
        target.timers.set(STUN_TIMER, SHOVE_STUN_TICKS);
        target.clearWalkDestination();
    }
    return true;
}

/** OSRS Shove: guaranteed utility displacement and stun with no damage roll. */
export class DragonSpearSpec implements WeaponSpecialAttackScript {
    readonly energyCost = SHOVE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true, hitCount: 0 });
    }

    onSpecialActivated(
        attacker: unknown,
        target: unknown,
        currentMapClock: number,
        _attack: CombatAttack,
        services: ServerServices,
    ): boolean {
        return applyDragonSpearShove(attacker, target, currentMapClock, services);
    }

    onHitApplied(
        _attacker: unknown,
        _target: unknown,
        _damageCalculated: number,
        _currentMapClock: number,
    ): void {}
}

export const DRAGON_SPEAR_SPECS = Object.freeze(
    DRAGON_SPEAR_ITEM_IDS.map((itemId) => Object.freeze(new DragonSpearSpec(itemId))),
);
export const DRAGON_SPEAR_SPEC = DRAGON_SPEAR_SPECS[0];
