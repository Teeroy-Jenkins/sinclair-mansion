import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { getQuestStage, setQuestStage } from "../../QuestService";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    showItem,
    startConversation,
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BANQUET_HALL_DOOR_LOC_ID,
    BLACK_KNIGHT_CAPTAIN_NPC_ID,
    BRONZE_MED_HELM_ITEM_ID,
    CABBAGE_HOLE_LOC_ID,
    CABBAGE_ITEM_ID,
    DOSSIER_ITEM_ID,
    DRAYNOR_MANOR_CABBAGE_ITEM_ID,
    FORTRESS_ENTRANCE_DOOR_LOC_ID,
    FORTRESS_GUARD_NPC_IDS,
    FORTRESS_WITCH_NPC_ID,
    GRELDO_NPC_ID,
    GUARDED_STURDY_DOOR_LOC_ID,
    IRON_CHAINBODY_ITEM_ID,
    LISTENING_GRILL_LOC_ID,
    SECRET_WALL_LOC_ID,
    SIR_AMIK_VARZE_NPC_ID,
    STAGE_INVESTIGATE,
    STAGE_RETURN_TO_AMIK,
    STAGE_SABOTAGE,
} from "./constants";
import { createFortressGuardTalkHandler, createSirAmikTalkHandler } from "./dialogue";

function crossDoor(event: LocInteractionEvent): void {
    const dx = event.player.tileX - event.tile.x;
    const dy = event.player.tileY - event.tile.y;
    if (Math.abs(dx) > Math.abs(dy)) {
        event.services.movement.teleportPlayer(
            event.player,
            event.tile.x - Math.sign(dx),
            event.player.tileY,
            event.level,
        );
        return;
    }
    event.services.movement.teleportPlayer(
        event.player,
        event.player.tileX,
        event.tile.y - Math.sign(dy),
        event.level,
    );
}

function isDisguised(event: LocInteractionEvent): boolean {
    return (
        event.services.equipment.getEquippedItem(event.player, EquipmentSlot.HEAD) ===
            BRONZE_MED_HELM_ITEM_ID &&
        event.services.equipment.getEquippedItem(event.player, EquipmentSlot.BODY) ===
            IRON_CHAINBODY_ITEM_ID
    );
}

function guardContext(event: LocInteractionEvent) {
    return {
        player: event.player,
        services: event.services,
        npcId: FORTRESS_GUARD_NPC_IDS[3],
        npcName: "Fortress Guard",
    };
}

function specificNpc(
    npcId: number,
    npcName: string,
    lines: string | readonly string[],
): DialogueStep {
    return { npc: typeof lines === "string" ? [lines] : [...lines], npcId, npcName };
}

export function registerBlackKnightsFortressInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const sirAmikTalk = createSirAmikTalkHandler(quest);
    registry.registerNpcScript({
        npcId: SIR_AMIK_VARZE_NPC_ID,
        option: "talk-to",
        handler: sirAmikTalk,
    });
    registry.registerNpcScript({ npcId: SIR_AMIK_VARZE_NPC_ID, option: undefined, handler: sirAmikTalk });

    const guardTalk = createFortressGuardTalkHandler();
    for (const npcId of FORTRESS_GUARD_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: guardTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: guardTalk });
    }

    registry.registerItemAction(
        DOSSIER_ITEM_ID,
        (event) => {
            if (getQuestStage(event.player, quest) >= STAGE_INVESTIGATE) {
                event.services.messaging.sendGameMessage(event.player, "The dossier has already served its purpose.");
                return;
            }
            startConversation(
                {
                    player: event.player,
                    services: event.services,
                    npcId: SIR_AMIK_VARZE_NPC_ID,
                    npcName: "Sir Amik Varze",
                },
                [
                    showItem(DOSSIER_ITEM_ID, [
                        "The Black Knights threaten Falador with a secret weapon.",
                        "Infiltrate their fortress, discover the weapon, and sabotage it.",
                    ]),
                    run(({ player, services }) => {
                        if (!services.inventory.consumeItem(player, event.source.slot)) return;
                        services.inventory.snapshotInventory(player);
                        setQuestStage(player, quest, services, STAGE_INVESTIGATE);
                        services.messaging.sendGameMessage(player, "The dossier crumbles to dust.");
                    }),
                ],
            );
        },
        "read",
    );

    registry.registerLocScript({
        locId: FORTRESS_ENTRANCE_DOOR_LOC_ID,
        action: "open",
        handler: (event) => {
            const entering = event.player.tileY < event.tile.y;
            if (!entering || isDisguised(event)) {
                crossDoor(event);
                return;
            }
            startConversation(guardContext(event), [
                sayNpc([
                    "Hey, you can't come in here!",
                    "This is a high-security military installation.",
                ]),
                choose([
                    option("Yes, but I work here!", [
                        sayNpc([
                            "This is the guards' entrance, and you're not a guard.",
                            "You're not even wearing the proper uniform!",
                        ]),
                        choose([
                            option("Please let me in!", [sayNpc("Go away. You're getting annoying.")]),
                            option("What is the uniform?", [
                                sayNpc("Iron chain mail and a medium bronze helmet, just like mine."),
                            ]),
                        ]),
                    ]),
                    option("Oh, sorry.", [sayNpc("Don't let it happen again.")]),
                    option("Who does this fortress belong to?", [
                        sayNpc("The order of Black Knights known as the Kinshra."),
                    ]),
                ]),
            ]);
        },
    });

    registry.registerLocScript({
        locId: BANQUET_HALL_DOOR_LOC_ID,
        action: "open",
        handler: (event) => {
            const entering = event.player.tileX < event.tile.x;
            if (!entering) {
                crossDoor(event);
                return;
            }
            startConversation(guardContext(event), [
                sayNpc([
                    "I wouldn't go in there if I were you.",
                    "The Black Knights said they'd kill anyone who disturbed their meeting!",
                ]),
                choose([
                    option("Okay, I won't."),
                    option("I don't care. I'm going in anyway.", [
                        run(() => crossDoor(event)),
                    ]),
                ]),
            ]);
        },
    });

    registry.registerLocScript({
        locId: GUARDED_STURDY_DOOR_LOC_ID,
        action: "open",
        handler: crossDoor,
    });
    registry.registerLocScript({
        locId: SECRET_WALL_LOC_ID,
        action: "push",
        handler: (event) => {
            event.services.messaging.sendGameMessage(
                event.player,
                "You push against the wall and find a secret passage.",
            );
            crossDoor(event);
        },
    });

    registry.registerLocScript({
        locId: LISTENING_GRILL_LOC_ID,
        action: "listen-at",
        handler: (event) => {
            if (getQuestStage(event.player, quest) !== STAGE_INVESTIGATE) {
                event.services.messaging.sendGameMessage(event.player, "You can't hear much right now.");
                return;
            }
            startConversation(
                {
                    player: event.player,
                    services: event.services,
                    npcId: BLACK_KNIGHT_CAPTAIN_NPC_ID,
                    npcName: "Black Knight Captain",
                },
                [
                    specificNpc(BLACK_KNIGHT_CAPTAIN_NPC_ID, "Black Knight Captain", "How is the secret weapon coming along?"),
                    specificNpc(FORTRESS_WITCH_NPC_ID, "Witch", [
                        "The invincibility potion is almost ready.",
                        "It's taken me five years, but only one ingredient remains.",
                    ]),
                    specificNpc(FORTRESS_WITCH_NPC_ID, "Witch", [
                        "Greldo will fetch a specially grown cabbage from Draynor Manor.",
                        "The magical soil gives those cabbages special properties.",
                    ]),
                    specificNpc(FORTRESS_WITCH_NPC_ID, "Witch", [
                        "Only a Draynor Manor cabbage will do!",
                        "Any ordinary cabbage would entirely wreck the potion.",
                    ]),
                    specificNpc(GRELDO_NPC_ID, "Greldo", "Yes, mistress."),
                    run(({ player, services }) =>
                        setQuestStage(player, quest, services, STAGE_SABOTAGE),
                    ),
                ],
            );
        },
    });

    registry.registerItemOnLoc(CABBAGE_ITEM_ID, CABBAGE_HOLE_LOC_ID, (event) => {
        if (getQuestStage(event.player, quest) !== STAGE_SABOTAGE) {
            startConversation(
                { player: event.player, services: event.services, npcId: FORTRESS_WITCH_NPC_ID, npcName: "Witch" },
                [sayPlayer("Why would I want to do that?")],
            );
            return;
        }
        if (!event.services.inventory.consumeItem(event.player, event.source.slot)) return;
        event.services.inventory.snapshotInventory(event.player);
        setQuestStage(event.player, quest, event.services, STAGE_RETURN_TO_AMIK);
        startConversation(
            { player: event.player, services: event.services, npcId: FORTRESS_WITCH_NPC_ID, npcName: "Witch" },
            [
                showItem(CABBAGE_ITEM_ID, "You drop the cabbage through the hole into the cauldron below."),
                sayNpc([
                    "The mixture starts to froth and bubble.",
                    "No! My invincibility potion is ruined!",
                ]),
                sayPlayer("That should have sabotaged the secret weapon."),
            ],
        );
    });

    registry.registerItemOnLoc(
        DRAYNOR_MANOR_CABBAGE_ITEM_ID,
        CABBAGE_HOLE_LOC_ID,
        (event) => {
            if (getQuestStage(event.player, quest) !== STAGE_SABOTAGE) {
                event.services.messaging.sendGameMessage(event.player, "Why would I want to do that?");
                return;
            }
            startConversation(
                { player: event.player, services: event.services, npcId: FORTRESS_WITCH_NPC_ID, npcName: "Witch" },
                [
                    sayPlayer([
                        "This is the wrong sort of cabbage!",
                        "I'm meant to hinder the witch, not help her.",
                    ]),
                ],
            );
        },
    );
}
