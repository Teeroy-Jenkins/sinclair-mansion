import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_AXE_ITEM_ID = 6739;
const INFERNAL_AXE_ITEM_ID = 13241;
const THIRD_AGE_AXE_ITEM_ID = 20011;
const CRYSTAL_AXE_ITEM_ID = 23673;
const CRYSTAL_FELLING_AXE_ITEM_ID = 28220;
const THIRD_AGE_FELLING_AXE_ITEM_ID = 28226;
const LUMBER_UP_ENERGY_COST = 100;
const LUMBER_UP_WOODCUTTING_BOOST = 3;

/**
 * Lumber Up is a utility special attack: it grants a temporary Woodcutting
 * boost rather than making an attack roll or producing a hitsplat.
 */
export class DragonAxeSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId = DRAGON_AXE_ITEM_ID) {}

    readonly energyCost = LUMBER_UP_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return false;

        const woodcutting = attacker.skillSystem.getSkill(SkillId.Woodcutting);
        const currentLevel = Math.max(
            0,
            Math.floor(woodcutting.baseLevel + woodcutting.boost),
        );
        const boostedLevel = Math.max(
            currentLevel,
            Math.floor(woodcutting.baseLevel + LUMBER_UP_WOODCUTTING_BOOST),
        );

        attacker.skillSystem.setSkillBoost(SkillId.Woodcutting, boostedLevel);
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

export const DRAGON_AXE_SPEC = Object.freeze(new DragonAxeSpec());
export const DRAGON_AXE_VARIANT_SPECS = Object.freeze([
    new DragonAxeSpec(INFERNAL_AXE_ITEM_ID),
    new DragonAxeSpec(THIRD_AGE_AXE_ITEM_ID),
    new DragonAxeSpec(CRYSTAL_AXE_ITEM_ID),
    new DragonAxeSpec(CRYSTAL_FELLING_AXE_ITEM_ID),
    new DragonAxeSpec(THIRD_AGE_FELLING_AXE_ITEM_ID),
]);
