import { PlayerState } from "../../../player";
import { NpcState } from "../../../npc";
import { OverheadType } from "../../../prayer/OverheadType";
import type { CombatHitEvaluation } from "../../engine/CombatHitEvaluator";
import type { CombatAttack } from "../../model/CombatAttack";
import { CombatAttributes } from "../../state/CombatAttributes";
import type { WeaponCombatContext, WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const NOXIOUS_HALBERD_ITEM_ID = 29796;
const VIRULENCE_ENERGY_COST = 50;

const virulenceMinimumHits = new WeakMap<PlayerState, number>();

/** Removes the one-hit Virulence buff immediately once another weapon is used. */
export function clearNoxiousHalberdVirulenceOnWeaponChange(
    player: PlayerState,
    weaponId: number | undefined,
): void {
    if (weaponId !== NOXIOUS_HALBERD_ITEM_ID) virulenceMinimumHits.delete(player);
}

function applyVirulenceMinimumHit(
    evaluation: CombatHitEvaluation,
    context: WeaponCombatContext,
): CombatHitEvaluation {
    if (!(context.attacker instanceof PlayerState) || !evaluation.landed) return evaluation;
    const minimumHit = virulenceMinimumHits.get(context.attacker);
    if (minimumHit === undefined) return evaluation;

    // The buff is consumed by the next accurate Noxious-halberd strike even if
    // its target is protected. transformHit runs after the ordinary damage
    // roll, so mirror that prayer's reduction when setting the minimum.
    virulenceMinimumHits.delete(context.attacker);
    const maximumDamage = Math.max(0, Math.floor(evaluation.maxHit));
    const protectedMinimum = applyMeleeProtectionPrayer(minimumHit, context.target);
    return Object.freeze({
        ...evaluation,
        damage: Math.min(
            maximumDamage,
            Math.max(Math.floor(evaluation.damage), protectedMinimum),
        ),
    });
}

function applyMeleeProtectionPrayer(minimumHit: number, target: WeaponCombatContext["target"]): number {
    const minimum = Math.max(0, Math.floor(minimumHit));
    if (target.combatAttributes.get(CombatAttributes.ACTIVE_OVERHEAD_PRAYER) !== OverheadType.MELEE) {
        return minimum;
    }
    return target instanceof NpcState ? 0 : Math.floor(minimum * 0.6);
}

/** Provides Virulence's persistent next-accurate-hit effect for normal attacks. */
export const NOXIOUS_HALBERD_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:noxious_halberd",
    itemIds: Object.freeze([NOXIOUS_HALBERD_ITEM_ID]),
    transformHit: applyVirulenceMinimumHit,
});

/**
 * Virulence consumes poison or venom to make the next accurate Noxious-halberd
 * strike roll from that pending damage through the ordinary maximum hit. It is
 * a utility special, so activation itself does not create a damage hitsplat.
 */
export class NoxiousHalberdSpec implements WeaponSpecialAttackScript {
    readonly itemId = NOXIOUS_HALBERD_ITEM_ID;
    readonly energyCost = VIRULENCE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return false;

        const pendingDamage = attacker.skillSystem.getPendingPoisonOrVenomDamage();
        if (pendingDamage <= 0) return false;

        attacker.skillSystem.curePoison();
        attacker.skillSystem.cureVenom();
        virulenceMinimumHits.set(attacker, pendingDamage);
        return true;
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void attacker;
        void target;
        void damageCalculated;
        void currentMapClock;
    }
}

export const NOXIOUS_HALBERD_SPEC = Object.freeze(new NoxiousHalberdSpec());
