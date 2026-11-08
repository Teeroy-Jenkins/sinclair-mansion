import type { CombatAttack } from "../../model/CombatAttack";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_DAGGER_ITEM_IDS = Object.freeze([1215, 1231, 5680, 5698, 20407]);

const DRAGON_DAGGER_SPECIAL = Object.freeze({
    energyCostPercent: 25,
    hitCount: 2,
    accuracyMultiplier: 1.15,
    damageMultiplier: 1.15,
    attackAnimation: 1062,
    castGraphic: Object.freeze({ id: 252 }),
    attackSoundId: 2537,
});

export const DRAGON_DAGGER_SPECIAL_ATTACK_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:dragon_dagger",
    itemIds: DRAGON_DAGGER_ITEM_IDS,
    specialAttackEnergyCost: DRAGON_DAGGER_SPECIAL.energyCostPercent,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () => DRAGON_DAGGER_SPECIAL,
});

export class DragonDaggerSpecialAttackScript implements WeaponSpecialAttackScript {
    readonly energyCost = DRAGON_DAGGER_SPECIAL.energyCostPercent;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: DRAGON_DAGGER_SPECIAL.hitCount,
            accuracyMultiplier: DRAGON_DAGGER_SPECIAL.accuracyMultiplier,
            damageMultiplier: DRAGON_DAGGER_SPECIAL.damageMultiplier,
        });
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

export const DRAGON_DAGGER_SPECIAL_ATTACK_SCRIPTS = Object.freeze(
    DRAGON_DAGGER_ITEM_IDS.map((itemId) =>
        Object.freeze(new DragonDaggerSpecialAttackScript(itemId)),
    ),
);
