import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import type { QuestDefinition } from "../../types";
import {
    BROTHER_CEDRIC_NPC_ID,
    BROTHER_OMAD_NPC_ID,
    CAVE_LADDER_LOC_ID,
    CAVE_LADDER_TILE,
    CHILDS_BLANKET_ITEM_ID,
    HIDDEN_LADDER_LOC_ID,
    HIDDEN_LADDER_TILE,
    JUG_OF_WATER_ITEM_ID,
    LADDER_REGION_ID,
    LOGS_ITEM_ID,
} from "./constants";
import { createCedricTalkHandler, createOmadTalkHandler } from "./dialogue";

function isTile(tile: { x: number; y: number }, expected: { x: number; y: number }): boolean {
    return tile.x === expected.x && tile.y === expected.y;
}

export function registerMonksFriendInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const omadTalk = createOmadTalkHandler(quest);
    const cedricTalk = createCedricTalkHandler(quest);
    registry.registerNpcScript({ npcId: BROTHER_OMAD_NPC_ID, option: "talk-to", handler: omadTalk });
    registry.registerNpcScript({ npcId: BROTHER_OMAD_NPC_ID, option: undefined, handler: omadTalk });
    registry.registerNpcScript({ npcId: BROTHER_CEDRIC_NPC_ID, option: "talk-to", handler: cedricTalk });
    registry.registerNpcScript({ npcId: BROTHER_CEDRIC_NPC_ID, option: undefined, handler: cedricTalk });
    registry.registerItemOnNpc(CHILDS_BLANKET_ITEM_ID, BROTHER_OMAD_NPC_ID, omadTalk);
    registry.registerItemOnNpc(JUG_OF_WATER_ITEM_ID, BROTHER_CEDRIC_NPC_ID, cedricTalk);
    registry.registerItemOnNpc(LOGS_ITEM_ID, BROTHER_CEDRIC_NPC_ID, cedricTalk);

    const previousDown = registry.findLocInteraction(HIDDEN_LADDER_LOC_ID, "climb-down");
    registry.registerLocScript({
        locId: HIDDEN_LADDER_LOC_ID,
        action: "climb-down",
        handler: (event) => {
            if (!isTile(event.tile, HIDDEN_LADDER_TILE)) return previousDown?.(event);
            event.services.movement.teleportPlayer(event.player, 2561, 9621, 0);
        },
    });

    const previousUp = registry.findLocInteraction(CAVE_LADDER_LOC_ID, "climb-up");
    registry.registerLocScript({
        locId: CAVE_LADDER_LOC_ID,
        action: "climb-up",
        handler: (event) => {
            if (!isTile(event.tile, CAVE_LADDER_TILE)) return previousUp?.(event);
            event.services.movement.teleportPlayer(event.player, 2561, 3221, 0);
        },
    });

    registry.registerRegionHandler(LADDER_REGION_ID, (event) => {
        if (event.type !== "enter") return;
        event.services.location.spawnLocForPlayer(
            event.player,
            HIDDEN_LADDER_LOC_ID,
            HIDDEN_LADDER_TILE,
            0,
            10,
            1,
        );
    });
}
