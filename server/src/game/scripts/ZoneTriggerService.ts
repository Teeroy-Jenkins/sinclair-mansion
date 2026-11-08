import type { PlayerState } from "../player";
import type { ScriptRuntime } from "./ScriptRuntime";
import type { ZoneDefinition, ZoneTile } from "./types";

const toZoneTile = (player: PlayerState): ZoneTile => ({
    x: player.tileX,
    y: player.tileY,
    level: player.level,
    worldViewId: player.worldViewId,
});

const sameTile = (left: ZoneTile, right: ZoneTile): boolean =>
    left.x === right.x &&
    left.y === right.y &&
    left.level === right.level &&
    left.worldViewId === right.worldViewId;

const contains = (zone: ZoneDefinition, tile: ZoneTile): boolean =>
    tile.x >= zone.minX &&
    tile.x <= zone.maxX &&
    tile.y >= zone.minY &&
    tile.y <= zone.maxY &&
    (!zone.levels || zone.levels.includes(tile.level)) &&
    (!zone.worldViewIds || zone.worldViewIds.includes(tile.worldViewId));

const regionId = (tile: ZoneTile): number => ((tile.x >> 6) << 8) | (tile.y >> 6);

export class ZoneTriggerService {
    private readonly previousTiles = new WeakMap<PlayerState, ZoneTile>();

    constructor(private readonly runtime: ScriptRuntime) {}

    observeBeforeMovement(player: PlayerState): void {
        if (!this.previousTiles.has(player)) {
            this.previousTiles.set(player, toZoneTile(player));
        }
    }

    processAfterMovement(player: PlayerState, tick: number): boolean {
        const current = toZoneTile(player);
        const previous = this.previousTiles.get(player);
        this.previousTiles.set(player, current);
        if (!previous || sameTile(previous, current)) return false;

        this.dispatchRegionTransitions(player, previous, current, tick);
        for (const zone of this.runtime.getZoneDefinitions()) {
            const wasInside = contains(zone, previous);
            const isInside = contains(zone, current);
            if (wasInside && !isInside) {
                this.runtime.queueZoneEvent({
                    tick,
                    player,
                    zone,
                    type: "exit",
                    previous,
                    current,
                });
            } else if (!wasInside && isInside) {
                this.runtime.queueZoneEvent({
                    tick,
                    player,
                    zone,
                    type: "enter",
                    previous,
                    current,
                });
            }
            if (isInside) {
                this.runtime.queueZoneEvent({
                    tick,
                    player,
                    zone,
                    type: "step",
                    previous,
                    current,
                });
            }
        }
        return true;
    }

    private dispatchRegionTransitions(
        player: PlayerState,
        previous: ZoneTile,
        current: ZoneTile,
        tick: number,
    ): void {
        const previousRegionId = regionId(previous);
        const currentRegionId = regionId(current);
        const contextChanged =
            previousRegionId !== currentRegionId ||
            previous.level !== current.level ||
            previous.worldViewId !== current.worldViewId;
        if (!contextChanged) return;

        this.runtime.queueRegionEvent({
            tick,
            player,
            regionId: previousRegionId,
            type: "leave",
            previous,
            current,
        });
        this.runtime.queueRegionEvent({
            tick,
            player,
            regionId: currentRegionId,
            type: "enter",
            previous,
            current,
        });
    }
}
