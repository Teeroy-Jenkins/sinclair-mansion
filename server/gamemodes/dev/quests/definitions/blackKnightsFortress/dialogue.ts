import type { NpcInteractionEvent } from "../../../../../src/game/scripts/types";
import {
    VARP_QUEST_POINTS,
    completeQuest,
    getQuestStage,
} from "../../QuestService";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    startConversation,
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BRONZE_MED_HELM_ITEM_ID,
    DOSSIER_ITEM_ID,
    IRON_CHAINBODY_ITEM_ID,
    REQUIRED_QUEST_POINTS,
    SIR_AMIK_VARZE_NPC_ID,
    STAGE_COMPLETE,
    STAGE_INVESTIGATE,
    STAGE_RETURN_TO_AMIK,
    STAGE_SABOTAGE,
} from "./constants";

function addDossier(event: NpcInteractionEvent): boolean {
    const result = event.services.inventory.addItemToInventory(event.player, DOSSIER_ITEM_ID, 1);
    if (result.added !== 1) {
        event.services.messaging.sendGameMessage(
            event.player,
            "You need a free inventory slot for Sir Amik's dossier.",
        );
        return false;
    }
    event.services.inventory.snapshotInventory(event.player);
    return true;
}

function hasDossier(event: NpcInteractionEvent): boolean {
    return event.services.inventory.playerHasItem(event.player, DOSSIER_ITEM_ID);
}

function missionBriefing(event: NpcInteractionEvent): DialogueStep[] {
    return [
        sayNpc([
            "You've come along at just the right time. All my knights are known",
            "to the Black Knights, and subtlety is not exactly our strong point.",
        ]),
        sayPlayer("So what needs doing?"),
        sayNpc([
            "The Black Knights are demanding money and land, and threaten to invade Falador.",
            "They claim to possess a powerful new secret weapon.",
        ]),
        sayNpc([
            "Get inside their fortress, discover what the weapon is, and sabotage it.",
            "Read this dossier before you leave. You will be well paid.",
        ]),
        run(() => {
            addDossier(event);
        }),
    ];
}

function preQuestDialogue(event: NpcInteractionEvent): DialogueStep[] {
    const questPoints = event.player.varps.getVarpValue(VARP_QUEST_POINTS);
    if (hasDossier(event)) {
        return [
            sayNpc("Read the dossier I gave you. It contains everything you need for the mission."),
        ];
    }
    return [
        sayNpc("I am the leader of the White Knights of Falador. Why do you seek my audience?"),
        choose([
            option(
                "I seek a quest!",
                questPoints < REQUIRED_QUEST_POINTS
                    ? [
                          sayNpc([
                              "I do have a task, but it is dangerous and no mistakes can be made.",
                              "I could not send an inexperienced quester on it.",
                          ]),
                          sayPlayer(`I need at least ${REQUIRED_QUEST_POINTS} Quest Points first.`),
                      ]
                    : [
                          sayNpc([
                              "I need some dangerous spy work done inside the Black Knights' Fortress.",
                              "Are you prepared to face the danger?",
                          ]),
                          choose([
                              option("I laugh in the face of danger!", missionBriefing(event)),
                              option("I cower at the first sign of danger!", [
                                  sayNpc("Spy work does involve a little hiding in corners, I suppose."),
                                  choose([
                                      option("Then I'll give it a go.", missionBriefing(event)),
                                      option("No, I'm not convinced."),
                                  ]),
                              ]),
                          ]),
                      ],
            ),
            option("I don't. I'm just looking around.", [
                sayNpc("All right. Just don't break anything."),
            ]),
        ]),
    ];
}

export function createSirAmikTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: SIR_AMIK_VARZE_NPC_ID,
            npcName: "Sir Amik Varze",
        };
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [sayPlayer("Hello, Sir Amik."), sayNpc("Hello, friend!")]);
            return;
        }
        if (stage === STAGE_RETURN_TO_AMIK) {
            startConversation(context, [
                sayPlayer([
                    "I ruined the Black Knights' invincibility potion.",
                    "That should put a stop to your problem.",
                ]),
                sayNpc([
                    "We just received word that they have withdrawn their demands.",
                    "That confirms your story. Excellent work.",
                ]),
                sayPlayer("You said you were going to pay me."),
                sayNpc("Yes, that's right. Here is your reward."),
                run(({ player, services }) => completeQuest(player, services, quest)),
            ]);
            return;
        }
        if (stage === STAGE_SABOTAGE) {
            startConversation(context, [
                sayNpc("How is the mission going?"),
                sayPlayer("The secret weapon is an invincibility potion."),
                sayNpc("That is bad news. Find a way to sabotage it, and you will be paid well."),
            ]);
            return;
        }
        if (stage === STAGE_INVESTIGATE) {
            startConversation(context, [
                sayNpc("How is the mission going?"),
                sayPlayer("I haven't discovered what the secret weapon is yet."),
            ]);
            return;
        }
        startConversation(context, preQuestDialogue(event));
    };
}

export function createFortressGuardTalkHandler(): (event: NpcInteractionEvent) => void {
    return (event) => {
        const disguised =
            event.services.equipment.getEquippedItem(event.player, 0) ===
                BRONZE_MED_HELM_ITEM_ID &&
            event.services.equipment.getEquippedItem(event.player, 4) ===
                IRON_CHAINBODY_ITEM_ID;
        startConversation(
            {
                player: event.player,
                services: event.services,
                npcId: event.npc.typeId,
                npcName: "Fortress Guard",
            },
            disguised
                ? [sayNpc("Hey! Get back on duty!"), sayPlayer("Uh...")]
                : [sayNpc("Get lost. This is private property.")],
        );
    };
}
