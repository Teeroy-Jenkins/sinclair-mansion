import type { ItemOnNpcEvent, NpcInteractionEvent } from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    getQuestStage,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import {
    choose,
    type NpcDialogueStep,
    option,
    run,
    sayNpc,
    sayPlayer,
    startConversation,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BLUE_GOBLIN_MAIL_ITEM_ID,
    GENERAL_BENTNOZE_NPC_ID,
    GENERAL_WARTFACE_NPC_ID,
    GOBLIN_MAIL_ITEM_ID,
    GRUBFOOT_NPC_ID,
    ORANGE_GOBLIN_MAIL_ITEM_ID,
    STAGE_BLUE_REJECTED,
    STAGE_BROWN_ACCEPTED,
    STAGE_COMPLETE,
    STAGE_ORANGE_REJECTED,
    STAGE_STARTED,
} from "./constants";

type GeneralEvent = NpcInteractionEvent | ItemOnNpcEvent;

function goblinLine(
    npcId: number,
    npcName: string,
    lines: string | readonly string[],
): NpcDialogueStep {
    return { npc: typeof lines === "string" ? [lines] : [...lines], npcId, npcName };
}

const wartface = (lines: string | readonly string[]) =>
    goblinLine(GENERAL_WARTFACE_NPC_ID, "General Wartface", lines);
const bentnoze = (lines: string | readonly string[]) =>
    goblinLine(GENERAL_BENTNOZE_NPC_ID, "General Bentnoze", lines);
const grubfoot = (lines: string | readonly string[]) =>
    goblinLine(GRUBFOOT_NPC_ID, "Grubfoot", lines);

function npcTypeId(event: GeneralEvent): number {
    return "npc" in event ? event.npc.typeId : event.target.typeId;
}

function generalContext(event: GeneralEvent) {
    const id = npcTypeId(event);
    return {
        player: event.player,
        services: event.services,
        npcId: id,
        npcName: id === GENERAL_BENTNOZE_NPC_ID ? "General Bentnoze" : "General Wartface",
    };
}

function hasItem(event: GeneralEvent, itemId: number): boolean {
    return event.services.inventory
        .getInventoryItems(event.player)
        .some((entry) => entry.itemId === itemId && entry.quantity > 0);
}

function acceptColourTestsSteps(quest: QuestDefinition) {
    return [
        wartface("We need a colour both goblin tribes will accept."),
        bentnoze("Human, you find us a new colour!"),
        choose([
            option("All right, I'll help you.", [
                bentnoze("First we try orange armour."),
                wartface("Bring one orange goblin mail for Grubfoot."),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_STARTED),
                ),
            ]),
            option("Why can't you choose for yourselves?", [
                bentnoze("Because Wartface always chooses wrong!"),
                wartface("Bentnoze chooses worse! Will you help or not?"),
                choose([
                    option("Fine, I'll help.", [
                        sayNpc("Good. Bring us orange goblin mail."),
                        run(({ player, services }) =>
                            setQuestStage(player, quest, services, STAGE_STARTED),
                        ),
                    ]),
                    option("No.", [sayNpc("Then go away, human!")]),
                ]),
            ]),
            option("No, settle it yourselves.", [sayNpc("Bah! Humans no help at all.")]),
        ]),
    ];
}

function removeMailAndAdvance(
    quest: QuestDefinition,
    itemId: number,
    nextStage: number,
    message: string,
) {
    return run(({ player, services }) => {
        if (!takeQuestItems(player, services, [{ itemId, quantity: 1, journalLabel: "" }])) return;
        services.messaging.sendGameMessage(player, message);
        setQuestStage(player, quest, services, nextStage);
    });
}

export function createGeneralTalkHandler(quest: QuestDefinition): (event: GeneralEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = generalContext(event);
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                bentnoze("Brown armour still best!"),
                wartface("Yes. Goblins finally agree."),
                choose([
                    option("Glad I could help.", [sayNpc("You clever, for a human.")]),
                    option("Are you arguing about anything else?", [
                        sayNpc("Not today. Maybe tomorrow."),
                    ]),
                ]),
            ]);
            return;
        }
        if (stage >= STAGE_BLUE_REJECTED) {
            if (hasItem(event, GOBLIN_MAIL_ITEM_ID)) {
                startConversation(context, [
                    sayPlayer("Here is the original brown goblin mail."),
                    wartface("Grubfoot! Try brown armour behind changing curtain."),
                    grubfoot("This one fits, generals."),
                    bentnoze("Brown is not too bright."),
                    wartface("Brown is perfect! We choose brown."),
                    removeMailAndAdvance(
                        quest,
                        GOBLIN_MAIL_ITEM_ID,
                        STAGE_BROWN_ACCEPTED,
                        "You hand over the brown goblin mail.",
                    ),
                    sayNpc("Thank you, human. Goblin Village is peaceful again."),
                    run(({ player, services }) => completeQuest(player, services, quest)),
                ]);
            } else {
                startConversation(context, [
                    sayNpc("Blue too bright. Bring ordinary brown goblin mail now."),
                    sayPlayer("Where can I get another one?"),
                    sayNpc("Search crates around village. Goblins leave armour everywhere."),
                ]);
            }
            return;
        }
        if (stage >= STAGE_ORANGE_REJECTED) {
            if (hasItem(event, BLUE_GOBLIN_MAIL_ITEM_ID)) {
                startConversation(context, [
                    sayPlayer("I have made a blue goblin mail."),
                    bentnoze("Grubfoot! Behind curtain. Try blue one."),
                    grubfoot("Blue armour makes Grubfoot look cold."),
                    wartface("No, blue much too bright."),
                    bentnoze("Try original brown colour instead."),
                    removeMailAndAdvance(
                        quest,
                        BLUE_GOBLIN_MAIL_ITEM_ID,
                        STAGE_BLUE_REJECTED,
                        "You hand over the blue goblin mail.",
                    ),
                ]);
            } else {
                startConversation(context, [
                    sayNpc("Orange no good. We need blue goblin mail next."),
                    sayPlayer("How do I make that?"),
                    sayNpc("Use blue dye on ordinary goblin mail. Ask witch in Draynor about dye."),
                ]);
            }
            return;
        }
        if (stage >= STAGE_STARTED) {
            if (hasItem(event, ORANGE_GOBLIN_MAIL_ITEM_ID)) {
                startConversation(context, [
                    sayPlayer("I brought the orange goblin mail you asked for."),
                    wartface("Grubfoot! Go behind changing curtain and put it on."),
                    grubfoot("Orange armour is very bright, generals."),
                    bentnoze("Too bright! I not like orange."),
                    wartface("Me neither. Human, bring blue armour."),
                    removeMailAndAdvance(
                        quest,
                        ORANGE_GOBLIN_MAIL_ITEM_ID,
                        STAGE_ORANGE_REJECTED,
                        "You hand over the orange goblin mail.",
                    ),
                ]);
            } else {
                startConversation(context, [
                    sayNpc("Where orange goblin mail? We need it for Grubfoot."),
                    choose([
                        option("How do I make orange armour?", [
                            sayNpc([
                                "Find goblin mail in village crates and use orange dye on it.",
                                "The witch Aggie in Draynor knows how to make dyes.",
                            ]),
                        ]),
                        option("I'm still working on it.", [sayNpc("Then hurry!")]),
                    ]),
                ]);
            }
            return;
        }
        startConversation(context, [
            wartface("Green armour!"),
            bentnoze("Red armour!"),
            choose([
                option("Why are you arguing?", [
                    sayPlayer("You two have been arguing so loudly that the whole village can hear."),
                    ...acceptColourTestsSteps(quest),
                ]),
                option("Wouldn't you prefer peace?", [
                    sayNpc("Yes, but first goblins must agree what colour armour to wear."),
                    ...acceptColourTestsSteps(quest),
                ]),
                option("Do you want me to pick a colour?", [
                    sayNpc("Maybe human can choose. We try orange first."),
                    choose([
                        option("I'll help.", [
                            sayNpc("Bring one orange goblin mail."),
                            run(({ player, services }) =>
                                setQuestStage(player, quest, services, STAGE_STARTED),
                            ),
                        ]),
                        option("No thanks.", [sayNpc("Then stop interrupting argument!")]),
                    ]),
                ]),
            ]),
        ]);
    };
}

export function createGrubfootTalkHandler(quest: QuestDefinition): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = {
            player: event.player,
            services: event.services,
            npcId: event.npc.typeId || GRUBFOOT_NPC_ID,
            npcName: "Grubfoot",
        };
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [sayNpc("Grubfoot happy to wear normal brown armour again.")]);
        } else if (stage >= STAGE_BLUE_REJECTED) {
            startConversation(context, [sayNpc("Generals say Grubfoot must try brown armour now.")]);
        } else if (stage >= STAGE_ORANGE_REJECTED) {
            startConversation(context, [sayNpc("Orange was too bright. Now generals want blue.")]);
        } else if (stage >= STAGE_STARTED) {
            startConversation(context, [sayNpc("Grubfoot waits while generals choose new armour.")]);
        } else {
            startConversation(context, [sayNpc("Generals always arguing. Grubfoot stays quiet.")]);
        }
    };
}
