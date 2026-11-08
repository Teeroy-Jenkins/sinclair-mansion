/**
 * Port Sarim shop greeters (LostCity betty/brian/gerrant.rs2 — shop paths only).
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

const BETTY = 5905;
const BRIAN_AXES = 2892; // Battleaxe Bazaar — not Rimmington archery Brian 8694
const GERRANT = 2891;

function shopDefs(): ShopTalkDefinition[] {
    return [
        {
            npcIds: [GERRANT],
            greeting: [
                "Welcome! You can buy fishing equipment at my store.",
                "We'll also buy anything you catch off you.",
            ],
            openShopOptions: ["Let's see what you've got then."],
            declineOption: "Sorry, I'm not interested.",
        },
    ];
}

function registerBetty(registry: IScriptRegistry): void {
    registerTalkTo(registry, [BETTY], (event) => {
        startNpcConversation(event, [
            sayNpc("Welcome to the magic emporium."),
            choose([
                option(
                    "Can I see your wares?",
                    [
                        sayPlayer("Can I see your wares?"),
                        sayNpc("Yes."),
                        openShopFromEvent(event),
                    ],
                    { echo: false },
                ),
                option(
                    "Sorry I'm not into magic.",
                    [
                        sayPlayer("Sorry I'm not into magic."),
                        sayNpc("Send anyone my way who is."),
                    ],
                    { echo: false },
                ),
            ]),
        ]);
    });
}

function registerBrianAxes(registry: IScriptRegistry): void {
    registerTalkTo(registry, [BRIAN_AXES], (event) => {
        startNpcConversation(event, [
            choose([
                option(
                    "So, are you selling something?",
                    [
                        sayPlayer("So, are you selling something?"),
                        sayNpc("Yep, take a look at these great axes!"),
                        openShopFromEvent(event),
                    ],
                    { echo: false },
                ),
                option("'Ello.", [sayPlayer("'Ello."), sayNpc("'Ello!")], { echo: false }),
            ]),
        ]);
    });
}

export function registerPortSarimShopHandlers(registry: IScriptRegistry): void {
    registerShopTalkMany(registry, shopDefs());
    registerBetty(registry);
    registerBrianAxes(registry);
}
