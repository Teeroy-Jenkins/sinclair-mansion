import type {
    ItemOnNpcEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    getQuestStage,
    hasQuestItems,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ENCHANTED_MEATS,
    KAQEMEEX_NPC_ID,
    SANFEW_NPC_ID,
    STAGE_COMPLETE,
    STAGE_GATHERING_MEATS,
    STAGE_RETURN_TO_KAQEMEEX,
    STAGE_STARTED,
} from "./constants";

function kaqemeexContext(event: NpcInteractionEvent) {
    return {
        player: event.player,
        services: event.services,
        npcId: KAQEMEEX_NPC_ID,
        npcName: "Kaqemeex",
    };
}

function sanfewContext(event: NpcInteractionEvent | ItemOnNpcEvent) {
    return {
        player: event.player,
        services: event.services,
        npcId: SANFEW_NPC_ID,
        npcName: "Sanfew",
    };
}

function ritualExplanation(quest: QuestDefinition) {
    return [
        sayPlayer("I'm in search of a quest."),
        sayNpc([
            "Hmm. I think I may have a worthwhile task for you.",
            "We druids worship Guthix, the god of nature and balance.",
        ]),
        sayNpc([
            "Our most ancient stone circle stands south of Varrock,",
            "but dark wizards drove us from it long ago.",
        ]),
        sayNpc([
            "We have made this circle our home, but it must be purified",
            "before we can use it for our ceremonies.",
        ]),
        choose([
            option("What would I need to do?", [
                sayNpc([
                    "Speak to Sanfew, our foremost herbalist. He is in",
                    "the building south of here and knows what is needed.",
                ]),
                choose([
                    option("I'll help you.", [
                        sayNpc("Excellent. Go to Sanfew and offer him your assistance."),
                        run(({ player, services }) =>
                            setQuestStage(player, quest, services, STAGE_STARTED),
                        ),
                    ]),
                    option("What is the reward?", [
                        sayNpc([
                            "We will teach you the ancient skill of Herblore,",
                            "so you may make useful potions from herbs.",
                        ]),
                        choose([
                            option("That sounds useful. I'll help.", [
                                sayNpc("Good. Sanfew will tell you what to do."),
                                run(({ player, services }) =>
                                    setQuestStage(player, quest, services, STAGE_STARTED),
                                ),
                            ]),
                            option("No thanks.", [sayNpc("Very well. Return if you reconsider.")]),
                        ]),
                    ]),
                    option("No thanks.", [sayNpc("As you wish. Nature teaches patience.")]),
                ]),
            ]),
            option("What is the reward?", [
                sayNpc([
                    "If you help us, we will teach you Herblore: the art",
                    "of identifying herbs and brewing them into potions.",
                ]),
                choose([
                    option("All right, I'll help.", [
                        sayNpc("Then speak to Sanfew in Taverley."),
                        run(({ player, services }) =>
                            setQuestStage(player, quest, services, STAGE_STARTED),
                        ),
                    ]),
                    option("No thanks.", [sayNpc("Very well.")]),
                ]),
            ]),
            option("I don't think I want to help.", [sayNpc("Then our circle must wait.")]),
        ]),
    ];
}

function herbloreFundamentals() {
    return [
        sayNpc([
            "The ritual is complete. You may now learn the secrets",
            "of Herblore that Guthix entrusted to us.",
        ]),
        sayPlayer("How do I use Herblore?"),
        sayNpc([
            "Begin by cleaning a grimy herb. Your Herblore level",
            "determines which herbs you can identify.",
        ]),
        sayNpc([
            "Put a clean herb into a vial of water, then add the",
            "correct secondary ingredient to finish the potion.",
        ]),
        sayNpc([
            "Different herbs and ingredients create different effects.",
            "Experiment, or ask an experienced herbalist for guidance.",
        ]),
    ];
}

export function createKaqemeexTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = kaqemeexContext(event);
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                sayNpc("Welcome, friend of the druids. How is your Herblore?"),
                choose([
                    option("Very well, thank you.", [sayNpc("Guthix be with you.")]),
                    option("I still need practice.", [
                        sayNpc("Patience. Knowledge grows like a well-tended herb."),
                    ]),
                    option("Explain the fundamentals again.", herbloreFundamentals()),
                ]),
            ]);
            return;
        }
        if (stage >= STAGE_RETURN_TO_KAQEMEEX) {
            startConversation(context, [
                sayNpc("I sense that Sanfew has completed the preparations."),
                sayPlayer("Yes. I took him all four enchanted meats."),
                ...herbloreFundamentals(),
                run(({ player, services }) => completeQuest(player, services, quest)),
            ]);
            return;
        }
        if (stage >= STAGE_STARTED) {
            startConversation(context, [
                sayNpc("Have you spoken to Sanfew yet?"),
                sayPlayer("I'm still working on the ritual."),
                sayNpc("You will find him upstairs in the herb shop south of here."),
            ]);
            return;
        }
        startConversation(context, [
            sayNpc("What brings you to our holy circle, adventurer?"),
            choose([
                option("Who are you?", [
                    sayNpc([
                        "I am Kaqemeex, a druid of Guthix. We seek balance",
                        "between all things in the natural world.",
                    ]),
                ]),
                option("I'm in search of a quest.", ritualExplanation(quest), { echo: false }),
                option("Did you build this stone circle?", [
                    sayNpc([
                        "No. It is far older than any living druid, but we",
                        "have cared for it since settling in Taverley.",
                    ]),
                ]),
            ]),
        ]);
    };
}

function missingMeatNames(
    player: NpcInteractionEvent["player"],
    services: ScriptServices,
): string[] {
    const carried = services.inventory.getInventoryItems(player);
    return ENCHANTED_MEATS.filter(
        (requirement) =>
            !carried.some(
                (entry) => entry.itemId === requirement.itemId && entry.quantity >= requirement.quantity,
            ),
    ).map((requirement) => requirement.journalLabel.toLowerCase());
}

export function createSanfewTalkHandler(
    quest: QuestDefinition,
): (event: NpcInteractionEvent | ItemOnNpcEvent) => void {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const context = sanfewContext(event);
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [
                sayNpc("Hello again. Kaqemeex tells me your Herblore is coming along."),
                choose([
                    option("Do you have any more work?", [
                        sayNpc("Not just now, but the druids often need a capable adventurer."),
                    ]),
                    option("Just saying hello.", [sayNpc("Then hello to you too.")]),
                ]),
            ]);
            return;
        }
        if (stage >= STAGE_RETURN_TO_KAQEMEEX) {
            startConversation(context, [
                sayNpc("Everything is ready. Return to Kaqemeex at the stone circle."),
            ]);
            return;
        }
        if (stage >= STAGE_GATHERING_MEATS) {
            if (hasQuestItems(event.player, event.services, ENCHANTED_MEATS)) {
                startConversation(context, [
                    sayPlayer("I have all four enchanted meats."),
                    sayNpc("Excellent. Hand them over and I can complete the purification."),
                    run(({ player, services }) => {
                        if (!takeQuestItems(player, services, ENCHANTED_MEATS)) return;
                        services.messaging.sendGameMessage(
                            player,
                            "You give Sanfew the enchanted meats.",
                        );
                        setQuestStage(player, quest, services, STAGE_RETURN_TO_KAQEMEEX);
                    }),
                    sayNpc("The ritual ingredients are prepared. Tell Kaqemeex the good news."),
                ]);
                return;
            }
            const missing = missingMeatNames(event.player, event.services);
            startConversation(context, [
                sayNpc("Have you dipped all four raw meats in the Cauldron of Thunder?"),
                sayPlayer("Not yet."),
                sayNpc([
                    `You still need ${missing.join(", ")}.`,
                    "The cauldron is in the dungeon beneath Taverley.",
                ]),
            ]);
            return;
        }
        if (stage >= STAGE_STARTED) {
            startConversation(context, [
                sayNpc("Kaqemeex sent word that you would help us."),
                sayNpc([
                    "I need raw beef, raw rat meat, raw bear meat and raw chicken.",
                    "Each piece must be dipped in the Cauldron of Thunder.",
                ]),
                sayPlayer("Where can I find the cauldron?"),
                sayNpc([
                    "Enter the dungeon south of the stone circle. The cauldron",
                    "is in a chamber just inside; beware the creatures below.",
                ]),
                run(({ player, services }) =>
                    setQuestStage(player, quest, services, STAGE_GATHERING_MEATS),
                ),
            ]);
            return;
        }
        startConversation(context, [
            sayNpc("Good day. If you seek the druids' help, speak first to Kaqemeex."),
        ]);
    };
}
