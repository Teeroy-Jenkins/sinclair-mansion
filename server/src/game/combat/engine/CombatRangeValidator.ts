import type { PathService } from "../../../pathfinding/PathService";
import type { Actor } from "../../actor";
import { AttackType } from "../AttackType";
import type { CombatAttackTraits } from "../model/CombatAttack";

interface ActorBounds {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
}

export type CombatRangeInvalidReason =
    | "different_plane"
    | "overlapping"
    | "out_of_range"
    | "blocked";

export interface CombatRangeValidation {
    readonly valid: boolean;
    readonly distanceTiles: number;
    readonly overlapping: boolean;
    readonly lineOfSight: boolean;
    readonly reason?: CombatRangeInvalidReason;
}

/** Performs footprint-aware range, overlap, wall, and projectile LoS checks. */
export class CombatRangeValidator {
    constructor(private readonly pathService: PathService) {}

    validate(attacker: Actor, target: Actor, traits: CombatAttackTraits): CombatRangeValidation {
        if (attacker.level !== target.level) {
            return {
                valid: false,
                distanceTiles: Number.MAX_SAFE_INTEGER,
                overlapping: false,
                lineOfSight: false,
                reason: "different_plane",
            };
        }

        const attackerBounds = this.boundsOf(attacker);
        const targetBounds = this.boundsOf(target);
        const distanceTiles = this.distanceBetweenBounds(attackerBounds, targetBounds);
        const overlapping = this.overlaps(attackerBounds, targetBounds);
        const rangeTiles = this.normalizeRangeTiles(traits.rangeTiles);

        if (overlapping) {
            return {
                valid: false,
                distanceTiles,
                overlapping: true,
                lineOfSight: false,
                reason: "overlapping",
            };
        }
        if (distanceTiles > rangeTiles) {
            return {
                valid: false,
                distanceTiles,
                overlapping: false,
                lineOfSight: false,
                reason: "out_of_range",
            };
        }

        const lineOfSight =
            traits.type === AttackType.Melee
                ? this.hasMeleeReach(attackerBounds, targetBounds, attacker.level, rangeTiles)
                : this.traceProjectileLineOfSight(attackerBounds, targetBounds, attacker.level);

        return lineOfSight
            ? { valid: true, distanceTiles, overlapping: false, lineOfSight: true }
            : {
                  valid: false,
                  distanceTiles,
                  overlapping: false,
                  lineOfSight: false,
                  reason: "blocked",
              };
    }

    distanceBetween(attacker: Actor, target: Actor): number {
        return this.distanceBetweenBounds(this.boundsOf(attacker), this.boundsOf(target));
    }

    isOverlapping(attacker: Actor, target: Actor): boolean {
        return this.overlaps(this.boundsOf(attacker), this.boundsOf(target));
    }

    hasProjectileLineOfSight(attacker: Actor, target: Actor): boolean {
        if (attacker.level !== target.level) return false;
        return this.traceProjectileLineOfSight(
            this.boundsOf(attacker),
            this.boundsOf(target),
            attacker.level,
        );
    }

    private boundsOf(actor: Actor): ActorBounds {
        const size = Math.max(1, Math.trunc(actor.size));
        return {
            minX: actor.tileX,
            minY: actor.tileY,
            maxX: actor.tileX + size - 1,
            maxY: actor.tileY + size - 1,
        };
    }

    private distanceBetweenBounds(first: ActorBounds, second: ActorBounds): number {
        const dx = Math.max(0, Math.max(second.minX - first.maxX, first.minX - second.maxX));
        const dy = Math.max(0, Math.max(second.minY - first.maxY, first.minY - second.maxY));
        return Math.max(dx, dy);
    }

    private overlaps(first: ActorBounds, second: ActorBounds): boolean {
        return (
            first.minX <= second.maxX &&
            second.minX <= first.maxX &&
            first.minY <= second.maxY &&
            second.minY <= first.maxY
        );
    }

    private hasMeleeReach(
        attacker: ActorBounds,
        target: ActorBounds,
        plane: number,
        rangeTiles: number,
    ): boolean {
        if (rangeTiles <= 1) {
            return this.hasOpenSharedEdge(attacker, target, plane);
        }
        return this.hasDirectMeleePath(attacker, target, plane);
    }

    private hasOpenSharedEdge(attacker: ActorBounds, target: ActorBounds, plane: number): boolean {
        if (attacker.maxX + 1 === target.minX || target.maxX + 1 === attacker.minX) {
            const startY = Math.max(attacker.minY, target.minY);
            const endY = Math.min(attacker.maxY, target.maxY);
            if (startY > endY) return false;
            const attackerX = attacker.maxX + 1 === target.minX ? attacker.maxX : attacker.minX;
            const targetX = attacker.maxX + 1 === target.minX ? target.minX : target.maxX;
            for (let y = startY; y <= endY; y++) {
                if (!this.pathService.edgeHasWallBetween(attackerX, y, targetX, y, plane)) {
                    return true;
                }
            }
            return false;
        }

        if (attacker.maxY + 1 === target.minY || target.maxY + 1 === attacker.minY) {
            const startX = Math.max(attacker.minX, target.minX);
            const endX = Math.min(attacker.maxX, target.maxX);
            if (startX > endX) return false;
            const attackerY = attacker.maxY + 1 === target.minY ? attacker.maxY : attacker.minY;
            const targetY = attacker.maxY + 1 === target.minY ? target.minY : target.maxY;
            for (let x = startX; x <= endX; x++) {
                if (!this.pathService.edgeHasWallBetween(x, attackerY, x, targetY, plane)) {
                    return true;
                }
            }
        }
        return false;
    }

    private hasDirectMeleePath(attacker: ActorBounds, target: ActorBounds, plane: number): boolean {
        const startX = this.nearestCoordinate(
            attacker.minX,
            attacker.maxX,
            target.minX,
            target.maxX,
        );
        const startY = this.nearestCoordinate(
            attacker.minY,
            attacker.maxY,
            target.minY,
            target.maxY,
        );
        const targetX = this.nearestCoordinate(target.minX, target.maxX, startX, startX);
        const targetY = this.nearestCoordinate(target.minY, target.maxY, startY, startY);

        let currentX = startX;
        let currentY = startY;
        while (currentX !== targetX || currentY !== targetY) {
            const stepX = Math.sign(targetX - currentX);
            const stepY = Math.sign(targetY - currentY);
            const nextX = currentX + stepX;
            const nextY = currentY + stepY;

            if (stepX !== 0 && stepY !== 0) {
                const horizontalFirst =
                    !this.pathService.edgeHasWallBetween(
                        currentX,
                        currentY,
                        nextX,
                        currentY,
                        plane,
                    ) && !this.pathService.edgeHasWallBetween(nextX, currentY, nextX, nextY, plane);
                const verticalFirst =
                    !this.pathService.edgeHasWallBetween(
                        currentX,
                        currentY,
                        currentX,
                        nextY,
                        plane,
                    ) && !this.pathService.edgeHasWallBetween(currentX, nextY, nextX, nextY, plane);
                if (!horizontalFirst && !verticalFirst) return false;
            } else if (
                this.pathService.edgeHasWallBetween(currentX, currentY, nextX, nextY, plane)
            ) {
                return false;
            }

            currentX = nextX;
            currentY = nextY;
        }
        return true;
    }

    private traceProjectileLineOfSight(
        attacker: ActorBounds,
        target: ActorBounds,
        plane: number,
    ): boolean {
        const fromX = this.lineOfSightCoordinate(attacker.minX, target.minX, attacker.maxX);
        const fromY = this.lineOfSightCoordinate(attacker.minY, target.minY, attacker.maxY);
        const toX = this.lineOfSightCoordinate(target.minX, attacker.minX, target.maxX);
        const toY = this.lineOfSightCoordinate(target.minY, attacker.minY, target.maxY);
        return this.pathService.projectileRaycast({ x: fromX, y: fromY, plane }, { x: toX, y: toY })
            .clear;
    }

    private lineOfSightCoordinate(min: number, otherMin: number, max: number): number {
        if (min >= otherMin) return min;
        if (max <= otherMin) return max;
        return otherMin;
    }

    private nearestCoordinate(
        min: number,
        max: number,
        otherMin: number,
        otherMax: number,
    ): number {
        if (max < otherMin) return max;
        if (min > otherMax) return min;
        return Math.max(min, otherMin);
    }

    private normalizeRangeTiles(value: number): number {
        if (!Number.isFinite(value)) {
            throw new RangeError(`Combat range must be finite; received ${value}`);
        }
        return Math.max(1, Math.trunc(value));
    }
}
