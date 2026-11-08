import { faceAngleRs } from "../../../client/rs/utils/rotation";
import {
    deltaToDirection,
    type MovementDirection,
} from "../../../client/common/Direction";
import { logger } from "../utils/logger";
import {
    type InteractionIndex,
    type InteractionTargetType,
    NO_INTERACTION,
    clampInteractionIndex,
    decodeInteractionTarget,
    encodeInteractionIndex,
} from "./interactionIndex";
import { MovementQueue, type MovementPathfinder } from "./movement/MovementQueue";

export type Tile = { x: number; y: number };

// Debug logging: Player IDs are automatically added/removed on connect/disconnect
// This enables path logging for all connected human players (not bots)
export const DEBUG_PLAYER_IDS = new Set<number>();

/** Signed angular delta in the range [-1024, 1024]. */
function signedAngleDelta(target: number, current: number): number {
    let delta = (target - current) & 2047;
    if (delta > 1024) delta -= 2048;
    return delta;
}

/** OSRS orientation angle from (fromX, fromY) toward (toX, toY). */
function orientTo(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    fallback: number,
): number {
    if (fromX < toX) {
        if (fromY < toY) return 1280;
        if (fromY > toY) return 1792;
        return 1536;
    }
    if (fromX > toX) {
        if (fromY < toY) return 768;
        if (fromY > toY) return 256;
        return 512;
    }
    if (fromY < toY) return 1024;
    if (fromY > toY) return 0;
    return fallback & 2047;
}

/**
 * Traversal type flags.
 *
 * These flags distinguish between:
 * - SLOW: Half-speed step (var8 >>= 1)
 * - WALK: Normal step (no speed scaling)
 * - RUN: Double-speed step (var8 <<= 1)
 */
export enum TraversalType {
    DEFAULT = -1,
    SLOW = 0,
    WALK = 1,
    RUN = 2,
}

export type MovementStepRecord = {
    x: number;
    y: number;
    level: number;
    rot: number;
    running: boolean;
    traversal: TraversalType;
    seq?: number;
    orientation?: number;
    direction?: number;
};

type TurnDirection = 0 | -1 | 1;

export const RUN_ENERGY_MAX = 10000;

export abstract class Actor {
    readonly id: number;
    readonly isPlayer: boolean = false; // Override to true in PlayerState
    readonly size: number;
    tileX: number;
    tileY: number;
    level: number;
    x: number;
    y: number;
    readonly movementQueue = new MovementQueue();
    walkDirection: MovementDirection | null = null;
    runDirection: number | null = null;
    rot: number = 0; // current rotation (0..2047)
    orientation: number = 0; // desired orientation (0..2047)
    forcedOrientation: number = -1; // -1 = none
    turnSpeed: number = 32;
    idleTurnTicks: number = 0;
    lastTileX: number;
    lastTileY: number;

    // Follow positions - stores last step position for followers to path to
    // This prevents followers from pathing through the target's current tile
    // Reference: Lost City's followX/followZ implementation
    followX: number;
    followZ: number;

    private lastSentX?: number;
    private lastSentY?: number;
    private lastSentLevel?: number;
    private lastSentRot?: number;
    private lastSentRunning?: boolean;
    private movedLastTick: boolean = false;
    private turnedLastTick: boolean = false;

    private stepPositions: MovementStepRecord[] = [];

    private positionCorrectionFlag: boolean = false;

    /**
     * Deferred movement flag.
     *
     * When true, movement is stored but interpolation is deferred until
     * the update mask is processed. This ensures movement and appearance
     * updates are synchronized properly.
     */
    protected deferredMovement: boolean = false;
    protected deferredTileX: number = 0;
    protected deferredTileY: number = 0;

    private interactionIndex: InteractionIndex = NO_INTERACTION;
    private interactionDirty: boolean = false;
    public pendingFaceTile?: { x: number; y: number };

    // Actor HSL color override (poison/freeze/venom tints)
    private _colorOverride: {
        hue: number;
        sat: number;
        lum: number;
        amount: number;
        durationTicks: number;
    } | null = null;
    private _colorOverrideDirty: boolean = false;

    // run is off by default and is toggled via varp 173 / run orb.
    runToggle: boolean = false;
    runEnergy: number = RUN_ENERGY_MAX;

    nextStepReservation1?: { x: number; y: number } | null;
    nextStepReservation2?: { x: number; y: number } | null;

    anim = {
        idle: 808,
        walk: 819,
        walkBack: undefined as number | undefined,
        walkLeft: undefined as number | undefined,
        walkRight: undefined as number | undefined,
        run: 824,
        runBack: undefined as number | undefined,
        runLeft: undefined as number | undefined,
        runRight: undefined as number | undefined,
        turnLeft: 823,
        turnRight: 823,
    };

    private pendingSeqs: Array<{ seqId: number; delay: number; interruptible?: boolean }> = [];
    private movementLockUntilTick: number = 0;
    private movementTickContext: number = 0;

    /**
     * Primary health bar definition id to use for this actor.
     * In OSRS this id is fully server-authored via update blocks.
     */
    getHealthBarDefinitionId(): number {
        return 0;
    }

    protected constructor(
        id: number,
        spawnTileX: number,
        spawnTileY: number,
        level: number = 0,
        size: number = 1,
    ) {
        this.id = id;
        this.tileX = spawnTileX;
        this.tileY = spawnTileY;
        this.level = level;
        this.size = Math.max(1, size);
        // Reference: player-movement.md (resetPath:50)
        // World coordinates = tile * 128 + modelRadius * 64
        // For 1x1 actors, modelRadius = 1, so: tile * 128 + 64
        this.x = this.tileX * 128 + this.size * 64;
        this.y = this.tileY * 128 + this.size * 64;
        this.lastTileX = this.tileX;
        this.lastTileY = this.tileY;
        // Initialize follow positions to one tile offset so they're different from current position
        this.followX = this.tileX - 1;
        this.followZ = this.tileY;
        this.rot = this.rot & 2047;
        this.orientation = this.rot;
        this.resetPathInternal(this.tileX, this.tileY);
    }

    get running(): boolean {
        return this.movementQueue.isRunning;
    }

    set running(running: boolean) {
        this.movementQueue.isRunning = !!running;
    }

    /**
     * Checks if world coordinates are within valid scene bounds.
     * Reference: player-movement.md (readPlayerUpdate:186-196)
     *
     * The client validates coordinates to prevent desync during region transitions.
     * Valid range: 1536 to 11776 world units (12 to 92 tiles).
     *
     * @param worldX World X coordinate (tile * 128 + offset)
     * @param worldY World Y coordinate (tile * 128 + offset)
     * @returns true if coordinates are outside scene bounds
     */
    protected isOutsideSceneBounds(worldX: number, worldY: number): boolean {
        const MIN_WORLD_COORD = 1536; // 12 tiles * 128
        const MAX_WORLD_COORD = 11776; // 92 tiles * 128
        return (
            worldX < MIN_WORLD_COORD ||
            worldY < MIN_WORLD_COORD ||
            worldX >= MAX_WORLD_COORD ||
            worldY >= MAX_WORLD_COORD
        );
    }

    /**
     * Resets the path queue to a single tile position.
     * @param tileX Target tile X coordinate
     * @param tileY Target tile Y coordinate
     */
    protected resetPathInternal(tileX: number, tileY: number): void {
        this.movementQueue.clear();
        // World coordinates = tile * 128 + transformedSize() * 64
        this.x = tileX * 128 + this.size * 64;
        this.y = tileY * 128 + this.size * 64;
    }

    setMovementTick(currentTick: number): void {
        this.movementTickContext = Math.max(0, currentTick);
    }

    protected lockMovementUntil(tick: number): void {
        const normalized = Math.max(0, tick);
        if (normalized > this.movementLockUntilTick) {
            this.movementLockUntilTick = normalized;
        }
    }

    protected clearMovementLock(): void {
        this.movementLockUntilTick = 0;
    }

    protected movementLockRemaining(currentTick: number): number {
        return Math.max(0, this.movementLockUntilTick - Math.max(0, currentTick));
    }

    holdMovementUntil(tick: number): void {
        this.lockMovementUntil(tick);
        this.clearPath();
        this.running = false;
    }

    releaseMovementHold(): void {
        this.clearMovementLock();
    }

    getOrientation(): number {
        return this.orientation & 2047;
    }

    setTurnSpeed(speed: number): void {
        this.turnSpeed = Math.max(1, speed);
    }

    setForcedOrientation(rot: number): void {
        const next = rot & 2047;
        this.forcedOrientation = next;
        this.orientation = next;
        // Keep current rotation in sync so clients see an immediate snap
        // instead of gradually interpolating toward the forced orientation.
        this.rot = next;
        this.idleTurnTicks = 0;
    }

    clearForcedOrientation(): void {
        this.forcedOrientation = -1;
    }

    queueOneShotSeq(
        seqId: number | undefined,
        delay: number = 0,
        opts?: { interruptible?: boolean },
    ): void {
        if (seqId !== undefined) {
            // A non-interruptible sequence (e.g. an attack) supersedes any
            // interruptible ones (e.g. blocks) queued earlier in the same tick,
            // matching the in-game rule that attack animations win over blocks.
            if (!opts?.interruptible && this.pendingSeqs.length > 0) {
                this.pendingSeqs = this.pendingSeqs.filter((entry) => !entry.interruptible);
            }
            this.pendingSeqs.push({
                seqId: seqId,
                delay: Math.max(0, delay),
                interruptible: opts?.interruptible === true,
            });
        }
    }

    stopAnimation(): void {
        this.clearPendingSeqs();
        this.queueOneShotSeq(-1);
    }

    clearPendingSeqs(): void {
        this.pendingSeqs = [];
    }

    /**
     * Check if there are any pending sequences in the queue.
     * Used to avoid queueing lower-priority animations when a higher-priority
     * animation is already pending (e.g., don't queue block when attack is pending).
     */
    hasPendingSeq(): boolean {
        return this.pendingSeqs.length > 0;
    }

    popPendingSeq(): { seqId: number; delay: number } | undefined {
        if (this.pendingSeqs.length === 0) {
            return undefined;
        }
        return this.pendingSeqs.shift();
    }

    setInteraction(targetType: InteractionTargetType, targetId: number): void {
        const next = encodeInteractionIndex(targetType, targetId);
        if (next !== this.interactionIndex) {
            this.interactionIndex = next;
            this.interactionDirty = true;
        }
    }

    setInteractionIndex(index: InteractionIndex): void {
        const next = clampInteractionIndex(index);
        if (next !== this.interactionIndex) {
            this.interactionIndex = next;
            this.interactionDirty = true;
        }
    }

    clearInteraction(): void {
        if (this.interactionIndex !== NO_INTERACTION) {
            this.interactionIndex = NO_INTERACTION;
            this.interactionDirty = true;
            this.stopAnimation();
        }
    }

    clearInteractionTarget(): void {
        if (this.interactionIndex !== NO_INTERACTION) {
            this.interactionIndex = NO_INTERACTION;
            this.interactionDirty = true;
        }
    }

    /**
     * Resend the face-entity target on the next update even if it hasn't changed: the client
     * predicts one (e.g. turning to a follow target on click) that the server may never set.
     */
    markInteractionDirty(): void {
        this.interactionDirty = true;
    }

    getInteractionIndex(): InteractionIndex {
        return this.interactionIndex;
    }

    getInteractionTarget(): { id: number; type: InteractionTargetType } | undefined {
        const decoded = decodeInteractionTarget(this.interactionIndex);
        if (!decoded) return undefined;
        return decoded;
    }

    isInteractionDirty(): boolean {
        return this.interactionDirty;
    }

    consumeInteractionDirty(): boolean {
        const dirty = this.interactionDirty;
        this.interactionDirty = false;
        return dirty;
    }

    /**
     * Apply a timed HSL color override to this actor.
     * Actor.colorOverride / HslOverride.
     * @param hue HSL hue component (-1 = no override, 0-63 packed range)
     * @param sat HSL saturation component (-1 = no override, 0-7 packed range)
     * @param lum HSL lightness component (-1 = no override, 0-127 packed range)
     * @param amount Lerp amount (0-255, 0=none, 255=full)
     * @param durationTicks Duration in server ticks
     */
    setColorOverride(
        hue: number,
        sat: number,
        lum: number,
        amount: number,
        durationTicks: number,
    ): void {
        this._colorOverride = { hue, sat, lum, amount, durationTicks };
        this._colorOverrideDirty = true;
    }

    clearColorOverride(): void {
        this._colorOverride = null;
    }

    getColorOverride(): {
        hue: number;
        sat: number;
        lum: number;
        amount: number;
        durationTicks: number;
    } | null {
        return this._colorOverride;
    }

    isColorOverrideDirty(): boolean {
        return this._colorOverrideDirty;
    }

    consumeColorOverrideDirty(): boolean {
        const dirty = this._colorOverrideDirty;
        this._colorOverrideDirty = false;
        return dirty;
    }

    setPath(steps: Tile[], run: boolean): void {
        this.running = !!run;
        this.clearForcedOrientation();
        this.movementQueue.replace(steps, run);
    }

    setMovementPathfinder(pathfinder: MovementPathfinder | undefined): void {
        this.movementQueue.setPathfinder(pathfinder);
    }

    pathTo(targetX: number, targetY: number): boolean {
        return this.movementQueue.pathTo(targetX, targetY);
    }

    peekNextStep(): Tile | undefined {
        return this.movementQueue.previewSteps(this.tileX, this.tileY, 1)[0];
    }

    clearPath(): void {
        this.movementQueue.clear();
    }

    hasPath(): boolean {
        return !this.movementQueue.isEmpty;
    }

    /**
     * Returns the current path as an array of tiles.
     * Used for testing and debugging. Returns steps in order they will be executed (oldest to newest).
     */
    getPathQueue(): Tile[] {
        return this.movementQueue.toArray();
    }

    /**
     * Convenience accessor for tests/tools that historically interacted with a `queue` array.
     * Assigning to `queue` reuses the normal setPath pipeline so reservations and blending work.
     */
    get queue(): Tile[] {
        return this.getPathQueue();
    }

    set queue(steps: Tile[]) {
        if (!Array.isArray(steps)) {
            this.clearPath();
            return;
        }
        this.setPath(steps, !!this.running);
    }

    hasAvailableRunEnergy(): boolean {
        return this.runEnergy > 0;
    }

    /** Prepares update-block state before MovementProcessor validates frame steps. */
    prepareMovementFrame(currentTick: number = this.movementTickContext): boolean {
        this.stepPositions.length = 0;
        this.turnedLastTick = false;
        this.walkDirection = null;
        this.runDirection = null;
        this.movementQueue.lastStepDirection = null;
        this.movementQueue.consumeReached(this.tileX, this.tileY);

        const next = this.peekNextStep();
        if (next) {
            const preOrientation = orientTo(
                this.tileX,
                this.tileY,
                next.x,
                next.y,
                this.orientation,
            );
            if (
                !this.movedLastTick &&
                Math.abs(signedAngleDelta(preOrientation, this.rot & 2047)) >
                    256 + this.turnSpeed
            ) {
                this.orientation = preOrientation;
            }
        } else if (this.forcedOrientation >= 0) {
            this.orientation = this.forcedOrientation & 2047;
        }

        if (currentTick > 0 && this.movementLockUntilTick > currentTick) {
            if (this.hasPath()) {
                this.clearPath();
                this.markPositionCorrection();
            }
            this.movedLastTick = false;
            return false;
        }
        if (this.movementLockUntilTick !== 0 && currentTick >= this.movementLockUntilTick) {
            this.movementLockUntilTick = 0;
        }

        this.processDeferredMovement();
        return true;
    }

    takeMovementReservations(): ReadonlyArray<Tile | null | undefined> {
        const reservations = [this.nextStepReservation1, this.nextStepReservation2];
        this.nextStepReservation1 = undefined;
        this.nextStepReservation2 = undefined;
        return reservations;
    }

    commitMovementStep(
        nextX: number,
        nextY: number,
        direction: MovementDirection,
        traversal: TraversalType,
    ): void {
        const oldX = this.tileX;
        const oldY = this.tileY;
        this.lastTileX = oldX;
        this.lastTileY = oldY;
        this.tileX = Math.trunc(nextX);
        this.tileY = Math.trunc(nextY);
        this.x = this.tileX * 128 + this.size * 64;
        this.y = this.tileY * 128 + this.size * 64;

        const stepOrientation = orientTo(oldX, oldY, this.tileX, this.tileY, this.orientation);
        this.orientation =
            this.forcedOrientation >= 0 ? this.forcedOrientation & 2047 : stepOrientation;
        this.movementQueue.consumeReached(this.tileX, this.tileY);
        this.movementQueue.lastStepDirection = direction;

        this.stepPositions.push({
            x: this.x,
            y: this.y,
            level: this.level,
            rot: 0,
            running: traversal === TraversalType.RUN,
            traversal,
            orientation: this.orientation & 2047,
            direction,
        });
    }

    /** Applies one server-authored step, used by forced movement such as Shove. */
    forceStep(tileX: number, tileY: number): boolean {
        const nextX = Math.trunc(tileX);
        const nextY = Math.trunc(tileY);
        const direction = deltaToDirection(nextX - this.tileX, nextY - this.tileY);
        if (direction === undefined) return false;

        this.clearPath();
        this.running = false;
        this.commitMovementStep(nextX, nextY, direction, TraversalType.WALK);
        return true;
    }

    setMovementDirections(walkDirection: MovementDirection, runDirection: number | null): void {
        this.walkDirection = walkDirection;
        this.runDirection = runDirection;
    }

    finishMovementFrame(moved: boolean): boolean {
        if (moved) {
            this.idleTurnTicks = 0;
        } else if (!this.hasPath() && this.forcedOrientation >= 0) {
            this.orientation = this.forcedOrientation & 2047;
        }

        const { rotated } = this.stepRotationTowardsOrientation();
        const finalRotation = this.rot & 2047;
        for (const step of this.stepPositions) {
            step.rot = finalRotation;
        }

        if (!moved && rotated) {
            this.stepPositions.push({
                x: this.x,
                y: this.y,
                level: this.level,
                rot: finalRotation,
                running: false,
                traversal: TraversalType.WALK,
                orientation: this.orientation & 2047,
            });
            this.turnedLastTick = true;
        }

        if (!moved) {
            if (rotated) {
                this.idleTurnTicks = Math.min(this.idleTurnTicks + 1, 25);
            } else if (signedAngleDelta(this.orientation, this.rot) === 0) {
                this.idleTurnTicks = 0;
            }
        }

        this.movedLastTick = moved;
        return moved;
    }

    private stepRotationTowardsOrientation(): { rotated: boolean; direction: TurnDirection } {
        const target = this.orientation & 2047;
        const current = this.rot & 2047;
        let delta = (target - current) & 2047;
        if (delta === 0) {
            return { rotated: false, direction: 0 };
        }
        if (delta > 1024) {
            delta -= 2048;
        }
        const direction: -1 | 1 = delta > 0 ? 1 : -1;
        const magnitude = Math.abs(delta);
        const step = Math.min(this.turnSpeed, magnitude);
        let next = (current + direction * step) & 2047;
        if (step >= magnitude) {
            next = target;
        }
        this.rot = next & 2047;
        return { rotated: true, direction };
    }

    setRunToggle(on: boolean): void {
        this.runToggle = !!on;
        this.running = this.runToggle;
    }

    faceRot(rot: number): void {
        this.setForcedOrientation(rot);
    }

    faceTile(x: number, y: number): void {
        this.pendingFaceTile = { x: x, y: y };
        this.clearForcedOrientation();
        // Calculate target angle server-side so getOrientation() is correct for NPC updates
        // and other logic that relies on the actor's current target facing.
        const angle = faceAngleRs(this.tileX, this.tileY, x, y);
        this.orientation = angle & 2047;
        // Note: We do NOT set this.rot here, allowing the client to interpolate.
    }

    drainStepPositions(): MovementStepRecord[] {
        const out = this.stepPositions.slice();
        this.stepPositions.length = 0;
        return out;
    }

    didMove(): boolean {
        return !!this.movedLastTick;
    }

    didTurn(): boolean {
        return !!this.turnedLastTick;
    }

    shouldSendPos(): boolean {
        // Reduce network spam by only sending significant position changes
        // Always send level changes or when actually moved
        if (this.lastSentLevel !== this.level) return true;

        // Only send if position actually changed (not just sub-tile rounding)
        const posChanged = this.lastSentX !== this.x || this.lastSentY !== this.y;
        if (!posChanged) return false;

        // Send if moved at least 1 sub-tile (meaningful change)
        const dx = Math.abs(this.x - (this.lastSentX ?? this.x));
        const dy = Math.abs(this.y - (this.lastSentY ?? this.y));

        return dx > 0 || dy > 0;
    }

    markSent(): void {
        this.lastSentX = this.x;
        this.lastSentY = this.y;
        this.lastSentLevel = this.level;
        this.lastSentRot = this.rot;
        this.lastSentRunning = this.running;
    }

    teleport(tileX: number, tileY: number, level?: number): void {
        // Allow teleport anywhere (admin/debug feature); no bounds enforcement for now.
        this.clearPath();
        if (level !== undefined) this.level = level;
        this.tileX = tileX;
        this.tileY = tileY;
        // Reference: player-movement.md (resetPath:50)
        // World coordinates = tile * 128 + modelRadius * 64
        this.x = this.tileX * 128 + this.size * 64;
        this.y = this.tileY * 128 + this.size * 64;
        this.running = false;
        this.orientation = this.rot & 2047;
        this.clearForcedOrientation();
        this.idleTurnTicks = 0;
        this.movementQueue.teleported = true;
        this.positionCorrectionFlag = false;
        this.resetPathInternal(this.tileX, this.tileY);
        logger.info(`[Actor] Teleported to tile (${tileX}, ${tileY}, ${this.level})`);
    }

    wasTeleported(): boolean {
        return this.movementQueue.teleported;
    }

    clearTeleportFlag(): void {
        this.movementQueue.teleported = false;
    }

    protected markPositionCorrection(): void {
        this.positionCorrectionFlag = true;
    }

    consumePositionCorrection(): boolean {
        const correction = this.positionCorrectionFlag;
        this.positionCorrectionFlag = false;
        return correction;
    }

    /**
     * Sets deferred movement for synchronization with update masks.
     * Reference: player-movement.md (readPlayerUpdate:189-194)
     *
     * @param tileX Deferred tile X
     * @param tileY Deferred tile Y
     */
    setDeferredMovement(tileX: number, tileY: number): void {
        this.deferredMovement = true;
        this.deferredTileX = tileX;
        this.deferredTileY = tileY;
    }

    /**
     * Processes deferred movement if pending.
     * Reference: player-movement.md (readPlayerUpdate:189-194)
     */
    processDeferredMovement(): void {
        if (this.deferredMovement) {
            this.deferredMovement = false;
            this.movementQueue.addStep(this.deferredTileX, this.deferredTileY);
        }
    }

    /**
     * Checks if there's a deferred movement pending.
     */
    hasDeferredMovement(): boolean {
        return this.deferredMovement;
    }

    // Movement step sequences removed: client selects movement animations from BAS.
}
