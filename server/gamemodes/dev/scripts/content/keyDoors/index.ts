import type {
    IScriptRegistry,
    LocInteractionEvent,
} from "../../../../../src/game/scripts/types";
import { DOOR_OPEN_SOUND, GATE_OPEN_SOUND, KEY_DOORS, type KeyDoorDef } from "./defs";

function hasKey(event: LocInteractionEvent, keyItemId: number): boolean {
    return event.player.items.hasItem(keyItemId, 1);
}

/** Land on the far side of the loc relative to the player's approach. */
function tileThroughDoor(
    playerX: number,
    playerY: number,
    doorX: number,
    doorY: number,
): { x: number; y: number } {
    const dx = Math.sign(doorX - playerX);
    const dy = Math.sign(doorY - playerY);
    if (dx === 0 && dy === 0) {
        return { x: doorX, y: doorY };
    }
    return { x: doorX + dx, y: doorY + dy };
}

function openWithKey(event: LocInteractionEvent, def: KeyDoorDef): void {
    const { player, services, tile, level, locId, tick } = event;
    const name = def.kind;

    if (!hasKey(event, def.keyItemId)) {
        services.messaging.sendGameMessage(
            player,
            def.kind === "door" ? "The door is locked." : `This ${name} is locked.`,
        );
        return;
    }

    services.messaging.sendGameMessage(player, `You unlock the ${name}.`);

    const doorManager = services.location.doorManager;
    const toggle = doorManager?.toggleDoor({
        x: tile.x,
        y: tile.y,
        level,
        currentId: locId,
        action: "open",
        currentTick: tick,
    });

    if (toggle?.success && toggle.newLocId !== undefined) {
        const { emitLocChange } = services.location;
        emitLocChange(locId, toggle.newLocId, tile, level, {
            oldTile: tile,
            newTile: toggle.newTile ?? tile,
            oldRotation: toggle.oldRotation,
            newRotation: toggle.newRotation,
        });
        if (toggle.partnerResult) {
            emitLocChange(
                toggle.partnerResult.oldLocId,
                toggle.partnerResult.newLocId,
                toggle.partnerResult.oldTile,
                level,
                {
                    oldTile: toggle.partnerResult.oldTile,
                    newTile: toggle.partnerResult.newTile,
                    oldRotation: toggle.partnerResult.oldRotation,
                    newRotation: toggle.partnerResult.newRotation,
                },
            );
        }
    } else {
        // No unique closed→opened pair in doors.json yet (LostCity uses temp locs).
        const dest = tileThroughDoor(player.tileX, player.tileY, tile.x, tile.y);
        services.movement.teleportPlayer(player, dest.x, dest.y, level);
    }

    services.sound.playAreaSound({
        soundId: def.kind === "gate" ? GATE_OPEN_SOUND : DOOR_OPEN_SOUND,
        tile: { x: tile.x, y: tile.y },
        level,
        radius: 5,
    });
}

export function registerKeyDoorHandlers(registry: IScriptRegistry): void {
    for (const def of KEY_DOORS) {
        registry.registerLocScript({
            locId: def.locId,
            action: "open",
            handler: (event) => openWithKey(event, def),
        });
        registry.registerItemOnLoc(def.keyItemId, def.locId, (event) => {
            openWithKey(event, def);
        });
    }
}
