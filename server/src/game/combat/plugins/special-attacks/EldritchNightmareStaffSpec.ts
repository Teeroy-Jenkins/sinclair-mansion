import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import { AttackType } from "../../AttackType";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    SpecialAttackMaximumHitSource,
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const ELDRITCH_NIGHTMARE_STAFF_ITEM_ID = 24425;
const ELDRITCH_NIGHTMARE_STAFF_ENERGY_COST = 55;
const INVOCATE_BASE_MAX_HIT = 44;
const INVOCATE_PRAYER_RESTORE_FRACTION = 0.5;
const INVOCATE_MAXIMUM_PRAYER_LEVEL = 120;

/**
 * Invocate is a rune-free spell whose internal max hit scales from visible
 * Magic level before equipment and prayer magic-damage bonuses are applied.
 */
export class EldritchNightmareStaffSpec implements WeaponSpecialAttackScript {
    readonly itemId = ELDRITCH_NIGHTMARE_STAFF_ITEM_ID;
    readonly energyCost = ELDRITCH_NIGHTMARE_STAFF_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, {
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
            rollAttackType: AttackType.Magic,
            damageType: AttackType.Magic,
            maximumHitSource: SpecialAttackMaximumHitSource.VisibleMagic,
            visibleMagicMaximumHit: INVOCATE_BASE_MAX_HIT,
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

        const prayer = attacker.skillSystem.getSkill(SkillId.Prayer);
        const currentPrayer = Math.max(0, Math.floor(prayer.baseLevel + prayer.boost));
        const restoredPrayer = Math.floor(damage * INVOCATE_PRAYER_RESTORE_FRACTION);
        const nextPrayer = Math.min(INVOCATE_MAXIMUM_PRAYER_LEVEL, currentPrayer + restoredPrayer);
        attacker.skillSystem.setSkillBoost(SkillId.Prayer, nextPrayer);
    }
}

export const ELDRITCH_NIGHTMARE_STAFF_SPEC = Object.freeze(new EldritchNightmareStaffSpec());
