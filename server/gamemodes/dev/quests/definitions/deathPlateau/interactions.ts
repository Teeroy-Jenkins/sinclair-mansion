import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestDefinitionByKey } from "../../QuestRegistry";
import { getQuestStage, isQuestComplete, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { QUEST_KEYS } from "../desertTreasureSeries/constants";
import {
    finishQuest,
    gameMessage,
    giveItem,
    registerTalk,
    requirement,
    skillLevel,
    talk,
} from "../desertTreasureSeries/helpers";
import { ITEM, NPC, REQUIRED_SUPPLIES } from "./constants";

function getTrollStrongholdQuest(): QuestDefinition | undefined {
    return getQuestDefinitionByKey(QUEST_KEYS.trollStronghold);
}

export function registerDeathPlateauInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerTalk(registry, NPC.denulth, (event) => {
        const deathStage = getQuestStage(event.player, quest);
        if (deathStage < quest.completionValue) {
            if (deathStage === 0) {
                talk(event, "Denulth", [
                    sayNpc([
                        "The trolls hold Death Plateau and our attacks keep failing.",
                        "Will you find a secret route for the Imperial Guard?",
                    ]),
                    choose([
                        option("Yes, I'll help.", [
                            sayNpc("Speak to Eohric in Burthorpe Castle. He may know a guide."),
                            run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 10)),
                        ]),
                        option("Not right now.", [sayNpc("Then Burthorpe remains in danger.")]),
                    ]),
                ]);
                return;
            }
            if (deathStage >= 75) {
                talk(event, "Denulth", [
                    sayPlayer("I found the secret route. Here are the map and the combination."),
                    sayNpc("Excellent work. The Imperial Guard can finally outflank the trolls."),
                    run((ctx) => {
                        const needed = [
                            requirement(ITEM.secretWayMap, 1, "Secret way map"),
                            requirement(ITEM.combination, 1, "Combination"),
                        ];
                        if (!takeQuestItems(ctx.player, ctx.services, needed)) {
                            gameMessage(
                                ctx.player,
                                ctx.services,
                                "You need the map and Harold's combination.",
                            );
                            return;
                        }
                        finishQuest(ctx.player, ctx.services, quest);
                    }),
                ]);
                return;
            }
            talk(event, "Denulth", [
                sayNpc("Find a safe route to Death Plateau and bring me a map of it."),
            ]);
            return;
        }

        const trollQuest = getTrollStrongholdQuest();
        if (!trollQuest) {
            talk(event, "Denulth", [sayNpc("Burthorpe owes you a great debt, adventurer.")]);
            return;
        }
        const trollStage = getQuestStage(event.player, trollQuest);
        if (trollStage === 0) {
            if (skillLevel(event.player, services, 16) < 15) {
                gameMessage(
                    event.player,
                    services,
                    "You need 15 Agility to begin Troll Stronghold.",
                );
                return;
            }
            talk(event, "Denulth", [
                sayNpc([
                    "The trolls have captured Dunstan's son, Godric.",
                    "Enter their stronghold and bring him home.",
                ]),
                choose([
                    option("I'll rescue him.", [
                        sayNpc("Climb the mountain path. A troll called Dad guards the arena."),
                        run((ctx) => setQuestStage(ctx.player, trollQuest, ctx.services, 10)),
                    ]),
                    option("That sounds too dangerous."),
                ]),
            ]);
            return;
        }
        if (trollStage < trollQuest.completionValue) {
            talk(event, "Denulth", [
                sayNpc("Godric is still inside the Troll Stronghold. Please hurry."),
            ]);
            return;
        }
        talk(event, "Denulth", [sayNpc("Burthorpe owes you a great debt, adventurer.")]);
    });

    registerTalk(registry, NPC.eohric, (event) => {
        if (getQuestStage(event.player, quest) !== 10) {
            talk(event, "Eohric", [sayNpc("I look after Burthorpe Castle for Prince Anlaf.")]);
            return;
        }
        talk(event, "Eohric", [
            sayNpc(
                "Harold used to guide soldiers through these mountains. You will find him upstairs in the Toad and Chicken.",
            ),
            run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 20)),
        ]);
    });

    registerTalk(registry, NPC.harold, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < 20 || stage >= 60) {
            talk(event, "Harold", [
                sayNpc("Buy me a drink and perhaps I'll remember something useful."),
            ]);
            return;
        }
        const supplies = [
            requirement(ITEM.asgarnianAle, 1, "Asgarnian ale"),
            requirement(ITEM.blurberrySpecial, 1, "Blurberry special"),
            requirement(ITEM.coins, 100, "100 coins"),
        ];
        talk(event, "Harold", [
            sayNpc("A drink, a cocktail, and a little gambling stake might loosen my memory."),
            run((ctx) => {
                if (!takeQuestItems(ctx.player, ctx.services, supplies)) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "Harold wants an Asgarnian ale, a Blurberry special, and 100 coins.",
                    );
                    return;
                }
                if (!giveItem(ctx.player, ctx.services, ITEM.iou, 1, "IOU")) return;
                if (!giveItem(ctx.player, ctx.services, ITEM.combination, 1, "combination")) return;
                setQuestStage(ctx.player, quest, ctx.services, 60);
            }),
            sayNpc("The IOU hides the route's combination. Saba knows the old mountain paths."),
        ]);
    });

    registerTalk(registry, NPC.saba, (event) => {
        if (getQuestStage(event.player, quest) !== 60) {
            talk(event, "Saba", [sayNpc("Leave an old hermit in peace.")]);
            return;
        }
        talk(event, "Saba", [
            sayNpc("Tenzing lives above the village. He knows the only path the trolls overlook."),
            run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 70)),
        ]);
    });

    registerTalk(registry, NPC.tenzing, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < 70 || stage >= 75) {
            talk(event, "Tenzing", [sayNpc("The mountain winds are cold today.")]);
            return;
        }
        talk(event, "Tenzing", [
            sayNpc(
                "Bring me ten loaves of bread and ten cooked trout, and I will show you the path.",
            ),
            run((ctx) => {
                if (!takeQuestItems(ctx.player, ctx.services, REQUIRED_SUPPLIES)) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "Tenzing still needs 10 bread and 10 cooked trout.",
                    );
                    return;
                }
                if (!giveItem(ctx.player, ctx.services, ITEM.secretWayMap, 1, "map")) return;
                if (!giveItem(ctx.player, ctx.services, ITEM.climbingBoots, 1, "climbing boots"))
                    return;
                setQuestStage(ctx.player, quest, ctx.services, 72);
            }),
            sayNpc("Follow the path behind my house. Have Dunstan put spikes on those boots."),
        ]);
    });

    registerTalk(registry, NPC.dunstan, (event) => {
        const deathStage = getQuestStage(event.player, quest);
        if (deathStage >= 70 && deathStage < 75) {
            talk(event, "Dunstan", [
                sayNpc(
                    "One iron bar and those climbing boots are enough for me to fit mountain spikes.",
                ),
                run((ctx) => {
                    const items = [
                        requirement(ITEM.ironBar, 1, "Iron bar"),
                        requirement(ITEM.climbingBoots, 1, "Climbing boots"),
                    ];
                    if (!takeQuestItems(ctx.player, ctx.services, items)) {
                        gameMessage(
                            ctx.player,
                            ctx.services,
                            "Dunstan needs an iron bar and the climbing boots.",
                        );
                        return;
                    }
                    if (!giveItem(ctx.player, ctx.services, ITEM.spikedBoots, 1, "spiked boots"))
                        return;
                    if (!giveItem(ctx.player, ctx.services, ITEM.certificate, 1, "certificate"))
                        return;
                    setQuestStage(ctx.player, quest, ctx.services, 75);
                }),
            ]);
            return;
        }

        const trollQuest = getTrollStrongholdQuest();
        if (
            trollQuest &&
            getQuestStage(event.player, trollQuest) >= 45 &&
            !isQuestComplete(event.player, trollQuest)
        ) {
            talk(event, "Dunstan", [
                sayPlayer("Godric is free and safely out of the stronghold."),
                sayNpc("You brought my son home. I cannot thank you enough."),
                run((ctx) => finishQuest(ctx.player, ctx.services, trollQuest)),
            ]);
            return;
        }
        talk(event, "Dunstan", [
            sayNpc("I am Burthorpe's finest smith, when my hands are not shaking with worry."),
        ]);
    });
}
