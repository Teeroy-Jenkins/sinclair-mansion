import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import { SpecialAttackTiming, type WeaponCombatProfile } from "../WeaponCombatProfile";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const SARADOMIN_GODSWORD_ITEM_IDS = Object.freeze([11806, 20372]);
const HEALING_BLADE_ENERGY_COST = 50;
const HEALING_BLADE_HITPOINTS_FRACTION = 0.5;
const HEALING_BLADE_PRAYER_FRACTION = 0.25;
const HEALING_BLADE_MINIMUM_HITPOINTS_HEAL = 10;
const HEALING_BLADE_MINIMUM_PRAYER_RESTORE = 5;

const HEALING_BLADE = Object.freeze({
    energyCostPercent: HEALING_BLADE_ENERGY_COST,
    hitCount: 1,
    accuracyMultiplier: 2,
    damageMultiplier: 1.1,
    attackAnimation: 7640,
    castGraphic: Object.freeze({ id: 1209 }),
    attackSoundId: 3866,
});

export const SARADOMIN_GODSWORD_PROFILE: WeaponCombatProfile = Object.freeze({
    id: "core:saradomin_godsword",
    itemIds: SARADOMIN_GODSWORD_ITEM_IDS,
    specialAttackEnergyCost: HEALING_BLADE_ENERGY_COST,
    specialAttackTiming: SpecialAttackTiming.Standard,
    handleSpecialAttack: () => HEALING_BLADE,
});

/** Healing Blade restores Hitpoints and Prayer when its enhanced strike deals damage. */
export class SaradominGodswordSpec implements WeaponSpecialAttackScript {
    readonly energyCost = HEALING_BLADE_ENERGY_COST;

    constructor(readonly itemId: number) {}

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 2,
            damageMultiplier: 1.1,
        });
    }

    onHitApplied(
        attacker: any,
        target: any,
        damageCalculated: number,
        currentMapClock: number,
    ): void {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return;

        const damage = Math.max(0, Math.floor(damageCalculated));
        if (damage <= 0) return;

        attacker.skillSystem.applyHitpointsHeal(
            Math.max(
                HEALING_BLADE_MINIMUM_HITPOINTS_HEAL,
                Math.floor(damage * HEALING_BLADE_HITPOINTS_FRACTION),
            ),
        );

        const prayer = attacker.skillSystem.getSkill(SkillId.Prayer);
        const currentPrayer = Math.max(0, Math.floor(prayer.baseLevel + prayer.boost));
        const restoredPrayer = Math.max(
            HEALING_BLADE_MINIMUM_PRAYER_RESTORE,
            Math.floor(damage * HEALING_BLADE_PRAYER_FRACTION),
        );
        attacker.skillSystem.setSkillBoost(
            SkillId.Prayer,
            Math.min(prayer.baseLevel, currentPrayer + restoredPrayer),
        );
    }
}

export const SARADOMIN_GODSWORD_SPECS = Object.freeze(
    SARADOMIN_GODSWORD_ITEM_IDS.map((itemId) => Object.freeze(new SaradominGodswordSpec(itemId))),
);
