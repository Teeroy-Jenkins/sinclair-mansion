import {
    deltaToDirection,
    deltaToRunDirection,
    type MovementDirection,
} from "../../../../../client/common/Direction";
import type { PathService } from "../../../pathfinding/PathService";
import { Actor, TraversalType, type Tile } from "../../actor";
import { MovementPathValidator } from "../path/MovementPathValidator";

export interface MovementTickResult {
    entity: Actor;
    moved: boolean;
    steps: number;
}

interface PlannedStep extends Tile {
    direction: MovementDirection;
}

/** Executes RSMod-style validated walk/run frames for players and NPCs. */
export class MovementProcessor {
    constructor(private readonly pathService: PathService) {}

    processMovementTicks(
        entities: Iterable<Actor>,
        currentMapClock: number,
    ): MovementTickResult[] {
        const results: MovementTickResult[] = [];
        for (const entity of entities) {
            const beforeX = entity.tileX;
            const beforeY = entity.tileY;
            const moved = this.processEntity(entity, currentMapClock);
            results.push({
                entity,
                moved,
                steps: Math.max(
                    Math.abs(entity.tileX - beforeX),
                    Math.abs(entity.tileY - beforeY),
                ),
            });
        }
        return results;
    }

    processEntity(entity: Actor, currentMapClock: number): boolean {
        const clock = Math.max(0, Math.trunc(currentMapClock));
        const originX = entity.tileX;
        const originY = entity.tileY;
        entity.setMovementTick(clock);
        if (!entity.prepareMovementFrame(clock)) {
            return false;
        }

        const reservations = entity.takeMovementReservations();
        const requestedStepCount =
            entity.movementQueue.isRunning && entity.hasAvailableRunEnergy() ? 2 : 1;
        const preview = entity.movementQueue.previewSteps(
            entity.tileX,
            entity.tileY,
            requestedStepCount,
        );
        const validator = new MovementPathValidator(this.pathService, () => ({
            level: entity.level,
            size: entity.size,
            worldViewId: (entity as Actor & { worldViewId?: number }).worldViewId,
        }));
        const planned: PlannedStep[] = [];

        let currentX = entity.tileX;
        let currentY = entity.tileY;
        for (let index = 0; index < preview.length; index++) {
            const candidate = preview[index];
            const direction = deltaToDirection(candidate.x - currentX, candidate.y - currentY);
            if (direction === undefined) break;

            const reservation = reservations[index];
            if (!this.matchesReservation(candidate, reservation)) break;
            if (!validator.canMove(currentX, currentY, candidate.x, candidate.y, direction)) break;

            planned.push({ ...candidate, direction });
            currentX = candidate.x;
            currentY = candidate.y;
        }

        if (planned.length === 2) {
            const runDirection = deltaToRunDirection(
                planned[1].x - entity.tileX,
                planned[1].y - entity.tileY,
            );
            if (runDirection < 0) {
                planned.pop();
            }
        }

        if (planned.length === 0) {
            return entity.finishMovementFrame(false);
        }

        const traversal = planned.length === 2 ? TraversalType.RUN : TraversalType.WALK;
        for (const step of planned) {
            entity.commitMovementStep(step.x, step.y, step.direction, traversal);
        }

        const runDirection =
            planned.length === 2
                ? deltaToRunDirection(planned[1].x - originX, planned[1].y - originY)
                : null;
        entity.setMovementDirections(planned[0].direction, runDirection);
        return entity.finishMovementFrame(true);
    }

    private matchesReservation(candidate: Tile, reservation: Tile | null | undefined): boolean {
        if (reservation === undefined) return true;
        if (reservation === null) return false;
        return candidate.x === reservation.x && candidate.y === reservation.y;
    }
}
