import {
    PRAYER_NAME_SET,
    type PrayerCombatStat,
    type PrayerName,
    getPrayerDefinition,
} from "../../../../../client/rs/prayer/prayers";
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { ServerServices } from "../../ServerServices";
import { NpcState } from "../../npc";
import { PlayerState } from "../../player";
import { OverheadType } from "../../prayer/OverheadType";
import { resolveElementalSpellBaseMaxHit } from "../../spells/ElementalSpellMaxHit";
import {
    calculatePoweredStaffBaseDamage,
    getPoweredStaffSpellData,
    getSpellData,
} from "../../spells/SpellDataProvider";
import { AttackType } from "../AttackType";
import { getAttackStyle as getWeaponAttackStyle } from "../WeaponDataProvider";
import {
    HIT_CHANCE_SCALE,
    calculateAttackRoll,
    calculateDefenceRoll,
    calculateHitChance,
    rollAccuracy,
} from "../formulas/Accuracy";
import { calculateMeleeMaxHit } from "../formulas/MeleeMaxHit";
import { calculateRangedMaxHit } from "../formulas/RangedMaxHit";
import type { CombatAttack, CombatAttackStyle } from "../model/CombatAttack";
import type { CombatEntityRef } from "../model/CombatEntityRef";
import { CombatEntityType } from "../model/CombatEntityRef";
import type { WeaponSpecialAttack } from "../plugins/WeaponCombatProfile";
import { dragonClawsMinimumHits, isDragonClaws } from "../plugins/special-attacks/DragonClawsSpec";
import {
    SpecialAttackMaximumHitSource,
    setWeaponSpecialAttackRuntimeMetadata,
} from "../plugins/WeaponSpecialAttackScript";
import { CombatAttributes } from "../state/CombatAttributes";
import type { CombatEntity } from "./CombatTargetResolver";

const PLAYER_EFFECTIVE_LEVEL_BONUS = 8;
const NPC_EFFECTIVE_LEVEL_BONUS = 9;
const MAGIC_ATTACK_BONUS_INDEX = 3;
const RANGED_ATTACK_BONUS_INDEX = 4;
const STAB_DEFENCE_BONUS_INDEX = 5;
const MAGIC_DEFENCE_BONUS_INDEX = 8;
const RANGED_DEFENCE_BONUS_INDEX = 9;
const MELEE_STRENGTH_BONUS_INDEX = 10;
const RANGED_STRENGTH_BONUS_INDEX = 11;
const MAGIC_DAMAGE_BONUS_INDEX = 12;

export interface CombatRollProfile {
    readonly effectiveAttack: number;
    readonly attackBonus: number;
    readonly effectiveDefence: number;
    readonly defenceBonus: number;
    readonly maxHit: number;
}

export interface CombatHitEvaluation {
    readonly valid: boolean;
    readonly attack: CombatAttack;
    readonly attacker?: CombatEntity;
    readonly target?: CombatEntity;
    readonly attackRoll: number;
    readonly defenceRoll: number;
    readonly hitChance: number;
    readonly maxHit: number;
    readonly landed: boolean;
    /** Successful internal accuracy rolls that produced this hitsplat. */
    readonly successfulAccuracyRolls?: number;
    /** Damage before matching protection-prayer reduction is applied. */
    readonly preProtectionDamage: number;
    readonly damage: number;
    readonly reason?: "attacker_not_found" | "target_not_found";
}

export interface CombatHitEvaluatorOptions {
    resolveEntity(reference: CombatEntityRef): CombatEntity | undefined;
    getEquipmentBonuses(player: PlayerState): readonly number[];
    random?: () => number;
}

/** Creates the canonical hit evaluator against the live world registries. */
export function createCombatHitEvaluator(
    services: ServerServices,
    random?: () => number,
): CombatHitEvaluator {
    return new CombatHitEvaluator({
        resolveEntity: (reference) =>
            reference.type === CombatEntityType.Player
                ? services.players?.getById(reference.id)
                : services.npcManager?.getById(reference.id),
        getEquipmentBonuses: (player) =>
            services.equipmentService.computeEquipmentStatBonuses(player),
        random,
    });
}

interface StanceBonuses {
    readonly accuracy: number;
    readonly strength: number;
    readonly defence: number;
}

interface AttackProfile {
    readonly effectiveAttack: number;
    readonly attackBonus: number;
    readonly maxHit: number;
    readonly meleeBonusIndex: number;
}

/** Rolls one immutable attack using the integer Phase 2 formula functions. */
export class CombatHitEvaluator {
    private readonly random: () => number;

    constructor(private readonly options: CombatHitEvaluatorOptions) {
        this.random = options.random ?? Math.random;
    }

    evaluate(attack: CombatAttack): CombatHitEvaluation {
        const hit = this.evaluateRoll(attack, {
            energyCostPercent: 0,
            hitCount: 1,
            accuracyMultiplier: 1,
            damageMultiplier: 1,
        });
        return this.withClawsDamageFloor(attack, [hit])[0];
    }

    evaluateSpecialAttack(
        attack: CombatAttack,
        special: WeaponSpecialAttack,
    ): readonly CombatHitEvaluation[] {
        if (special.firstSuccessfulAccuracyDamageRanges) {
            return this.withClawsDamageFloor(attack, this.evaluateFirstSuccessfulAccuracyMultiHit(attack, special));
        }
        const hitCount = Math.max(1, Math.trunc(special.hitCount));
        const evaluations: CombatHitEvaluation[] = [];
        for (let hitIndex = 0; hitIndex < hitCount; hitIndex++) {
            const firstEvaluation = evaluations[0];
            evaluations.push(
                this.evaluateRoll(
                    attack,
                    special,
                    hitIndex,
                    special.sharedAccuracyRollAcrossHits === true && hitIndex > 0
                        ? (firstEvaluation?.successfulAccuracyRolls ?? 0)
                        : undefined,
                ),
            );
        }
        return Object.freeze(evaluations);
    }

    /**
     * Dragon claws never deal less than half their potential (DRAGON_CLAWS_MINIMUM_DAMAGE_FRACTION):
     * a weaker roll, a miss included, becomes the smallest split that reaches it.
     */
    private withClawsDamageFloor(
        attack: CombatAttack,
        hits: readonly CombatHitEvaluation[],
    ): readonly CombatHitEvaluation[] {
        const first = hits[0];
        if (!first?.valid || !first.attacker || !first.target || !isDragonClaws(attack.traits.weaponId)) return hits;
        const floor = dragonClawsMinimumHits(this.buildPhysicalMeleeMaxHit(attack, first.attacker), hits.length);
        const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
        if (sum(hits.map((h) => h.preProtectionDamage)) >= sum(floor)) return hits;
        return Object.freeze(
            hits.map((h, i) => {
                const preProtectionDamage = floor[i] ?? 0;
                return Object.freeze({
                    ...h,
                    landed: preProtectionDamage > 0,
                    preProtectionDamage,
                    damage: this.applyProtectionPrayer(preProtectionDamage, attack.traits.type, first.attacker!, first.target!, false),
                });
            }),
        );
    }

    private evaluateFirstSuccessfulAccuracyMultiHit(
        attack: CombatAttack,
        special: WeaponSpecialAttack,
    ): readonly CombatHitEvaluation[] {
        const ranges = special.firstSuccessfulAccuracyDamageRanges ?? [];
        const hitCount = Math.max(1, Math.trunc(special.hitCount));
        let lastMiss: CombatHitEvaluation | undefined;
        for (let attempt = 0; attempt < ranges.length; attempt++) {
            const range = ranges[attempt];
            const attemptSpecial: WeaponSpecialAttack = {
                ...special,
                hitCount: 1,
                accuracyRollCount: 1,
                damageRangeBySuccessfulAccuracyRolls: [range],
                maximumHitReductionOnFullAccuracyRolls: range.maximumDamageReduction ?? 0,
            };
            const total = this.evaluateRoll(attack, attemptSpecial);
            if (!total.landed) {
                lastMiss = total;
                continue;
            }
            setWeaponSpecialAttackRuntimeMetadata(attack, {
                firstSuccessfulAccuracyRoll: attempt + 1,
            });
            const distributedDamage = range.distributeDamage?.(total.preProtectionDamage, hitCount);
            return Object.freeze(
                Array.from({ length: hitCount }, (_, hitIndex) => {
                    const preProtectionDamage = Math.max(
                        0,
                        Math.floor(
                            distributedDamage?.[hitIndex] ??
                                total.preProtectionDamage *
                                    (range.hitDamageMultipliers[hitIndex] ?? 0),
                        ) +
                            (distributedDamage
                                ? 0
                                : Math.trunc(range.hitDamageBonuses?.[hitIndex] ?? 0)),
                    );
                    return Object.freeze({
                        ...total,
                        successfulAccuracyRolls: attempt + 1,
                        preProtectionDamage,
                        damage: this.applyProtectionPrayer(
                            preProtectionDamage,
                            special.damageType ?? attack.traits.type,
                            total.attacker!,
                            total.target!,
                            special.ignoreProtectionPrayer === true,
                        ),
                    });
                }),
            );
        }

        const miss =
            lastMiss ??
            this.evaluateRoll(attack, { ...special, hitCount: 1, accuracyRollCount: 1 });
        const configuredPatterns = special.allMissDamagePatterns;
        const fallbackRoll = this.nextRandom();
        const fallbackDamage = fallbackRoll < 0.2 ? 0 : fallbackRoll < 0.6 ? 1 : 2;
        const pattern =
            configuredPatterns && configuredPatterns.length > 0
                ? configuredPatterns[
                      Math.min(
                          configuredPatterns.length - 1,
                          Math.floor(fallbackRoll * configuredPatterns.length),
                      )
                  ]
                : Array.from({ length: hitCount }, (_, hitIndex) =>
                      hitIndex === hitCount - 1 ? fallbackDamage : 0,
                  );
        return Object.freeze(
            Array.from({ length: hitCount }, (_, hitIndex) => {
                const preProtectionDamage = Math.max(0, Math.floor(pattern[hitIndex] ?? 0));
                return Object.freeze({
                    ...miss,
                    // A one/two-damage all-miss outcome is still a real damage
                    // hitsplat; only the zero outcome is a block.
                    landed: preProtectionDamage > 0,
                    preProtectionDamage,
                    damage: this.applyProtectionPrayer(
                        preProtectionDamage,
                        special.damageType ?? attack.traits.type,
                        miss.attacker!,
                        miss.target!,
                        special.ignoreProtectionPrayer === true,
                    ),
                });
            }),
        );
    }

    private evaluateRoll(
        attack: CombatAttack,
        special: WeaponSpecialAttack,
        hitIndex = 0,
        forcedSuccessfulAccuracyRolls?: number,
    ): CombatHitEvaluation {
        const attacker = this.options.resolveEntity(attack.attacker);
        if (!attacker) return this.invalid(attack, "attacker_not_found");

        const target = this.options.resolveEntity(attack.target);
        if (!target) return this.invalid(attack, "target_not_found", attacker);

        const rollAttack = this.withRollAttackType(attack, special.rollAttackType);
        const rolls = this.buildRollProfile(
            rollAttack,
            attacker,
            target,
            special.meleeAttackBonusIndex,
            special.meleeDefenceBonusIndex,
            special.attackLevelMultiplier,
            special.strengthLevelMultiplier,
            special.defenceRollAttackType,
        );
        const accuracyMultiplier = this.nonNegativeMultiplier(
            special.accuracyMultiplier,
            "special attack accuracy",
        );
        const damageMultiplier = this.nonNegativeMultiplier(
            special.damageMultiplier,
            "special attack damage",
        );
        const accuracyMultiplierStages = special.accuracyMultiplierStages;
        const attackRoll =
            accuracyMultiplierStages && accuracyMultiplierStages.length > 0
                ? accuracyMultiplierStages.reduce(
                      (roll, multiplier, stageIndex) =>
                          Math.floor(
                              roll *
                                  this.nonNegativeMultiplier(
                                      multiplier,
                                      `special attack accuracy stage ${stageIndex + 1}`,
                                  ),
                          ),
                      calculateAttackRoll(rolls.effectiveAttack, rolls.attackBonus),
                  )
                : Math.floor(
                      calculateAttackRoll(rolls.effectiveAttack, rolls.attackBonus) *
                          accuracyMultiplier,
                  );
        const defenceRoll = Math.floor(
            calculateDefenceRoll(rolls.effectiveDefence, rolls.defenceBonus) *
                this.nonNegativeMultiplier(
                    special.defenceRollMultiplier ?? 1,
                    "special attack defence roll",
                ),
        );
        const sourcedMaxHit =
            special.maximumHitSource === SpecialAttackMaximumHitSource.PhysicalMelee
                ? this.buildPhysicalMeleeMaxHit(attack, attacker)
                : special.maximumHitSource === SpecialAttackMaximumHitSource.Magic
                  ? this.buildMagicMaxHit(attack, attacker)
                  : special.maximumHitSource === SpecialAttackMaximumHitSource.VisibleMagic
                    ? this.buildVisibleMagicMaxHit(attacker, special.visibleMagicMaximumHit ?? 0)
                    : rolls.maxHit;
        const baseMaxHit =
            special.maxHitOverride === undefined
                ? sourcedMaxHit
                : this.nonNegativeInteger(special.maxHitOverride, "special attack max hit");
        const damageMultiplierStages = special.damageMultiplierStages;
        const damageMultiplierStageRounding = special.damageMultiplierStageRounding;
        const scaledMaxHit = Math.max(
            0,
            damageMultiplierStages && damageMultiplierStages.length > 0
                ? damageMultiplierStages.reduce((maximumHit, multiplier, stageIndex) => {
                      const scaled =
                          maximumHit *
                          this.nonNegativeMultiplier(
                              multiplier,
                              `special attack damage stage ${stageIndex + 1}`,
                          );
                      return damageMultiplierStageRounding?.[stageIndex] === "ceil"
                          ? Math.ceil(scaled)
                          : Math.floor(scaled);
                  }, baseMaxHit)
                : Math.floor(baseMaxHit * damageMultiplier),
        );
        const maximumHitSplitCount = Math.max(1, Math.trunc(special.maximumHitSplitCount ?? 1));
        const hitMaximum = this.splitMaximumHit(scaledMaxHit, maximumHitSplitCount, hitIndex);
        const fixedAccuracyMultiplier =
            special.fixedAccuracyRollMultiplierWhenTargetAtOrBelowMaximumDamage;
        const usesFixedAccuracyRoll =
            fixedAccuracyMultiplier !== undefined && this.getCurrentHitpoints(target) <= hitMaximum;
        const resolvedAttackRoll = usesFixedAccuracyRoll
            ? Math.floor(
                  attackRoll *
                      this.nonNegativeMultiplier(
                          fixedAccuracyMultiplier!,
                          "special attack fixed accuracy",
                      ),
              )
            : attackRoll;
        const hitChance = special.guaranteedHit
            ? HIT_CHANCE_SCALE
            : usesFixedAccuracyRoll
              ? this.calculateFixedAttackRollHitChance(resolvedAttackRoll, defenceRoll)
              : calculateHitChance(attackRoll, defenceRoll);
        const accuracyRollCount = Math.max(1, Math.trunc(special.accuracyRollCount ?? 1));
        const guaranteedAccuracyRolls = special.guaranteedHit
            ? accuracyRollCount
            : special.guaranteedFirstAccuracyRoll === true && hitIndex === 0
              ? 1
              : 0;
        const successfulAccuracyRolls =
            forcedSuccessfulAccuracyRolls === undefined
                ? guaranteedAccuracyRolls +
                  this.rollSuccessfulAccuracyRolls(
                      hitChance,
                      Math.max(0, accuracyRollCount - guaranteedAccuracyRolls),
                  )
                : Math.max(
                      0,
                      Math.min(accuracyRollCount, Math.trunc(forcedSuccessfulAccuracyRolls)),
                  );
        const damageRange =
            successfulAccuracyRolls > 0
                ? special.damageRangeBySuccessfulAccuracyRolls?.[successfulAccuracyRolls - 1]
                : undefined;
        let minimumDamage = Math.floor(
            hitMaximum *
                this.nonNegativeMultiplier(
                    damageRange?.minimumDamageMultiplier ?? special.minimumDamageMultiplier ?? 0,
                    "special attack minimum damage",
                ),
        );
        let maximumDamage = Math.floor(
            hitMaximum *
                this.nonNegativeMultiplier(
                    damageRange?.maximumDamageMultiplier ?? special.maximumDamageMultiplier ?? 1,
                    "special attack maximum damage",
                ),
        );
        minimumDamage += this.nonNegativeInteger(
            special.minimumDamageBonus ?? 0,
            "special attack minimum damage bonus",
        );
        maximumDamage += this.nonNegativeInteger(
            special.maximumDamageBonus ?? 0,
            "special attack maximum damage bonus",
        );
        if (special.maximumDamageCap !== undefined) {
            maximumDamage = Math.min(
                maximumDamage,
                this.nonNegativeInteger(
                    special.maximumDamageCap,
                    "special attack maximum damage cap",
                ),
            );
            minimumDamage = Math.min(minimumDamage, maximumDamage);
        }
        if (successfulAccuracyRolls === accuracyRollCount) {
            maximumDamage = Math.max(
                0,
                maximumDamage -
                    this.nonNegativeInteger(
                        special.maximumHitReductionOnFullAccuracyRolls ?? 0,
                        "special attack full-accuracy max-hit reduction",
                    ),
            );
            // A legitimate flat max-hit reduction can make the upper bound
            // lower than the percentage-derived lower bound at tiny max hits.
            minimumDamage = Math.min(minimumDamage, maximumDamage);
        }
        if (maximumDamage < minimumDamage) {
            throw new RangeError(
                `Combat special attack maximum damage ${maximumDamage} cannot be below minimum damage ${minimumDamage}`,
            );
        }
        const maxHit = Math.max(0, maximumDamage);
        const landed = successfulAccuracyRolls > 0;
        const rolledDamage = landed
            ? minimumDamage + Math.floor(this.nextRandom() * (maximumDamage - minimumDamage + 1))
            : 0;
        const damage = this.applyProtectionPrayer(
            rolledDamage,
            special.damageType ?? rollAttack.traits.type,
            attacker,
            target,
            special.ignoreProtectionPrayer === true,
        );

        return Object.freeze({
            valid: true,
            attack,
            attacker,
            target,
            attackRoll: resolvedAttackRoll,
            defenceRoll,
            hitChance,
            maxHit,
            landed,
            successfulAccuracyRolls,
            preProtectionDamage: rolledDamage,
            damage,
        });
    }

    private buildPhysicalMeleeMaxHit(attack: CombatAttack, attacker: CombatEntity): number {
        const physicalMeleeAttack: CombatAttack = {
            ...attack,
            traits: {
                ...attack.traits,
                type: AttackType.Melee,
            },
        };
        return this.buildAttackProfile(physicalMeleeAttack, attacker).maxHit;
    }

    private buildMagicMaxHit(attack: CombatAttack, attacker: CombatEntity): number {
        const magicAttack: CombatAttack = {
            ...attack,
            traits: {
                ...attack.traits,
                type: AttackType.Magic,
            },
        };
        return this.buildAttackProfile(magicAttack, attacker).maxHit;
    }

    private buildVisibleMagicMaxHit(attacker: CombatEntity, baseMaximumHit: number): number {
        if (!(attacker instanceof PlayerState)) return 0;
        const base = Math.max(0, Math.floor(baseMaximumHit));
        if (base <= 0) return 0;

        const visibleMagicLevel = this.getBoostedLevel(attacker, SkillId.Magic);
        const internalMaximumHit = Math.min(base, Math.floor((base * visibleMagicLevel) / 99 + 1));
        return this.applyMagicDamageBonuses(
            internalMaximumHit,
            attacker,
            this.options.getEquipmentBonuses(attacker),
        );
    }

    private withRollAttackType(
        attack: CombatAttack,
        rollAttackType: AttackType | undefined,
    ): CombatAttack {
        if (rollAttackType === undefined || rollAttackType === attack.traits.type) return attack;
        return {
            ...attack,
            traits: {
                ...attack.traits,
                type: rollAttackType,
            },
        };
    }

    private applyProtectionPrayer(
        damage: number,
        attackType: AttackType,
        attacker: CombatEntity,
        target: CombatEntity,
        ignoreProtectionPrayer: boolean,
    ): number {
        if (!(damage > 0)) return 0;
        if (ignoreProtectionPrayer) return damage;

        const requiredOverhead = this.overheadForAttackType(attackType);
        if (requiredOverhead === OverheadType.NONE) return damage;

        const activeOverhead = target.combatAttributes.get(CombatAttributes.ACTIVE_OVERHEAD_PRAYER);
        if (activeOverhead !== requiredOverhead) return damage;

        // Protection prayers fully block ordinary NPC damage. Against another
        // player they reduce the rolled damage by 40%, leaving 60% applied.
        if (attacker instanceof NpcState) return 0;
        if (target instanceof PlayerState && target.protectionBlocksPlayers) return 0;
        return Math.floor(damage * 0.6);
    }

    private overheadForAttackType(attackType: AttackType): OverheadType {
        switch (attackType) {
            case AttackType.Melee:
                return OverheadType.MELEE;
            case AttackType.Ranged:
                return OverheadType.RANGED;
            case AttackType.Magic:
                return OverheadType.MAGIC;
            default:
                return OverheadType.NONE;
        }
    }

    private nonNegativeMultiplier(value: number, field: string): number {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(
                `Combat ${field} multiplier must be non-negative; received ${value}`,
            );
        }
        return value;
    }

    /**
     * Resolves a single, non-random attacker roll against the target's normal
     * inclusive 0..defenceRoll roll. This is used by effects such as Sunspear's
     * execute window, whose accuracy is fixed at a percentage of max accuracy.
     */
    private calculateFixedAttackRollHitChance(attackRoll: number, defenceRoll: number): number {
        const attack = this.nonNegativeInteger(attackRoll, "fixed special attack roll");
        const defence = this.nonNegativeInteger(defenceRoll, "fixed special defence roll");
        if (attack >= defence) return HIT_CHANCE_SCALE;
        return Math.round(((attack + 1) / (defence + 1)) * HIT_CHANCE_SCALE);
    }

    private getCurrentHitpoints(target: CombatEntity): number {
        return target instanceof PlayerState
            ? target.skillSystem.getHitpointsCurrent()
            : target.getHitpoints();
    }

    private nonNegativeInteger(value: number, field: string): number {
        if (!Number.isFinite(value) || value < 0) {
            throw new RangeError(`Combat ${field} must be non-negative; received ${value}`);
        }
        return Math.trunc(value);
    }

    buildRollProfile(
        attack: CombatAttack,
        attacker: CombatEntity,
        target: CombatEntity,
        meleeAttackBonusIndex?: 0 | 1 | 2,
        meleeDefenceBonusIndex?: 0 | 1 | 2,
        attackLevelMultiplier?: number,
        strengthLevelMultiplier?: number,
        defenceRollAttackType?: AttackType,
    ): CombatRollProfile {
        const attackProfile = this.buildAttackProfile(
            this.withRollAttackType(attack, defenceRollAttackType),
            attacker,
            meleeAttackBonusIndex,
            attackLevelMultiplier,
            strengthLevelMultiplier,
        );
        const defenceProfile = this.buildDefenceProfile(
            attack,
            target,
            meleeDefenceBonusIndex ?? attackProfile.meleeBonusIndex,
        );
        return {
            effectiveAttack: attackProfile.effectiveAttack,
            attackBonus: attackProfile.attackBonus,
            effectiveDefence: defenceProfile.effectiveDefence,
            defenceBonus: defenceProfile.defenceBonus,
            maxHit: attackProfile.maxHit,
        };
    }

    private buildAttackProfile(
        attack: CombatAttack,
        attacker: CombatEntity,
        meleeAttackBonusIndex?: 0 | 1 | 2,
        attackLevelMultiplier?: number,
        strengthLevelMultiplier?: number,
    ): AttackProfile {
        if (attacker instanceof NpcState) {
            return this.buildNpcAttackProfile(attack, attacker);
        }
        return this.buildPlayerAttackProfile(
            attack,
            attacker,
            meleeAttackBonusIndex,
            attackLevelMultiplier,
            strengthLevelMultiplier,
        );
    }

    private buildPlayerAttackProfile(
        attack: CombatAttack,
        player: PlayerState,
        forcedMeleeBonusIndex?: 0 | 1 | 2,
        attackLevelMultiplier?: number,
        strengthLevelMultiplier?: number,
    ): AttackProfile {
        const bonuses = this.options.getEquipmentBonuses(player);
        const stance = this.resolveStanceBonuses(attack.traits.style, attack.traits.type);
        const meleeBonusIndex =
            forcedMeleeBonusIndex ?? this.resolveMeleeBonusIndex(player, bonuses);

        switch (attack.traits.type) {
            case AttackType.Ranged: {
                const effectiveAttack = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Ranged),
                    this.getPrayerMultiplier(player, "ranged"),
                    stance.accuracy,
                );
                const effectiveStrength = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Ranged),
                    this.getPrayerMultiplier(player, "ranged_strength"),
                    stance.strength,
                );
                return {
                    effectiveAttack,
                    attackBonus: this.bonusAt(bonuses, RANGED_ATTACK_BONUS_INDEX),
                    maxHit: calculateRangedMaxHit(
                        effectiveStrength,
                        this.bonusAt(bonuses, RANGED_STRENGTH_BONUS_INDEX),
                    ),
                    meleeBonusIndex,
                };
            }
            case AttackType.Magic: {
                const effectiveMagic = this.playerEffectiveLevel(
                    this.getBoostedLevel(player, SkillId.Magic),
                    this.getPrayerMultiplier(player, "magic"),
                    0,
                );
                return {
                    effectiveAttack: effectiveMagic,
                    attackBonus: this.bonusAt(bonuses, MAGIC_ATTACK_BONUS_INDEX),
                    maxHit: this.calculatePlayerMagicMaxHit(
                        attack,
                        player,
                        effectiveMagic,
                        bonuses,
                    ),
                    meleeBonusIndex,
                };
            }
            case AttackType.Melee:
            default: {
                const effectiveAttack = this.playerEffectiveLevel(
                    Math.floor(
                        this.getBoostedLevel(player, SkillId.Attack) *
                            this.nonNegativeMultiplier(
                                attackLevelMultiplier ?? 1,
                                "special attack level",
                            ),
                    ),
                    this.getPrayerMultiplier(player, "attack"),
                    stance.accuracy,
                );
                const effectiveStrength = this.playerEffectiveLevel(
                    Math.floor(
                        this.getBoostedLevel(player, SkillId.Strength) *
                            this.nonNegativeMultiplier(
                                strengthLevelMultiplier ?? 1,
                                "special strength level",
                            ),
                    ),
                    this.getPrayerMultiplier(player, "strength"),
                    stance.strength,
                );
                return {
                    effectiveAttack,
                    attackBonus: this.bonusAt(bonuses, meleeBonusIndex),
                    maxHit: calculateMeleeMaxHit(
                        effectiveStrength,
                        this.bonusAt(bonuses, MELEE_STRENGTH_BONUS_INDEX),
                    ),
                    meleeBonusIndex,
                };
            }
        }
    }

    private buildNpcAttackProfile(attack: CombatAttack, npc: NpcState): AttackProfile {
        const profile = npc.combat;
        switch (attack.traits.type) {
            case AttackType.Ranged:
                return {
                    effectiveAttack:
                        Math.max(0, Math.trunc(profile.rangedLevel)) + NPC_EFFECTIVE_LEVEL_BONUS,
                    attackBonus: this.clampBonus(profile.rangedBonus),
                    maxHit: Math.max(0, Math.trunc(profile.maxHit)),
                    meleeBonusIndex: 1,
                };
            case AttackType.Magic:
                return {
                    effectiveAttack:
                        Math.max(0, Math.trunc(profile.magicLevel)) + NPC_EFFECTIVE_LEVEL_BONUS,
                    attackBonus: this.clampBonus(profile.magicBonus),
                    maxHit: Math.max(0, Math.trunc(profile.maxHit)),
                    meleeBonusIndex: 1,
                };
            case AttackType.Melee:
            default:
                return {
                    effectiveAttack:
                        Math.max(0, Math.trunc(profile.attackLevel)) + NPC_EFFECTIVE_LEVEL_BONUS,
                    attackBonus: this.clampBonus(profile.attackBonus),
                    maxHit: Math.max(0, Math.trunc(profile.maxHit)),
                    meleeBonusIndex: 1,
                };
        }
    }

    private buildDefenceProfile(
        attack: CombatAttack,
        target: CombatEntity,
        meleeBonusIndex: number,
    ): { effectiveDefence: number; defenceBonus: number } {
        if (target instanceof NpcState) {
            const profile = target.combat;
            // An NPC defends against magic with its Magic level alone; the 70/30 Magic/Defence
            // split is for players only.
            const effectiveDefence =
                attack.traits.type === AttackType.Magic
                    ? Math.max(0, Math.trunc(profile.magicLevel)) + NPC_EFFECTIVE_LEVEL_BONUS
                    : Math.max(0, Math.trunc(profile.defenceLevel)) + NPC_EFFECTIVE_LEVEL_BONUS;
            const defenceBonus =
                attack.traits.type === AttackType.Magic
                    ? profile.defenceMagic
                    : attack.traits.type === AttackType.Ranged
                      ? profile.defenceRanged
                      : meleeBonusIndex === 0
                        ? profile.defenceStab
                        : meleeBonusIndex === 2
                          ? profile.defenceCrush
                          : profile.defenceSlash;
            if (attack.traits.type === AttackType.Magic) {
                return {
                    effectiveDefence,
                    defenceBonus: this.resolveMagicDefenceBonus(target, defenceBonus),
                };
            }
            return { effectiveDefence, defenceBonus: this.clampBonus(defenceBonus) };
        }

        const bonuses = this.options.getEquipmentBonuses(target);
        const stance = this.resolveStanceBonuses(
            this.resolvePlayerAttackStyle(target),
            target.getCurrentAttackType() ?? AttackType.Melee,
        );
        if (attack.traits.type === AttackType.Magic) {
            const prayedDefence = Math.floor(
                this.getBoostedLevel(target, SkillId.Defence) *
                    this.getPrayerMultiplier(target, "defence"),
            );
            const prayedMagic = Math.floor(
                this.getBoostedLevel(target, SkillId.Magic) *
                    this.getPrayerMultiplier(target, "magic"),
            );
            return {
                effectiveDefence:
                    Math.floor(prayedMagic * 0.7 + (prayedDefence + stance.defence) * 0.3) +
                    PLAYER_EFFECTIVE_LEVEL_BONUS,
                defenceBonus: this.resolveMagicDefenceBonus(
                    target,
                    this.bonusAt(bonuses, MAGIC_DEFENCE_BONUS_INDEX),
                ),
            };
        }

        const defenceBonusIndex =
            attack.traits.type === AttackType.Ranged
                ? RANGED_DEFENCE_BONUS_INDEX
                : STAB_DEFENCE_BONUS_INDEX + Math.max(0, Math.min(2, meleeBonusIndex));
        return {
            effectiveDefence: this.playerEffectiveLevel(
                this.getBoostedLevel(target, SkillId.Defence),
                this.getPrayerMultiplier(target, "defence"),
                stance.defence,
            ),
            defenceBonus: this.bonusAt(bonuses, defenceBonusIndex),
        };
    }

    private resolveMagicDefenceBonus(target: CombatEntity, baseBonus: number): number {
        const base = this.clampBonus(baseBonus);
        const drain = Math.max(
            0,
            Math.floor(target.combatAttributes.get(CombatAttributes.MAGIC_DEFENCE_BONUS_DRAIN)),
        );
        const drainableBonus = Math.max(0, base - drain);
        target.combatAttributes.set(CombatAttributes.MAGIC_DEFENCE_BONUS_CURRENT, drainableBonus);
        return drain > 0 ? drainableBonus : base;
    }

    private calculatePlayerMagicMaxHit(
        attack: CombatAttack,
        player: PlayerState,
        effectiveMagic: number,
        bonuses: readonly number[],
    ): number {
        const magicLevel = this.getBoostedLevel(player, SkillId.Magic);
        const spellId = attack.traits.spellId;
        let baseDamage: number | undefined;

        if (spellId !== undefined && spellId > 0) {
            const spell = getSpellData(spellId);
            if (spell) {
                baseDamage = resolveElementalSpellBaseMaxHit(spellId, magicLevel, spell.baseMaxHit);
            }
        }

        if (baseDamage === undefined && attack.traits.weaponId !== undefined) {
            const poweredStaff = getPoweredStaffSpellData(attack.traits.weaponId);
            if (poweredStaff) {
                baseDamage = calculatePoweredStaffBaseDamage(
                    magicLevel,
                    poweredStaff.maxHitFormula,
                );
            }
        }

        baseDamage ??= Math.max(0, Math.floor(effectiveMagic / 3));
        return this.applyMagicDamageBonuses(baseDamage, player, bonuses);
    }

    private applyMagicDamageBonuses(
        baseDamage: number,
        player: PlayerState,
        bonuses: readonly number[],
    ): number {
        const equipmentPercent = Math.max(0, this.bonusAt(bonuses, MAGIC_DAMAGE_BONUS_INDEX));
        const prayerPercent = Math.max(
            0,
            (this.getPrayerMultiplier(player, "magic_damage") - 1) * 100,
        );
        return Math.floor(Math.max(0, baseDamage) * (1 + (equipmentPercent + prayerPercent) / 100));
    }

    private resolveMeleeBonusIndex(player: PlayerState, bonuses: readonly number[]): number {
        const mapped = player.getCurrentMeleeBonusIndex();
        if (mapped !== undefined && mapped >= 0 && mapped <= 2) return Math.trunc(mapped);

        let bestIndex = 1;
        let bestBonus = Number.NEGATIVE_INFINITY;
        for (let index = 0; index <= 2; index++) {
            const value = this.bonusAt(bonuses, index);
            if (value > bestBonus) {
                bestBonus = value;
                bestIndex = index;
            }
        }
        return bestIndex;
    }

    private resolvePlayerAttackStyle(player: PlayerState): CombatAttackStyle | null {
        try {
            const style = getWeaponAttackStyle(
                player.combat.weaponItemId > 0 ? player.combat.weaponItemId : 0,
                player.combat.styleSlot,
            );
            switch (style) {
                case "accurate":
                case "aggressive":
                case "controlled":
                case "defensive":
                case "rapid":
                case "longrange":
                    return style;
                default:
                    return null;
            }
        } catch {
            return null;
        }
    }

    private resolveStanceBonuses(
        style: CombatAttackStyle | null,
        attackType: AttackType,
    ): StanceBonuses {
        switch (style) {
            case "accurate":
                return {
                    accuracy: 3,
                    strength: attackType === AttackType.Ranged ? 3 : 0,
                    defence: 0,
                };
            case "aggressive":
                return { accuracy: 0, strength: 3, defence: 0 };
            case "controlled":
                return { accuracy: 1, strength: 1, defence: 1 };
            case "defensive":
                return { accuracy: 0, strength: 0, defence: 3 };
            case "longrange":
                return { accuracy: 1, strength: 1, defence: 3 };
            case "rapid":
            default:
                return { accuracy: 0, strength: 0, defence: 0 };
        }
    }

    private playerEffectiveLevel(level: number, prayerMultiplier: number, stance: number): number {
        return (
            Math.floor(Math.max(0, level) * Math.max(0, prayerMultiplier)) +
            Math.trunc(stance) +
            PLAYER_EFFECTIVE_LEVEL_BONUS
        );
    }

    private getBoostedLevel(player: PlayerState, skillId: SkillId): number {
        const skill = player.skillSystem.getSkill(skillId);
        return Math.max(0, Math.trunc(skill.baseLevel + skill.boost));
    }

    private getPrayerMultiplier(player: PlayerState, stat: PrayerCombatStat): number {
        let multiplier = 1;
        for (const prayer of player.prayer.activePrayers) {
            if (!PRAYER_NAME_SET.has(prayer as PrayerName)) continue;
            const value = getPrayerDefinition(prayer as PrayerName).combatMultipliers?.[stat];
            if (value !== undefined && value > multiplier) multiplier = value;
        }
        return multiplier;
    }

    private bonusAt(bonuses: readonly number[], index: number): number {
        return this.clampBonus(bonuses[index] ?? 0);
    }

    private clampBonus(value: number): number {
        return Math.max(-64, Number.isFinite(value) ? Math.trunc(value) : 0);
    }

    private nextRandom(): number {
        const value = this.random();
        if (!Number.isFinite(value) || value < 0 || value >= 1) {
            throw new RangeError(`Combat random source must return [0, 1); received ${value}`);
        }
        return value;
    }

    private rollSuccessfulAccuracyRolls(hitChance: number, count: number): number {
        let successfulRolls = 0;
        for (let roll = 0; roll < count; roll++) {
            if (rollAccuracy(hitChance, this.random)) successfulRolls++;
        }
        return successfulRolls;
    }

    private splitMaximumHit(total: number, splitCount: number, hitIndex: number): number {
        if (splitCount <= 1) return total;
        const index = Math.max(0, Math.min(splitCount - 1, Math.trunc(hitIndex)));
        return Math.max(
            0,
            Math.floor((total * (index + 1)) / splitCount) -
                Math.floor((total * index) / splitCount),
        );
    }

    private invalid(
        attack: CombatAttack,
        reason: "attacker_not_found" | "target_not_found",
        attacker?: CombatEntity,
    ): CombatHitEvaluation {
        return Object.freeze({
            valid: false,
            attack,
            attacker,
            attackRoll: 0,
            defenceRoll: 0,
            hitChance: 0,
            maxHit: 0,
            landed: false,
            preProtectionDamage: 0,
            damage: 0,
            reason,
        });
    }
}
