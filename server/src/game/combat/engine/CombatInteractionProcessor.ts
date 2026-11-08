import type { PathService } from "../../../pathfinding/PathService";
import {
    CardinalAdjacentRouteStrategy,
    RectWithinRangeLineOfSightRouteStrategy,
    RectWithinRangeRouteStrategy,
    type RouteStrategy,
} from "../../../pathfinding/legacy/pathfinder/RouteStrategy";
import type { Actor } from "../../actor";
import { NpcState } from "../../npc";
import { PlayerState } from "../../player";
import { AttackType } from "../AttackType";
import type { CombatAttackTraits } from "../model/CombatAttack";
import type { CombatEntityRef } from "../model/CombatEntityRef";
import { CombatAttributes } from "../state/CombatAttributes";
import { type CombatRangeValidation, CombatRangeValidator } from "./CombatRangeValidator";
import {
    type CombatEntity,
    type CombatTargetInvalidReason,
    CombatTargetResolver,
} from "./CombatTargetResolver";

export type CombatAttackTraitsResolver = (
    attacker: CombatEntity,
    target: CombatEntity,
) => CombatAttackTraits | null;

export type CombatInteractionStatus = "ready" | "moving" | "unreachable" | "ended" | "unavailable";

export interface CombatInteractionResult {
    readonly status: CombatInteractionStatus;
    readonly target?: CombatEntity;
    readonly traits?: CombatAttackTraits;
    readonly range?: CombatRangeValidation;
    readonly reason?: CombatTargetInvalidReason | "missing_target" | "missing_traits" | "unreachable";
}

interface CombatRouteState {
    readonly target: CombatEntityRef;
    readonly targetX: number;
    readonly targetY: number;
    readonly targetLevel: number;
    readonly rangeTiles: number;
    readonly attackType: string;
}

/** Runs target, facing, reach/LoS, and approach processing for one combatant. */
/** Ticks a player stands unable to reach its combat target before the fight is dropped. */
export const UNREACHABLE_TIMEOUT_TICKS = 10;

export class CombatInteractionProcessor {
    private readonly routes = new WeakMap<Actor, CombatRouteState>();
    /** Clock from which a player has been standing with no route to its target. */
    private readonly unreachableSince = new WeakMap<Actor, number>();

    constructor(
        private readonly targetResolver: CombatTargetResolver,
        private readonly rangeValidator: CombatRangeValidator,
        private readonly pathService: PathService,
    ) {}

    process(
        attacker: CombatEntity,
        currentMapClock: number,
        resolveTraits: CombatAttackTraitsResolver,
    ): CombatInteractionResult {
        const targetReference = attacker.combatAttributes.get(CombatAttributes.COMBAT_TARGET);
        if (!targetReference) {
            return { status: "ended", reason: "missing_target" };
        }

        // A stun prevents actions and movement, not the combat engagement
        // itself. Keeping the target lets an NPC resume pursuit/attacks when
        // Shove ends instead of silently de-aggroing.
        if (
            currentMapClock <
            attacker.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK)
        ) {
            attacker.clearPath();
            this.routes.delete(attacker);
            return { status: "unavailable" };
        }

        const attackerResolution = this.targetResolver.validateAttacker(attacker, currentMapClock);
        if (!attackerResolution.valid) {
            this.endInteraction(attacker);
            return { status: "ended", reason: attackerResolution.reason };
        }

        const targetResolution = this.targetResolver.resolve(targetReference, currentMapClock);
        if (!targetResolution.valid) {
            this.endInteraction(attacker);
            return { status: "ended", reason: targetResolution.reason };
        }
        const target = targetResolution.entity;
        const pairFailure = this.targetResolver.validatePair(attacker, target);
        if (pairFailure) {
            this.endInteraction(attacker);
            return { status: "ended", target, reason: pairFailure };
        }

        const resolvedTraits = resolveTraits(attacker, target);
        if (!resolvedTraits) {
            return { status: "unavailable", target, reason: "missing_traits" };
        }
        const traits = this.resolveInteractionTraits(
            attacker,
            targetReference,
            resolvedTraits,
        );

        attacker.setInteraction(target instanceof PlayerState ? "player" : "npc", target.id);

        // Where the target stood at the attacker's turn (OSRS processes NPCs, then players in
        // PID order, each moving and then interacting); see targetAtTurn.
        const targetAtTurn = this.targetAtTurn(attacker, target, currentMapClock);

        // Range is evaluated before consulting the cached travel route. On the
        // movement tick that enters spell range, this falls straight through as
        // ready and the attack manager may cast without an extra idle tick.
        const range = this.rangeValidator.validate(attacker, targetAtTurn, traits);
        if (range.valid) {
            attacker.clearPath();
            this.routes.delete(attacker);
            return { status: "ready", target, traits, range };
        }

        if (
            currentMapClock <
            Math.max(
                attacker.combatAttributes.get(CombatAttributes.FREEZE_UNTIL_CLOCK),
                attacker.combatAttributes.get(CombatAttributes.STUN_UNTIL_CLOCK),
            )
        ) {
            attacker.clearPath();
            this.routes.delete(attacker);
            return { status: "unavailable", target, traits, range };
        }

        const moving = this.routeToward(attacker, target, targetAtTurn, targetReference, traits);
        if (moving || attacker.hasPath()) {
            this.unreachableSince.delete(attacker);
        } else if (attacker instanceof PlayerState) {
            // A player standing still with no way to its target gives the fight up, as in
            // RuneScape (2009scape: combat timeout of 10 ticks), instead of waiting forever.
            const since = this.unreachableSince.get(attacker) ?? currentMapClock;
            this.unreachableSince.set(attacker, since);
            if (currentMapClock - since >= UNREACHABLE_TIMEOUT_TICKS) {
                this.endInteraction(attacker);
                return { status: "ended", target, reason: "unreachable" };
            }
        }
        return {
            status: moving ? "moving" : "unreachable",
            target,
            traits,
            range,
        };
    }

    endInteraction(attacker: CombatEntity): void {
        this.unreachableSince.delete(attacker);
        if (attacker instanceof PlayerState) {
            attacker.resetInteractions();
        } else {
            attacker.disengageCombat();
        }
        attacker.clearPath();
        this.routes.delete(attacker);
    }

    /**
     * Manual combat spells and autocasts share OSRS's ten-tile casting radius.
     * Resolve that intent here, before both range validation and route creation,
     * so a staff's melee reach can never make a distant spell click stall.
     */
    private resolveInteractionTraits(
        attacker: CombatEntity,
        targetReference: CombatEntityRef,
        traits: CombatAttackTraits,
    ): CombatAttackTraits {
        if (!(attacker instanceof PlayerState)) return traits;

        const pending = attacker.combat.pendingManualCombatSpell;
        const pendingSpellId =
            pending && this.pendingSpellTargets(pending.target, targetReference)
                ? pending.spellId
                : undefined;
        const autocastSpellId = attacker.combatAttributes.get(CombatAttributes.AUTOCAST_SPELL_ID);
        const activeSpellId =
            pendingSpellId ??
            (autocastSpellId !== null && autocastSpellId > 0
                ? autocastSpellId
                : traits.type === AttackType.Magic &&
                    traits.spellId !== undefined &&
                    traits.spellId > 0
                  ? traits.spellId
                  : undefined);
        if (activeSpellId === undefined) return traits;

        return {
            ...traits,
            type: AttackType.Magic,
            rangeTiles: 10,
            spellId: activeSpellId,
        };
    }

    private pendingSpellTargets(
        pendingTarget:
            | { type: "npc"; npcId: number }
            | { type: "player"; playerId: number },
        targetReference: CombatEntityRef,
    ): boolean {
        if (pendingTarget.type === "npc") {
            return targetReference.type === "npc" && targetReference.id === pendingTarget.npcId;
        }
        return targetReference.type === "player" && targetReference.id === pendingTarget.playerId;
    }

    /**
     * The target as the attacker sees it on the attacker's own turn. OSRS processes every NPC,
     * then the players in PID order, and each takes its whole turn (movement, then interacting
     * with players and NPCs) before the next. So a player target whose turn comes later (higher
     * PID than a player attacker, or any player when an NPC attacks) hasn't moved yet: the
     * attacker checks reach against, and routes toward, the tile it stood on at the start of the
     * tick. That's what lets the attacker land its hit as a target starts to walk away. Players
     * attacked by a player with a higher PID, and all NPC targets, have already moved.
     */
    private targetAtTurn(attacker: CombatEntity, target: CombatEntity, clock: number): Actor {
        if (!(target instanceof PlayerState)) return target;
        const targetMovesLater =
            attacker instanceof NpcState ||
            (attacker instanceof PlayerState && attacker.getPidPriority() < target.getPidPriority());
        if (!targetMovesLater) return target;
        const start = target.getTurnStartTile(clock);
        // Only a walk or run this tick; a teleport means the old tile is meaningless.
        if (!start || start.level !== target.level) return target;
        if (Math.max(Math.abs(start.x - target.tileX), Math.abs(start.y - target.tileY)) > 2) return target;
        if (start.x === target.tileX && start.y === target.tileY) return target;
        return { tileX: start.x, tileY: start.y, level: start.level, size: target.size } as Actor;
    }

    private routeToward(
        attacker: CombatEntity,
        target: CombatEntity,
        targetAtTurn: Actor,
        targetReference: CombatEntityRef,
        traits: CombatAttackTraits,
    ): boolean {
        const rangeTiles = Math.max(1, Math.trunc(traits.rangeTiles));
        const existing = this.routes.get(attacker);
        const unchanged =
            existing != null &&
            existing.target.type === targetReference.type &&
            existing.target.id === targetReference.id &&
            existing.targetX === targetAtTurn.tileX &&
            existing.targetY === targetAtTurn.tileY &&
            existing.targetLevel === targetAtTurn.level &&
            existing.rangeTiles === rangeTiles &&
            existing.attackType === traits.type;

        if (unchanged && attacker.hasPath()) {
            return true;
        }

        const routed =
            attacker instanceof NpcState
                ? this.routeNpc(attacker, target, targetAtTurn, traits)
                : this.routePlayer(attacker, targetAtTurn, traits);

        if (!routed) {
            this.routes.delete(attacker);
            return false;
        }

        this.routes.set(attacker, {
            target: targetReference,
            targetX: targetAtTurn.tileX,
            targetY: targetAtTurn.tileY,
            targetLevel: targetAtTurn.level,
            rangeTiles,
            attackType: traits.type,
        });
        return true;
    }

    private routePlayer(
        attacker: PlayerState,
        target: Actor,
        traits: CombatAttackTraits,
    ): boolean {
        const targetSize = Math.max(1, Math.trunc(target.size));
        const rangeTiles = Math.max(1, Math.trunc(traits.rangeTiles));
        let strategy: RouteStrategy;

        if (traits.type === AttackType.Melee && rangeTiles <= 1) {
            strategy = new CardinalAdjacentRouteStrategy(
                target.tileX,
                target.tileY,
                targetSize,
                targetSize,
            );
        } else if (traits.type === AttackType.Melee) {
            strategy = new RectWithinRangeRouteStrategy(
                target.tileX,
                target.tileY,
                targetSize,
                targetSize,
                rangeTiles,
            );
        } else {
            strategy = new RectWithinRangeLineOfSightRouteStrategy(
                target.tileX,
                target.tileY,
                targetSize,
                targetSize,
                rangeTiles,
            );
        }

        const result = this.pathService.findPathSteps(
            {
                from: { x: attacker.tileX, y: attacker.tileY, plane: attacker.level },
                to: { x: target.tileX, y: target.tileY },
                size: Math.max(1, attacker.size),
                worldViewId: attacker.worldViewId,
            },
            { routeStrategy: strategy, maxSteps: 128 },
        );
        if (!result.ok || !result.steps || result.steps.length === 0) {
            return false;
        }

        const end = result.end ?? result.steps[result.steps.length - 1];
        if (!strategy.hasArrived(end.x, end.y, attacker.level, attacker.size)) {
            return false;
        }

        attacker.setPath(result.steps, attacker.energy.isRunActive());
        return true;
    }

    private routeNpc(
        attacker: NpcState,
        target: CombatEntity,
        targetAtTurn: Actor,
        traits: CombatAttackTraits,
    ): boolean {
        if (attacker.isRecoveringToSpawn()) return false;
        const targetIsBusy =
            target instanceof PlayerState &&
            target.combatAttributes.get(CombatAttributes.COMBAT_TARGET) !== null;
        // RSMod: an NPC under a busy player skips movement so their routes do not compete.
        if (targetIsBusy && this.rangeValidator.isOverlapping(attacker, target)) {
            attacker.clearPath();
            return false;
        }

        const destination =
            traits.type === AttackType.Melee && traits.rangeTiles <= 1
                ? this.nearestCardinalApproachTile(attacker, targetAtTurn)
                : {
                      x: targetAtTurn.tileX + Math.floor(Math.max(1, targetAtTurn.size) / 2),
                      y: targetAtTurn.tileY + Math.floor(Math.max(1, targetAtTurn.size) / 2),
                  };
        const nextStep = this.pathService.findNpcPathStep(
            { x: attacker.tileX, y: attacker.tileY, plane: attacker.level },
            destination,
            Math.max(1, attacker.size),
        );
        if (!nextStep) return false;

        attacker.setPath([nextStep], false);
        return true;
    }

    private nearestCardinalApproachTile(attacker: Actor, target: Actor): { x: number; y: number } {
        const attackerSize = Math.max(1, attacker.size);
        const targetSize = Math.max(1, target.size);
        const candidates: Array<{ x: number; y: number }> = [];

        for (let y = target.tileY - attackerSize + 1; y < target.tileY + targetSize; y++) {
            candidates.push({ x: target.tileX - attackerSize, y });
            candidates.push({ x: target.tileX + targetSize, y });
        }
        for (let x = target.tileX - attackerSize + 1; x < target.tileX + targetSize; x++) {
            candidates.push({ x, y: target.tileY - attackerSize });
            candidates.push({ x, y: target.tileY + targetSize });
        }

        let nearest = candidates[0] ?? { x: target.tileX, y: target.tileY };
        let nearestDistance = Number.MAX_SAFE_INTEGER;
        for (const candidate of candidates) {
            const distance = Math.max(
                Math.abs(candidate.x - attacker.tileX),
                Math.abs(candidate.y - attacker.tileY),
            );
            if (distance < nearestDistance) {
                nearest = candidate;
                nearestDistance = distance;
            }
        }
        return nearest;
    }
}
