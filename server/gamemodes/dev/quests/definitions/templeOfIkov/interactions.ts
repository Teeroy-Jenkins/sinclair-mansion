import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage, isQuestComplete, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    finishQuest,
    gameMessage,
    giveItem,
    registerTalk,
    requirement,
    skillLevel,
    talk,
} from "../desertTreasureSeries/helpers";
import { isBossActive, spawnBoss } from "../desertTreasureSeries/runtime";
import { BOSS_NPC, ITEM, NPC } from "./constants";

export function registerTempleOfIkovInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerTalk(registry, NPC.lucien, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            if (skillLevel(event.player, services, 17) < 42) {
                gameMessage(
                    event.player,
                    services,
                    "You need 42 Thieving to begin Temple of Ikov.",
                );
                return;
            }
            talk(event, "Lucien", [
                sayNpc(
                    "Deep beneath the Temple of Ikov lies the Staff of Armadyl. Recover it for me.",
                ),
                choose([
                    option("I'll find the staff.", [
                        run((ctx) => {
                            if (
                                !giveItem(
                                    ctx.player,
                                    ctx.services,
                                    ITEM.pendantOfLucien,
                                    1,
                                    "pendant",
                                )
                            )
                                return;
                            setQuestStage(ctx.player, quest, ctx.services, 10);
                        }),
                    ]),
                    option("No, I don't trust you."),
                ]),
            ]);
            return;
        }
        if (stage >= 70 && stage < quest.completionValue) {
            talk(event, "Lucien", [
                sayNpc("You have the Staff of Armadyl. Give it to me and your task is complete."),
                choose([
                    option("Give Lucien the staff.", [
                        run((ctx) => {
                            if (
                                !takeQuestItems(ctx.player, ctx.services, [
                                    requirement(ITEM.staffOfArmadyl, 1, "Staff of Armadyl"),
                                ])
                            )
                                return;
                            finishQuest(ctx.player, ctx.services, quest);
                        }),
                    ]),
                    option("Keep the staff and side with the Guardians.", [
                        sayNpc("Then you have made an enemy of Lucien."),
                        run((ctx) => finishQuest(ctx.player, ctx.services, quest)),
                    ]),
                ]),
            ]);
            return;
        }
        talk(event, "Lucien", [
            sayNpc(
                isQuestComplete(event.player, quest)
                    ? "Our business is concluded."
                    : "The Staff of Armadyl is still beneath the temple.",
            ),
        ]);
    });

    registerTalk(registry, NPC.winelda, (event) => {
        if (getQuestStage(event.player, quest) !== 10) {
            talk(event, "Winelda", [
                sayNpc("I know passages through the Temple of Ikov, for a price."),
            ]);
            return;
        }
        talk(event, "Winelda", [
            sayNpc("Bring me twenty limpwurt roots and I will take you past the lava."),
            run((ctx) => {
                if (isBossActive(ctx.player, "fire-warrior")) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "The Fire Warrior is already waiting beyond the lava.",
                    );
                    return;
                }
                if (
                    !takeQuestItems(ctx.player, ctx.services, [
                        requirement(ITEM.limpwurtRoot, 20, "20 limpwurt roots"),
                    ])
                ) {
                    gameMessage(ctx.player, ctx.services, "Winelda needs 20 limpwurt roots.");
                    return;
                }
                if (
                    !spawnBoss(ctx.player, ctx.services, "fire-warrior", {
                        id: BOSS_NPC.fireWarrior,
                        name: "Fire Warrior of Lesarkus",
                        x: 2657,
                        y: 9877,
                        level: 0,
                    })
                )
                    return;
                setQuestStage(ctx.player, quest, ctx.services, 50);
                gameMessage(
                    ctx.player,
                    ctx.services,
                    "The Fire Warrior of Lesarkus waits beyond the lava passage.",
                );
            }),
        ]);
    });

    registerTalk(registry, NPC.guardiansOfArmadyl, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < 60) {
            talk(event, "Guardian of Armadyl", [
                sayNpc("Only one who has defeated Lesarkus may approach the sacred staff."),
            ]);
            return;
        }
        if (stage < 70) {
            talk(event, "Guardian of Armadyl", [
                sayNpc(
                    "Lucien seeks the staff for evil. Wear Armadyl's pendant and take the staff, then choose your allegiance.",
                ),
                run((ctx) => {
                    if (
                        !giveItem(
                            ctx.player,
                            ctx.services,
                            ITEM.armadylPendant,
                            1,
                            "Armadyl pendant",
                        )
                    )
                        return;
                    if (
                        !giveItem(
                            ctx.player,
                            ctx.services,
                            ITEM.staffOfArmadyl,
                            1,
                            "Staff of Armadyl",
                        )
                    )
                        return;
                    setQuestStage(ctx.player, quest, ctx.services, 70);
                }),
            ]);
            return;
        }
        talk(event, "Guardian of Armadyl", [sayNpc("Do not allow Lucien to wield the staff.")]);
    });
}
