import { MovementDirection } from "../../../../client/common/Direction";

export { MovementDirection as Direction } from "../../../../client/common/Direction";

export interface MovementWaypoint {
    x: number;
    y: number;
}

export type MovementPathfinder = (
    targetX: number,
    targetY: number,
) => readonly MovementWaypoint[] | undefined;

const DEFAULT_QUEUE_CAPACITY = 128;

/**
 * RSMod-style movement destination queue.
 *
 * The queue may contain either every adjacent route tile or only route turn-points.
 * MovementProcessor derives individual one-tile steps from the head destination, so
 * both representations are consumed with identical frame semantics.
 */
export class MovementQueue {
    readonly waypoints: MovementWaypoint[] = [];

    isRunning = false;
    teleported = false;
    lastStepDirection: MovementDirection | null = null;

    private pathfinder?: MovementPathfinder;

    constructor(private readonly capacity: number = DEFAULT_QUEUE_CAPACITY) {}

    get length(): number {
        return this.waypoints.length;
    }

    get isEmpty(): boolean {
        return this.waypoints.length === 0;
    }

    setPathfinder(pathfinder: MovementPathfinder | undefined): void {
        this.pathfinder = pathfinder;
    }

    addStep(x: number, y: number): boolean {
        const waypoint = this.normalizeWaypoint(x, y);
        const last = this.waypoints[this.waypoints.length - 1];
        if (last?.x === waypoint.x && last.y === waypoint.y) {
            return false;
        }
        if (this.waypoints.length >= this.capacity) {
            return false;
        }
        this.waypoints.push(waypoint);
        return true;
    }

    addSteps(steps: readonly MovementWaypoint[]): number {
        let added = 0;
        for (const step of steps) {
            if (!this.addStep(step.x, step.y)) {
                if (this.waypoints.length >= this.capacity) break;
                continue;
            }
            added++;
        }
        return added;
    }

    replace(steps: readonly MovementWaypoint[], isRunning: boolean = this.isRunning): void {
        this.clear();
        this.isRunning = !!isRunning;
        this.addSteps(steps);
    }

    clear(): void {
        this.waypoints.length = 0;
        this.lastStepDirection = null;
    }

    peek(): MovementWaypoint | undefined {
        const waypoint = this.waypoints[0];
        return waypoint ? { ...waypoint } : undefined;
    }

    poll(): MovementWaypoint | undefined {
        const waypoint = this.waypoints.shift();
        return waypoint ? { ...waypoint } : undefined;
    }

    toArray(): MovementWaypoint[] {
        return this.waypoints.map((waypoint) => ({ ...waypoint }));
    }

    /**
     * Requests a server-authored route and replaces the current destinations.
     * The actor/manager supplies the pathfinder closure so this state object has
     * no dependency on collision maps or world registries.
     */
    pathTo(targetX: number, targetY: number): boolean {
        if (!this.pathfinder) return false;
        const route = this.pathfinder(Math.trunc(targetX), Math.trunc(targetY));
        if (!route || route.length === 0) return false;
        this.replace(route, this.isRunning);
        return true;
    }

    /**
     * Produces the next one or two adjacent frame steps without mutating the queue.
     * This mirrors RSMod's validated step factory when the queue contains turn-points.
     */
    previewSteps(fromX: number, fromY: number, maximumSteps: number): MovementWaypoint[] {
        const limit = Math.max(0, Math.trunc(maximumSteps));
        if (limit === 0 || this.waypoints.length === 0) return [];

        const result: MovementWaypoint[] = [];
        let x = Math.trunc(fromX);
        let y = Math.trunc(fromY);
        let waypointIndex = 0;

        while (result.length < limit && waypointIndex < this.waypoints.length) {
            const destination = this.waypoints[waypointIndex];
            if (x === destination.x && y === destination.y) {
                waypointIndex++;
                continue;
            }

            x += Math.sign(destination.x - x);
            y += Math.sign(destination.y - y);
            result.push({ x, y });

            if (x === destination.x && y === destination.y) {
                waypointIndex++;
            }
        }

        return result;
    }

    /** Removes every destination reached by a committed adjacent step. */
    consumeReached(stepX: number, stepY: number): void {
        const x = Math.trunc(stepX);
        const y = Math.trunc(stepY);
        while (this.waypoints[0]?.x === x && this.waypoints[0]?.y === y) {
            this.waypoints.shift();
        }
    }

    private normalizeWaypoint(x: number, y: number): MovementWaypoint {
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new RangeError("Movement waypoints must have finite coordinates.");
        }
        return { x: Math.trunc(x), y: Math.trunc(y) };
    }
}
