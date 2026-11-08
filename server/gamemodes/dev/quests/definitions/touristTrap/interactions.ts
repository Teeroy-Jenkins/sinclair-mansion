import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage, isQuestComplete, setQuestStage, takeQuestItems } from "../../QuestService";
import { type DialogueStep, choose, option, run, sayNpc, sayPlayer } from "../../dialogue";
import type { QuestDefinition } from "../../types";
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

export function registerTouristTrapInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const rewardSkills = [
        { skillId: 16, name: "Agility" },
        { skillId: 9, name: "Fletching" },
        { skillId: 13, name: "Smithing" },
        { skillId: 17, name: "Thieving" },
    ] as const;
    const buildRewardChoice = (firstSkillId?: number): DialogueStep =>
        choose(
            rewardSkills.map(({ skillId, name }) =>
                option(name, [
                    ...(firstSkillId === undefined ? [buildRewardChoice(skillId)] : []),
                    ...(firstSkillId !== undefined
                        ? [
                              sayNpc(`You choose ${name} for your second reward.`),
                              run((ctx) => {
                                  if (
                                      !takeQuestItems(ctx.player, ctx.services, [
                                          requirement(ITEM.anaInBarrel, 1, "Ana in a barrel"),
                                      ])
                                  )
                                      return;
                                  ctx.services.skills.addSkillXp(ctx.player, firstSkillId, 4650);
                                  ctx.services.skills.addSkillXp(ctx.player, skillId, 4650);
                                  finishQuest(ctx.player, ctx.services, quest);
                              }),
                          ]
                        : []),
                ]),
            ),
            firstSkillId === undefined
                ? "Choose your first XP reward"
                : "Choose your second XP reward",
        );

    registerTalk(registry, NPC.irena, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            const missing: string[] = [];
            if (skillLevel(event.player, services, 13) < 20) missing.push("20 Smithing");
            if (skillLevel(event.player, services, 9) < 10) missing.push("10 Fletching");
            if (missing.length > 0) {
                gameMessage(
                    event.player,
                    services,
                    `You need ${missing.join(" and ")} to begin The Tourist Trap.`,
                );
                return;
            }
            talk(event, "Irena", [
                sayNpc(
                    "My daughter Ana was taken by the guards of the desert mining camp. Please bring her home.",
                ),
                choose([
                    option("I'll rescue Ana.", [
                        run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 1)),
                    ]),
                    option("The desert is too dangerous."),
                ]),
            ]);
            return;
        }
        if (stage >= 25 && stage < quest.completionValue) {
            talk(event, "Irena", [
                sayPlayer("I have Ana safely hidden in this barrel."),
                sayNpc(
                    "Ana! You brought her back. Choose two lots of experience from my travels; you may choose the same skill twice.",
                ),
                buildRewardChoice(),
            ]);
            return;
        }
        talk(event, "Irena", [
            sayNpc(
                isQuestComplete(event.player, quest)
                    ? "Ana and I will never forget what you did."
                    : "Please find Ana in the desert mining camp.",
            ),
        ]);
    });

    registerTalk(registry, NPC.mercenaryCaptain, (event) => {
        if (getQuestStage(event.player, quest) !== 1) {
            talk(event, "Mercenary Captain", [
                sayNpc("No one enters the mining camp without permission."),
            ]);
            return;
        }
        talk(event, "Mercenary Captain", [
            sayNpc("That woman is a prisoner. If you want past me, you will have to fight."),
            sayPlayer("Then get ready."),
        ]);
    });

    registerTalk(registry, NPC.alShabim, (event) => {
        if (getQuestStage(event.player, quest) !== 10) {
            talk(event, "Al Shabim", [
                sayNpc("We trade with the mining camp, but its guards trust no outsider."),
            ]);
            return;
        }
        talk(event, "Al Shabim", [
            sayNpc(
                "Bring me three bronze bars and ten feathers. I can copy a guard's key and make you a slave disguise.",
            ),
            run((ctx) => {
                const supplies = [
                    requirement(ITEM.bronzeBar, 3, "3 bronze bars"),
                    requirement(ITEM.feather, 10, "10 feathers"),
                ];
                if (!takeQuestItems(ctx.player, ctx.services, supplies)) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "Al Shabim needs 3 bronze bars and 10 feathers.",
                    );
                    return;
                }
                const rewards: Array<[number, string]> = [
                    [ITEM.wroughtIronKey, "wrought iron key"],
                    [ITEM.slaveShirt, "slave shirt"],
                    [ITEM.slaveRobe, "slave robe"],
                    [ITEM.slaveBoots, "slave boots"],
                ];
                for (const [itemId, label] of rewards) {
                    if (!giveItem(ctx.player, ctx.services, itemId, 1, label)) return;
                }
                setQuestStage(ctx.player, quest, ctx.services, 20);
            }),
        ]);
    });

    registerTalk(registry, NPC.captainSiad, (event) => {
        if (getQuestStage(event.player, quest) !== 20) {
            talk(event, "Captain Siad", [
                sayNpc("I run this camp. Slaves return to work at once."),
            ]);
            return;
        }
        const disguise = [ITEM.slaveShirt, ITEM.slaveRobe, ITEM.slaveBoots].every((itemId) =>
            hasItem(event.player, services, itemId),
        );
        if (!disguise || !hasItem(event.player, services, ITEM.wroughtIronKey)) {
            gameMessage(
                event.player,
                services,
                "You need the slave disguise and wrought iron key.",
            );
            return;
        }
        talk(event, "Captain Siad", [
            sayNpc(
                "You look familiar... no matter. Take this work detail into the underground mine.",
            ),
            run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 22)),
        ]);
    });

    registerTalk(registry, NPC.ana, (event) => {
        if (getQuestStage(event.player, quest) !== 22) {
            talk(event, "Ana", [sayNpc("Please don't let the guards see you talking to me.")]);
            return;
        }
        talk(event, "Ana", [
            sayPlayer("Your mother sent me. I'll hide you in this barrel and smuggle you out."),
            sayNpc("A barrel? It beats another day in this mine."),
            run((ctx) => {
                if (
                    !giveItem(
                        ctx.player,
                        ctx.services,
                        ITEM.anaInBarrel,
                        1,
                        "barrel containing Ana",
                    )
                )
                    return;
                setQuestStage(ctx.player, quest, ctx.services, 25);
            }),
        ]);
    });
}
