import { SkillId } from "../../../../../../client/rs/skill/skills";
import { PlayerState } from "../../../player";
import type { CombatAttack } from "../../model/CombatAttack";
import {
    type WeaponSpecialAttackScript,
    setWeaponSpecialAttackTraitOverrides,
} from "../WeaponSpecialAttackScript";

const DRAGON_PICKAXE_ITEM_ID = 11920;
const INFERNAL_PICKAXE_ITEM_ID = 13243;
const THIRD_AGE_PICKAXE_ITEM_ID = 20014;
const CRYSTAL_PICKAXE_ITEM_ID = 23680;
const ROCK_KNOCKER_ENERGY_COST = 100;
const ROCK_KNOCKER_MINING_BOOST = 3;

/**
 * Rock Knocker is a utility special attack: it grants a temporary Mining
 * boost rather than making an attack roll or producing a hitsplat.
 */
export class DragonPickaxeSpec implements WeaponSpecialAttackScript {
    constructor(readonly itemId = DRAGON_PICKAXE_ITEM_ID) {}

    readonly energyCost = ROCK_KNOCKER_ENERGY_COST;

    modifyAttackTraits(attack: CombatAttack): void {
        setWeaponSpecialAttackTraitOverrides(attack, { skipAttack: true });
    }

    onSpecialActivated(attacker: any, target: any, currentMapClock: number): boolean {
        void target;
        void currentMapClock;
        if (!(attacker instanceof PlayerState)) return false;

        const mining = attacker.skillSystem.getSkill(SkillId.Mining);
        const currentLevel = Math.max(
            0,
            Math.floor(mining.baseLevel + mining.boost),
        );
        const boostedLevel = Math.max(
            currentLevel,
            Math.floor(mining.baseLevel + ROCK_KNOCKER_MINING_BOOST),
        );

        attacker.skillSystem.setSkillBoost(SkillId.Mining, boostedLevel);
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

export const DRAGON_PICKAXE_SPEC = Object.freeze(new DragonPickaxeSpec());
export const DRAGON_PICKAXE_VARIANT_SPECS = Object.freeze([
    new DragonPickaxeSpec(INFERNAL_PICKAXE_ITEM_ID),
    new DragonPickaxeSpec(THIRD_AGE_PICKAXE_ITEM_ID),
    new DragonPickaxeSpec(CRYSTAL_PICKAXE_ITEM_ID),
]);
