import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage, setQuestStage, takeQuestItems } from "../../QuestService";
import { run, sayNpc } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { gameMessage, registerTalk, requirement, talk } from "../desertTreasureSeries/helpers";
import { ITEM, NPC } from "./constants";

export function registerTrollStrongholdInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registerTalk(registry, NPC.godric, (event) => {
        if (getQuestStage(event.player, quest) < 40) {
            talk(event, "Godric", [sayNpc("Please find the keys and get me out of here!")]);
            return;
        }
        const keys = [
            requirement(ITEM.prisonKey, 1, "Prison key"),
            requirement(ITEM.cellKey1, 1, "Cell key 1"),
            requirement(ITEM.cellKey2, 1, "Cell key 2"),
        ];
        talk(event, "Godric", [
            sayNpc("You found every key! Let us get out before the trolls return."),
            run((ctx) => {
                if (!takeQuestItems(ctx.player, ctx.services, keys)) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "You need the prison key and both cell keys.",
                    );
                    return;
                }
                setQuestStage(ctx.player, quest, ctx.services, 45);
            }),
        ]);
    });

    registerTalk(registry, NPC.eadgar, (event) => {
        talk(event, "Eadgar", [
            sayNpc(
                getQuestStage(event.player, quest) >= 20
                    ? "The stronghold entrance lies beyond Dad's arena."
                    : "Dad blocks the only path into the stronghold.",
            ),
        ]);
    });
}
