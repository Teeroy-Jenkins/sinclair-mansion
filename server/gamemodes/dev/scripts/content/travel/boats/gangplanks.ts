/**
 * Ship gangplanks — Cross between dock (plane 0) and deck (plane 1).
 * LostCity general_use/gangplank.rs2 (rotation-aware); here we use approach direction.
 */
import type { IScriptRegistry, LocInteractionEvent } from "../../../../../../src/game/scripts/types";

/** Entrana ferry planks (OSRS 2412–2415, examine "Handy for boarding the ship."). */
const ENTRANA_GANGPLANK_IDS = [2412, 2413, 2414, 2415] as const;

/** Port Sarim / Musa planks (2081–2084, examine "Handy for boarding boats."). */
const SARIM_KARAMJA_GANGPLANK_IDS = [2081, 2082, 2083, 2084] as const;

const BOARD_HINT: Partial<Record<number, string>> = {
    2081: "You must speak to the Customs Officer before it will set sail.",
    2083: "You must speak to one of the sailors before it will set sail.",
};

function playerTile(event: LocInteractionEvent): { x: number; y: number; level: number } {
    return {
        x: event.player.tileX,
        y: event.player.tileY,
        level: event.player.level,
    };
}

/**
 * Land on the far side of the plank, changing plane.
 * Approach direction (player → loc) continues through; if standing on the loc,
 * prefer N/S for Entrana-style jetties (ship north of dock).
 */
function resolveLanding(event: LocInteractionEvent): {
    x: number;
    y: number;
    level: number;
    boarding: boolean;
} {
    const player = playerTile(event);
    const boarding = player.level === 0;
    const destLevel = boarding ? 1 : 0;

    let dirX = Math.sign(event.tile.x - player.x);
    let dirY = Math.sign(event.tile.y - player.y);
    if (dirX === 0 && dirY === 0) {
        // On the plank tile — Entrana/Port Sarim ships sit north of the jetty.
        dirY = boarding ? 1 : -1;
    }

    return {
        x: event.tile.x + dirX * 2,
        y: event.tile.y + dirY * 2,
        level: destLevel,
        boarding,
    };
}

function crossGangplank(event: LocInteractionEvent): void {
    const { player, services, locId } = event;
    const landing = resolveLanding(event);

    if (landing.boarding) {
        services.messaging.sendGameMessage(player, "You board the ship.");
        const hint = BOARD_HINT[locId];
        if (hint) services.messaging.sendGameMessage(player, hint);
    }

    services.movement.teleportPlayer(player, landing.x, landing.y, landing.level, true);
}

export function registerGangplanks(registry: IScriptRegistry): void {
    const ids = [...ENTRANA_GANGPLANK_IDS, ...SARIM_KARAMJA_GANGPLANK_IDS];
    for (const locId of ids) {
        registry.registerLocInteraction(locId, crossGangplank, "cross");
        // Default / null action fallback used by some clients.
        registry.registerLocInteraction(locId, crossGangplank, undefined);
    }
}
