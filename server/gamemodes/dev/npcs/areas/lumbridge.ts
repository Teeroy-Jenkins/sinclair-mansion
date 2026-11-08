import type { IScriptRegistry } from "../../../../src/game/scripts/types";
import type { DialogueStep } from "../../quests/dialogue";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
} from "../dialogue";
import {
    registerNpcOptions,
    registerTalkTo,
    requestTradeOpen,
    startNpcConversation,
} from "../helpers";
import { registerShopTalkMany, type ShopTalkDefinition } from "../shopTalk";

const STANDARD_GENERAL_STORE: Omit<ShopTalkDefinition, "npcIds"> = {
    greeting: ["Can I help you at all?"],
    openShopOptions: ["Yes please. What are you selling?"],
    declineOption: "No thanks.",
};

function shopDefs(): ShopTalkDefinition[] {
    return [
        {
            npcIds: [2813, 2814],
            ...STANDARD_GENERAL_STORE,
        },
        {
            npcIds: [2815, 2816],
            ...STANDARD_GENERAL_STORE,
        },
        {
            npcIds: [2883],
            greeting: ["Welcome to Lowe's Archery Emporium. Do you want to see my wares?"],
            openShopOptions: ["Yes please!"],
            declineOption: "No, I prefer to bash things close up.",
            declineReply: ["Humph, philistine."],
        },
        {
            npcIds: [2882],
            greeting: ["Hello, do you need any help?"],
            openShopOptions: ["Do you want to trade?"],
            declineOption: "No thanks. I'm just looking around.",
            declineReply: ["Well, come and see me if you're ever in need of armour!"],
        },
        {
            npcIds: [534],
            greeting: ["Do you want to buy any fine clothes?"],
            openShopOptions: ["What have you got?", "I'd just like to buy some clothes."],
            declineOption: "No, thank you.",
            declineReply: ["Well, please return if you change your mind."],
        },
        {
            npcIds: [2884, 2885],
            greeting: ["Hello, bold adventurer! Can I interest you in some swords?"],
            openShopOptions: ["Yes please!"],
            declineOption: "No, I'm okay for swords right now.",
            declineReply: ["Come back if you need any."],
        },
    ];
}

function registerAsyff(registry: IScriptRegistry): void {
    registerTalkTo(registry, [2887], (event) => {
        startNpcConversation(event, [
            {
                npc: [
                    "Now you look like someone who goes to a lot of fancy dress parties.",
                ],
            },
            { player: ["Errr...what are you saying exactly?"] },
            {
                npc: [
                    "I'm just saying that perhaps you would like to peruse my selection of garments.",
                    "Or, if that doesn't interest you, then maybe you have something else to offer? I'm always on the look out for interesting or unusual new materials.",
                ],
            },
            {
                options: [
                    {
                        text: "Okay, let's see what you've got then.",
                        next: [
                            {
                                exec: () => {
                                    event.services.shopping?.openShop?.(event.player, {
                                        npcTypeId: 2887,
                                    });
                                },
                            },
                        ],
                    },
                    {
                        text: "I think I might just leave the perusing for now thanks.",
                    },
                ],
            },
        ]);
    });
    registerNpcOptions(registry, [2887], ["trade", "trade-with"], (event) => {
        const typeId = event.npc?.typeId;
        if (typeId == null) return;
        requestTradeOpen(event.player, event.services, typeId, event.tick);
    });
}

export function registerHans(registry: IScriptRegistry): void {
    registerTalkTo(registry, [3105], (event) => {
        startNpcConversation(event, [
            { npc: ["Hello. What are you doing here?"] },
            {
                options: [
                    {
                        text: "I'm looking for whoever is in charge of this place.",
                        next: [
                            {
                                npc: [
                                    "Who, the Duke? He's in his study, on the first floor.",
                                ],
                            },
                        ],
                    },
                    {
                        text: "I have come to kill everyone in this castle!",
                        next: [{ npc: ["Help! Help!"] }],
                    },
                    {
                        text: "I don't know. I'm lost. Where am I?",
                        next: [
                            {
                                npc: [
                                    "You are in Lumbridge Castle, in the Kingdom of Misthalin. Across the river, the road leads north to Varrock, and to the west lies Draynor Village.",
                                ],
                            },
                        ],
                    },
                    {
                        text: "Can you tell me how long I've been here?",
                        next: [
                            {
                                npc: [
                                    "Ahh, I see all the newcomers arriving in Lumbridge, fresh-faced and eager for adventure. I remember you...",
                                    "You've spent quite some time in the world since you arrived. Keep at it!",
                                ],
                            },
                        ],
                    },
                    { text: "Nothing." },
                ],
            },
        ]);
    });
}

function questAdviceSteps(): DialogueStep[] {
    return [
        { npc: ["What kind of quest are you looking for?"] },
        {
            options: [
                {
                    text: "I fancy a bit of a fight, anything dangerous?",
                    next: [
                        {
                            npc: [
                                "Hmm.. dangerous you say? What sort of creatures are you looking to fight?",
                            ],
                        },
                        {
                            options: [
                                {
                                    text: "Big scary demons!",
                                    next: [
                                        {
                                            npc: [
                                                "You are a brave soul indeed.",
                                                "Now that you mention it, I heard a rumour about a fortune-teller in Varrock who is rambling about some kind of greater evil.. sounds demon-like if you ask me.",
                                                "Perhaps you could check it out if you are as brave as you say?",
                                            ],
                                        },
                                    ],
                                },
                                {
                                    text: "Vampyres!",
                                    next: [
                                        {
                                            npc: [
                                                "Ha ha. A strange taste but each to their own.",
                                                "Speak to Morgan in Draynor Village; he has been having problems with a vampyre.",
                                            ],
                                        },
                                    ],
                                },
                                {
                                    text: "Small.. something small would be good.",
                                    next: [
                                        {
                                            npc: [
                                                "Small? Yes, that sounds good. I know of a goblin tribe that has been causing trouble near Goblin Village.",
                                                "You could also try the goblins just north of here across the river.",
                                            ],
                                        },
                                    ],
                                },
                                { text: "Maybe another time." },
                            ],
                        },
                    ],
                },
                {
                    text: "Something easy please, I'm new here.",
                    next: [
                        {
                            npc: [
                                "I always recommend people start with Cook's Assistant. Talk to the cook in the castle kitchen.",
                                "There's also a chap called Duke Horacio upstairs who has a strange tale about a lost talisman.",
                            ],
                        },
                    ],
                },
                {
                    text: "I'm a thinker rather than fighter; anything skill oriented?",
                    next: [
                        {
                            npc: [
                                "Yes, crafting and smithing tutors around Lumbridge can help you get started.",
                                "You could also visit the farming patches and fishing spots nearby.",
                            ],
                        },
                    ],
                },
                {
                    text: "I want to do all kinds of things, do you know anything like that?",
                    next: [
                        {
                            npc: [
                                "You should speak to the tutors around Lumbridge and keep an eye out for quest icons on your minimap.",
                            ],
                        },
                    ],
                },
                { text: "Maybe another time." },
            ],
        },
    ];
}

const BUY_STICK: DialogueStep[] = [
    { npc: ["It's not a stick! I'll have you know it's a very powerful staff!"] },
    { player: ["Really? Show me what it can do!"] },
    { npc: ["Um..It's a bit low on power at the moment.."] },
    { player: ["It's a stick isn't it?"] },
    {
        npc: [
            "...Ok it's a stick.. But only while I save up for a staff. Zaff in Varrock square sells them in his shop.",
        ],
    },
    { player: ["Well good luck with that."] },
];

export function registerDonieAndGee(registry: IScriptRegistry): void {
    registerTalkTo(registry, [921, 6816], (event) => {
        const menus: DialogueStep[][] = [
            [
                {
                    options: [
                        {
                            text: "What's up?",
                            next: [
                                { npc: ["I assume the sky is up.."] },
                                { player: ["You assume?"] },
                                {
                                    npc: [
                                        "Yeah, unfortunately I don't seem to be able to look up.",
                                    ],
                                },
                            ],
                        },
                        {
                            text: "Are there any quests I can do here?",
                            next: questAdviceSteps(),
                        },
                        { text: "Can I buy your stick?", next: BUY_STICK },
                    ],
                },
            ],
            [
                {
                    options: [
                        {
                            text: "Do you have anything of value which I can have?",
                            next: [
                                { npc: ["Are you asking for free stuff?"] },
                                { player: ["Well... er... yes."] },
                                {
                                    npc: [
                                        "No I do not have anything I can give you. If I did have anything of value I wouldn't want to give it away.",
                                    ],
                                },
                            ],
                        },
                        {
                            text: "Are there any quests I can do here?",
                            next: questAdviceSteps(),
                        },
                        { text: "Can I buy your stick?", next: BUY_STICK },
                    ],
                },
            ],
            [
                {
                    options: [
                        {
                            text: "Where am I?",
                            next: [
                                { npc: ["This is the town of Lumbridge my friend."] },
                            ],
                        },
                        {
                            text: "How are you today?",
                            next: [
                                {
                                    npc: [
                                        "Aye, not too bad thank you. Lovely weather in Gielinor this fine day.",
                                    ],
                                },
                                { player: ["Weather?"] },
                                {
                                    npc: [
                                        "Yes weather, you know.",
                                        "The state or condition of the atmosphere at a time and place, with respect to variables such as temperature, moisture, wind velocity, and barometric pressure.",
                                    ],
                                },
                                { player: ["..."] },
                                { npc: ["Not just a pretty face eh? Ha ha ha."] },
                            ],
                        },
                        {
                            text: "Are there any quests I can do here?",
                            next: questAdviceSteps(),
                        },
                        {
                            text: "Your shoe lace is untied.",
                            next: [
                                { npc: ["No it's not!"] },
                                { player: ["Yes it is!"] },
                                { npc: ["No it isn't!"] },
                                { player: ["Yes it is!"] },
                                { npc: ["No it isn't!!"] },
                                { player: ["Yes it is!!"] },
                                { npc: ["Ahem. Excuse me."] },
                            ],
                        },
                    ],
                },
            ],
        ];
        const pick = menus[Math.floor(Math.random() * menus.length)]!;
        startNpcConversation(event, [{ npc: ["Hello there, can I help you?"] }, ...pick]);
    });
}

const BEER = 1917;
const COINS = 995;

export function registerShearedRamBartender(registry: IScriptRegistry): void {
    registerTalkTo(registry, [7546], (event) => {
        const canPay = event.player.items.hasItem(COINS, 2);
        const beerNext: DialogueStep[] = canPay
            ? [
                  sayNpc("That'll be two coins please."),
                  run((ctx) => {
                      ctx.player.items.removeItem(COINS, 2, { assureFullRemoval: true });
                      ctx.player.items.addItem(BEER, 1);
                      ctx.services.messaging.sendGameMessage(ctx.player, "You buy a pint of beer.");
                  }),
              ]
            : [
                  sayNpc("That'll be two coins please."),
                  sayPlayer("Oh dear, I don't seem to have enough money."),
              ];

        startNpcConversation(event, [
            sayNpc("Welcome to the Sheared Ram. What can I do for you?"),
            choose([
                option("I'll have a beer please.", beerNext),
                option("Heard any rumours recently?", [
                    sayNpc(
                        "One of the patrons here is looking for treasure apparently. A chap by the name of Veos.",
                    ),
                ]),
                option("Nothing, I'm fine."),
            ]),
        ]);
    });
}

export function registerPrayerTutor(registry: IScriptRegistry): void {
    registerTalkTo(registry, [3223], (event) => {
        const noThanks: DialogueStep[] = [
            { npc: ["Very well. Saradomin be with you!"] },
        ];
        const training: DialogueStep[] = [
            {
                npc: [
                    "The most common way to train prayer is by either burying bones, or offering them to the gods at some kind of an altar.",
                    "Lots of adventurers build such altars in their own homes, or there are a few frequent places of worship around the world.",
                    "Different kinds of bones will help you to train faster. Generally speaking, the bigger they are and the more frightening a creature they come from, the better they are for it.",
                    "Is there anything else you would like to know?",
                ],
            },
            {
                options: [
                    {
                        text: "What is prayer useful for?",
                        next: usefulness(),
                    },
                    { text: "No, thank you.", next: noThanks },
                ],
            },
        ];
        function usefulness(): DialogueStep[] {
            return [
                {
                    npc: [
                        "The gods look kindly upon their devout followers. There are all kinds of benefits they may provide, if you pray for them!",
                        "They could help you in combat, help your wounds to heal more quickly, protect your belongings... There's a lot they can do for you!",
                        "You can find out more by looking in your prayer book.",
                        "You need to be careful that your prayers don't run out, though. You can get prayer potions to help you recharge, or you can pray at an altar whenever one's nearby.",
                        "Is there anything else you would like to know?",
                    ],
                },
                {
                    options: [
                        { text: "How can I train my prayer?", next: training },
                        { text: "No, thank you.", next: noThanks },
                    ],
                },
            ];
        }
        startNpcConversation(event, [
            { player: ["Good day, sister."] },
            {
                npc: [
                    `Greetings, ${event.player.name ?? "adventurer"}. Can I help you with anything, today?`,
                ],
            },
            {
                options: [
                    { text: "How can I train my prayer?", next: training },
                    { text: "What is prayer useful for?", next: usefulness() },
                    { text: "No, thank you.", next: noThanks },
                ],
            },
        ]);
    });
}

export function registerWoodsmanTutor(registry: IScriptRegistry): void {
    registerTalkTo(registry, [3226], (event) => {
        startNpcConversation(event, [
            {
                options: [
                    {
                        text: "Can you teach me the basics of Woodcutting and Firemaking, please?",
                        next: [
                            {
                                npc: [
                                    "Of course. Look for tree icons on your minimap to find areas of trees.",
                                    "When you see a likely looking tree, simply click on it to chop it down.",
                                    "When you have a full inventory of logs, you can bank them on the roof of Lumbridge Castle, or burn them with a tinderbox.",
                                    "Click on your tinderbox, then click on one of the logs in your inventory to attempt to light a fire.",
                                ],
                            },
                        ],
                    },
                    {
                        text: "What is that cape you're wearing?",
                        next: [
                            {
                                npc: [
                                    "It's a skillcape for Woodcutting, awarded to those who've mastered the skill. I'm proud to wear it.",
                                ],
                            },
                        ],
                    },
                ],
            },
        ]);
    });
}

export function registerSmithingApprentice(registry: IScriptRegistry): void {
    registerTalkTo(registry, [3224], (event) => {
        startNpcConversation(event, [
            { player: ["Can you teach me the basics of smelting please?"] },
            {
                npc: [
                    "Look for a furnace icon on your minimap to find a place to smelt ores into metal.",
                    "You'll need to have mined some ore to smelt first. Go see the mining tutor to the south if you're not sure how to do this.",
                    "Click on the furnace to bring up a menu of metal bars you can try to make from your ore.",
                    "When you have a full inventory, take it to the bank on the roof of Lumbridge Castle.",
                    "If you have a hammer, you can smith bronze bars into equipment on the anvil outside.",
                ],
            },
        ]);
    });
}

export function registerBarfyBill(registry: IScriptRegistry): void {
    registerTalkTo(registry, [1326], (event) => {
        startNpcConversation(event, [
            {
                npc: [
                    "Oh, hello there. Looking for a canoe, are you?",
                    "I teach people how to make canoes so they can travel along the river.",
                    "You'll need a hatchet and some Woodcutting skill. Chop a canoe tree, shape it, then paddle away!",
                ],
            },
        ]);
    });
}

export function registerLumbridgeNpcHandlers(registry: IScriptRegistry): void {
    registerShopTalkMany(registry, shopDefs());
    registerAsyff(registry);
    registerHans(registry);
    registerDonieAndGee(registry);
    registerShearedRamBartender(registry);
    registerPrayerTutor(registry);
    registerWoodsmanTutor(registry);
    registerSmithingApprentice(registry);
    registerBarfyBill(registry);
}
