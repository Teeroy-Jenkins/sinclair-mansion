import type { PathService } from "../../../pathfinding/PathService";
import { PlayerState } from "../../player";
import type { CombatAttack, CombatAttackTraits } from "../model/CombatAttack";
import type { CombatEntityRef } from "../model/CombatEntityRef";
import { CombatAttributes } from "../state/CombatAttributes";
import { CombatPluginRegistry } from "../plugins/CombatPluginRegistry";
import { SpecialAttackContainer } from "../plugins/SpecialAttackContainer";
import { SpecialAttackTiming } from "../plugins/WeaponCombatProfile";
import { CombatAttackManager } from "./CombatAttackManager";
import {
    CombatInteractionProcessor,
    type CombatInteractionStatus,
} from "./CombatInteractionProcessor";
import { CombatRangeValidator } from "./CombatRangeValidator";
import {
    type CombatEntity,
    type CombatEntityRegistry,
    CombatTargetResolver,
} from "./CombatTargetResolver";

export interface CombatTickEngineOptions extends CombatEntityRegistry {
    readonly pathService: PathService;
    getCombatants(): Iterable<CombatEntity>;
    resolveAttackTraits(attacker: CombatEntity, target: CombatEntity): CombatAttackTraits | null;
    onAttackPrepared?(attack: CombatAttack): void;
}

export interface CombatTickResult {
    readonly currentMapClock: number;
    readonly activeInteractions: number;
    readonly preparedAttacks: readonly CombatAttack[];
    readonly statuses: ReadonlyMap<CombatInteractionStatus | "waiting", number>;
}

/** Single entry point for all active player and NPC combat interactions. */
export class CombatTickEngine {
    private readonly interactionProcessor: CombatInteractionProcessor;
    private readonly attackManager = new CombatAttackManager();

    constructor(
        private readonly options: CombatTickEngineOptions,
        private readonly plugins: CombatPluginRegistry = CombatPluginRegistry.shared,
    ) {
        const targetResolver = new CombatTargetResolver(options);
        const rangeValidator = new CombatRangeValidator(options.pathService);
        this.interactionProcessor = new CombatInteractionProcessor(
            targetResolver,
            rangeValidator,
            options.pathService,
        );
    }

    processTick(currentMapClock: number): CombatTickResult {
        const clock = this.mapClock(currentMapClock);
        const preparedAttacks: CombatAttack[] = [];
        const statuses = new Map<CombatInteractionStatus | "waiting", number>();
        let activeInteractions = 0;

        for (const attacker of this.options.getCombatants()) {
            if (attacker instanceof PlayerState) {
                const expired = attacker.combat.pruneExpiredInstantSpecialAttacks(clock, 3);
                if (expired > 0 && !attacker.combat.hasQueuedInstantSpecialAttacks()) {
                    attacker.specEnergy.setActivated(false);
                }
            }
            if (!attacker.combatAttributes.get(CombatAttributes.COMBAT_TARGET)) {
                continue;
            }
            activeInteractions++;

            const interaction = this.interactionProcessor.process(
                attacker,
                clock,
                this.options.resolveAttackTraits,
            );
            if (interaction.status !== "ready" || !interaction.target || !interaction.traits) {
                this.incrementStatus(statuses, interaction.status);
                continue;
            }

            const queuedInstantSpecials = this.takeQueuedInstantSpecialAttacks(
                attacker,
                interaction.traits,
                interaction.target instanceof PlayerState
                    ? { type: "player", id: interaction.target.id }
                    : { type: "npc", id: interaction.target.id },
            );
            if (queuedInstantSpecials.count > 0) {
                const initiatedCombatThisTick =
                    queuedInstantSpecials.includedUntargetedActivation ||
                    attacker.combatAttributes.get(CombatAttributes.LAST_COMBAT_CLOCK) === clock &&
                    attacker.combatAttributes.get(CombatAttributes.LAST_ATTACK_CLOCK) !== clock;

                // A normal attack that was already due retains its own hit. This is
                // what permits the classic normal-hit + two Quick Smash stack.
                if (!initiatedCombatThisTick && this.attackManager.isAttackReady(attacker, clock)) {
                    const normal = this.attackManager.prepareAttack(
                        attacker,
                        interaction.target,
                        { ...interaction.traits, specialAttack: false },
                        clock,
                    );
                    if (normal) {
                        preparedAttacks.push(normal.attack);
                        this.options.onAttackPrepared?.(normal.attack);
                    }
                }

                for (let index = 0; index < queuedInstantSpecials.count; index++) {
                    const prepared = this.attackManager.prepareAttack(
                        attacker,
                        interaction.target,
                        { ...interaction.traits, specialAttack: true },
                        clock,
                        { bypassAttackDelay: true, preserveAttackDelay: true },
                    );
                    if (prepared) {
                        preparedAttacks.push(prepared.attack);
                        this.options.onAttackPrepared?.(prepared.attack);
                    }
                }
                this.incrementStatus(statuses, "ready");
                continue;
            }

            const instantSpecialAttack = this.isInstantSpecialAttack(
                attacker,
                interaction.traits,
            );
            const prepared = this.attackManager.prepareAttack(
                attacker,
                interaction.target,
                interaction.traits,
                clock,
                {
                    bypassAttackDelay: instantSpecialAttack,
                    preserveAttackDelay: instantSpecialAttack,
                },
            );
            if (!prepared) {
                this.incrementStatus(statuses, "waiting");
                continue;
            }

            preparedAttacks.push(prepared.attack);
            this.options.onAttackPrepared?.(prepared.attack);
            this.incrementStatus(statuses, "ready");
        }

        return {
            currentMapClock: clock,
            activeInteractions,
            preparedAttacks,
            statuses,
        };
    }

    /**
     * The attacker's turn starts by routing toward its target from where everyone stands now,
     * before it moves (OSRS: interact, else path to the target, move, then try to interact
     * again). The combat phase checks reach after the move, so an attacker that catches up
     * hits that same tick instead of trailing a step behind a target walking away.
     */
    routeBeforeMovement(attacker: CombatEntity, currentMapClock: number): void {
        if (!attacker.combatAttributes.get(CombatAttributes.COMBAT_TARGET)) return;
        this.interactionProcessor.process(attacker, this.mapClock(currentMapClock), this.options.resolveAttackTraits);
    }

    stopCombat(entity: CombatEntity): void {
        this.interactionProcessor.endInteraction(entity);
    }

    private isInstantSpecialAttack(
        attacker: CombatEntity,
        traits: CombatAttackTraits,
    ): boolean {
        if (!(attacker instanceof PlayerState)) return false;
        if (!attacker.combatAttributes.get(CombatAttributes.SPECIAL_ATTACK_ACTIVE)) return false;
        if (traits.specialAttack !== true) return false;

        const profile = this.plugins.resolve({
            weaponId: traits.weaponId,
            categoryId: attacker.combat.weaponCategory,
        });
        if (profile.specialAttackTiming === SpecialAttackTiming.Instant) return true;

        const weaponId = traits.weaponId;
        return (
            weaponId !== undefined &&
            SpecialAttackContainer.get(weaponId)?.bypassAttackDelay === true
        );
    }

    private takeQueuedInstantSpecialAttacks(
        attacker: CombatEntity,
        traits: CombatAttackTraits,
        target: CombatEntityRef,
    ): { count: number; includedUntargetedActivation: boolean } {
        if (!(attacker instanceof PlayerState)) {
            return { count: 0, includedUntargetedActivation: false };
        }
        const weaponId = traits.weaponId;
        if (weaponId === undefined) {
            return { count: 0, includedUntargetedActivation: false };
        }
        return attacker.combat.takeQueuedInstantSpecialAttacks(weaponId, target);
    }

    private incrementStatus(
        statuses: Map<CombatInteractionStatus | "waiting", number>,
        status: CombatInteractionStatus | "waiting",
    ): void {
        statuses.set(status, (statuses.get(status) ?? 0) + 1);
    }

    private mapClock(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Current map clock must be finite; received ${value}`);
        }
        return Math.trunc(value);
    }
}
