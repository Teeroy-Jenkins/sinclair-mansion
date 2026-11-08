import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_HARPOON_ITEM_ID = 21028;
const INFERNAL_HARPOON_ITEM_ID = 21031;
const CRYSTAL_HARPOON_ITEM_ID = 23762;
const FISHSTABBER_ENERGY_COST = 100;
const FISHSTABBER_FISHING_BOOST = 3;

/**
 * Fishstabber is a utility special attack: it grants a temporary Fishing
 * boost rather than making an attack roll or producing a hitsplat.
 */
export class DragonHarpoonSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId = DRAGON_HARPOON_ITEM_ID) {}

    readonly energyCost = FISHSTABBER_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return false;

        const fishing = attacker.skillSystem.getSkill(SkillId.Fishing);
        const currentLevel = Math.max(
            0,
            Math.floor(fishing.baseLevel + fishing.boost),
        );
        const boostedLevel = Math.max(
            currentLevel,
            Math.floor(fishing.baseLevel + FISHSTABBER_FISHING_BOOST),
        );

        attacker.skillSystem.setSkillBoost(SkillId.Fishing, boostedLevel);
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

export const DRAGON_HARPOON_SPEC = Object.freeze(new DragonHarpoonSpec());
export const DRAGON_HARPOON_VARIANT_SPECS = Object.freeze([
    new DragonHarpoonSpec(INFERNAL_HARPOON_ITEM_ID),
    new DragonHarpoonSpec(CRYSTAL_HARPOON_ITEM_ID),
]);
