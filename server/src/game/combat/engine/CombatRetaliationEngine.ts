import type { PathService } from "../../../pathfinding/PathService";
import { NpcState } from "../../npc";
import { PlayerState } from "../../player";
import type { CombatAttackTraits } from "../model/CombatAttack";
import type { CombatEntityRef } from "../model/CombatEntityRef";
import { CombatAttributes } from "../state/CombatAttributes";
import {
    CombatInteractionProcessor,
    type CombatAttackTraitsResolver,
} from "./CombatInteractionProcessor";
import { CombatRangeValidator } from "./CombatRangeValidator";
import {
    type CombatEntity,
    type CombatEntityRegistry,
    CombatTargetResolver,
} from "./CombatTargetResolver";

export interface CombatRetaliationEngineOptions extends CombatEntityRegistry {
    readonly pathService: PathService;
    resolveAttackTraits(attacker: CombatEntity, target: CombatEntity): CombatAttackTraits | null;
}

/**
 * Claims an idle defender's combat target after a hit has been applied.
 *
 * Validation and reachability deliberately run through the same interaction
 * processor used by normal combat. This prevents retaliation from targeting a
 * dead/disconnected actor or creating an interaction that cannot be routed.
 * Existing weapon deadlines are retained. An idle NPC gets OSRS's half-rate
 * retaliation delay when it first acquires the attacker.
 */
export class CombatRetaliationEngine {
    private readonly interactionProcessor: CombatInteractionProcessor;
    private readonly resolveAttackTraits: CombatAttackTraitsResolver;

    constructor(private readonly options: CombatRetaliationEngineOptions) {
        this.resolveAttackTraits = options.resolveAttackTraits;
        this.interactionProcessor = new CombatInteractionProcessor(
            new CombatTargetResolver(options),
            new CombatRangeValidator(options.pathService),
            options.pathService,
        );
    }

    intercept(
        defender: CombatEntity,
        attackerReference: CombatEntityRef,
        currentMapClock: number,
    ): boolean {
        if (defender.combatAttributes.get(CombatAttributes.COMBAT_TARGET) !== null) {
            return false;
        }
        if (
            defender instanceof PlayerState &&
            !defender.combatAttributes.get(CombatAttributes.AUTO_RETALIATE_ENABLED)
        ) {
            return false;
        }
        // A player who is walking or running somewhere doesn't turn to fight back: the hit
        // lands, but the walk carries on (RuneScape only auto-retaliates when you stand still).
        if (defender instanceof PlayerState && defender.hasPath()) {
            return false;
        }
        // The gamemode may call a truce between players (e.g. everyone summoned to dinner).
        if (
            defender instanceof PlayerState &&
            attackerReference.type === "player" &&
            defender.gamemode.mayRetaliateAgainstPlayer?.(defender) === false
        ) {
            return false;
        }

        defender.combatAttributes.set(CombatAttributes.COMBAT_TARGET, attackerReference);
        const result = this.interactionProcessor.process(
            defender,
            this.mapClock(currentMapClock),
            this.resolveAttackTraits,
        );
        if (result.status === "ready" || result.status === "moving") {
            if (defender instanceof NpcState) {
                const delay = Math.floor(Math.max(1, defender.attackSpeed) / 2);
                defender.combatAttributes.set(
                    CombatAttributes.ATTACK_DELAY,
                    Math.max(
                        defender.combatAttributes.get(CombatAttributes.ATTACK_DELAY),
                        this.mapClock(currentMapClock) + delay,
                    ),
                );
            }
            return true;
        }

        this.interactionProcessor.endInteraction(defender);
        return false;
    }

    private mapClock(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Retaliation map clock must be finite; received ${value}`);
        }
        return Math.trunc(value);
    }
}
