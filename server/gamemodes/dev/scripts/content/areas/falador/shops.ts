/**
 * Falador shop greeters (LostCity cassie/flynn/herquin/wayne.rs2).
 */
import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import {
    choose,
    option,
    openShopFromEvent,
    sayNpc,
    sayPlayer,
} from "../../../../npcs/dialogue";
import { registerShopTalkMany, type ShopTalkDefinition } from "../../../../npcs/shopTalk";
import { registerTalkTo, startNpcConversation } from "../../../../npcs/helpers";

const CASSIE = 3214;
const FLYNN = 5896;
const HERQUIN = 6529;
const WAYNE = 5897;

function shopDefs(): ShopTalkDefinition[] {
    return [
        {
            npcIds: [FLYNN],
            greeting: "Hello. Do you want to buy or sell any maces?",
            openShopOptions: ["Well, I'll have a look, anyway."],
            declineOption: "No thanks.",
        },
        {
            npcIds: [WAYNE],
            greeting: [
                "Welcome to Wayne's Chains.",
                "Do you wanna buy or sell some chain mail?",
            ],
            openShopOptions: ["Yes please."],
            declineOption: "No thanks.",
        },
        {
            npcIds: [CASSIE],
            greeting: "I buy and sell shields, do you want to trade?",
            openShopOptions: ["Yes please."],
            declineOption: "No thank you.",
        },
    ];
}

function registerHerquin(registry: IScriptRegistry): void {
    registerTalkTo(registry, [HERQUIN], (event) => {
        startNpcConversation(event, [
            choose([
                option(
                    "Do you wish to trade?",
                    [
                        sayPlayer("Do you wish to trade?"),
                        sayNpc("Why yes this a jewel shop after all."),
                        openShopFromEvent(event),
                    ],
                    { echo: false },
                ),
                option("Sorry I don't want to talk to you actually.", [
                    sayPlayer("Sorry I don't want to talk to you actually."),
                ], { echo: false }),
            ]),
        ]);
    });
}

export function registerFaladorShopHandlers(registry: IScriptRegistry): void {
    registerShopTalkMany(registry, shopDefs());
    registerHerquin(registry);
}
