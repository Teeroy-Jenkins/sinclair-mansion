/**
 * Gnome Stronghold agility — log balance (LostCity gnome_course.rs2 first obstacle).
 * Soft exact-move port; full course / BAS walk deferred.
 */
import { SkillId } from "../../../../../client/rs/skill/skills";
import type { IScriptRegistry, LocInteractionEvent } from "../../../../src/game/scripts/types";

/** OSRS gnome_log_balance1 */
const GNOME_LOG_LOC_ID = 23145;
const LOG_WALK_ANIM = 762; // human_walk_logbalance
const LOG_SPAN_TILES = 7;
const LOG_MOVE_TICKS = 7;
const LOG_XP = 7.5;

function crossGnomeLog(event: LocInteractionEvent): void {
    const { player, tile, services, tick } = event;
    const goingNorth = player.tileY <= tile.y;
    const destX = tile.x;
    const destY = player.tileY + (goingNorth ? LOG_SPAN_TILES : -LOG_SPAN_TILES);
    const destLevel = player.level;

    services.messaging.sendGameMessage(player, "You walk carefully across the slippery log...");

    const startTile = { x: player.tileX, y: player.tileY };
    const endTile = { x: destX, y: destY };

    services.movement.teleportPlayer(player, destX, destY, destLevel);
    services.movement.queueForcedMovement(player, {
        startTile,
        endTile,
        endTick: tick + LOG_MOVE_TICKS,
    });

    player.clearPendingSeqs();
    services.animation.playPlayerSeq(player, LOG_WALK_ANIM);

    services.skills.addSkillXp(player, SkillId.Agility, LOG_XP);
    services.messaging.sendGameMessage(player, "...You make it safely to the other side.");
}

export function register(registry: IScriptRegistry): void {
    for (const action of ["walk-across", "walk across", "cross", undefined]) {
        registry.registerLocInteraction(GNOME_LOG_LOC_ID, crossGnomeLog, action);
    }
}
