import type { PlayerState } from "../../../../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage, isQuestComplete, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    finishQuest,
    gameMessage,
    giveItem,
    hasItem,
    registerTalk,
    requirement,
    talk,
} from "../desertTreasureSeries/helpers";
import { ITEM, LOC, NPC } from "./constants";

export function registerWaterfallQuestInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    registerTalk(registry, NPC.almera, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            talk(event, "Almera", [
                sayNpc(
                    "My son Hudon went searching for treasure near the waterfall. Please make sure he is safe.",
                ),
                choose([
                    option("I'll look for him.", [
                        run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 1)),
                    ]),
                    option("I don't like waterfalls."),
                ]),
            ]);
            return;
        }
        talk(event, "Almera", [
            sayNpc(
                isQuestComplete(event.player, quest)
                    ? "You uncovered Baxtorian's secret and Hudon is safe."
                    : "Hudon is somewhere near the waterfall.",
            ),
        ]);
    });

    registerTalk(registry, NPC.hudon, (event) => {
        if (getQuestStage(event.player, quest) === 1) {
            talk(event, "Hudon", [
                sayNpc(
                    "I'm fine! The real treasure is hidden in Baxtorian's halls. Hadley knows the legends.",
                ),
                run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 2)),
            ]);
            return;
        }
        talk(event, "Hudon", [sayNpc("There has to be a way inside the waterfall.")]);
    });

    registerTalk(registry, NPC.hadley, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage >= 2 && stage < 3) {
            talk(event, "Hadley", [
                sayNpc(
                    "Read this book about King Baxtorian and Queen Glarial. Their tombs hold the key.",
                ),
                run((ctx) => {
                    if (
                        !giveItem(
                            ctx.player,
                            ctx.services,
                            ITEM.bookOnBaxtorian,
                            1,
                            "Book on Baxtorian",
                        )
                    )
                        return;
                    setQuestStage(ctx.player, quest, ctx.services, 3);
                }),
            ]);
            return;
        }
        talk(event, "Hadley", [
            sayNpc("The waterfall has guarded the elven king's secrets for centuries."),
        ]);
    });

    registerTalk(registry, NPC.golrie, (event) => {
        if (
            getQuestStage(event.player, quest) !== 3 ||
            !hasItem(event.player, services, ITEM.bookOnBaxtorian)
        ) {
            talk(event, "Golrie", [sayNpc("Glarial's tomb is sealed by an old elven pebble.")]);
            return;
        }
        talk(event, "Golrie", [
            sayNpc("This pebble opens Glarial's tomb. You will find her amulet and urn inside."),
            run((ctx) => {
                if (!giveItem(ctx.player, ctx.services, ITEM.glarialsPebble, 1, "Glarial's pebble"))
                    return;
                setQuestStage(ctx.player, quest, ctx.services, 4);
            }),
        ]);
    });

    registry.registerItemOnLoc(ITEM.glarialsPebble, LOC.tombstone, (event) => {
        if (getQuestStage(event.player, quest) !== 4) return;
        if (
            !takeQuestItems(event.player, services, [
                requirement(ITEM.glarialsPebble, 1, "Glarial's pebble"),
            ])
        )
            return;
        if (!giveItem(event.player, services, ITEM.glarialsAmulet, 1, "Glarial's amulet")) return;
        if (!giveItem(event.player, services, ITEM.glarialsUrnFull, 1, "Glarial's urn")) return;
        setQuestStage(event.player, quest, services, 5);
        gameMessage(
            event.player,
            services,
            "The pebble unlocks Glarial's tomb; you recover her amulet and urn.",
        );
    });

    const placeRelics = (event: { player: PlayerState }) => {
        if (getQuestStage(event.player, quest) !== 5) return;
        const relics = [
            requirement(ITEM.glarialsAmulet, 1, "Glarial's amulet"),
            requirement(ITEM.glarialsUrnFull, 1, "Glarial's urn"),
        ];
        if (!takeQuestItems(event.player, services, relics)) {
            gameMessage(event.player, services, "You need Glarial's amulet and urn.");
            return;
        }
        setQuestStage(event.player, quest, services, 8);
        gameMessage(
            event.player,
            services,
            "You place Glarial's relics before Baxtorian's statue.",
        );
    };
    registry.registerLocScript({
        locId: LOC.statue,
        action: undefined,
        handler: placeRelics,
    });
    registry.registerLocScript({ locId: LOC.statue, action: "search", handler: placeRelics });
    registry.registerItemOnLoc(ITEM.glarialsAmulet, LOC.statue, placeRelics);
    registry.registerItemOnLoc(ITEM.glarialsUrnFull, LOC.statue, placeRelics);

    const takeChalice = (event: { player: PlayerState }) => {
        if (getQuestStage(event.player, quest) !== 8) return;
        const runes = [
            requirement(ITEM.airRune, 6, "6 air runes"),
            requirement(ITEM.waterRune, 6, "6 water runes"),
            requirement(ITEM.earthRune, 6, "6 earth runes"),
        ];
        if (!takeQuestItems(event.player, services, runes)) {
            gameMessage(
                event.player,
                services,
                "The spell requires 6 air, 6 water, and 6 earth runes.",
            );
            return;
        }
        finishQuest(event.player, services, quest);
    };
    registry.registerLocScript({
        locId: LOC.chalice,
        action: undefined,
        handler: takeChalice,
    });
    registry.registerLocScript({
        locId: LOC.chalice,
        action: "take treasure",
        handler: takeChalice,
    });
}
