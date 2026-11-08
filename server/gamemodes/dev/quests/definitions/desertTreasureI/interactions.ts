import type { PlayerState } from "../../../../../src/game/player";
import type { IScriptRegistry, ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestDefinitionByKey } from "../../QuestRegistry";
import { getQuestStage, isQuestComplete, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    allPrerequisitesComplete,
    finishQuest,
    gameMessage,
    giveItem,
    hasItem,
    registerTalk,
    requirement,
    sendMissingDesertTreasureRequirements,
    skillLevel,
    talk,
} from "../desertTreasureSeries/helpers";
import { isBossActive, spawnBoss } from "../desertTreasureSeries/runtime";
import {
    BOSS_NPC,
    DT_DIRECT_PREREQUISITES,
    EBLIS_SUPPLIES,
    ITEM,
    LOC,
    NPC,
    QUEST_KEYS,
    VARP_DESERT_TREASURE_DIAMONDS,
} from "./constants";

function getPrerequisiteQuests(): Record<string, QuestDefinition> | undefined {
    const quests: Record<string, QuestDefinition> = {};
    for (const key of DT_DIRECT_PREREQUISITES) {
        const quest = getQuestDefinitionByKey(key);
        if (!quest) return undefined;
        quests[key] = quest;
    }
    return quests;
}

export function registerDesertTreasureIInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    services.npc.spawnNpc({
        id: NPC.asgarniaSmith[0],
        name: "Asgarnia Smith",
        x: 3177,
        y: 3043,
        level: 0,
        wanderRadius: 2,
    });

    registerTalk(registry, NPC.asgarniaSmith, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            const prerequisites = getPrerequisiteQuests();
            if (
                !prerequisites ||
                !allPrerequisitesComplete(event.player, prerequisites) ||
                skillLevel(event.player, services, 6) < 50
            ) {
                if (prerequisites) {
                    sendMissingDesertTreasureRequirements(event.player, services, prerequisites);
                } else {
                    gameMessage(
                        event.player,
                        services,
                        "The Desert Treasure prerequisite definitions are unavailable.",
                    );
                }
                return;
            }
            talk(event, "Asgarnia Smith", [
                sayNpc(
                    "I found these strange etchings while excavating near the Bedabin Camp. Terry Balando may translate them.",
                ),
                choose([
                    option("I'll investigate the etchings.", [
                        run((ctx) => {
                            if (!giveItem(ctx.player, ctx.services, ITEM.etchings, 1, "etchings"))
                                return;
                            setQuestStage(ctx.player, quest, ctx.services, 1);
                        }),
                    ]),
                    option("I have enough treasure already."),
                ]),
            ]);
            return;
        }
        if (stage === 4) {
            talk(event, "Asgarnia Smith", [
                sayNpc(
                    "Terry's translation names a forgotten Zarosian called Azzanadra. The Bandit Camp worships the old god.",
                ),
                run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 6)),
            ]);
            return;
        }
        talk(event, "Asgarnia Smith", [
            sayNpc(
                isQuestComplete(event.player, quest)
                    ? "You actually opened the pyramid. What an archaeological discovery!"
                    : "Follow the translation and learn what the Zarosian bandits know.",
            ),
        ]);
    });

    registerTalk(registry, NPC.bartender, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < 6 || stage >= 8) {
            talk(event, "Bartender", [
                sayNpc("Bandit's brew: six hundred and fifty coins a glass."),
            ]);
            return;
        }
        if (!hasItem(event.player, services, ITEM.banditsBrew)) {
            talk(event, "Bartender", [
                sayNpc(
                    "Buy a Bandit's brew for 650 coins. Outsiders loosen their tongues after one.",
                ),
                choose([
                    option("Buy a Bandit's brew.", [
                        run((ctx) => {
                            if (
                                !takeQuestItems(ctx.player, ctx.services, [
                                    requirement(ITEM.coins, 650, "650 coins"),
                                ])
                            ) {
                                gameMessage(ctx.player, ctx.services, "You need 650 coins.");
                                return;
                            }
                            giveItem(
                                ctx.player,
                                ctx.services,
                                ITEM.banditsBrew,
                                1,
                                "Bandit's brew",
                            );
                        }),
                    ]),
                    option("No thanks."),
                ]),
            ]);
            return;
        }
        talk(event, "Bartender", [
            sayPlayer("Tell me about Azzanadra and the desert pyramid."),
            sayNpc("Careful with that name. Eblis, east of camp, keeps the old Zarosian rites."),
            run((ctx) => {
                if (
                    !takeQuestItems(ctx.player, ctx.services, [
                        requirement(ITEM.banditsBrew, 1, "Bandit's brew"),
                    ])
                )
                    return;
                setQuestStage(ctx.player, quest, ctx.services, 8);
            }),
        ]);
    });

    registerTalk(registry, NPC.eblis, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (isQuestComplete(event.player, quest)) {
            talk(event, "Eblis", [
                sayNpc(
                    "For 80,000 coins I can sell you one Ancient staff, an instrument suited to Ancient Magicks.",
                ),
                choose([
                    option("Buy an Ancient staff.", [
                        run((ctx) => {
                            if (
                                !takeQuestItems(ctx.player, ctx.services, [
                                    requirement(ITEM.coins, 80000, "80,000 coins"),
                                ])
                            ) {
                                gameMessage(ctx.player, ctx.services, "You need 80,000 coins.");
                                return;
                            }
                            giveItem(
                                ctx.player,
                                ctx.services,
                                ITEM.ancientStaff,
                                1,
                                "Ancient staff",
                            );
                        }),
                    ]),
                    option("No thanks."),
                ]),
            ]);
            return;
        }
        if (stage === 8) {
            talk(event, "Eblis", [
                sayNpc(
                    "Four diamonds seal Azzanadra's pyramid. Bring materials and I will make mirrors to locate their guardians.",
                ),
                run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 9)),
            ]);
            return;
        }
        if (stage === 9) {
            talk(event, "Eblis", [
                sayNpc([
                    "I need ashes, a blood rune, bones, charcoal, six molten glass,",
                    "twelve magic logs, and six steel bars.",
                ]),
                run((ctx) => {
                    if (!takeQuestItems(ctx.player, ctx.services, EBLIS_SUPPLIES)) {
                        gameMessage(
                            ctx.player,
                            ctx.services,
                            "You have not brought every material for Eblis's mirrors.",
                        );
                        return;
                    }
                    setQuestStage(ctx.player, quest, ctx.services, 10);
                }),
            ]);
            return;
        }
        if (stage === 10) {
            talk(event, "Eblis", [
                sayNpc([
                    "The mirrors show four guardians: Dessous of blood, Kamil of ice,",
                    "Fareed of smoke, and Damis of shadow. Defeat them and place their diamonds in the pyramid obelisks.",
                ]),
                run((ctx) => setQuestStage(ctx.player, quest, ctx.services, 11)),
            ]);
            return;
        }
        talk(event, "Eblis", [
            sayNpc(
                stage >= 11
                    ? "Recover the four diamonds, then place each into its matching obelisk."
                    : "The old gods are not discussed with strangers.",
            ),
        ]);
    });

    const searchBanditChest = (event: { player: PlayerState }) => {
        if (
            getQuestStage(event.player, quest) < 11 ||
            hasItem(event.player, services, ITEM.gildedCross)
        )
            return;
        if (
            skillLevel(event.player, services, 17) < 53 ||
            !hasItem(event.player, services, ITEM.lockpick)
        ) {
            gameMessage(
                event.player,
                services,
                "You need 53 Thieving and a lockpick to open this secure chest.",
            );
            return;
        }
        giveItem(event.player, services, ITEM.gildedCross, 1, "gilded cross");
        gameMessage(event.player, services, "You pick the lock and find a gilded cross.");
    };
    registry.registerLocScript({
        locId: LOC.banditChest,
        action: undefined,
        handler: searchBanditChest,
    });
    registry.registerLocScript({
        locId: LOC.banditChest,
        action: "open",
        handler: searchBanditChest,
    });

    registerTalk(registry, NPC.rasolo, (event) => {
        if (getQuestStage(event.player, quest) < 11) {
            talk(event, "Rasolo", [sayNpc("I trade curious things to curious travellers.")]);
            return;
        }
        if (hasItem(event.player, services, ITEM.shadowDiamond)) {
            talk(event, "Rasolo", [
                sayNpc("Damis has fallen. Keep the ring; it reveals things hidden in shadow."),
            ]);
            return;
        }
        if (!hasItem(event.player, services, ITEM.gildedCross)) {
            talk(event, "Rasolo", [
                sayNpc(
                    "A gilded cross was stolen from me and hidden in a secure Bandit Camp chest. Return it and I will help you find Damis.",
                ),
            ]);
            return;
        }
        talk(event, "Rasolo", [
            sayNpc(
                "My cross! Take this Ring of Visibility. Damis waits in the Shadow Dungeon beneath the old village.",
            ),
            run((ctx) => {
                if (
                    !takeQuestItems(ctx.player, ctx.services, [
                        requirement(ITEM.gildedCross, 1, "Gilded cross"),
                    ])
                )
                    return;
                if (
                    !hasItem(ctx.player, ctx.services, ITEM.ringOfVisibility) &&
                    !giveItem(
                        ctx.player,
                        ctx.services,
                        ITEM.ringOfVisibility,
                        1,
                        "Ring of Visibility",
                    )
                )
                    return;
                spawnBoss(ctx.player, ctx.services, "damis-1", {
                    id: BOSS_NPC.damisFirst,
                    name: "Damis",
                    x: 2739,
                    y: 5091,
                    level: 0,
                });
            }),
        ]);
    });

    registerTalk(registry, NPC.ruantun, (event) => {
        if (
            getQuestStage(event.player, quest) < 11 ||
            hasItem(event.player, services, ITEM.bloodDiamond)
        ) {
            talk(event, "Ruantun", [
                sayNpc("Silver is a fine metal for vessels intended to hold blood."),
            ]);
            return;
        }
        if (
            hasItem(event.player, services, ITEM.blessedPot) ||
            hasItem(event.player, services, ITEM.silverPot)
        ) {
            talk(event, "Ruantun", [
                sayNpc("Have the High Priest bless the pot, then return to Malak."),
            ]);
            return;
        }
        talk(event, "Ruantun", [
            sayNpc("Bring me a silver bar and I will craft the vessel Malak described."),
            run((ctx) => {
                if (
                    !takeQuestItems(ctx.player, ctx.services, [
                        requirement(ITEM.silverBar, 1, "Silver bar"),
                    ])
                ) {
                    gameMessage(ctx.player, ctx.services, "Ruantun needs one silver bar.");
                    return;
                }
                giveItem(ctx.player, ctx.services, ITEM.silverPot, 1, "silver pot");
            }),
        ]);
    });

    registerTalk(registry, NPC.highPriest, (event) => {
        if (!hasItem(event.player, services, ITEM.silverPot)) {
            talk(event, "High Priest", [
                sayNpc("Bring me a silver pot and I will consecrate it against vampyric evil."),
            ]);
            return;
        }
        talk(event, "High Priest", [
            sayNpc("I will bless this pot. Fill it as Malak instructed before facing Dessous."),
            run((ctx) => {
                if (
                    !takeQuestItems(ctx.player, ctx.services, [
                        requirement(ITEM.silverPot, 1, "Silver pot"),
                    ])
                )
                    return;
                giveItem(ctx.player, ctx.services, ITEM.blessedPot, 1, "blessed pot");
            }),
        ]);
    });

    const grindGarlic = (event: {
        player: PlayerState;
        source: { slot: number; itemId: number };
        target: { slot: number; itemId: number };
    }) => {
        if (getQuestStage(event.player, quest) < 11) return;
        const garlicSlot =
            event.source.itemId === ITEM.garlic ? event.source.slot : event.target.slot;
        if (!services.inventory.consumeItem(event.player, garlicSlot)) return;
        services.inventory.snapshotInventory(event.player);
        if (giveItem(event.player, services, ITEM.garlicPowder, 1, "garlic powder")) {
            gameMessage(event.player, services, "You grind the garlic into a fine powder.");
        }
    };
    registry.registerItemOnItem(ITEM.garlic, ITEM.pestleAndMortar, grindGarlic);
    registry.registerItemOnItem(ITEM.pestleAndMortar, ITEM.garlic, grindGarlic);

    registerTalk(registry, NPC.malak, (event) => {
        if (getQuestStage(event.player, quest) < 11) {
            talk(event, "Malak", [sayNpc("Canifis is no place for the living after dark.")]);
            return;
        }
        if (hasItem(event.player, services, ITEM.bloodDiamond)) {
            talk(event, "Malak", [sayNpc("Dessous is destroyed and the blood diamond is yours.")]);
            return;
        }
        const supplies = [
            requirement(ITEM.blessedPot, 1, "Blessed pot"),
            requirement(ITEM.garlicPowder, 1, "Garlic powder"),
            requirement(ITEM.spice, 1, "Spice"),
        ];
        talk(event, "Malak", [
            sayNpc(
                "Prepare a blessed silver pot with garlic powder and spice. Then Dessous can be made vulnerable.",
            ),
            run((ctx) => {
                if (isBossActive(ctx.player, "dessous")) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "Dessous is already waiting at the graveyard.",
                    );
                    return;
                }
                if (!takeQuestItems(ctx.player, ctx.services, supplies)) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "Malak needs a blessed pot, garlic powder, and spice.",
                    );
                    return;
                }
                spawnBoss(ctx.player, ctx.services, "dessous", {
                    id: BOSS_NPC.dessous,
                    name: "Dessous",
                    x: 3570,
                    y: 3403,
                    level: 0,
                });
            }),
        ]);
    });

    registerTalk(registry, NPC.trollChild, (event) => {
        if (getQuestStage(event.player, quest) < 11) {
            talk(event, "Troll child", [sayNpc("Mummy and daddy are frozen!")]);
            return;
        }
        if (hasItem(event.player, services, ITEM.iceDiamond)) {
            talk(event, "Troll child", [sayNpc("You beat the bad ice man. Thank you!")]);
            return;
        }
        const firemaking = services.skills.getSkill(event.player, 11);
        if (firemaking.baseLevel + firemaking.boost < 50) {
            gameMessage(
                event.player,
                services,
                "You need an effective Firemaking level of 50 for the ice path.",
            );
            return;
        }
        if (
            !hasItem(event.player, services, ITEM.cake) ||
            !hasItem(event.player, services, ITEM.spikedBoots)
        ) {
            gameMessage(
                event.player,
                services,
                "Bring the troll child a cake and wear or carry spiked boots.",
            );
            return;
        }
        talk(event, "Troll child", [
            sayNpc(
                "Cake! Kamil froze my parents further up the mountain. Your spiked boots can cross the ice.",
            ),
            run((ctx) => {
                if (isBossActive(ctx.player, "kamil")) {
                    gameMessage(
                        ctx.player,
                        ctx.services,
                        "Kamil is already waiting on the ice path.",
                    );
                    return;
                }
                if (!takeQuestItems(ctx.player, ctx.services, [requirement(ITEM.cake, 1, "Cake")]))
                    return;
                spawnBoss(ctx.player, ctx.services, "kamil", {
                    id: BOSS_NPC.kamil,
                    name: "Kamil",
                    x: 2868,
                    y: 3721,
                    level: 0,
                });
            }),
        ]);
    });

    LOC.smokeTorches.forEach((locId, index) => {
        const lightTorch = (event: { player: PlayerState }) => {
            if (getQuestStage(event.player, quest) < 11) return;
            const firemaking = services.skills.getSkill(event.player, 11);
            const protectedFromSmoke =
                skillLevel(event.player, services, 18) >= 10 ||
                hasItem(event.player, services, ITEM.facemask);
            if (
                firemaking.baseLevel + firemaking.boost < 50 ||
                !hasItem(event.player, services, ITEM.tinderbox)
            ) {
                gameMessage(
                    event.player,
                    services,
                    "You need 50 Firemaking and a tinderbox to light the torch.",
                );
                return;
            }
            if (!protectedFromSmoke) {
                gameMessage(
                    event.player,
                    services,
                    "You need 10 Slayer or a facemask to survive the smoke.",
                );
                return;
            }
            const mask =
                event.player.varps.getVarpValue(VARP_DESERT_TREASURE_DIAMONDS) | (1 << (index + 4));
            event.player.varps.setVarpValue(VARP_DESERT_TREASURE_DIAMONDS, mask);
            services.variables.sendVarp(event.player, VARP_DESERT_TREASURE_DIAMONDS, mask);
            gameMessage(event.player, services, "You light one of the four smoke-dungeon torches.");
        };
        registry.registerLocScript({ locId, action: undefined, handler: lightTorch });
        registry.registerLocScript({ locId, action: "light", handler: lightTorch });
        registry.registerItemOnLoc(ITEM.tinderbox, locId, lightTorch);
    });

    const searchSmokeChest = (event: { player: PlayerState }) => {
        if (
            getQuestStage(event.player, quest) < 11 ||
            hasItem(event.player, services, ITEM.smokeDiamond)
        )
            return;
        const mask = event.player.varps.getVarpValue(VARP_DESERT_TREASURE_DIAMONDS);
        if ((mask & 0xf0) !== 0xf0) {
            gameMessage(
                event.player,
                services,
                "All four torches must be burning before the chest will open.",
            );
            return;
        }
        if (!hasItem(event.player, services, ITEM.warmKey)) {
            giveItem(event.player, services, ITEM.warmKey, 1, "warm key");
        }
    };
    registry.registerLocScript({
        locId: LOC.smokeChest,
        action: undefined,
        handler: searchSmokeChest,
    });
    registry.registerLocScript({
        locId: LOC.smokeChest,
        action: "open",
        handler: searchSmokeChest,
    });

    registry.registerItemOnLoc(ITEM.warmKey, LOC.fareedGate, (event) => {
        if (
            getQuestStage(event.player, quest) < 11 ||
            hasItem(event.player, services, ITEM.smokeDiamond)
        )
            return;
        if (!takeQuestItems(event.player, services, [requirement(ITEM.warmKey, 1, "Warm key")]))
            return;
        spawnBoss(event.player, services, "fareed", {
            id: BOSS_NPC.fareed,
            name: "Fareed",
            x: 3315,
            y: 9376,
            level: 0,
        });
    });

    const obelisks: Array<{
        itemId: number;
        locId: number;
        bit: number;
        name: string;
    }> = [
        {
            itemId: ITEM.bloodDiamond,
            locId: LOC.diamondObelisks.blood,
            bit: 1,
            name: "blood",
        },
        {
            itemId: ITEM.iceDiamond,
            locId: LOC.diamondObelisks.ice,
            bit: 2,
            name: "ice",
        },
        {
            itemId: ITEM.smokeDiamond,
            locId: LOC.diamondObelisks.smoke,
            bit: 4,
            name: "smoke",
        },
        {
            itemId: ITEM.shadowDiamond,
            locId: LOC.diamondObelisks.shadow,
            bit: 8,
            name: "shadow",
        },
    ];
    for (const obelisk of obelisks) {
        registry.registerItemOnLoc(obelisk.itemId, obelisk.locId, (event) => {
            if (getQuestStage(event.player, quest) < 11) return;
            if (
                !takeQuestItems(event.player, services, [
                    requirement(obelisk.itemId, 1, `${obelisk.name} diamond`),
                ])
            )
                return;
            const mask =
                event.player.varps.getVarpValue(VARP_DESERT_TREASURE_DIAMONDS) | obelisk.bit;
            event.player.varps.setVarpValue(VARP_DESERT_TREASURE_DIAMONDS, mask);
            services.variables.sendVarp(event.player, VARP_DESERT_TREASURE_DIAMONDS, mask);
            gameMessage(
                event.player,
                services,
                `You place the ${obelisk.name} diamond into its obelisk.`,
            );
            if ((mask & 0x0f) === 0x0f) setQuestStage(event.player, quest, services, 13);
        });
    }

    registerTalk(registry, NPC.azzanadra, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < 13) {
            talk(event, "Azzanadra", [
                sayNpc("The four elemental diamonds still bind this pyramid."),
            ]);
            return;
        }
        if (stage < quest.completionValue) {
            talk(event, "Azzanadra", [
                sayNpc([
                    "At last, the four seals are broken. You have freed Azzanadra, faithful servant of Zaros.",
                    "Accept the knowledge of Ancient Magicks as your reward.",
                ]),
                run((ctx) => finishQuest(ctx.player, ctx.services, quest)),
            ]);
            return;
        }
        talk(event, "Azzanadra", [sayNpc("The power of Ancient Magicks is yours to command.")]);
    });
}
