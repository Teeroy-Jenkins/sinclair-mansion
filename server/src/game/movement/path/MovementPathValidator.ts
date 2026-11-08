import {
    MovementDirection,
    directionToDelta,
} from "../../../../../client/common/Direction";
import type { PathService } from "../../../pathfinding/PathService";

export { MovementDirection as Direction } from "../../../../../client/common/Direction";

export interface MovementValidationContext {
    level: number;
    size: number;
    worldViewId?: number;
}

/**
 * Adapter between the movement state engine and the existing collision maps.
 * Projectile ray-casting intentionally remains owned by PathService.
 */
export class MovementPathValidator {
    constructor(
        private readonly pathService: PathService,
        private readonly context: () => MovementValidationContext,
    ) {}

    canMove(
        currentX: number,
        currentY: number,
        targetX: number,
        targetY: number,
        direction: MovementDirection,
    ): boolean {
        const fromX = Math.trunc(currentX);
        const fromY = Math.trunc(currentY);
        const toX = Math.trunc(targetX);
        const toY = Math.trunc(targetY);
        const deltaX = toX - fromX;
        const deltaY = toY - fromY;

        if (deltaX === 0 && deltaY === 0) return true;
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) return false;

        const expectedDelta = directionToDelta(direction);
        if (expectedDelta.dx !== deltaX || expectedDelta.dy !== deltaY) {
            return false;
        }

        const validation = this.context();
        return this.pathService.canActorStep(
            { x: fromX, y: fromY, plane: Math.trunc(validation.level) },
            { x: toX, y: toY },
            Math.max(1, Math.trunc(validation.size)),
            validation.worldViewId,
        );
    }
}
