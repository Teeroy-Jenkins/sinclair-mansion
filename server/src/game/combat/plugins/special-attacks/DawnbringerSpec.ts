import { AttackType } from "../../AttackType";
import { isInTheatreOfBlood } from "../../MultiCombatZones";
import type { CombatAttack } from "../../model/CombatAttack";
import { PlayerState } from "../../../player";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DAWNBRINGER_ITEM_ID = 22516;
const PULSATE_ENERGY_COST = 35;
const PULSATE_MINIMUM_DAMAGE = 75;
const PULSATE_MAXIMUM_DAMAGE = 150;

/**
 * Pulsate is the Dawnbringer's fixed-damage blast. It can only be activated
 * within the Theatre of Blood build area; future Verzik content can add its
 * own encounter-specific target handling without changing this weapon script.
 */
export class DawnbringerSpec implements WeaponSpecialAttackScript {
    readonly itemId = DAWNBRINGER_ITEM_ID;
    readonly energyCost = PULSATE_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            guaranteedHit: true,
            rollAttackType: AttackType.Magic,
            damageType: AttackType.Magic,
            maxHitOverride: PULSATE_MAXIMUM_DAMAGE,
            minimumDamageMultiplier: PULSATE_MINIMUM_DAMAGE / PULSATE_MAXIMUM_DAMAGE,
            maximumDamageMultiplier: 1,
        });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        return (
            attacker instanceof PlayerState &&
            isInTheatreOfBlood(attacker.tileX, attacker.tileY, attacker.level)
        );
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

export const DAWNBRINGER_SPEC = Object.freeze(new DawnbringerSpec());
