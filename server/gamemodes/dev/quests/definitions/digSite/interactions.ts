import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestDefinitionByKey } from "../../QuestRegistry";
import { getQuestStage, isQuestComplete, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { QUEST_KEYS } from "../desertTreasureSeries/constants";
import {
    finishQuest,
    gameMessage,
    giveItem,
    hasItem,
    registerTalk,
    requirement,
    skillLevel,
    talk,
} from "../desertTreasureSeries/helpers";
import { ITEM, NPC } from "./constants";

export function registerDigSiteInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerTalk(registry, NPC.examiners, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            const missing: string[] = [];
            if (skillLevel(event.player, services, 16) < 10) missing.push("10 Agility");
            if (skillLevel(event.player, services, 15) < 10) missing.push("10 Herblore");
            if (skillLevel(event.player, services, 17) < 25) missing.push("25 Thieving");
            if (missing.length > 0) {
                gameMessage(
                    event.player,
                    services,
                    `You need ${missing.join(", ")} to begin The Dig Site.`,
                );
                return;
            }
            talk(event, "Examiner", [
                sayNpc(
                    "Before you may dig, you must pass our examinations. Interview each of the three students.",
                ),
                choose([
                    option("I'll take the exams.", [
                        run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 1)),
                    ]),
                    option("Perhaps later."),
                ]),
            ]);
            return;
        }
        talk(event, "Examiner", [
            sayNpc(
                stage < 4
                    ? "Study the site's history with all three students."
                    : "You have passed. Terry Balando can issue your digging permission.",
            ),
        ]);
    });

    NPC.students.forEach((npcId, index) => {
        registerTalk(registry, [npcId], (event) => {
            const expectedStage = index + 1;
            const stage = getQuestStage(event.player, quest);
            if (stage !== expectedStage) {
                talk(event, "Student", [
                    sayNpc(
                        stage > expectedStage
                            ? "I have already signed your certificate."
                            : "Speak to the other students first; we each cover a different subject.",
                    ),
                ]);
                return;
            }
            const certificates = [
                ITEM.level1Certificate,
                ITEM.level2Certificate,
                ITEM.level3Certificate,
            ];
            const topics = [
                "the proper care of archaeological finds",
                "safe use of digging tools",
                "the history of the Zarosian settlement",
            ];
            talk(event, "Student", [
                sayNpc(`You understand ${topics[index]}. Take this certificate to the examiner.`),
                run((ctx) => {
                    if (!giveItem(ctx.player, ctx.services, certificates[index], 1, "certificate"))
                        return;
                    setQuestStage(ctx.player, quest, ctx.services, expectedStage + 1);
                }),
            ]);
        });
    });

    registerTalk(registry, NPC.terryBalando, (event) => {
        const stage = getQuestStage(event.player, quest);
        const desertTreasure = getQuestDefinitionByKey(QUEST_KEYS.desertTreasure);
        if (
            desertTreasure &&
            isQuestComplete(event.player, quest) &&
            getQuestStage(event.player, desertTreasure) === 1
        ) {
            talk(event, "Terry Balando", [
                sayNpc(
                    "These etchings describe a Zarosian treasure sealed beneath the desert. Here is my translation.",
                ),
                run((ctx) => {
                    if (
                        !takeQuestItems(ctx.player, ctx.services, [
                            requirement(ITEM.etchings, 1, "Etchings"),
                        ])
                    ) {
                        gameMessage(
                            ctx.player,
                            ctx.services,
                            "You need the etchings from the Asgarnia Smith.",
                        );
                        return;
                    }
                    if (!giveItem(ctx.player, ctx.services, ITEM.translation, 1, "translation"))
                        return;
                    setQuestStage(ctx.player, desertTreasure, ctx.services, 4);
                }),
            ]);
            return;
        }
        if (stage === 4) {
            const certificates = [
                requirement(ITEM.level1Certificate, 1, "Level 1 certificate"),
                requirement(ITEM.level2Certificate, 1, "Level 2 certificate"),
                requirement(ITEM.level3Certificate, 1, "Level 3 certificate"),
            ];
            talk(event, "Terry Balando", [
                sayNpc("All three certificates are in order. You may investigate the dig shafts."),
                run((ctx) => {
                    if (!takeQuestItems(ctx.player, ctx.services, certificates)) return;
                    if (
                        !giveItem(
                            ctx.player,
                            ctx.services,
                            ITEM.chemicalCompound,
                            1,
                            "chemical compound",
                        )
                    )
                        return;
                    setQuestStage(ctx.player, quest, ctx.services, 7);
                }),
            ]);
            return;
        }
        if (stage === 7 && hasItem(event.player, services, ITEM.chemicalCompound)) {
            talk(event, "Terry Balando", [
                sayNpc(
                    "The compound exposed a hidden Zarosian altar. This ancient talisman belongs in the museum.",
                ),
                run((ctx) => {
                    if (
                        !takeQuestItems(ctx.player, ctx.services, [
                            requirement(ITEM.chemicalCompound, 1, "Chemical compound"),
                        ])
                    )
                        return;
                    if (
                        !giveItem(
                            ctx.player,
                            ctx.services,
                            ITEM.ancientTalisman,
                            1,
                            "ancient talisman",
                        )
                    )
                        return;
                    setQuestStage(ctx.player, quest, ctx.services, 8);
                }),
            ]);
            return;
        }
        talk(event, "Terry Balando", [
            sayNpc(
                stage >= 8
                    ? "Take the ancient talisman to Curator Haig Halen in Varrock."
                    : "Archaeology rewards patience and careful study.",
            ),
        ]);
    });

    registerTalk(registry, NPC.curator, (event) => {
        if (getQuestStage(event.player, quest) !== 8) {
            talk(event, "Curator Haig Halen", [
                sayNpc("The Varrock Museum is always interested in important finds."),
            ]);
            return;
        }
        talk(event, "Curator Haig Halen", [
            sayNpc(
                "An ancient Zarosian talisman! This is one of the Dig Site's greatest discoveries.",
            ),
            run((ctx) => {
                if (
                    !takeQuestItems(ctx.player, ctx.services, [
                        requirement(ITEM.ancientTalisman, 1, "Ancient talisman"),
                    ])
                )
                    return;
                finishQuest(ctx.player, ctx.services, quest);
            }),
        ]);
    });
}
