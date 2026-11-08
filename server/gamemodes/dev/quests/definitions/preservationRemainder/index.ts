import { SkillId } from "../../../../../../client/rs/skill/skills";
import { WaitCondition } from "../../../../../src/game/model/queue/QueueTask";
import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcAttackDecision,
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcAttackEvent,
    type NpcInteractionEvent,
    type NpcInteractionHandler,
    type NpcPreDeathEvent,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import {
    completeQuest,
    countCarriedItem,
    getQuestStage,
    getUnmetQuestRequirements,
    meetsQuestRequirements,
    setQuestStage,
    takeQuestItems,
} from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition, QuestRewards, QuestRequirements } from "../../types";

type ItemStack = { itemId: number; quantity?: number };
type Step = {
    stage: number;
    next: number;
    npcIds: readonly number[];
    npcName: string;
    text: string;
    requires?: readonly ItemStack[];
    gives?: readonly ItemStack[];
    spawnNpcId?: number;
    complete?: boolean;
};

function has(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    return countCarriedItem(player, services, itemId) >= quantity;
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function give(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) {
        services.messaging.sendGameMessage(player, "You need more free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function take(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    return takeQuestItems(player, services, [{ itemId, quantity, journalLabel: "" }]);
}

function setVarp(player: PlayerState, services: ScriptServices, id: number, value: number): void {
    player.varps.setVarpValue(id, value);
    services.variables.sendVarp(player, id, value);
}

function npcContext(event: NpcInteractionEvent, npcName: string) {
    return { player: event.player, services: event.services, npcId: event.npc.typeId, npcName };
}

function registerLinearSteps(quest: QuestDefinition, registry: IScriptRegistry, steps: readonly Step[]): void {
    const byNpc = new Map<number, Step[]>();
    for (const step of steps) {
        for (const npcId of step.npcIds) {
            const entries = byNpc.get(npcId) ?? [];
            entries.push(step);
            byNpc.set(npcId, entries);
        }
    }
    for (const [npcId, entries] of byNpc) {
        const createHandler = (fallback: NpcInteractionHandler | undefined): NpcInteractionHandler => (event): void => {
            const stage = getQuestStage(event.player, quest);
            const step = entries.find((entry) => entry.stage === stage);
            if (!step) {
                if (fallback) {
                    void fallback(event);
                    return;
                }
                startConversation(npcContext(event, entries[0].npcName), [
                    sayNpc(stage >= quest.completionValue ? "You have done all that was asked of you." : "Continue the task you were given."),
                ]);
                return;
            }
            if (stage === 0 && !meetsQuestRequirements(event.player, event.services, quest)) {
                if (fallback) {
                    void fallback(event);
                    return;
                }
                const unmet = getUnmetQuestRequirements(event.player, event.services, quest);
                startConversation(npcContext(event, step.npcName), [
                    sayNpc(`Before I can ask this of you, you need: ${unmet.join(", ")}.`),
                ]);
                return;
            }
            const missing = (step.requires ?? []).filter((item) => !has(event.player, event.services, item.itemId, item.quantity ?? 1));
            if (missing.length) {
                startConversation(npcContext(event, step.npcName), [sayNpc(`You still need ${missing.map((item) => `${item.quantity ?? 1} of item ${item.itemId}`).join(", ")}.`)]);
                return;
            }
            startConversation(npcContext(event, step.npcName), [
                sayNpc(step.text),
                run(({ player, services }) => {
                    for (const item of step.requires ?? []) if (!take(player, services, item.itemId, item.quantity ?? 1)) return;
                    for (const item of step.gives ?? []) if (!owns(player, services, item.itemId) && !give(player, services, item.itemId, item.quantity ?? 1)) return;
                    if (step.complete) completeQuest(player, services, quest);
                    else {
                        setQuestStage(player, quest, services, step.next);
                        if (step.spawnNpcId !== undefined) {
                            services.npc.spawnNpc({
                                id: step.spawnNpcId,
                                x: player.tileX + 2,
                                y: player.tileY,
                                level: player.level,
                                worldViewId: player.worldViewId,
                                ownerPlayerId: player.id,
                                lifetimeTicks: 500,
                            });
                        }
                    }
                }),
            ]);
        };
        const talkFallback = registry.findNpcInteractionDirect(npcId, "talk-to");
        const genericFallback = registry.findNpcInteractionDirect(npcId, undefined);
        registry.registerNpcScript({ npcId, option: "talk-to", handler: createHandler(talkFallback) });
        registry.registerNpcScript({ npcId, option: undefined, handler: createHandler(genericFallback) });
    }
}

function createDefinition(config: {
    key: string;
    name: string;
    varpId: number;
    startedValue: number;
    completionValue: number;
    stageBits?: { start: number; end: number };
    requirements?: QuestRequirements;
    rewards: QuestRewards;
    rewardItemId?: number;
    startText: string;
    journal: (stage: number) => string[];
    register: (quest: QuestDefinition, registry: IScriptRegistry, services: ScriptServices) => void;
}): QuestDefinition {
    const quest: QuestDefinition = {
        key: config.key,
        name: config.name,
        members: true,
        varpId: config.varpId,
        stageBits: config.stageBits,
        startedValue: config.startedValue,
        completionValue: config.completionValue,
        requirements: config.requirements,
        rewards: config.rewards,
        rewardItemId: config.rewardItemId,
        overviewStartText: config.startText,
        buildJournal(player): string[] {
            const stage = getQuestStage(player, quest);
            return stage >= quest.completionValue
                ? [`<str>I completed ${quest.name}.</str>`, "", "<col=ff0000>QUEST COMPLETE!</col>"]
                : config.journal(stage);
        },
        register(registry, services): void {
            config.register(quest, registry, services);
        },
    };
    return quest;
}

const EADGAR = { sanfew: 5044, eadgar: 4118, burntmeat: 4157, parrotPete: 4769 } as const;
export const eadgarsRuseQuest = createDefinition({
    key: "eadgars_ruse", name: "Eadgar's Ruse", varpId: 335, startedValue: 10, completionValue: 110,
    requirements: { skills: [{ skillId: SkillId.Herblore, level: 31, label: "Herblore" }], quests: [{ varpId: 317, minValue: 50, label: "Troll Stronghold" }, { varpId: 80, minValue: 4, label: "Druidic Ritual" }] },
    rewards: { questPoints: 1, xp: [{ skillId: SkillId.Herblore, amount: 11_000, label: "Herblore" }], other: ["The Trollheim Teleport spell", "Access to the Troll Stronghold storeroom"] },
    rewardItemId: 3261,
    startText: "speaking to <col=800000>Sanfew<col=000080> in Taverley.",
    journal: (stage) => [stage < 30 ? "Find Eadgar and discover what Burntmeat wants." : stage < 70 ? "Use the drunk parrot to fool the troll guards." : stage < 100 ? "Help Eadgar make a fake human and trade it for goutweed." : "Return the goutweed to Sanfew."],
    register(quest, registry) {
        registerLinearSteps(quest, registry, [
            { stage: 0, next: 10, npcIds: [EADGAR.sanfew], npcName: "Sanfew", text: "The druids need goutweed. Eadgar in the Troll Stronghold may know how to obtain it." },
            { stage: 10, next: 15, npcIds: [EADGAR.eadgar], npcName: "Eadgar", text: "Burntmeat knows the storeroom. Learn what he would trade for goutweed." },
            { stage: 15, next: 30, npcIds: [EADGAR.burntmeat], npcName: "Burntmeat", text: "Bring Burntmeat a tasty human. Eadgar will devise a ruse." },
            { stage: 30, next: 50, npcIds: [EADGAR.parrotPete], npcName: "Parroty Pete", text: "Take this drunk parrot and hide it near the troll storeroom.", gives: [{ itemId: 3266 }] },
            { stage: 50, next: 60, npcIds: [EADGAR.eadgar], npcName: "Eadgar", text: "The parrot's voice will distract the guards.", requires: [{ itemId: 3266 }] },
            { stage: 60, next: 70, npcIds: [EADGAR.eadgar], npcName: "Eadgar", text: "Now gather ten grain, five raw chickens and a log for the fake man." },
            { stage: 70, next: 90, npcIds: [EADGAR.eadgar], npcName: "Eadgar", text: "This troll potion and stuffed fake man should fool Burntmeat.", requires: [{ itemId: 1947, quantity: 10 }, { itemId: 2138, quantity: 5 }, { itemId: 1511 }], gives: [{ itemId: 3268 }] },
            { stage: 90, next: 100, npcIds: [EADGAR.burntmeat], npcName: "Burntmeat", text: "Dat human look tasty! Take da goutweed.", requires: [{ itemId: 3268 }], gives: [{ itemId: 3261 }] },
            { stage: 100, next: 110, npcIds: [EADGAR.sanfew], npcName: "Sanfew", text: "The goutweed is exactly what we need.", requires: [{ itemId: 3261 }], complete: true },
        ]);
    },
});

const HORROR = {
    larrissa: [4425, 4426],
    gunnjorn: 2153,
    jossikWell: 4423,
    jossikInjured: 4424,
    dagannothJunior: 979,
    motherForms: [6361, 6362, 6364, 6366, 6363, 6365],
    key: 3848,
    casket: 3849,
    doorway: 4577,
    brokenBridge: [4615, 4616],
    lightingMechanisms: [4587, 4588, 4589, 4590, 21945],
    strangeWallStudy: [4543, 4544],
    strangeWallOpen: [4545, 4546],
    dungeonLadderDown: 4412,
    dungeonLadderUp: 4413,
} as const;

const HORROR_FLAGS = {
    bridgeLeft: 12,
    bridgeRight: 13,
    hasKey: 14,
    entranceUnlocked: 15,
    fireRune: 16,
    waterRune: 17,
    earthRune: 18,
    airRune: 19,
    sword: 20,
    arrow: 21,
    tar: 22,
    glass: 23,
    light: 24,
} as const;

function getVarpFlag(player: PlayerState, varpId: number, bit: number): boolean {
    return (player.varps.getVarpValue(varpId) & (1 << bit)) !== 0;
}

function setVarpFlag(
    player: PlayerState,
    services: ScriptServices,
    varpId: number,
    bit: number,
    enabled = true,
): void {
    const mask = 1 << bit;
    const current = player.varps.getVarpValue(varpId);
    setVarp(player, services, varpId, enabled ? current | mask : current & ~mask);
}

function getVarpRange(player: PlayerState, varpId: number, start: number, end: number): number {
    const width = end - start + 1;
    return (player.varps.getVarpValue(varpId) >>> start) & (2 ** width - 1);
}

function setVarpRange(
    player: PlayerState,
    services: ScriptServices,
    varpId: number,
    start: number,
    end: number,
    value: number,
): void {
    const width = end - start + 1;
    const valueMask = 2 ** width - 1;
    const rangeMask = valueMask << start;
    const current = player.varps.getVarpValue(varpId);
    setVarp(player, services, varpId, (current & ~rangeMask) | ((value & valueMask) << start));
}

export const horrorFromTheDeepQuest = createDefinition({
    key: "horror_from_the_deep", name: "Horror from the Deep", varpId: 351, stageBits: { start: 0, end: 10 }, startedValue: 1, completionValue: 10,
    requirements: { skills: [{ skillId: SkillId.Agility, level: 35, label: "Agility" }], quests: [{ varpId: 77, minValue: 2, label: "Alfred Grimhand's Barcrawl" }] },
    rewards: { questPoints: 2, xp: [{ skillId: SkillId.Magic, amount: 4_662, label: "Magic" }, { skillId: SkillId.Strength, amount: 4_662, label: "Strength" }, { skillId: SkillId.Ranged, amount: 4_662, label: "Ranged" }], items: [{ itemId: HORROR.casket, quantity: 1, label: "A rusty casket" }], other: ["Access to the Lighthouse dagannoth caves", "A damaged god book chosen from Jossik"] },
    rewardItemId: HORROR.casket,
    startText: "speaking to <col=800000>Larrissa<col=000080> west of Rellekka.",
    journal: (stage) => [stage < 2 ? "Get the lighthouse key from Gunnjorn and repair both halves of the bridge." : stage < 4 ? "Repair the lens, tar the torch and relight the lighthouse mechanism." : stage < 5 ? "Find Jossik below the lighthouse and defeat the young dagannoth." : "Defeat the Dagannoth Mother and get Jossik out safely."],
    register(quest, registry, services) {
        const isFlagSet = (player: PlayerState, bit: number): boolean =>
            getVarpFlag(player, quest.varpId, bit);
        const setFlag = (player: PlayerState, scriptServices: ScriptServices, bit: number): void =>
            setVarpFlag(player, scriptServices, quest.varpId, bit);
        const bothBridgeHalves = (player: PlayerState): boolean =>
            isFlagSet(player, HORROR_FLAGS.bridgeLeft) &&
            isFlagSet(player, HORROR_FLAGS.bridgeRight);
        const wallIsComplete = (player: PlayerState): boolean =>
            [
                HORROR_FLAGS.fireRune,
                HORROR_FLAGS.waterRune,
                HORROR_FLAGS.earthRune,
                HORROR_FLAGS.airRune,
                HORROR_FLAGS.sword,
                HORROR_FLAGS.arrow,
            ].every((bit) => isFlagSet(player, bit));

        const larrissa = (event: NpcInteractionEvent): void => {
            const stage = getQuestStage(event.player, quest);
            if (stage === 0) {
                if (!meetsQuestRequirements(event.player, event.services, quest)) {
                    startConversation(npcContext(event, "Larrissa"), [sayNpc(`Before you can help, you need: ${getUnmetQuestRequirements(event.player, event.services, quest).join(", ")}.`)]);
                    return;
                }
                startConversation(npcContext(event, "Larrissa"), [
                    sayNpc("My boyfriend Jossik has vanished and the lighthouse has gone dark. Please help me find him!"),
                    choose([
                        option("Okay, I'll help!", [
                            sayNpc("Thank you! Get my spare key from Gunnjorn and repair each half of the bridge with a plank, four steel nails and a hammer."),
                            run(({ player, services: dialogueServices }) => setQuestStage(player, quest, dialogueServices, 1)),
                        ]),
                        option("Sorry, just passing through.", [sayNpc("Oh... my poor darling Jossik...")]),
                    ]),
                ]);
                return;
            }
            if (stage === 1) {
                const key = isFlagSet(event.player, HORROR_FLAGS.hasKey) || owns(event.player, event.services, HORROR.key);
                startConversation(npcContext(event, "Larrissa"), [
                    sayNpc(key && bothBridgeHalves(event.player)
                        ? "You have the key and the bridge is safe. Unlock the lighthouse doorway and go inside."
                        : key
                          ? "You found the key. Please repair both halves of the bridge now."
                          : bothBridgeHalves(event.player)
                            ? "The bridge is fixed. Gunnjorn at the Barbarian Outpost still has my spare key."
                            : "Gunnjorn has my spare key. Each bridge half needs a plank and four steel nails."),
                ]);
                return;
            }
            if (stage < 4) {
                startConversation(npcContext(event, "Larrissa"), [sayNpc("Please repair the lighthouse light before a ship is wrecked on these rocks!")]);
                return;
            }
            if (stage < quest.completionValue) {
                startConversation(npcContext(event, "Larrissa"), [sayNpc("You found Jossik, but something is still keeping him below. Please save him!")]);
                return;
            }
            startConversation(npcContext(event, "Larrissa"), [sayNpc("Thank you for rescuing my darling Jossik!")]);
        };
        for (const npcId of HORROR.larrissa) registry.registerNpcScript({ npcId, option: "talk-to", handler: larrissa });

        registry.registerNpcScript({
            npcId: HORROR.gunnjorn,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if (owns(event.player, event.services, HORROR.key)) {
                    startConversation(npcContext(event, "Gunnjorn"), [sayNpc("You already have Larrissa's spare lighthouse key.")]);
                    return;
                }
                startConversation(npcContext(event, "Gunnjorn"), [
                    sayNpc("Larrissa left this spare lighthouse key with me. Take it to her."),
                    run(({ player, services: dialogueServices }) => {
                        if (give(player, dialogueServices, HORROR.key)) setFlag(player, dialogueServices, HORROR_FLAGS.hasKey);
                    }),
                ]);
            },
        });

        for (const [index, locId] of HORROR.brokenBridge.entries()) {
            registry.registerItemOnLoc(960, locId, ({ player, services: itemServices }) => {
                if (getQuestStage(player, quest) !== 1) return;
                const bit = index === 0 ? HORROR_FLAGS.bridgeLeft : HORROR_FLAGS.bridgeRight;
                if (isFlagSet(player, bit)) {
                    itemServices.messaging.sendGameMessage(player, "You have already repaired this half of the bridge.");
                    return;
                }
                if (!has(player, itemServices, 1539, 4) || !has(player, itemServices, 2347)) {
                    itemServices.messaging.sendGameMessage(player, "You need four steel nails and a hammer to attach the plank.");
                    return;
                }
                if (!take(player, itemServices, 960) || !take(player, itemServices, 1539, 4)) return;
                setFlag(player, itemServices, bit);
                itemServices.messaging.sendGameMessage(player, bothBridgeHalves(player)
                    ? "You finish a makeshift walkway across the broken bridge."
                    : "You create half a makeshift walkway from the plank.");
            });
            registry.registerLocScript({
                locId,
                action: "cross",
                handler: ({ player, services: locServices, tile, tick }) => {
                    if (!bothBridgeHalves(player)) {
                        locServices.messaging.sendGameMessage(player, "The broken bridge is too dangerous to cross safely.");
                        return;
                    }
                    const dx = player.tileX <= tile.x ? 3 : -3;
                    locServices.movement.queueForcedMovement(player, {
                        startTile: { x: player.tileX, y: player.tileY },
                        endTile: { x: player.tileX + dx, y: player.tileY },
                        endTick: tick + 3,
                    });
                },
            });
        }

        registry.registerItemOnLoc(HORROR.key, HORROR.doorway, ({ player, services: itemServices }) => {
            if (getQuestStage(player, quest) !== 1 || isFlagSet(player, HORROR_FLAGS.entranceUnlocked)) return;
            if (!bothBridgeHalves(player)) {
                itemServices.messaging.sendGameMessage(player, "Larrissa is still trapped by the broken bridge.");
                return;
            }
            if (!take(player, itemServices, HORROR.key)) return;
            setFlag(player, itemServices, HORROR_FLAGS.entranceUnlocked);
            setQuestStage(player, quest, itemServices, 2);
            itemServices.messaging.sendGameMessage(player, "You unlock the lighthouse front door.");
        });
        registry.registerLocScript({
            locId: HORROR.doorway,
            action: "walk-through",
            handler: ({ player, services: locServices, tile, level }) => {
                if (!isFlagSet(player, HORROR_FLAGS.entranceUnlocked)) {
                    locServices.messaging.sendGameMessage(player, "This doorway is locked securely shut.");
                    return;
                }
                if (getQuestStage(player, quest) === 1) setQuestStage(player, quest, locServices, 2);
                locServices.movement.teleportPlayer(player, tile.x, player.tileY <= tile.y ? tile.y + 1 : tile.y - 1, level);
            },
        });

        const registerMechanismItem = (itemId: number, bit: number, message: string, consume: boolean): void => {
            for (const locId of HORROR.lightingMechanisms) {
                registry.registerItemOnLoc(itemId, locId, ({ player, services: itemServices }) => {
                    const stage = getQuestStage(player, quest);
                    if (stage < 2 || stage >= 4 || isFlagSet(player, bit)) return;
                    if (itemId === 590 && !isFlagSet(player, HORROR_FLAGS.tar)) {
                        itemServices.messaging.sendGameMessage(player, "The old torch is not flammable yet.");
                        return;
                    }
                    if (consume && !take(player, itemServices, itemId)) return;
                    setFlag(player, itemServices, bit);
                    itemServices.messaging.sendGameMessage(player, message);
                    if (
                        isFlagSet(player, HORROR_FLAGS.tar) &&
                        isFlagSet(player, HORROR_FLAGS.glass) &&
                        isFlagSet(player, HORROR_FLAGS.light)
                    ) {
                        setQuestStage(player, quest, itemServices, 4);
                        itemServices.messaging.sendGameMessage(player, "The repaired lighthouse torch bursts into life.");
                    } else if (stage === 2) {
                        setQuestStage(player, quest, itemServices, 3);
                    }
                });
            }
        };
        registerMechanismItem(1939, HORROR_FLAGS.tar, "You coat the old torch with swamp tar.", true);
        registerMechanismItem(1775, HORROR_FLAGS.glass, "You repair the cracked lens with molten glass.", true);
        registerMechanismItem(590, HORROR_FLAGS.light, "You light the tarred torch.", false);

        const wallOfferings = [
            { items: [554], bit: HORROR_FLAGS.fireRune, label: "fire rune" },
            { items: [555], bit: HORROR_FLAGS.waterRune, label: "water rune" },
            { items: [557], bit: HORROR_FLAGS.earthRune, label: "earth rune" },
            { items: [556], bit: HORROR_FLAGS.airRune, label: "air rune" },
            { items: [1277, 1281, 1285, 1289, 1291, 1293, 1295, 1305], bit: HORROR_FLAGS.sword, label: "sword" },
            { items: [882, 884, 886, 888, 890, 892], bit: HORROR_FLAGS.arrow, label: "arrow" },
        ] as const;
        for (const offering of wallOfferings) {
            for (const itemId of offering.items) {
                for (const locId of HORROR.strangeWallStudy) {
                    registry.registerItemOnLoc(itemId, locId, ({ player, services: itemServices }) => {
                        if (getQuestStage(player, quest) < 4 || isFlagSet(player, offering.bit)) return;
                        if (!take(player, itemServices, itemId)) return;
                        setFlag(player, itemServices, offering.bit);
                        itemServices.messaging.sendGameMessage(player, `You place the ${offering.label} into the slot in the wall.`);
                        if (wallIsComplete(player)) itemServices.messaging.sendGameMessage(player, "You hear something moving deep within the wall.");
                    });
                }
            }
        }
        for (const locId of HORROR.strangeWallOpen) {
            registry.registerLocScript({
                locId,
                action: "open",
                handler: ({ player, services: locServices, tile, level }) => {
                    if (!wallIsComplete(player)) {
                        locServices.messaging.sendGameMessage(player, "You cannot see any way to move this part of the wall.");
                        return;
                    }
                    locServices.movement.teleportPlayer(player, tile.x, player.tileY <= tile.y ? tile.y + 1 : tile.y - 1, level);
                },
            });
        }

        const createDagannothInstance = (player: PlayerState, instanceServices: ScriptServices): void => {
            if (instanceServices.instances.get(player.id)) return;
            const templateChunks = instanceServices.instances.buildTemplate([{
                sourceBaseX: 2504,
                sourceBaseY: 4624,
                widthChunks: 4,
                heightChunks: 4,
                sourcePlanes: [0, 1],
                destinationChunkX: 5,
                destinationChunkY: 6,
            }]);
            const handle = instanceServices.instances.create(player, {
                templateChunks,
                destination: { x: 2515, y: 4631, level: 0 },
                exit: { x: 2519, y: 4618, level: 1 },
                npcs: [{ id: HORROR.jossikInjured, offsetX: 54, offsetY: 57, level: 0, wanderRadius: 0 }],
            });
            if (!handle) instanceServices.messaging.sendGameMessage(player, "The lighthouse cavern is unavailable right now.");
        };
        registry.registerLocScript({
            locId: HORROR.dungeonLadderDown,
            action: "climb",
            handler: ({ player, services: locServices }) => {
                if (getQuestStage(player, quest) < 4) {
                    locServices.messaging.sendGameMessage(player, "You should repair the lighthouse before exploring below.");
                    return;
                }
                createDagannothInstance(player, locServices);
            },
        });
        registry.registerLocScript({
            locId: HORROR.dungeonLadderUp,
            action: "climb",
            handler: ({ player, services: locServices }) => {
                if (!locServices.instances.dispose(player)) {
                    locServices.movement.teleportPlayer(player, 2519, 4618, 1, true);
                }
            },
        });

        const startMotherAi = (player: PlayerState, scriptServices: ScriptServices, initialNpc: NonNullable<ReturnType<ScriptServices["npc"]["spawnNpc"]>>): void => {
            let current = initialNpc;
            let formIndex = 0;
            let taskId = 0;
            taskId = scriptServices.scheduler.repeat(30, 30, () => {
                if (getQuestStage(player, quest) !== 5 || current.getHitpoints() <= 0) {
                    scriptServices.scheduler.cancel(taskId);
                    return;
                }
                if (Math.max(Math.abs(player.tileX - current.tileX), Math.abs(player.tileY - current.tileY)) > 17) {
                    scriptServices.npc.removeNpc(current.id);
                    scriptServices.scheduler.cancel(taskId);
                    return;
                }
                formIndex = (formIndex + 1) % HORROR.motherForms.length;
                const replacement = scriptServices.npc.replaceNpc(current, HORROR.motherForms[formIndex]);
                if (!replacement) {
                    scriptServices.scheduler.cancel(taskId);
                    return;
                }
                current = replacement;
                scriptServices.npc.queueNpcForcedChat(current, ["Krrrrrrk", "Chkhkhkhkhk", "Krrrrrrssssssss", "Sssssrrrkkkkk", "Krkrkrkrkrkrkrkr", "Tktktktktktkt"][formIndex]);
                scriptServices.npc.engageCombat(current, player);
            }, { kind: "player", id: player.id });
        };

        const spawnMotherCutscene = (player: PlayerState, scriptServices: ScriptServices): void => {
            if (scriptServices.npc.findNearbyNpc(player, HORROR.motherForms[0], 40)) return;
            scriptServices.sequence.run(player, function* () {
                scriptServices.camera.move(player, { x: 2514, y: 4645 }, 500);
                scriptServices.camera.lookAt(player, { x: 2509, y: 4644 }, 100);
                yield new WaitCondition(1);
                const boss = scriptServices.npc.spawnNpc({
                    id: HORROR.motherForms[0],
                    x: 2506,
                    y: 4642,
                    level: 0,
                    worldViewId: player.worldViewId,
                    ownerPlayerId: player.id,
                    wanderRadius: 0,
                });
                if (!boss) return;
                scriptServices.npc.queueNpcForcedChat(boss, "Krrrrrrk");
                yield new WaitCondition(1);
                scriptServices.npc.moveNpcTo(boss, { x: 2520, y: 4646 });
                yield new WaitCondition(2);
                scriptServices.npc.engageCombat(boss, player);
                startMotherAi(player, scriptServices, boss);
            }, { resetCamera: true });
        };

        registry.registerNpcScript({
            npcId: HORROR.jossikInjured,
            option: "talk-to",
            handler: (event) => {
                const stage = getQuestStage(event.player, quest);
                if (stage === 4) {
                    const existing = event.services.npc.findNearbyNpc(event.player, HORROR.dagannothJunior, 40);
                    if (existing) {
                        startConversation(npcContext(event, "Jossik"), [sayNpc("Look out! The creature is still attacking!")]);
                        return;
                    }
                    startConversation(npcContext(event, "Jossik"), [
                        sayNpc("Please help me! I found the secret door, but one of those creatures trapped me down here."),
                        sayPlayer("Don't worry, I'll get you out of here."),
                        run(({ player, services: dialogueServices }) => {
                            const handle = dialogueServices.instances.get(player.id);
                            if (!handle) return;
                            const junior = dialogueServices.npc.spawnNpc({
                                id: HORROR.dagannothJunior,
                                x: handle.baseX + 56,
                                y: handle.baseY + 70,
                                level: 0,
                                worldViewId: handle.worldViewId,
                                ownerPlayerId: player.id,
                                wanderRadius: 0,
                            });
                            if (junior) dialogueServices.npc.engageCombat(junior, player);
                        }),
                    ]);
                    return;
                }
                if (stage === 5) {
                    startConversation(npcContext(event, "Jossik"), [
                        sayPlayer("The creature is dead. Now we can leave."),
                        sayNpc("No! That was only one of its babies. The mother is coming!"),
                        run(({ player, services: dialogueServices }) => spawnMotherCutscene(player, dialogueServices)),
                    ]);
                }
            },
        });

        registry.registerNpcPreDeath(HORROR.dagannothJunior, (event) => {
            const player = event.killer;
            if (player && event.npc.ownerPlayerId === player.id && getQuestStage(player, quest) === 4) {
                setQuestStage(player, quest, event.services, 5);
            }
            return NpcPreDeathDecision.Allow;
        });
        const applyRangedMotherAttack = (event: NpcAttackEvent, maxHit: number, hits: number): typeof NpcAttackDecision.Prevent => {
            event.services.scheduler.after(1, () => {
                if (event.target.worldViewId !== event.npc.worldViewId || event.npc.getHitpoints() <= 0) return;
                for (let hit = 0; hit < hits; hit++) {
                    event.services.combat.applyNpcDamageToPlayer(event.npc, event.target, 0, Math.floor(Math.random() * (maxHit + 1)));
                }
            }, { kind: "player", id: event.target.id });
            return NpcAttackDecision.Prevent;
        };
        registry.registerNpcAttack(HORROR.dagannothJunior, (event) => applyRangedMotherAttack(event, 8, 1));
        for (const npcId of HORROR.motherForms) {
            registry.registerNpcAttack(npcId, (event) => {
                if (event.npc.ownerPlayerId !== event.target.id || getQuestStage(event.target, quest) !== 5) return NpcAttackDecision.Allow;
                const prayers = event.target.prayer.activePrayers;
                const useRanged = prayers.has("protect_from_melee") || (!prayers.has("protect_from_missiles") && Math.random() < 0.5);
                if (!useRanged) return NpcAttackDecision.Allow;
                return applyRangedMotherAttack(event, 12, 2);
            });
            registry.registerNpcPreDeath(npcId, (event) => {
                const player = event.killer;
                if (!player || event.npc.ownerPlayerId !== player.id || getQuestStage(player, quest) !== 5) return NpcPreDeathDecision.Allow;
                completeQuest(player, event.services, quest);
                event.services.scheduler.after(1, () => {
                    event.services.instances.dispose(player, { x: 2509, y: 3640, level: 1 });
                    event.services.messaging.sendGameMessage(player, "Jossik follows you safely back to the lighthouse library.");
                }, { kind: "player", id: player.id });
                return NpcPreDeathDecision.Allow;
            });
        }

        registry.registerNpcScript({
            npcId: HORROR.jossikWell,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) < quest.completionValue) return;
                if (!owns(event.player, event.services, HORROR.casket)) {
                    startConversation(npcContext(event, "Jossik"), [sayNpc("Thank you again for rescuing me from the caverns.")]);
                    return;
                }
                startConversation(npcContext(event, "Jossik"), [
                    sayNpc("There is faint writing on the casket. Which god's name can you make out?"),
                    choose([
                        option("Saradomin", [run(({ player, services: dialogueServices }) => { if (take(player, dialogueServices, HORROR.casket)) give(player, dialogueServices, 3839); })]),
                        option("Guthix", [run(({ player, services: dialogueServices }) => { if (take(player, dialogueServices, HORROR.casket)) give(player, dialogueServices, 3841); })]),
                        option("Zamorak", [run(({ player, services: dialogueServices }) => { if (take(player, dialogueServices, HORROR.casket)) give(player, dialogueServices, 3843); })]),
                    ], "What does the casket say?"),
                ]);
            },
        });
        void services;
    },
});

export const watchtowerQuest = createDefinition({
    key: "watchtower", name: "Watchtower", varpId: 212, startedValue: 1, completionValue: 13,
    requirements: { skills: [{ skillId: SkillId.Magic, level: 15, label: "Magic" }, { skillId: SkillId.Thieving, level: 15, label: "Thieving" }, { skillId: SkillId.Agility, level: 25, label: "Agility" }, { skillId: SkillId.Herblore, level: 14, label: "Herblore" }, { skillId: SkillId.Mining, level: 40, label: "Mining" }] },
    rewards: { questPoints: 4, xp: [{ skillId: SkillId.Magic, amount: 15_250, label: "Magic" }], items: [{ itemId: 995, quantity: 5_000, label: "5,000 coins" }, { itemId: 2396, quantity: 1, label: "Watchtower teleport spell scroll" }], other: ["The Watchtower Teleport spell", "Access to Gu'Tanoth"] }, rewardItemId: 2396,
    startText: "speaking to the <col=800000>Watchtower Wizard<col=000080> south of Yanille.",
    journal: (stage) => [stage < 4 ? "Recover the three ogre relic pieces and return them to the wizard." : stage < 9 ? "Earn passage through Gu'Tanoth and learn the Skavid language." : stage < 11 ? "Make the ogre potion and defeat six shamans." : "Return the four crystals to the Watchtower Wizard."],
    register(quest, registry) {
        const wizard = 4397;
        const shamans = [4382, 4383, 4387, 4389, 4391, 4393] as const;
        const getShamanCount = (player: PlayerState): number => (player.varps.getVarpValue(213) >>> 17) & 7;
        const setShamanCount = (player: PlayerState, services: ScriptServices, count: number): void => {
            const current = player.varps.getVarpValue(213);
            setVarp(player, services, 213, (current & ~(7 << 17)) | ((Math.min(6, count) & 7) << 17));
        };
        registerLinearSteps(quest, registry, [
            { stage: 0, next: 1, npcIds: [wizard], npcName: "Watchtower Wizard", text: "Ogres raided the Watchtower. Find their fingernails and recover our stolen relic." },
            { stage: 1, next: 2, npcIds: [wizard], npcName: "Watchtower Wizard", text: "These fingernails point to the ogres of Gu'Tanoth.", gives: [{ itemId: 2384 }] },
            { stage: 2, next: 3, npcIds: [4364, 4365, 4366], npcName: "Ogre chieftain", text: "You have helped the three chieftains and recovered every piece of the relic. Grew also returns the first powering crystal.", requires: [{ itemId: 536 }, { itemId: 530 }, { itemId: 235 }], gives: [{ itemId: 2372 }, { itemId: 2380 }] },
            { stage: 3, next: 4, npcIds: [wizard], npcName: "Watchtower Wizard", text: "The restored relic proves the ogres' involvement.", requires: [{ itemId: 2372 }] },
            { stage: 4, next: 6, npcIds: [4364, 4365, 4366], npcName: "Ogre chieftain", text: "Solve the riddle, enter the market and take this Skavid map.", gives: [{ itemId: 2376 }] },
            { stage: 6, next: 7, npcIds: [4374, 4375, 4376, 4377, 4378, 4379, 4380], npcName: "Skavid", text: "You have learned enough of the Skavid language. Take the crystal the ogres hid in this cave.", requires: [{ itemId: 2376 }], gives: [{ itemId: 2381 }] },
            { stage: 7, next: 9, npcIds: [wizard], npcName: "Watchtower Wizard", text: "Use nightshade on an ogre guard and make a potion from guam, jangerberries and bat bones." },
            { stage: 9, next: 10, npcIds: [wizard], npcName: "Watchtower Wizard", text: "I have infused the potion with magic. It will dissolve the shamans' invulnerability.", requires: [{ itemId: 249 }, { itemId: 247 }, { itemId: 530 }, { itemId: 227 }], gives: [{ itemId: 2395 }] },
            { stage: 11, next: 13, npcIds: [wizard], npcName: "Watchtower Wizard", text: "All four power crystals are restored. The Watchtower is operational again.", requires: [{ itemId: 2380 }, { itemId: 2381 }, { itemId: 2382 }, { itemId: 2383 }], complete: true },
        ]);
        for (const npcId of shamans) {
            registry.registerNpcScript({
                npcId,
                option: "talk-to",
                handler: (event) => {
                    event.services.messaging.sendGameMessage(event.player, "A magic blast comes from the shaman.");
                    event.services.messaging.sendGameMessage(event.player, "You are badly injured by the blast.");
                    event.services.combat.applyNpcDamageToPlayer(event.npc, event.player, 0, 20);
                    event.services.npc.queueNpcForcedChat(event.npc, "Grr! How dare you talk to us. We will destroy you!");
                },
            });
            registry.registerItemOnNpc(2394, npcId, ({ player, services: itemServices }) => {
                itemServices.messaging.sendGameMessage(player, "There is a small flash, but the potion is ineffective.");
                itemServices.messaging.sendGameMessage(player, "I had better go back to the wizard about this.");
            });
            registry.registerItemOnNpc(2395, npcId, ({ player, services: itemServices, target }) => {
                if (getQuestStage(player, quest) !== 10) {
                    itemServices.messaging.sendGameMessage(player, "Nothing interesting happens.");
                    return;
                }
                const magic = itemServices.skills.getSkill(player, SkillId.Magic);
                if (magic.baseLevel + magic.boost < 14) {
                    itemServices.messaging.sendGameMessage(player, "You need a Magic level of 14 or over to use this potion.");
                    return;
                }
                const current = getShamanCount(player);
                if (current >= 6) {
                    itemServices.messaging.sendGameMessage(player, "The remaining magic in the potion has no effect.");
                    return;
                }
                itemServices.messaging.sendGameMessage(player, "There is a bright flash!");
                itemServices.messaging.sendGameMessage(player, "The ogre dissolves into spirit form.");
                itemServices.npc.queueNpcSpotAnim(target, 4, 124);
                const count = current + 1;
                setShamanCount(player, itemServices, count);
                const progress = [
                    "That's one destroyed...",
                    "That's the second one gone...",
                    "That's the next one dealt with...",
                    "There goes another one...",
                    "That's five, only one more left now...",
                ][count - 1];
                if (progress) itemServices.messaging.sendGameMessage(player, progress);
                if (count !== 6) return;
                if (!take(player, itemServices, 2395)) return;
                give(player, itemServices, 229);
                give(player, itemServices, 2382);
                itemServices.messaging.sendGameMessage(player, "A crystal drops from the disappearing ogre and you snatch it up.");
            });
            registry.registerNpcPreDeath(npcId, (event) => {
                const player = event.killer;
                if (!player || getQuestStage(player, quest) !== 10) return NpcPreDeathDecision.Allow;
                event.services.messaging.sendGameMessage(player, "Your weapon cannot pierce the shaman's magical protection.");
                event.services.npc.queueNpcForcedChat(event.npc, "You fool! Your primitive weapons are no match for our superior magics!");
                return NpcPreDeathDecision.Prevent;
            });
        }
        registry.registerLocScript({
            locId: 2816,
            action: "prospect",
            handler: ({ player, services: locServices }) => {
                locServices.messaging.sendGameMessage(player, "You examine the rock for ores...");
                locServices.messaging.sendGameMessage(player, "The rock contains a crystal!");
            },
        });
        registry.registerLocScript({
            locId: 2816,
            action: "mine",
            handler: ({ player, services: locServices }) => {
                if (getQuestStage(player, quest) !== 10 || getShamanCount(player) < 6) {
                    locServices.messaging.sendGameMessage(player, "You cannot touch it. It seems linked to the shamans.");
                    return;
                }
                if (owns(player, locServices, 2383)) {
                    locServices.messaging.sendGameMessage(player, "You already have this crystal.");
                    return;
                }
                const mining = locServices.skills.getSkill(player, SkillId.Mining);
                if (mining.baseLevel + mining.boost < 40) {
                    locServices.messaging.sendGameMessage(player, "You need level 40 Mining to mine this rock.");
                    return;
                }
                const pickaxes = [1275, 1271, 1273, 1269, 1267, 1265, 13243, 11920, 23680];
                if (!pickaxes.some((itemId) => owns(player, locServices, itemId))) {
                    locServices.messaging.sendGameMessage(player, "You need a pickaxe to prise the crystal from the rock.");
                    return;
                }
                locServices.animation.playPlayerSeq(player, 625);
                if (!give(player, locServices, 2383)) return;
                locServices.messaging.sendGameMessage(player, "A crack appears and you prise a crystal from the rock.");
                if ([2380, 2381, 2382, 2383].every((itemId) => owns(player, locServices, itemId))) {
                    setQuestStage(player, quest, locServices, 11);
                }
            },
        });
    },
});

export const shadesOfMorttonQuest = createDefinition({
    key: "shades_of_mortton", name: "Shades of Mort'ton", varpId: 339, startedValue: 5, completionValue: 85,
    requirements: { skills: [{ skillId: SkillId.Crafting, level: 20, label: "Crafting" }, { skillId: SkillId.Herblore, level: 15, label: "Herblore" }, { skillId: SkillId.Firemaking, level: 5, label: "Firemaking" }], quests: [{ varpId: 302, minValue: 60, label: "Priest in Peril" }] },
    rewards: { questPoints: 3, xp: [{ skillId: SkillId.Crafting, amount: 2_000, label: "Crafting" }, { skillId: SkillId.Herblore, amount: 2_000, label: "Herblore" }], other: ["Access to the Shade Catacombs", "The ability to make pyre logs and Serum 208"] }, rewardItemId: 3396,
    startText: "reading the <col=800000>diary<col=000080> in the abandoned house south-west of Mort'ton.",
    journal: (stage) => [stage < 15 ? "Make Serum 207 and cure Ulsquire and Razmire temporarily." : stage < 45 ? "Kill five Loar shades for Razmire." : stage < 65 ? "Repair the temple and sanctify olive oil." : "Make pyre logs and cremate a Loar shade."],
    register(quest, registry) {
        registerLinearSteps(quest, registry, [
            { stage: 0, next: 5, npcIds: [1287], npcName: "Afflicted Ulsquire", text: "The diary explains how tarromin and ashes make Serum 207." },
            { stage: 5, next: 10, npcIds: [1287, 1288], npcName: "Ulsquire Shauncy", text: "The serum restores Ulsquire briefly.", requires: [{ itemId: 253 }, { itemId: 592 }, { itemId: 227 }], gives: [{ itemId: 3408 }] },
            { stage: 10, next: 15, npcIds: [1289, 1290], npcName: "Razmire Keelgan", text: "Razmire needs the remains of five Loar shades.", requires: [{ itemId: 3408 }] },
            { stage: 40, next: 45, npcIds: [1289, 1290], npcName: "Razmire Keelgan", text: "These remains prove you can help rebuild the temple.", requires: [{ itemId: 3396, quantity: 5 }] },
            { stage: 45, next: 55, npcIds: [1287, 1288], npcName: "Ulsquire Shauncy", text: "The temple walls stand again. Light the sacred flame.", requires: [{ itemId: 3420, quantity: 5 }, { itemId: 1941, quantity: 5 }] },
            { stage: 55, next: 65, npcIds: [1287, 1288], npcName: "Ulsquire Shauncy", text: "The altar sanctifies olive oil for the funeral pyres.", requires: [{ itemId: 3423 }], gives: [{ itemId: 3436 }] },
            { stage: 65, next: 70, npcIds: [1287, 1288], npcName: "Ulsquire Shauncy", text: "Rub the sacred oil into logs to make pyre logs.", requires: [{ itemId: 3436 }, { itemId: 1511 }], gives: [{ itemId: 3438 }] },
            { stage: 70, next: 85, npcIds: [1287, 1288], npcName: "Ulsquire Shauncy", text: "The shade has been laid to rest and the people of Mort'ton have hope again.", requires: [{ itemId: 3438 }, { itemId: 3396 }], complete: true },
        ]);
        for (const npcId of [1277, 1280, 1284]) registry.registerNpcPreDeath(npcId, (event) => {
            const player = event.killer;
            if (!player) return NpcPreDeathDecision.Allow;
            const stage = getQuestStage(player, quest);
            if (stage < 15 || stage >= 40) return NpcPreDeathDecision.Allow;
            give(player, event.services, 3396);
            setQuestStage(player, quest, event.services, Math.min(40, stage + 5));
            return NpcPreDeathDecision.Allow;
        });
    },
});

export const regicideQuest = createDefinition({
    key: "regicide", name: "Regicide", varpId: 328, startedValue: 1, completionValue: 15,
    requirements: { skills: [{ skillId: SkillId.Agility, level: 56, label: "Agility" }], quests: [{ varpId: 161, minValue: 110, label: "Underground Pass" }] },
    rewards: { questPoints: 3, xp: [{ skillId: SkillId.Agility, amount: 13_750, label: "Agility" }], items: [{ itemId: 995, quantity: 15_000, label: "15,000 coins" }], other: ["Access to Tirannwn", "The ability to use charter ships to Port Tyras"] }, rewardItemId: 3218,
    startText: "receiving a message from <col=800000>King Lathas<col=000080> after Underground Pass.",
    journal: (stage) => [stage < 4 ? "Cross the Underground Pass and find Lord Iorwerth." : stage < 9 ? "Follow the tracker gnomes and enter the Tyras camp." : stage < 13 ? "Construct a barrel bomb and destroy King Tyras's tent." : "Report Iorwerth's treachery to Arianwyn and King Lathas."],
    register(quest, registry) {
        registerLinearSteps(quest, registry, [
            { stage: 0, next: 1, npcIds: [8046, 8842, 9005, 11022], npcName: "King Lathas", text: "My messenger brings orders: cross the pass and contact our scouts.", gives: [{ itemId: 3206 }] },
            { stage: 1, next: 2, npcIds: [8046, 8842, 9005, 11022], npcName: "King Lathas", text: "Find Lord Iorwerth beyond the Underground Pass.", requires: [{ itemId: 3206 }] },
            { stage: 2, next: 3, npcIds: [3413, 8976], npcName: "Koftik", text: "The pass has reopened. The elven scouts wait in Isafdar." },
            { stage: 3, next: 4, npcIds: [8758], npcName: "Lord Iorwerth", text: "Find my tracker gnomes and locate King Tyras. Take this crystal pendant.", gives: [{ itemId: 3208 }] },
            { stage: 4, next: 8, npcIds: [4975, 4976, 4977], npcName: "Tracker gnome", text: "The pendant proves Iorwerth sent you. The footprints lead to Tyras camp.", requires: [{ itemId: 3208 }] },
            { stage: 9, next: 11, npcIds: [8758], npcName: "Lord Iorwerth", text: "Mix this naphtha with ground sulphur and quicklime, then add a cloth fuse.", gives: [{ itemId: 3221 }, { itemId: 3214 }, { itemId: 3215 }, { itemId: 3224 }] },
            { stage: 12, next: 13, npcIds: [8758], npcName: "Lord Iorwerth", text: "Return to King Lathas and report your success." },
            { stage: 13, next: 14, npcIds: [3432, 9014], npcName: "Arianwyn", text: "Iorwerth deceived you. Lathas means to hand Kandarin to the Dark Lord." },
            { stage: 14, next: 15, npcIds: [8046, 8842, 9005, 11022], npcName: "King Lathas", text: "Tyras is dead. Kandarin owes you a great debt.", complete: true },
        ]);
        const mix = (first: number, second: number, result: number, message: string): void => {
            registry.registerItemOnItem(first, second, ({ player, services }) => {
                if (getQuestStage(player, quest) !== 11) return;
                if (!take(player, services, first) || !take(player, services, second)) return;
                if (!give(player, services, result)) return;
                services.messaging.sendGameMessage(player, message);
            });
        };
        mix(3221, 3214, 3223, "You mix the quicklime into the naphtha.");
        mix(3221, 3215, 3222, "You mix the sulphur into the naphtha.");
        mix(3223, 3215, 3218, "You add sulphur and seal the barrel.");
        mix(3222, 3214, 3218, "You add quicklime and seal the barrel.");
        mix(3218, 3224, 3219, "You fit the cloth as a fuse for the barrel bomb.");
        registry.registerItemOnLoc(3219, 3976, ({ player, services: itemServices }) => {
            if (getQuestStage(player, quest) !== 11) {
                itemServices.messaging.sendGameMessage(player, "I don't want to use that for ammunition.");
                return;
            }
            if (!take(player, itemServices, 3219)) return;
            itemServices.sequence.run(player, function* () {
                itemServices.movement.teleportPlayer(player, 2187, 3185, 0);
                itemServices.location.faceTile(player, { x: 2187, y: 3186 });
                yield new WaitCondition(1);
                itemServices.animation.playPlayerSeq(player, 1239);
                itemServices.animation.playLocAnimation({ locId: 3977, tile: { x: 2186, y: 3183 }, level: 0, animId: 1228 });
                yield new WaitCondition(2);
                itemServices.animation.playPlayerSeq(player, 827);
                itemServices.animation.playLocAnimation({ locId: 3976, tile: { x: 2185, y: 3183 }, level: 0, animId: 1227 });
                itemServices.animation.playLocAnimation({ locId: 3978, tile: { x: 2184, y: 3183 }, level: 0, animId: 1221 });
                itemServices.projectiles.launch({
                    projectileId: 286,
                    source: { tileX: 2185, tileY: 3185, plane: 0 },
                    target: { tileX: 2186, tileY: 3142, plane: 0 },
                    sourceHeight: 138 * 4,
                    endHeight: 75 * 4,
                    slope: 30,
                    startPos: 170,
                    startCycleOffset: 0,
                    endCycleOffset: 50,
                });
                yield new WaitCondition(4);
                itemServices.animation.playPlayerSeq(player, 1241);
                itemServices.movement.teleportPlayer(player, 2314, 4550, 0, true);
                itemServices.camera.move(player, { x: 2314, y: 4561 }, 700, true);
                itemServices.camera.lookAt(player, { x: 2314, y: 4550 }, 0, true);
                itemServices.projectiles.launch({
                    projectileId: 286,
                    source: { tileX: 2314, tileY: 4562, plane: 0 },
                    target: { tileX: 2314, tileY: 4551, plane: 0 },
                    sourceHeight: 112 * 4,
                    endHeight: 100 * 4,
                    slope: 30,
                    startPos: 90,
                    startCycleOffset: 0,
                    endCycleOffset: 35,
                });
                itemServices.animation.playLocGraphic({ spotId: 287, tile: { x: 2314, y: 4550 }, level: 0, height: 194, delayTicks: 2 });
                yield new WaitCondition(2);
                const scope = { worldViewId: player.worldViewId, ownerPlayerId: player.id };
                const burningWalls = [
                    { oldId: 3995, x: 2317, y: 4550, shape: 0, rotation: 3 },
                    { oldId: 4001, x: 2312, y: 4551, shape: 0, rotation: 2 },
                    { oldId: 4001, x: 2312, y: 4549, shape: 0, rotation: 1 },
                    { oldId: 4001, x: 2316, y: 4549, shape: 0, rotation: 0 },
                    { oldId: 4001, x: 2316, y: 4551, shape: 0, rotation: 3 },
                    { oldId: 3995, x: 2313, y: 4548, shape: 0, rotation: 1 },
                    { oldId: 3995, x: 2314, y: 4548, shape: 0, rotation: 1 },
                    { oldId: 3995, x: 2315, y: 4548, shape: 0, rotation: 1 },
                ];
                for (const wall of burningWalls) {
                    itemServices.location.replaceTemporaryLoc(scope, wall.oldId, 3997, { x: wall.x, y: wall.y }, 0, {
                        oldShape: wall.shape,
                        oldRotation: wall.rotation,
                        newShape: wall.shape,
                        newRotation: wall.rotation,
                        lifetimeTicks: 12,
                    });
                }
                for (const tile of [{ x: 2313, y: 4549 }, { x: 2314, y: 4549 }, { x: 2315, y: 4549 }, { x: 2313, y: 4551 }, { x: 2314, y: 4551 }, { x: 2315, y: 4551 }]) {
                    itemServices.location.replaceTemporaryLoc(scope, 3984, 4000, tile, 0, { newShape: 10, lifetimeTicks: 12 });
                }
                itemServices.camera.shake(player, 0, 8, 0, 0);
                itemServices.sound.sendSound(player, 616);
                yield new WaitCondition(7);
                itemServices.animation.playPlayerSeq(player, 1241);
                itemServices.movement.teleportPlayer(player, 2183, 3185, 0, true);
                setQuestStage(player, quest, itemServices, 12);
            }, { resetCamera: true });
        });
        for (const npcId of [639, 1114, 1327, 3433, 3434]) registry.registerNpcPreDeath(npcId, (event) => { const player = event.killer; if (player && getQuestStage(player, quest) === 8) setQuestStage(player, quest, event.services, 9); return NpcPreDeathDecision.Allow; });
    },
});

export const undergroundPassQuest = createDefinition({
    key: "underground_pass", name: "Underground Pass", varpId: 161, startedValue: 1, completionValue: 110,
    requirements: { skills: [{ skillId: SkillId.Ranged, level: 25, label: "Ranged" }], quests: [{ varpId: 68, minValue: 16, label: "Biohazard" }] },
    rewards: { questPoints: 5, xp: [{ skillId: SkillId.Attack, amount: 3_000, label: "Attack" }, { skillId: SkillId.Agility, amount: 3_000, label: "Agility" }], items: [{ itemId: 1409, quantity: 1, label: "Iban's staff" }, { itemId: 560, quantity: 15, label: "15 death runes" }, { itemId: 554, quantity: 30, label: "30 fire runes" }], other: ["Access to the Underground Pass and Isafdar", "The Iban Blast spell"] }, rewardItemId: 1409,
    startText: "speaking to <col=800000>King Lathas<col=000080> in East Ardougne.",
    journal: (stage) => [stage < 3 ? "Follow Koftik through the first caverns of the Underground Pass." : stage < 7 ? "Cross the traps, defeat the unicorn and descend to Iban's city." : stage < 9 ? "Restore the Doll of Iban with blood, dove, ashes and shadow." : "Defeat Iban and escape the pass."],
    register(quest, registry) {
        registerLinearSteps(quest, registry, [
            { stage: 0, next: 1, npcIds: [8046, 8842, 9005, 11022], npcName: "King Lathas", text: "The western pass leads to a land occupied by my brother Tyras. Help Koftik clear it." },
            { stage: 1, next: 2, npcIds: [3413, 8976], npcName: "Koftik", text: "Use my damp cloth on the arrows and cross the chasm.", gives: [{ itemId: 1485 }] },
            { stage: 2, next: 3, npcIds: [3413, 8976], npcName: "Koftik", text: "The fallen unicorn's horn will open the next gate.", gives: [{ itemId: 1487 }] },
            { stage: 3, next: 4, npcIds: [3413, 8976], npcName: "Koftik", text: "The unicorn's horn opens the next gate.", requires: [{ itemId: 1487 }] },
            { stage: 4, next: 6, npcIds: [3413, 8976], npcName: "Koftik", text: "Cross the great cavern and find the witch Kardia." },
            { stage: 6, next: 7, npcIds: [8991], npcName: "Kardia", text: "Iban's spirit is bound to this doll. His dove was kept by the paladins; find his shadow and ashes below.", gives: [{ itemId: 1492 }, { itemId: 1496 }] },
            { stage: 7, next: 8, npcIds: [8991], npcName: "Kardia", text: "The doll now bears Iban's blood, dove, ashes and shadow.", requires: [{ itemId: 1496 }, { itemId: 1500 }, { itemId: 1502 }] },
        ]);
        registry.registerNpcPreDeath(8997, (event) => {
            const player = event.killer;
            if (player && getQuestStage(player, quest) === 7 && !owns(player, event.services, 1502)) give(player, event.services, 1502);
            return NpcPreDeathDecision.Allow;
        });
        registry.registerNpcPreDeath(3962, (event) => {
            const player = event.killer;
            if (player && getQuestStage(player, quest) === 7 && !owns(player, event.services, 1500)) give(player, event.services, 1500);
            return NpcPreDeathDecision.Allow;
        });
        const startIbanHazard = (player: PlayerState, scriptServices: ScriptServices, iban: NpcPreDeathEvent["npc"]): void => {
            const taunts = [
                "Begone from my temple!",
                "Fool!",
                "I'll swallow your soul!",
                "You belong in the slave pits!",
                "You will die, frail mortal.",
                "You dare to defy me?!?",
                "Who dares desecrate my temple!",
                "I am the great Iban, I cannot die!",
            ];
            scriptServices.scheduler.repeat(2, 10, () => {
                if (player.worldViewId !== iban.worldViewId || getQuestStage(player, quest) !== 8 || iban.getHitpoints() <= 0) return;
                scriptServices.npc.faceNpcToTile(iban, { x: 2141, y: 4647 });
                scriptServices.npc.queueNpcSeq(iban, 347);
                scriptServices.npc.queueNpcForcedChat(iban, taunts[Math.floor(Math.random() * taunts.length)]);
                for (let round = 0; round < 8; round++) {
                    scriptServices.scheduler.after(round, () => {
                        if (player.worldViewId !== iban.worldViewId || getQuestStage(player, quest) !== 8) return;
                        let struck = false;
                        for (let bolt = 0; bolt < 25; bolt++) {
                            const tile = { x: 2136 + Math.floor(Math.random() * 6), y: 4639 + Math.floor(Math.random() * 12) };
                            scriptServices.animation.playLocGraphic({ spotId: 88, tile, level: 1 });
                            if (player.tileX === tile.x && player.tileY === tile.y) struck = true;
                        }
                        if (!struck) return;
                        scriptServices.combat.applyNpcDamageToPlayer(iban, player, 0, 5 + Math.floor(Math.random() * 6));
                        scriptServices.animation.playPlayerSeq(player, 424);
                        scriptServices.animation.broadcastPlayerSpot(player, 80, 124);
                    }, { kind: "player", id: player.id });
                }
            }, { kind: "player", id: player.id });
        };
        const enterIbanTemple = (player: PlayerState, scriptServices: ScriptServices): void => {
            if (scriptServices.instances.get(player.id)) return;
            const equipment = scriptServices.equipment.getEquipArray(player);
            if (!equipment.includes(1033) || !equipment.includes(1035)) {
                scriptServices.messaging.sendGameMessage(player, "The door refuses to open. Only followers of Zamorak may enter.");
                return;
            }
            if (!owns(player, scriptServices, 1492)) {
                scriptServices.messaging.sendGameMessage(player, "You should finish Kardia's doll before confronting Iban.");
                return;
            }
            const templateChunks = scriptServices.instances.buildTemplate([{
                sourceBaseX: 2112,
                sourceBaseY: 4608,
                widthChunks: 8,
                heightChunks: 8,
                sourcePlanes: [1],
                destinationChunkX: 3,
                destinationChunkY: 1,
            }]);
            const handle = scriptServices.instances.create(player, {
                templateChunks,
                destination: { x: 2142, y: 4648, level: 1 },
                exit: { x: 2144, y: 4648, level: 1 },
            });
            if (!handle) return;
            const iban = scriptServices.npc.spawnNpc({
                id: 8998,
                x: 2133,
                y: 4647,
                level: 1,
                worldViewId: handle.worldViewId,
                ownerPlayerId: player.id,
                wanderRadius: 0,
            });
            if (!iban) return;
            scriptServices.messaging.sendGameMessage(player, "Iban seems to sense the witch's magic in the doll.");
            scriptServices.npc.queueNpcForcedChat(iban, "An imposter dares desecrate the home of the only true child of Zamorak!");
            startIbanHazard(player, scriptServices, iban);
        };
        for (const locId of [3333, 3334]) {
            const fallback = registry.findLocInteraction(locId, "open");
            registry.registerLocScript({
                locId,
                action: "open",
                handler: (event) => {
                    if (event.services.instances.get(event.player.id)) {
                        event.services.instances.dispose(event.player, { x: 2144, y: 4648, level: 1 });
                        return;
                    }
                    if (getQuestStage(event.player, quest) !== 8) {
                        if (fallback) void fallback(event);
                        return;
                    }
                    enterIbanTemple(event.player, event.services);
                },
            });
        }
        registry.registerItemOnLoc(1492, 3359, ({ player, services: itemServices }) => {
            if (getQuestStage(player, quest) !== 8 || !itemServices.instances.get(player.id)) {
                itemServices.messaging.sendGameMessage(player, "Nothing interesting happens.");
                return;
            }
            const iban = itemServices.npc.findNearbyNpc(player, 8998, 32);
            if (!iban || iban.ownerPlayerId !== player.id) {
                itemServices.messaging.sendGameMessage(player, "Iban is already gone.");
                return;
            }
            if (!take(player, itemServices, 1492)) return;
            itemServices.sequence.run(player, function* () {
                itemServices.messaging.sendGameMessage(player, "You throw the doll of Iban into the well...");
                yield new WaitCondition(1);
                itemServices.npc.queueNpcForcedChat(iban, "What's happening? It's dark here... so dark!");
                yield new WaitCondition(1);
                itemServices.npc.queueNpcForcedChat(iban, "I'm falling into the dark, what have you done?");
                itemServices.npc.queueNpcSeq(iban, 836);
                yield new WaitCondition(1);
                itemServices.npc.queueNpcForcedChat(iban, "Noooooooo!");
                yield new WaitCondition(1);
                itemServices.npc.removeNpc(iban.id);
                itemServices.messaging.sendGameMessage(player, "A roar comes from the pit. The infamous Iban has finally gone to rest.");
                setQuestStage(player, quest, itemServices, 9);
                completeQuest(player, itemServices, quest);
                yield new WaitCondition(2);
                itemServices.camera.shake(player, 0, 8, 0, 0);
                for (const tile of [{ x: 2137, y: 4646 }, { x: 2139, y: 4651 }, { x: 2135, y: 4652 }, { x: 2140, y: 4644 }]) {
                    itemServices.animation.playLocGraphic({ spotId: 60, tile, level: 1 });
                }
                itemServices.messaging.sendGameMessage(player, "The temple walls begin to collapse and you are thrown from the platform!");
                yield new WaitCondition(2);
                itemServices.instances.dispose(player, { x: 2482, y: 9607, level: 0 });
            }, { resetCamera: true });
        });
    },
});

export const legendsQuest = createDefinition({
    key: "legends_quest", name: "Legend's Quest", varpId: 139, startedValue: 1, completionValue: 180,
    requirements: { questPoints: 107, skills: [{ skillId: SkillId.Agility, level: 50, label: "Agility" }, { skillId: SkillId.Crafting, level: 50, label: "Crafting" }, { skillId: SkillId.Herblore, level: 45, label: "Herblore" }, { skillId: SkillId.Magic, level: 56, label: "Magic" }, { skillId: SkillId.Mining, level: 52, label: "Mining" }, { skillId: SkillId.Prayer, level: 42, label: "Prayer" }, { skillId: SkillId.Smithing, level: 50, label: "Smithing" }, { skillId: SkillId.Strength, level: 50, label: "Strength" }, { skillId: SkillId.Thieving, level: 50, label: "Thieving" }, { skillId: SkillId.Woodcutting, level: 50, label: "Woodcutting" }], quests: [{ varpId: 148, minValue: 11, label: "Family Crest" }, { varpId: 188, minValue: 15, label: "Heroes' Quest" }, { varpId: 116, minValue: 15, label: "Shilo Village" }, { varpId: 161, minValue: 110, label: "Underground Pass" }] },
    rewards: { questPoints: 4, xp: [{ skillId: SkillId.Attack, amount: 7_650, label: "Attack" }, { skillId: SkillId.Defence, amount: 7_650, label: "Defence" }, { skillId: SkillId.Strength, amount: 7_650, label: "Strength" }, { skillId: SkillId.Hitpoints, amount: 7_650, label: "Hitpoints" }], other: ["Access to the Legends' Guild", "The ability to wield the dragon sq shield", "A gilded totem"] }, rewardItemId: 750,
    startText: "speaking to <col=800000>Radimus Erkle<col=000080> at the Legends' Guild.",
    journal: (stage) => [stage < 4 ? "Map the Kharazi Jungle for Radimus and summon Gujuo." : stage < 16 ? "Rescue Ungadulu and restore the sacred water pool." : stage < 35 ? "Descend into the caverns and defeat Nezikchened three times." : "Return the gilded totem to Radimus Erkle."],
    register(quest, registry) {
        registerLinearSteps(quest, registry, [
            { stage: 0, next: 1, npcIds: [3953], npcName: "Radimus Erkle", text: "Map the western, central and eastern Kharazi Jungle. Take these notes.", gives: [{ itemId: 714 }] },
            { stage: 1, next: 2, npcIds: [3954, 3955], npcName: "Jungle forester", text: "Your completed map impresses the foresters.", requires: [{ itemId: 714 }] },
            { stage: 2, next: 4, npcIds: [3954, 3955], npcName: "Jungle forester", text: "Use this bull roarer to call Gujuo.", gives: [{ itemId: 716 }] },
            { stage: 4, next: 7, npcIds: [3957], npcName: "Ungadulu", text: "Nezikchened has imprisoned me. Prepare holy water with a golden bowl and the Book of Binding." },
            { stage: 7, next: 11, npcIds: [3957], npcName: "Ungadulu", text: "The sacred fire summons Nezikchened. Defeat him.", spawnNpcId: 3962 },
            { stage: 12, next: 16, npcIds: [3957], npcName: "Ungadulu", text: "The Yommi tree restores the pool. Descend with bravery potion, rope and the seven gems." },
            { stage: 16, next: 20, npcIds: [3964, 3965, 3966], npcName: "Ancient warrior", text: "The three defeated warriors' crystal pieces form a dark dagger. Push the boulder from the sacred spring.", requires: [{ itemId: 741 }, { itemId: 742 }, { itemId: 743 }], gives: [{ itemId: 746 }], spawnNpcId: 3962 },
            { stage: 22, next: 32, npcIds: [3957], npcName: "Ungadulu", text: "Collect sacred water and carve the Yommi tree into a new totem. Nezikchened rises a final time as you try to replace it.", spawnNpcId: 3962 },
            { stage: 35, next: 40, npcIds: [3957], npcName: "Ungadulu", text: "Nezikchened is banished. Replace the stolen totem.", gives: [{ itemId: 750 }] },
            { stage: 40, next: 180, npcIds: [3953], npcName: "Radimus Erkle", text: "Your name is entered among the legends of this guild.", requires: [{ itemId: 750 }], complete: true },
        ]);
        registry.registerItemAction(716, ({ player, services }) => { if (getQuestStage(player, quest) === 2) setQuestStage(player, quest, services, 4); }, "swing");
        for (const [npcId, crystal] of [[3964, 741], [3965, 742], [3966, 743]] as const) {
            registry.registerNpcPreDeath(npcId, (event) => {
                const player = event.killer;
                if (player && getQuestStage(player, quest) === 16 && !owns(player, event.services, crystal)) give(player, event.services, crystal);
                return NpcPreDeathDecision.Allow;
            });
        }
        const daggerUsed = new Set<number>();
        const prayerDrained = new Set<number>();
        const previousNezikchenedPreDeath = registry.findNpcPreDeath(3962);
        registry.registerNpcAttack(3962, (event) => {
            if (event.npc.ownerPlayerId !== event.target.id) return NpcAttackDecision.Allow;
            const stage = getQuestStage(event.target, quest);
            if (stage !== 11 && stage !== 20 && stage !== 32) return NpcAttackDecision.Allow;
            if (stage === 32 && !prayerDrained.has(event.npc.id)) {
                prayerDrained.add(event.npc.id);
                const prayer = event.target.skillSystem.getSkill(SkillId.Prayer);
                const current = Math.max(0, prayer.baseLevel + prayer.boost);
                event.target.skillSystem.setSkillBoost(SkillId.Prayer, Math.floor(current * 0.25));
                event.target.prayer.clearActivePrayers();
                event.services.combat.queueCombatState(event.target);
                event.services.messaging.sendGameMessage(event.target, "You feel a great sense of loss as Nezikchened drains your faith.");
                event.services.npc.queueNpcForcedChat(event.npc, "Your faith will help you little here.");
            }
            if (stage === 20 && !daggerUsed.has(event.npc.id) && Math.random() < 0.1) {
                daggerUsed.add(event.npc.id);
                event.services.messaging.sendGameMessage(event.target, "The demon takes out a dark dagger and throws it at you.");
                const damage = Math.floor(Math.random() * 19);
                if (Math.random() < 1 / 3) {
                    event.services.messaging.sendGameMessage(event.target, "You neatly dodge the attack.");
                } else {
                    event.services.combat.applyNpcDamageToPlayer(event.npc, event.target, 0, damage);
                    event.services.npc.queueNpcForcedChat(event.npc, "Ha, ha, ha... feel my power!");
                }
                return NpcAttackDecision.Prevent;
            }
            const distance = Math.max(
                Math.abs(event.npc.tileX - event.target.tileX),
                Math.abs(event.npc.tileY - event.target.tileY),
            );
            if (distance <= 3) return NpcAttackDecision.Allow;
            event.services.npc.queueNpcSeq(event.npc, 69);
            event.services.npc.queueNpcSpotAnim(event.npc, 194, 92);
            event.services.projectiles.launch({
                projectileId: 195,
                source: { tileX: event.npc.tileX, tileY: event.npc.tileY, plane: event.npc.level, actor: { kind: "npc", serverId: event.npc.id } },
                target: { tileX: event.target.tileX, tileY: event.target.tileY, plane: event.target.level, actor: { kind: "player", serverId: event.target.id } },
                sourceHeight: 43 * 4,
                endHeight: 31 * 4,
                slope: 16,
                startPos: 64,
                startCycleOffset: 0,
                endCycleOffset: Math.max(10, distance * 10 - 5),
            });
            event.services.scheduler.after(1, () => {
                if (event.npc.getHitpoints() <= 0 || event.target.worldViewId !== event.npc.worldViewId) return;
                event.services.animation.broadcastPlayerSpot(event.target, 197, 0);
                event.services.combat.applyNpcDamageToPlayer(event.npc, event.target, 0, Math.floor(Math.random() * 19));
            }, { kind: "player", id: event.target.id });
            return NpcAttackDecision.Prevent;
        });
        registry.registerNpcPreDeath(3962, (event) => {
            const player = event.killer;
            if (!player || event.npc.ownerPlayerId !== player.id) {
                return previousNezikchenedPreDeath?.(event) ?? NpcPreDeathDecision.Allow;
            }
            daggerUsed.delete(event.npc.id);
            prayerDrained.delete(event.npc.id);
            const stage = getQuestStage(player, quest);
            if (stage === 11) {
                setQuestStage(player, quest, event.services, 12);
                event.services.npc.queueNpcForcedChat(event.npc, "But I will leave you with a taste of my power...");
                event.services.scheduler.after(2, () => {
                    event.services.animation.broadcastPlayerSpot(player, 76, 0);
                    event.services.combat.applyNpcDamageToPlayer(event.npc, player, 0, Math.floor(Math.random() * 17));
                }, { kind: "player", id: player.id });
            } else if (stage === 20) {
                setQuestStage(player, quest, event.services, 22);
                event.services.npc.queueNpcForcedChat(event.npc, "Very well, I will ready myself for our next encounter...");
            } else if (stage === 32) {
                setQuestStage(player, quest, event.services, 35);
                event.services.npc.queueNpcForcedChat(event.npc, "I am beaten by a mere mortal...");
            }
            return NpcPreDeathDecision.Allow;
        });
    },
});

export const fremennikTrialsQuest = createDefinition({
    key: "fremennik_trials", name: "The Fremennik Trials", varpId: 347, startedValue: 1, completionValue: 10,
    requirements: { skills: [{ skillId: SkillId.Fletching, level: 25, label: "Fletching" }, { skillId: SkillId.Woodcutting, level: 40, label: "Woodcutting" }, { skillId: SkillId.Crafting, level: 40, label: "Crafting" }] },
    rewards: { questPoints: 3, xp: [{ skillId: SkillId.Fletching, amount: 2_812, label: "Fletching" }, { skillId: SkillId.Fishing, amount: 2_812, label: "Fishing" }, { skillId: SkillId.Crafting, amount: 2_812, label: "Crafting" }, { skillId: SkillId.Agility, amount: 2_812, label: "Agility" }, { skillId: SkillId.Thieving, amount: 2_812, label: "Thieving" }], other: ["Fremennik citizenship and a Fremennik name", "Access to Miscellania, Etceteria, Neitiznot and Jatizso"] }, rewardItemId: 3748,
    startText: "speaking to <col=800000>Brundt the Chieftain<col=000080> in Rellekka.",
    journal: () => ["Earn seven votes from Rellekka's council: Manni, Olaf, Sigli,", "Swensen, Thorvald, Peer and Sigmund, then return to Brundt."],
    register(quest, registry) {
        const chiefIds = [8048, 9263, 9266];
        const chief = (event: NpcInteractionEvent): void => {
            const stage = getQuestStage(event.player, quest);
            const votes = event.player.varps.getVarpValue(348) & 0x7f;
            if (stage === 0) {
                if (!meetsQuestRequirements(event.player, event.services, quest)) { startConversation(npcContext(event, "Brundt the Chieftain"), [sayNpc("You lack the crafting skills for our trials.")]); return; }
                startConversation(npcContext(event, "Brundt the Chieftain"), [sayNpc("Win seven votes from our council and you will become Fremennik."), run(({ player, services }) => { setVarp(player, services, 348, 0); setQuestStage(player, quest, services, 1); })]); return;
            }
            if (stage === 1 && votes === 0x7f) { startConversation(npcContext(event, "Brundt the Chieftain"), [sayNpc("Seven elders support you. Rise as a Fremennik of Rellekka!"), run(({ player, services }) => { completeQuest(player, services, quest); setVarp(player, services, 348, 0); })]); return; }
            startConversation(npcContext(event, "Brundt the Chieftain"), [sayNpc(`You have ${votes.toString(2).split("1").length - 1} of the seven votes.`)]);
        };
        for (const npcId of chiefIds) registry.registerNpcScript({ npcId, option: "talk-to", handler: chief });
        const MANNI_VARP = 349;
        const OLAF_VARP = 350;
        const SIGLI_VARP = 352;
        const SWENSEN_VARP = 353;
        const PEER_VARP = 354;
        const SIGMUND_VARP = 355;
        const THORVALD_VARP = 356;
        const askeladdenIds = [8402, 8403, 8404, 8405] as const;
        const grantVote = (player: PlayerState, scriptServices: ScriptServices, bit: number): void =>
            setVarp(player, scriptServices, 348, player.varps.getVarpValue(348) | (1 << bit));
        const hasVote = (player: PlayerState, bit: number): boolean =>
            (player.varps.getVarpValue(348) & (1 << bit)) !== 0;

        registry.registerNpcScript({
            npcId: 3920,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if (hasVote(event.player, 0)) {
                    startConversation(npcContext(event, "Manni the Reveller"), [sayNpc("Anyone who can drink like you has my vote!")]);
                    return;
                }
                const progress = event.player.varps.getVarpValue(MANNI_VARP);
                if (progress === 0) {
                    startConversation(npcContext(event, "Manni the Reveller"), [
                        sayNpc("Beat me in a drinking contest. Bring a keg from the longhall table when you are ready."),
                        run(({ player, services }) => setVarp(player, services, MANNI_VARP, 1)),
                    ]);
                    return;
                }
                if (!has(event.player, event.services, 3711)) {
                    startConversation(npcContext(event, "Manni the Reveller"), [sayNpc("Bring a keg of beer from the table and we will begin.")]);
                    return;
                }
                if (progress < 3) {
                    startConversation(npcContext(event, "Manni the Reveller"), [
                        sayNpc("Drink up, outerlander!"),
                        run(({ player, services }) => {
                            take(player, services, 3711);
                            services.camera.shake(player, 3, 0, 20, 2);
                            services.messaging.sendGameMessage(player, "You drink the keg and become far too drunk to continue.");
                        }),
                        sayNpc("I win! Find a cunning way to stay on your feet before our rematch."),
                    ]);
                    return;
                }
                startConversation(npcContext(event, "Manni the Reveller"), [
                    sayNpc("You drank the whole keg and it did not affect you at all! I concede."),
                    run(({ player, services }) => {
                        take(player, services, 3711);
                        setVarp(player, services, MANNI_VARP, 4);
                        grantVote(player, services, 0);
                    }),
                ]);
            },
        });
        registry.registerNpcScript({
            npcId: 4227,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1 || event.player.varps.getVarpValue(MANNI_VARP) < 1) return;
                if (owns(event.player, event.services, 3712)) {
                    startConversation(npcContext(event, "Poison Salesman"), [sayNpc("You already have a keg of my patented low-alcohol beer.")]);
                    return;
                }
                startConversation(npcContext(event, "Poison Salesman"), [
                    sayNpc("A low-alcohol keg costs 250 coins. It tastes like beer, but will not make you drunk."),
                    choose([
                        option("Buy one for 250 coins.", [run(({ player, services }) => {
                            if (!take(player, services, 995, 250)) return;
                            give(player, services, 3712);
                        })]),
                        option("No thanks."),
                    ]),
                ]);
            },
        });
        registry.registerItemOnNpc(1917, 3921, ({ player, services }) => {
            if (getQuestStage(player, quest) !== 1 || owns(player, services, 3713) || owns(player, services, 3714)) return;
            if (!take(player, services, 1917)) return;
            if (give(player, services, 3713)) services.messaging.sendGameMessage(player, "The workman trades you a strange explosive object for the beer.");
        });
        registry.registerItemOnItem(3713, 590, ({ player, services }) => {
            if (getQuestStage(player, quest) !== 1 || !take(player, services, 3713)) return;
            if (give(player, services, 3714)) services.messaging.sendGameMessage(player, "You light the strange object. Its fuse begins to hiss.");
        });
        registry.registerItemOnLoc(3714, 4162, ({ player, services }) => {
            if (getQuestStage(player, quest) !== 1 || !take(player, services, 3714)) return;
            setVarp(player, services, MANNI_VARP, Math.max(2, player.varps.getVarpValue(MANNI_VARP)));
            services.messaging.sendGameMessage(player, "You push the lit object into the pipe. It will make a perfect distraction.");
        });
        registry.registerItemOnItem(3712, 3711, ({ player, services }) => {
            if (getQuestStage(player, quest) !== 1 || player.varps.getVarpValue(MANNI_VARP) < 2) {
                services.messaging.sendGameMessage(player, "Manni is watching too closely for you to swap the beer.");
                return;
            }
            if (!take(player, services, 3712)) return;
            setVarp(player, services, MANNI_VARP, 3);
            services.messaging.sendGameMessage(player, "A bang echoes through the pipe. While everyone looks away, you refill the keg with low-alcohol beer.");
        });

        registry.registerNpcScript({
            npcId: 802,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if (hasVote(event.player, 1)) {
                    startConversation(npcContext(event, "Olaf the Bard"), [sayNpc("Your performance earned my vote, fellow bard.")]);
                    return;
                }
                if (event.player.varps.getVarpValue(OLAF_VARP) === 0) {
                    startConversation(npcContext(event, "Olaf the Bard"), [
                        sayNpc("Craft a lyre from the swaying tree, string it with Lalli's golden wool, have Fossegrimen enchant it, then perform in the longhall."),
                        run(({ player, services }) => setVarp(player, services, OLAF_VARP, 1)),
                    ]);
                    return;
                }
                startConversation(npcContext(event, "Olaf the Bard"), [sayNpc("Bring an enchanted lyre to the longhall stage and play your ballad.")]);
            },
        });
        registry.registerLocScript({
            locId: 4142,
            action: "cut-branch",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) !== 1 || player.varps.getVarpValue(OLAF_VARP) < 1) return;
                if (services.skills.getSkill(player, SkillId.Woodcutting).baseLevel < 40) {
                    services.messaging.sendGameMessage(player, "You need Woodcutting level 40 to cut a musical branch.");
                    return;
                }
                const axes = new Set([1349, 1351, 1353, 1355, 1357, 1359, 1361, 6739, 13241, 20011, 23279, 23673, 25371, 27194, 28217]);
                if (!services.inventory.collectCarriedItemIds(player).some((itemId) => axes.has(itemId))) {
                    services.messaging.sendGameMessage(player, "You need an axe to cut a branch from this tree.");
                    return;
                }
                if (give(player, services, 3692)) {
                    services.skills.addSkillXp(player, SkillId.Woodcutting, 10);
                    services.messaging.sendGameMessage(player, "You cut a branch from the strangely musical tree.");
                }
            },
        });
        registry.registerItemOnItem(3692, 946, ({ player, services }) => {
            if (services.skills.getSkill(player, SkillId.Crafting).baseLevel < 40) {
                services.messaging.sendGameMessage(player, "You need Crafting level 40 to carve a lyre.");
                return;
            }
            if (!take(player, services, 3692)) return;
            if (give(player, services, 3688)) services.skills.addSkillXp(player, SkillId.Crafting, 10);
        });
        const askeladden = (event: NpcInteractionEvent): void => {
                if (getQuestStage(event.player, quest) !== 1 || event.player.varps.getVarpValue(OLAF_VARP) < 1) return;
                if (owns(event.player, event.services, 3695)) {
                    startConversation(npcContext(event, "Askeladden"), [sayNpc("That pet rock should fool Lalli... although perhaps not twice in the same way.")]);
                    return;
                }
                startConversation(npcContext(event, "Askeladden"), [
                    sayNpc("Lalli once traded golden wool for a pet that never sleeps. Try this pet rock, then make him stone soup if he recognises the trick."),
                    run(({ player, services }) => give(player, services, 3695)),
                ]);
        };
        for (const npcId of askeladdenIds) registry.registerNpcScript({ npcId, option: "talk-to", handler: askeladden });
        const stewIngredients = new Map([[3695, 8], [1965, 9], [1942, 10], [1957, 11]]);
        for (const [itemId, bit] of stewIngredients) {
            registry.registerItemOnLoc(itemId, 4149, ({ player, services }) => {
                if (getQuestStage(player, quest) !== 1 || player.varps.getVarpValue(OLAF_VARP) < 1) return;
                if (((player.varps.getVarpValue(OLAF_VARP) >>> bit) & 1) !== 0) {
                    services.messaging.sendGameMessage(player, "That ingredient is already in Lalli's stew.");
                    return;
                }
                if (!take(player, services, itemId)) return;
                setVarp(player, services, OLAF_VARP, player.varps.getVarpValue(OLAF_VARP) | (1 << bit));
                services.messaging.sendGameMessage(player, "You add the ingredient to Lalli's stone soup.");
            });
        }
        registry.registerNpcScript({
            npcId: 803,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1 || event.player.varps.getVarpValue(OLAF_VARP) < 1) return;
                if (owns(event.player, event.services, 3693) || owns(event.player, event.services, 3694)) {
                    startConversation(npcContext(event, "Lalli"), [sayNpc("Me already trade you golden fleece for tasty stone soup!")]);
                    return;
                }
                const ingredients = (event.player.varps.getVarpValue(OLAF_VARP) >>> 8) & 0xf;
                if (ingredients !== 0xf) {
                    startConversation(npcContext(event, "Lalli"), [sayNpc("Me want stone soup: special rock, cabbage, potato and onion in cauldron!")]);
                    return;
                }
                startConversation(npcContext(event, "Lalli"), [
                    sayNpc("Stone soup delicious! Me trade worthless golden fleece for magic soup stone."),
                    run(({ player, services }) => give(player, services, 3693)),
                ]);
            },
        });
        registry.registerItemOnItem(3688, 3694, ({ player, services }) => {
            if (services.skills.getSkill(player, SkillId.Fletching).baseLevel < 25) {
                services.messaging.sendGameMessage(player, "You need Fletching level 25 to string the lyre.");
                return;
            }
            if (!take(player, services, 3688) || !take(player, services, 3694)) return;
            if (give(player, services, 3689)) services.skills.addSkillXp(player, SkillId.Fletching, 10);
        });
        for (const offering of [383, 395, 389]) {
            registry.registerItemOnLoc(offering, 4141, ({ player, services }) => {
                if (getQuestStage(player, quest) !== 1 || player.varps.getVarpValue(OLAF_VARP) < 1 || !has(player, services, 3689)) return;
                if (!take(player, services, offering) || !take(player, services, 3689)) return;
                if (give(player, services, 3690)) services.messaging.sendGameMessage(player, "Fossegrimen accepts the offering and enchants your lyre.");
            });
        }
        registry.registerItemAction(3690, ({ player, services }) => {
            if (getQuestStage(player, quest) !== 1 || player.varps.getVarpValue(OLAF_VARP) < 1 || hasVote(player, 1)) return;
            if (player.tileX < 2655 || player.tileX > 2675 || player.tileY < 3670 || player.tileY > 3690) {
                services.messaging.sendGameMessage(player, "You should perform this enchanted lyre on the longhall stage.");
                return;
            }
            services.sequence.run(player, function* () {
                services.messaging.sendGameMessage(player, "You begin a ballad for the longhall revellers.");
                yield new WaitCondition(3);
                services.messaging.sendGameMessage(player, "The audience jeers, laughs, and finally applauds your perfectly tuned lyre.");
                yield new WaitCondition(3);
                take(player, services, 3690);
                give(player, services, 3689);
                setVarp(player, services, OLAF_VARP, 2);
                grantVote(player, services, 1);
                services.messaging.sendGameMessage(player, "Congratulations! You have completed the Bard's Trial.");
            });
        }, "play");

        registry.registerNpcScript({
            npcId: 3924,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if (hasVote(event.player, 2)) {
                    startConversation(npcContext(event, "Sigli the Huntsman"), [sayNpc("You bound the Draugen. You have my vote.")]);
                    return;
                }
                if (owns(event.player, event.services, 3696)) {
                    startConversation(npcContext(event, "Sigli the Huntsman"), [
                        sayNpc("The charged talisman proves the Draugen is defeated. You have my vote."),
                        run(({ player, services }) => {
                            take(player, services, 3696);
                            setVarp(player, services, SIGLI_VARP, 2);
                            grantVote(player, services, 2);
                        }),
                    ]);
                    return;
                }
                if (!owns(event.player, event.services, 3697)) {
                    startConversation(npcContext(event, "Sigli the Huntsman"), [
                        sayNpc("Use this hunters' talisman to track and defeat the Draugen that haunts our lands."),
                        run(({ player, services }) => {
                            if (give(player, services, 3697)) setVarp(player, services, SIGLI_VARP, 1);
                        }),
                    ]);
                    return;
                }
                startConversation(npcContext(event, "Sigli the Huntsman"), [sayNpc("Use the talisman to locate the Draugen, then bind its spirit in combat.")]);
            },
        });
        registry.registerItemAction(3697, ({ player, services }) => {
            if (getQuestStage(player, quest) !== 1 || player.varps.getVarpValue(SIGLI_VARP) !== 1) return;
            if (services.npc.findNearbyNpc(player, 3922, 30)) {
                services.messaging.sendGameMessage(player, "The talisman pulls strongly toward the nearby Draugen.");
                return;
            }
            const draugen = services.npc.spawnNpc({
                id: 3922,
                x: player.tileX + 2,
                y: player.tileY + 1,
                level: player.level,
                worldViewId: player.worldViewId,
                ownerPlayerId: player.id,
                lifetimeTicks: 1_000,
                wanderRadius: 0,
            });
            if (!draugen) return;
            services.npc.queueNpcForcedChat(draugen, "You will never bind me, outerlander!");
            services.npc.engageCombat(draugen, player);
        }, "locate");
        registry.registerNpcPreDeath(3922, (event) => {
            const player = event.killer;
            if (!player || event.npc.ownerPlayerId !== player.id || player.varps.getVarpValue(SIGLI_VARP) !== 1) return NpcPreDeathDecision.Allow;
            if (take(player, event.services, 3697) && give(player, event.services, 3696)) {
                event.services.messaging.sendGameMessage(player, "The Draugen's essence is drawn into the hunters' talisman.");
            }
            return NpcPreDeathDecision.Allow;
        });

        registry.registerNpcScript({
            npcId: 3925,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if (hasVote(event.player, 3)) {
                    startConversation(npcContext(event, "Swensen the Navigator"), [sayNpc("You mastered my maze and have my vote.")]);
                    return;
                }
                if (event.player.varps.getVarpValue(SWENSEN_VARP) === 0) {
                    startConversation(npcContext(event, "Swensen the Navigator"), [
                        sayNpc("Find the route through my portal maze beneath this house. The exit ladder is your only proof."),
                        run(({ player, services }) => setVarp(player, services, SWENSEN_VARP, 1)),
                    ]);
                    return;
                }
                startConversation(npcContext(event, "Swensen the Navigator"), [sayNpc("The maze is below my house. Only the seven correct portals lead to the exit.")]);
            },
        });
        registry.registerLocScript({ locId: 4158, action: "climb-down", handler: ({ player, services }) => {
            if (getQuestStage(player, quest) === 1 && player.varps.getVarpValue(SWENSEN_VARP) === 1) services.movement.teleportPlayer(player, 2631, 10004, 0);
        } });
        registry.registerLocScript({ locId: 4159, action: "climb-up", handler: ({ player, services }) => services.movement.teleportPlayer(player, 2644, 3658, 0) });
        registry.registerLocScript({ locId: 4161, action: "climb-up", handler: ({ player, services }) => services.movement.teleportPlayer(player, 2647, 3658, 0) });
        registry.registerLocScript({ locId: 4160, action: "climb-up", handler: ({ player, services }) => {
            if (getQuestStage(player, quest) !== 1 || player.varps.getVarpValue(SWENSEN_VARP) !== 1) return;
            setVarp(player, services, SWENSEN_VARP, 2);
            grantVote(player, services, 3);
            services.movement.teleportPlayer(player, 2649, 3661, 0);
            services.messaging.sendGameMessage(player, "You emerge from the maze. Swensen grants you his vote.");
        } });
        const mazeDestinations = new Map<number, readonly [number, number]>([
            [4150, [2642, 10017]], [4151, [2651, 10004]], [4152, [2667, 10015]], [4153, [2630, 10028]],
            [4154, [2653, 10035]], [4155, [2668, 10026]], [4156, [2665, 10038]],
        ]);
        for (const [locId, destination] of mazeDestinations) {
            registry.registerLocScript({ locId, action: "use", handler: ({ player, services }) => services.movement.teleportPlayer(player, destination[0], destination[1], 0) });
        }
        const wrongMazeDestinations: readonly (readonly [number, number])[] = [
            [2632, 10037], [2642, 10037], [2631, 10017], [2631, 10013], [2655, 10015], [2662, 10004], [2631, 10003],
            [2644, 10039], [2628, 10037], [2653, 10017], [2656, 10026], [2666, 10004], [2628, 10037], [2642, 10028],
            [2652, 10026], [2642, 10024], [2640, 10005], [2629, 10015], [2644, 10005], [2651, 10015],
        ];
        registry.registerLocScript({ locId: 4157, action: "use", handler: ({ player, services }) => {
            const destination = wrongMazeDestinations[Math.floor(Math.random() * wrongMazeDestinations.length)];
            services.movement.teleportPlayer(player, destination[0], destination[1], 0);
        } });

        const getPeerProgress = (player: PlayerState): number => player.varps.getVarpValue(PEER_VARP) & 0xf;
        const setPeerProgress = (player: PlayerState, scriptServices: ScriptServices, progress: number): void =>
            setVarp(player, scriptServices, PEER_VARP, (player.varps.getVarpValue(PEER_VARP) & ~0xf) | progress);
        registry.registerNpcScript({
            npcId: 3895,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if (hasVote(event.player, 5)) {
                    startConversation(npcContext(event, "Peer the Seer"), [sayNpc("You solved my riddles and escaped my house. You have my vote.")]);
                    return;
                }
                if (getPeerProgress(event.player) === 0) {
                    if (event.services.inventory.collectCarriedItemIds(event.player).length !== 0) {
                        startConversation(npcContext(event, "Peer the Seer"), [sayNpc("Enter my house with no inventory, weapons, or armour. Bank everything before beginning.")]);
                        return;
                    }
                    const riddle = Math.floor(Math.random() * 6);
                    startConversation(npcContext(event, "Peer the Seer"), [
                        sayNpc("Enter through one door, solve every puzzle inside, recover the Seers' key, and leave through the other."),
                        run(({ player, services }) => setVarp(player, services, PEER_VARP, 1 | (riddle << 4))),
                    ]);
                    return;
                }
                startConversation(npcContext(event, "Peer the Seer"), [sayNpc("The combination riddle is on the first door. Everything else you need is hidden inside.")]);
            },
        });
        const peerRiddles = [
            ["My first is in mage, but not in wizard. My whole is the most powerful tool you will possess.", "Mind", "Time", "Wind"],
            ["My first is in tar, but not in a swamp. My whole wears more rings the older I get.", "Tree", "Fire", "Life"],
            ["My first is in the well, but not at sea. My whole when stolen from you causes you death.", "Life", "Mind", "Tree"],
            ["My first is in fish, but not in the sea. My whole cannot die as long as it has food.", "Fire", "Time", "Wind"],
            ["My first is in water, and also in tea. My whole crushes mountains and destroys civilisations.", "Time", "Life", "Mind"],
            ["My first is in wizard, but not in a mage. My whole helps make bread, birds fly and boats sail.", "Wind", "Tree", "Fire"],
        ] as const;
        registry.registerLocScript({
            locId: 4165,
            action: "open",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) !== 1 || getPeerProgress(player) === 0) return;
                if (getPeerProgress(player) >= 2) {
                    services.movement.teleportPlayer(player, player.tileX < 2636 ? 2637 : 2635, player.tileY, player.level);
                    return;
                }
                const riddle = peerRiddles[(player.varps.getVarpValue(PEER_VARP) >>> 4) & 0x7] ?? peerRiddles[0];
                const context = { player, services, npcId: 3895, npcName: "Combination lock" };
                startConversation(context, [
                    sayNpc(riddle[0]),
                    choose([
                        option(riddle[1], [run(({ player: choicePlayer, services: choiceServices }) => {
                            setPeerProgress(choicePlayer, choiceServices, 2);
                            choiceServices.messaging.sendGameMessage(choicePlayer, "The combination lock clicks open.");
                        })]),
                        option(riddle[2], [sayNpc("The lock buzzes. That answer is wrong.")]),
                        option(riddle[3], [sayNpc("The lock buzzes. That answer is wrong.")]),
                    ]),
                ]);
            },
        });
        const givePeerItem = (locId: number, action: string, itemId: number, message: string): void => {
            registry.registerLocScript({ locId, action, handler: ({ player, services }) => {
                if (getQuestStage(player, quest) !== 1 || getPeerProgress(player) < 2 || owns(player, services, itemId)) return;
                if (give(player, services, itemId)) services.messaging.sendGameMessage(player, message);
            } });
        };
        givePeerItem(4167, "open", 3732, "You find a jug marked with the number three.");
        givePeerItem(4168, "search", 3732, "You find a jug marked with the number three.");
        givePeerItem(4177, "open", 3727, "You find a bucket marked with the number five.");
        givePeerItem(4178, "search", 3727, "You find a bucket marked with the number five.");
        givePeerItem(4171, "search", 3742, "Hidden behind the books is a red herring.");
        givePeerItem(4181, "study", 3743, "The unicorn's eye is really a red wooden disk.");
        givePeerItem(4182, "study", 3744, "The bull's eye is an uncoloured wooden disk.");
        const bucketIds = [3727, 3726, 3725, 3724, 3723, 3722] as const;
        const jugIds = [3732, 3731, 3730, 3729] as const;
        for (let volume = 0; volume < bucketIds.length; volume++) {
            registry.registerItemOnLoc(bucketIds[volume], 4176, ({ player, services }) => {
                if (!take(player, services, bucketIds[volume])) return;
                give(player, services, bucketIds[5]);
            });
            registry.registerItemOnLoc(bucketIds[volume], 4175, ({ player, services }) => {
                if (!take(player, services, bucketIds[volume])) return;
                give(player, services, bucketIds[0]);
            });
        }
        for (let volume = 0; volume < jugIds.length; volume++) {
            registry.registerItemOnLoc(jugIds[volume], 4176, ({ player, services }) => {
                if (!take(player, services, jugIds[volume])) return;
                give(player, services, jugIds[3]);
            });
            registry.registerItemOnLoc(jugIds[volume], 4175, ({ player, services }) => {
                if (!take(player, services, jugIds[volume])) return;
                give(player, services, jugIds[0]);
            });
        }
        for (let bucketVolume = 0; bucketVolume < bucketIds.length; bucketVolume++) {
            for (let jugVolume = 0; jugVolume < jugIds.length; jugVolume++) {
                registry.registerItemOnItem(bucketIds[bucketVolume], jugIds[jugVolume], ({ player, services, source, target }) => {
                    const sourceIsBucket = bucketIds.includes(source.itemId as typeof bucketIds[number]);
                    const sourceVolume = sourceIsBucket ? bucketIds.indexOf(source.itemId as typeof bucketIds[number]) : jugIds.indexOf(source.itemId as typeof jugIds[number]);
                    const targetVolume = sourceIsBucket ? jugIds.indexOf(target.itemId as typeof jugIds[number]) : bucketIds.indexOf(target.itemId as typeof bucketIds[number]);
                    const targetCapacity = sourceIsBucket ? 3 : 5;
                    const moved = Math.min(sourceVolume, targetCapacity - targetVolume);
                    if (moved <= 0) {
                        services.messaging.sendGameMessage(player, "No more water will fit in that container.");
                        return;
                    }
                    if (!take(player, services, source.itemId) || !take(player, services, target.itemId)) return;
                    const nextSourceVolume = sourceVolume - moved;
                    const nextTargetVolume = targetVolume + moved;
                    give(player, services, sourceIsBucket ? bucketIds[nextSourceVolume] : jugIds[nextSourceVolume]);
                    give(player, services, sourceIsBucket ? jugIds[nextTargetVolume] : bucketIds[nextTargetVolume]);
                });
            }
        }
        registry.registerItemOnLoc(3723, 4170, ({ player, services }) => {
            if (owns(player, services, 3734)) return;
            if (give(player, services, 3734)) services.messaging.sendGameMessage(player, "Four fifths of a bucket balances the chest lock. Inside is a strange vase.");
        });
        registry.registerItemOnLoc(3742, 4172, ({ player, services }) => {
            if (!take(player, services, 3742)) return;
            give(player, services, 347);
            give(player, services, 3746);
            services.messaging.sendGameMessage(player, "The red coating peels from the herring as sticky red goop.");
        });
        registry.registerItemOnItem(3744, 3746, ({ player, services }) => {
            if (!take(player, services, 3744) || !take(player, services, 3746)) return;
            if (give(player, services, 3743)) services.messaging.sendGameMessage(player, "You coat the wooden disk with sticky red goop.");
        });
        registry.registerItemOnLoc(3743, 4179, ({ player, services }) => {
            const disks = getVarpRange(player, PEER_VARP, 8, 9);
            if (disks >= 2 || !take(player, services, 3743)) return;
            setVarpRange(player, services, PEER_VARP, 8, 9, disks + 1);
            if (disks + 1 === 2 && give(player, services, 3737)) services.messaging.sendGameMessage(player, "Both disks complete the mural. Its centre opens and reveals a vase lid.");
            else services.messaging.sendGameMessage(player, "The red disk fits one of the mural's empty eyes.");
        });
        registry.registerItemOnLoc(3743, 4180, ({ player, services }) => {
            const disks = getVarpRange(player, PEER_VARP, 8, 9);
            if (disks >= 2 || !take(player, services, 3743)) return;
            setVarpRange(player, services, PEER_VARP, 8, 9, disks + 1);
            if (disks + 1 === 2) give(player, services, 3737);
        });
        registry.registerItemOnLoc(3734, 4176, ({ player, services }) => {
            if (!take(player, services, 3734)) return;
            give(player, services, 3735);
        });
        registry.registerItemOnItem(3735, 3737, ({ player, services }) => {
            if (!take(player, services, 3735) || !take(player, services, 3737)) return;
            give(player, services, 3740);
        });
        registry.registerItemOnLoc(3740, 4169, ({ player, services }) => {
            if (!take(player, services, 3740)) return;
            if (give(player, services, 3741)) services.messaging.sendGameMessage(player, "The sealed water freezes, expands, and shatters the vase around a frozen key.");
        });
        registry.registerItemOnLoc(3741, 4172, ({ player, services }) => {
            if (!take(player, services, 3741)) return;
            if (give(player, services, 3745)) services.messaging.sendGameMessage(player, "The range melts the ice from the Seers' key.");
        });
        const clearPeerItems = (player: PlayerState, scriptServices: ScriptServices): void => {
            for (let itemId = 3718; itemId <= 3746; itemId++) {
                while (has(player, scriptServices, itemId)) take(player, scriptServices, itemId);
            }
        };
        const finishPeerTrial = (player: PlayerState, scriptServices: ScriptServices): void => {
            if (!has(player, scriptServices, 3745)) {
                scriptServices.messaging.sendGameMessage(player, "The final door is locked tightly shut.");
                return;
            }
            clearPeerItems(player, scriptServices);
            setPeerProgress(player, scriptServices, 3);
            grantVote(player, scriptServices, 5);
            scriptServices.messaging.sendGameMessage(player, "You unlock the exit. Peer is astonished and grants you his vote.");
        };
        registry.registerLocScript({ locId: 4166, action: "open", handler: ({ player, services }) => finishPeerTrial(player, services) });
        registry.registerItemOnLoc(3745, 4166, ({ player, services }) => finishPeerTrial(player, services));

        registry.registerNpcScript({
            npcId: 3894,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if (hasVote(event.player, 6)) {
                    startConversation(npcContext(event, "Sigmund the Merchant"), [sayNpc("Your trading skill earned my vote.")]);
                    return;
                }
                if (owns(event.player, event.services, 3698)) {
                    startConversation(npcContext(event, "Sigmund the Merchant"), [
                        sayNpc("The exotic flower! You completed every trade in the chain. You have my vote."),
                        run(({ player, services }) => {
                            take(player, services, 3698);
                            setVarp(player, services, SIGMUND_VARP, 14);
                            grantVote(player, services, 6);
                        }),
                    ]);
                    return;
                }
                if (event.player.varps.getVarpValue(SIGMUND_VARP) === 0) {
                    startConversation(npcContext(event, "Sigmund the Merchant"), [
                        sayNpc("Demonstrate your merchanting skill. Find the rare flower brought across the sea and trade whatever its owner demands."),
                        run(({ player, services }) => setVarp(player, services, SIGMUND_VARP, 1)),
                    ]);
                    return;
                }
                startConversation(npcContext(event, "Sigmund the Merchant"), [sayNpc("Ask around Rellekka. A sailor brought the rare flower from across the sea.")]);
            },
        });

        const THORVALD_VOTE = 1 << 4;
        const getThorvaldProgress = (player: PlayerState): number => player.varps.getVarpValue(THORVALD_VARP);
        const setThorvaldProgress = (player: PlayerState, scriptServices: ScriptServices, value: number): void => setVarp(player, scriptServices, THORVALD_VARP, value);
        const passThorvaldTrial = (player: PlayerState, scriptServices: ScriptServices, defeatedKoschei: boolean): void => {
            setThorvaldProgress(player, scriptServices, 2);
            setVarp(player, scriptServices, 348, player.varps.getVarpValue(348) | THORVALD_VOTE);
            if (defeatedKoschei && !owns(player, scriptServices, 3757)) give(player, scriptServices, 3757);
            scriptServices.messaging.sendGameMessage(player, defeatedKoschei
                ? "Congratulations! You have completed the warrior's trial!"
                : "You fought to the death and proved your bravery to Thorvald.");
        };
        const isTrialEquipment = (player: PlayerState, scriptServices: ScriptServices): boolean =>
            scriptServices.inventory.collectCarriedItemIds(player).some((itemId) => {
                const definition = scriptServices.data.getItemDefinition(itemId);
                if (definition?.equipmentType !== undefined || definition?.weaponInterface !== undefined) return true;
                const cacheName = String(scriptServices.data.getObjType(itemId)?.name ?? definition?.name ?? "").toLowerCase();
                return /rune$|arrow|bow string|logs$|clue scroll|casket|cannon/.test(cacheName);
            });

        registry.registerNpcScript({
            npcId: 3896,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== 1) return;
                if ((event.player.varps.getVarpValue(348) & THORVALD_VOTE) !== 0) {
                    startConversation(npcContext(event, "Thorvald"), [sayNpc("You fought with great bravery. You have my vote at the council.")]);
                    return;
                }
                if (getThorvaldProgress(event.player) === 0) {
                    startConversation(npcContext(event, "Thorvald"), [
                        sayNpc("I will vote for you only if you fight Koschei the Deathless beneath this hall. Defeat him three times; the fourth battle is to the death."),
                        choose([
                            option("I am prepared.", [
                                sayNpc("Go down the ladder without armour, weapons, runes or ranged supplies. You may climb back out at any time."),
                                run(({ player, services: dialogueServices }) => setThorvaldProgress(player, dialogueServices, 1)),
                            ]),
                            option("Not yet.", [sayNpc("Return when you have found your courage, outerlander.")]),
                        ]),
                    ]);
                    return;
                }
                startConversation(npcContext(event, "Thorvald"), [sayNpc("Enter the ladder unarmed and fight Koschei to the death. Your bravery is what I am judging.")]);
            },
        });

        const createThorvaldInstance = (player: PlayerState, scriptServices: ScriptServices): void => {
            if (scriptServices.instances.get(player.id)) return;
            if (isTrialEquipment(player, scriptServices)) {
                scriptServices.messaging.sendGameMessage(player, "Thorvald will not let you enter with armour, weapons, runes or ranged supplies.");
                return;
            }
            const templateChunks = scriptServices.instances.buildTemplate([{
                sourceBaseX: 2624,
                sourceBaseY: 10048,
                widthChunks: 8,
                heightChunks: 8,
                sourcePlanes: [2],
                destinationChunkX: 1,
                destinationChunkY: 0,
            }]);
            const handle = scriptServices.instances.create(player, {
                templateChunks,
                destination: { x: 2671, y: 10098, level: 2 },
                exit: { x: 2667, y: 3692, level: 1 },
            });
            if (!handle) return;
            scriptServices.messaging.sendGameMessage(player, "Explore this battleground and find your foe...");
            const delay = 20 + Math.floor(Math.random() * 51);
            scriptServices.scheduler.after(delay, () => {
                if (player.worldViewId !== handle.worldViewId || getThorvaldProgress(player) !== 1) return;
                const koschei = scriptServices.npc.spawnNpc({
                    id: 3897,
                    x: player.tileX + 1,
                    y: player.tileY + 1,
                    level: 2,
                    worldViewId: handle.worldViewId,
                    ownerPlayerId: player.id,
                    wanderRadius: 0,
                });
                if (!koschei) return;
                scriptServices.npc.queueNpcSpotAnim(koschei, 4);
                scriptServices.npc.queueNpcForcedChat(koschei, "Prepare to face my power, outerlander!");
                scriptServices.npc.engageCombat(koschei, player);
            }, { kind: "player", id: player.id });
        };
        registry.registerLocScript({
            locId: 4187,
            action: "climb-down",
            handler: ({ player, services: locServices }) => {
                if (getQuestStage(player, quest) !== 1 || getThorvaldProgress(player) !== 1) {
                    locServices.messaging.sendGameMessage(player, "Thorvald has not admitted you to his combat trial.");
                    return;
                }
                createThorvaldInstance(player, locServices);
            },
        });
        registry.registerLocScript({
            locId: 4188,
            action: "climb-up",
            handler: ({ player, services: locServices }) => {
                locServices.instances.dispose(player, { x: 2667, y: 3692, level: 1 });
            },
        });

        const koscheiForms = [3897, 3898, 3899, 3900] as const;
        for (let index = 0; index < koscheiForms.length; index++) {
            const npcId = koscheiForms[index];
            registry.registerNpcPreDeath(npcId, (event) => {
                const player = event.killer;
                if (!player || event.npc.ownerPlayerId !== player.id || getThorvaldProgress(player) !== 1) return NpcPreDeathDecision.Allow;
                if (index < koscheiForms.length - 1) {
                    const replacement = event.services.npc.replaceNpc(event.npc, koscheiForms[index + 1]);
                    if (replacement) {
                        replacement.heal(replacement.getMaxHitpoints());
                        event.services.npc.queueNpcSeq(replacement, 811);
                        event.services.npc.queueNpcForcedChat(replacement, [
                            "It seems you understand combat. I will not hold back this time!",
                            "Impressive start... but now we fight for real!",
                            "You show some skill. This time you lose your prayer and fight like a warrior!",
                        ][index]);
                        if (index === 2) {
                            player.prayer.clearActivePrayers();
                            event.services.combat.queueCombatState(player);
                        }
                    }
                    return NpcPreDeathDecision.Prevent;
                }
                passThorvaldTrial(player, event.services, true);
                event.services.scheduler.after(1, () => {
                    event.services.instances.dispose(player, { x: 2667, y: 3692, level: 1 });
                }, { kind: "player", id: player.id });
                return NpcPreDeathDecision.Allow;
            });
        }
        registry.registerNpcAttack(3900, (event) => {
            if (event.npc.ownerPlayerId !== event.target.id || getThorvaldProgress(event.target) !== 1) return NpcAttackDecision.Allow;
            const damage = Math.floor(Math.random() * 16);
            const hitpoints = Math.max(1, event.services.skills.getSkill(event.target, SkillId.Hitpoints).baseLevel + event.services.skills.getSkill(event.target, SkillId.Hitpoints).boost);
            if (damage >= hitpoints) {
                passThorvaldTrial(event.target, event.services, false);
                event.services.sequence.run(event.target, function* () {
                    event.services.animation.playPlayerSeq(event.target, 1156);
                    yield new WaitCondition(3);
                    event.services.instances.dispose(event.target, { x: 2667, y: 3692, level: 1 });
                });
                return NpcAttackDecision.Prevent;
            }
            event.services.combat.applyNpcDamageToPlayer(event.npc, event.target, 0, damage);
            return NpcAttackDecision.Prevent;
        });

        type MerchantRequest = {
            npcIds: readonly number[];
            npcName: string;
            progress: number;
            nextProgress: number;
            request: string;
        };
        type MerchantExchange = {
            npcIds: readonly number[];
            npcName: string;
            inputItemId: number;
            outputItemId: number;
            response: string;
        };
        const merchantRequests: MerchantRequest[] = [
            { npcIds: [3936], npcName: "Sailor", progress: 1, nextProgress: 2, request: "I found that flower abroad, but I will trade it only for a romantic ballad." },
            { npcIds: [802], npcName: "Olaf the Bard", progress: 2, nextProgress: 3, request: "Yrsa knows romance better than I do. Ask what would make a worthy ballad." },
            { npcIds: [3933], npcName: "Yrsa", progress: 3, nextProgress: 4, request: "Ask Brundt whether he can guarantee lower sales taxes for my shop." },
            { npcIds: chiefIds, npcName: "Brundt the Chieftain", progress: 4, nextProgress: 5, request: "Sigli has sought untouched hunting grounds. His map would earn my guarantee." },
            { npcIds: [3924], npcName: "Sigli the Huntsman", progress: 5, nextProgress: 6, request: "Skulgrimen can make the finely balanced bow string I require." },
            { npcIds: [3935], npcName: "Skulgrimen", progress: 6, nextProgress: 7, request: "The fisherman sometimes catches unusual fish. Bring me one worthy of this string." },
            { npcIds: [3934], npcName: "Fisherman", progress: 7, nextProgress: 8, request: "Swensen possesses a chart of the finest deep-sea fishing spots." },
            { npcIds: [3925], npcName: "Swensen the Navigator", progress: 8, nextProgress: 9, request: "Peer the Seer can provide the weather forecast I need before surrendering my map." },
            { npcIds: [3895], npcName: "Peer the Seer", progress: 9, nextProgress: 10, request: "Thorvald must promise to protect me before I reveal tomorrow's weather." },
            { npcIds: [3896], npcName: "Thorvald the Warrior", progress: 10, nextProgress: 11, request: "Manni owns the champion's token that would make such a contract worthwhile." },
            { npcIds: [3920], npcName: "Manni the Reveller", progress: 11, nextProgress: 12, request: "Thora's legendary cocktail would persuade me to part with my champion's token." },
            { npcIds: [3932], npcName: "Thora the Barkeep", progress: 12, nextProgress: 13, request: "Bring me Askeladden's written promise that he will never enter the longhall again." },
        ];
        const merchantExchanges: MerchantExchange[] = [
            { npcIds: [3932], npcName: "Thora the Barkeep", inputItemId: 3709, outputItemId: 3707, response: "This promise looks binding. Take my legendary cocktail." },
            { npcIds: [3920], npcName: "Manni the Reveller", inputItemId: 3707, outputItemId: 3706, response: "A legendary cocktail deserves my champion's token." },
            { npcIds: [3896], npcName: "Thorvald the Warrior", inputItemId: 3706, outputItemId: 3710, response: "This token proves your worth. Take my warrior's contract." },
            { npcIds: [3895], npcName: "Peer the Seer", inputItemId: 3710, outputItemId: 3705, response: "Thorvald's contract satisfies me. Here is my weather forecast." },
            { npcIds: [3925], npcName: "Swensen the Navigator", inputItemId: 3705, outputItemId: 3704, response: "The weather will hold. Take my sea-fishing map." },
            { npcIds: [3934], npcName: "Fisherman", inputItemId: 3704, outputItemId: 3703, response: "Those are exceptional waters. This unusual fish is yours." },
            { npcIds: [3935], npcName: "Skulgrimen", inputItemId: 3703, outputItemId: 3702, response: "A rare fish is fair payment for my custom bow string." },
            { npcIds: [3924], npcName: "Sigli the Huntsman", inputItemId: 3702, outputItemId: 3701, response: "A perfectly balanced string! Take my map to untouched hunting grounds." },
            { npcIds: chiefIds, npcName: "Brundt the Chieftain", inputItemId: 3701, outputItemId: 3708, response: "This hunting map is valuable. Give Yrsa my fiscal statement." },
            { npcIds: [3933], npcName: "Yrsa", inputItemId: 3708, outputItemId: 3700, response: "Brundt's guarantee is acceptable. Olaf may have these sturdy boots." },
            { npcIds: [802], npcName: "Olaf the Bard", inputItemId: 3700, outputItemId: 3699, response: "These boots inspire me! Take this Fremennik ballad to the sailor." },
            { npcIds: [3936], npcName: "Sailor", inputItemId: 3699, outputItemId: 3698, response: "A love ballad by Olaf, as promised. The exotic flower is yours." },
        ];
        const merchantItemIds = new Set(merchantExchanges.flatMap((exchange) => [exchange.inputItemId, exchange.outputItemId]));
        const hasMerchantItem = (player: PlayerState, scriptServices: ScriptServices): boolean =>
            [...merchantItemIds].some((itemId) => owns(player, scriptServices, itemId));
        const requestByNpc = new Map<number, MerchantRequest>();
        const exchangeByNpc = new Map<number, MerchantExchange>();
        for (const request of merchantRequests) for (const npcId of request.npcIds) requestByNpc.set(npcId, request);
        for (const exchange of merchantExchanges) for (const npcId of exchange.npcIds) exchangeByNpc.set(npcId, exchange);
        for (const npcId of new Set([...requestByNpc.keys(), ...exchangeByNpc.keys(), ...askeladdenIds])) {
            const fallback = registry.findNpcInteractionDirect(npcId, "talk-to");
            registry.registerNpcScript({
                npcId,
                option: "talk-to",
                handler: (event) => {
                    if (getQuestStage(event.player, quest) !== 1 || hasVote(event.player, 6)) {
                        if (fallback) void fallback(event);
                        return;
                    }
                    const progress = event.player.varps.getVarpValue(SIGMUND_VARP);
                    const exchange = exchangeByNpc.get(npcId);
                    if (progress === 13 && exchange && owns(event.player, event.services, exchange.inputItemId)) {
                        startConversation(npcContext(event, exchange.npcName), [
                            sayNpc(exchange.response),
                            run(({ player, services }) => {
                                if (!take(player, services, exchange.inputItemId)) return;
                                give(player, services, exchange.outputItemId);
                            }),
                        ]);
                        return;
                    }
                    if (askeladdenIds.includes(npcId as typeof askeladdenIds[number]) && progress === 13 && !hasMerchantItem(event.player, event.services)) {
                        startConversation(npcContext(event, "Askeladden"), [
                            sayNpc("For 5,000 coins I will write a promise never to enter the longhall again. It is a bargain, outerlander!"),
                            choose([
                                option("Pay 5,000 coins.", [run(({ player, services }) => {
                                    if (!take(player, services, 995, 5_000)) {
                                        services.messaging.sendGameMessage(player, "You need 5,000 coins for Askeladden's promissory note.");
                                        return;
                                    }
                                    give(player, services, 3709);
                                })]),
                                option("No thanks."),
                            ]),
                        ]);
                        return;
                    }
                    const request = requestByNpc.get(npcId);
                    if (request && progress === request.progress) {
                        startConversation(npcContext(event, request.npcName), [
                            sayNpc(request.request),
                            run(({ player, services }) => setVarp(player, services, SIGMUND_VARP, request.nextProgress)),
                        ]);
                        return;
                    }
                    if (fallback) void fallback(event);
                },
            });
        }
    },
});

export const shiloVillageQuest = createDefinition({
    key: "shilo_village", name: "Shilo Village", varpId: 116, startedValue: 1, completionValue: 15,
    requirements: { skills: [{ skillId: SkillId.Crafting, level: 20, label: "Crafting" }, { skillId: SkillId.Agility, level: 32, label: "Agility" }], quests: [{ varpId: 175, minValue: 13, label: "Jungle Potion" }] },
    rewards: { questPoints: 2, xp: [{ skillId: SkillId.Crafting, amount: 3_875, label: "Crafting" }], other: ["Access to Shilo Village", "Yanni Salika's antique shop"] }, rewardItemId: 616,
    startText: "speaking to <col=800000>Mosol Rei<col=000080> outside Shilo Village.",
    journal: (stage) => [stage < 7 ? "Investigate the Ah Za Rhoon temple with Trufitus." : stage < 12 ? "Explore Bervirius's tomb and make the Beads of the Dead." : "Defeat Nazastarool and return Rashiliyia's corpse to Trufitus."],
    register(quest, registry) {
        const TOMB_MECHANISMS_VARP = 117;
        const getBoneDoorState = (player: PlayerState): number => getVarpRange(player, TOMB_MECHANISMS_VARP, 7, 8);
        const setBoneDoorState = (player: PlayerState, scriptServices: ScriptServices, state: number): void =>
            setVarpRange(player, scriptServices, TOMB_MECHANISMS_VARP, 7, 8, state);
        const hasBeadsEquipped = (player: PlayerState, scriptServices: ScriptServices): boolean =>
            scriptServices.equipment.getEquipArray(player).includes(616);
        const showBoneDoorState = (player: PlayerState, scriptServices: ScriptServices): void => {
            if (player.worldViewId < 0) return;
            const state = getBoneDoorState(player);
            const scope = { worldViewId: player.worldViewId, ownerPlayerId: player.id };
            if (state >= 1) {
                scriptServices.location.replaceTemporaryLoc(scope, 2246, state === 1 ? 2248 : 2249, { x: 2892, y: 9480 }, 0, {
                    newShape: 0,
                    newRotation: 1,
                });
            }
            if (state >= 3) {
                scriptServices.location.replaceTemporaryLoc(scope, 2247, 2250, { x: 2893, y: 9480 }, 0, {
                    newShape: 0,
                    newRotation: 1,
                });
            }
        };
        registerLinearSteps(quest, registry, [
            { stage: 0, next: 1, npcIds: [5340, 8696], npcName: "Mosol Rei", text: "Zombies overrun Shilo Village. Take this wampum belt to Trufitus." },
            { stage: 1, next: 2, npcIds: [4625], npcName: "Trufitus", text: "Find the ancient mound north-east of here." },
            { stage: 2, next: 7, npcIds: [4625], npcName: "Trufitus", text: "Use a spade, rope and light to explore Ah Za Rhoon and bring back its scrolls.", requires: [{ itemId: 952 }, { itemId: 954 }, { itemId: 33 }], gives: [{ itemId: 607 }, { itemId: 608 }] },
            { stage: 7, next: 9, npcIds: [4625], npcName: "Trufitus", text: "The scrolls reveal Bervirius's tomb on Cairn Isle. The tomb yields an ancient bone shard.", gives: [{ itemId: 604 }] },
            { stage: 9, next: 10, npcIds: [4625], npcName: "Trufitus", text: "Carve the bone shard into a key and make the Beads of the Dead.", requires: [{ itemId: 604 }, { itemId: 1794 }], gives: [{ itemId: 605 }, { itemId: 616 }] },
            { stage: 10, next: 10, npcIds: [4625], npcName: "Trufitus", text: "Wear the Beads of the Dead, enter Rashiliyia's tomb and open its inner bone-lock before searching the dolmen." },
            { stage: 14, next: 15, npcIds: [4625], npcName: "Trufitus", text: "Rashiliyia is at peace and Shilo Village is free.", requires: [{ itemId: 609 }], complete: true },
        ]);
        const createRashiliyiaInstance = (player: PlayerState, scriptServices: ScriptServices): void => {
            const templateChunks = scriptServices.instances.buildTemplate([{
                sourceBaseX: 2880,
                sourceBaseY: 9472,
                widthChunks: 8,
                heightChunks: 8,
                sourcePlanes: [0],
                destinationChunkX: 5,
                destinationChunkY: 3,
            }]);
            const handle = scriptServices.instances.create(player, {
                templateChunks,
                destination: { x: 2892, y: 9478, level: 0 },
                exit: { x: 2892, y: 9496, level: 0 },
            });
            if (!handle) return;
            if (getQuestStage(player, quest) < 12) setQuestStage(player, quest, scriptServices, 12);
            showBoneDoorState(player, scriptServices);
        };
        for (const locId of [2246, 2247]) {
            registry.registerLocScript({
                locId,
                action: "open",
                handler: ({ player, services: locServices, tile }) => {
                    if (tile.y === 9480) {
                        if (getQuestStage(player, quest) < 13 || getBoneDoorState(player) < 3) {
                            locServices.messaging.sendGameMessage(player, "The ornate door is sealed. Three bones are missing from its carved warriors.");
                            return;
                        }
                        if (!hasBeadsEquipped(player, locServices)) {
                            locServices.messaging.sendGameMessage(player, "Rashiliyia's influence overwhelms you without the Beads of the Dead.");
                            return;
                        }
                        locServices.movement.teleportPlayer(player, player.tileX, player.tileY < 9480 ? 9481 : 9479, player.level);
                        return;
                    }
                    if (tile.y !== 9497) return;
                    if (locServices.instances.get(player.id)) {
                        locServices.instances.dispose(player, { x: 2892, y: 9496, level: 0 });
                        return;
                    }
                    if (getQuestStage(player, quest) < 10 || !owns(player, locServices, 605)) {
                        locServices.messaging.sendGameMessage(player, "The bone lock in the tomb entrance needs a bone key.");
                        return;
                    }
                    createRashiliyiaInstance(player, locServices);
                },
            });
            registry.registerLocScript({
                locId,
                action: "search",
                handler: ({ player, services: locServices, tile }) => {
                    if (tile.y !== 9480 || getQuestStage(player, quest) < 12) return;
                    const remaining = Math.max(0, 3 - getBoneDoorState(player));
                    locServices.messaging.sendGameMessage(player, remaining === 0
                        ? "All three skeletal warriors are complete; the tomb doors can now open."
                        : `The skeletal carvings contain ${remaining} empty bone ${remaining === 1 ? "recess" : "recesses"}.`);
                },
            });
            registry.registerItemOnLoc(526, locId, ({ player, services: locServices, target }) => {
                if (target.tile.y !== 9480 || getQuestStage(player, quest) !== 12) return;
                if (!hasBeadsEquipped(player, locServices)) {
                    locServices.messaging.sendGameMessage(player, "You cannot concentrate on the carvings without wearing the Beads of the Dead.");
                    return;
                }
                const state = getBoneDoorState(player);
                if (state >= 3) {
                    locServices.messaging.sendGameMessage(player, "There are no more recesses to fill.");
                    return;
                }
                if (!take(player, locServices, 526)) return;
                const nextState = state + 1;
                setBoneDoorState(player, locServices, nextState);
                showBoneDoorState(player, locServices);
                locServices.animation.playPlayerSeq(player, 827);
                if (nextState < 3) {
                    locServices.messaging.sendGameMessage(player, `The bone fits. ${3 - nextState} ${nextState === 2 ? "recess remains" : "recesses remain"}.`);
                    return;
                }
                setQuestStage(player, quest, locServices, 13);
                locServices.messaging.sendGameMessage(player, "The last bone fits. The skeletal warriors wrench themselves free and push the tomb doors open.");
                locServices.movement.teleportPlayer(player, 2892, 9481, 0);
            });
        }
        registry.registerLocScript({
            locId: 2258,
            action: "search",
            handler: ({ player, services: locServices, tile }) => {
                if (tile.y !== 9487 || getQuestStage(player, quest) !== 13) return;
                if (owns(player, locServices, 609)) {
                    locServices.messaging.sendGameMessage(player, "You find nothing new on the dolmen.");
                    return;
                }
                if ([5353, 5354, 5355].some((npcId) => locServices.npc.findNearbyNpc(player, npcId, 12))) {
                    locServices.messaging.sendGameMessage(player, "The dolmen remains silent while Nazastarool is present.");
                    return;
                }
                locServices.sequence.run(player, function* () {
                    locServices.camera.shake(player, 0, 10, 0, 0);
                    locServices.messaging.sendGameMessage(player, "The ground shakes as an unearthly voice booms through the tomb.");
                    yield new WaitCondition(5 + Math.floor(Math.random() * 4));
                    const nazastarool = locServices.npc.spawnNpc({
                        id: 5353,
                        x: player.tileX + 1,
                        y: player.tileY + 1,
                        level: player.level,
                        worldViewId: player.worldViewId,
                        ownerPlayerId: player.id,
                        lifetimeTicks: 500,
                        wanderRadius: 0,
                    });
                    if (!nazastarool) return;
                    locServices.npc.queueNpcForcedChat(nazastarool, "I am Nazastarool! Prepare to die!");
                    locServices.npc.engageCombat(nazastarool, player);
                }, { resetCamera: true });
            },
        });
        const transitionNazastarool = (event: NpcPreDeathEvent, nextId: number, message: string): typeof NpcPreDeathDecision.Prevent => {
            const player = event.killer;
            if (!player) return NpcPreDeathDecision.Prevent;
            const replacement = event.services.npc.replaceNpc(event.npc, nextId, 500);
            if (replacement) {
                replacement.heal(replacement.getMaxHitpoints());
                event.services.npc.queueNpcForcedChat(replacement, message);
                event.services.npc.engageCombat(replacement, player);
            }
            return NpcPreDeathDecision.Prevent;
        };
        registry.registerNpcPreDeath(5353, (event) => {
            const player = event.killer;
            if (!player || event.npc.ownerPlayerId !== player.id || getQuestStage(player, quest) !== 13) return NpcPreDeathDecision.Allow;
            event.services.messaging.sendGameMessage(player, "The corpse falls, then its bones reform into a grisly giant skeleton.");
            return transitionNazastarool(event, 5354, "Quake in fear, for I am reborn!");
        });
        registry.registerNpcPreDeath(5354, (event) => {
            const player = event.killer;
            if (!player || event.npc.ownerPlayerId !== player.id || getQuestStage(player, quest) !== 13) return NpcPreDeathDecision.Allow;
            event.services.messaging.sendGameMessage(player, "An ethereal form rises from the shattered skeleton.");
            return transitionNazastarool(event, 5355, "Nazastarool returns with vengeance!");
        });
        registry.registerNpcPreDeath(5355, (event) => {
            const player = event.killer;
            if (player && event.npc.ownerPlayerId === player.id && getQuestStage(player, quest) === 13) {
                if (give(player, event.services, 609)) {
                    setQuestStage(player, quest, event.services, 14);
                    event.services.messaging.sendGameMessage(player, "Rashiliyia's mummified remains appear on the dolmen.");
                }
            }
            return NpcPreDeathDecision.Allow;
        });
    },
});

export const taiBwoWannaiTrioQuest = createDefinition({
    key: "tai_bwo_wannai_trio", name: "Tai Bwo Wannai Trio", varpId: 320, startedValue: 3, completionValue: 6,
    requirements: { skills: [{ skillId: SkillId.Agility, level: 15, label: "Agility" }, { skillId: SkillId.Cooking, level: 30, label: "Cooking" }, { skillId: SkillId.Fishing, level: 5, label: "Fishing" }], quests: [{ varpId: 175, minValue: 13, label: "Jungle Potion" }] },
    rewards: { questPoints: 2, xp: [{ skillId: SkillId.Cooking, amount: 5_000, label: "Cooking" }, { skillId: SkillId.Fishing, amount: 5_000, label: "Fishing" }, { skillId: SkillId.Attack, amount: 2_500, label: "Attack" }, { skillId: SkillId.Strength, amount: 2_500, label: "Strength" }], items: [{ itemId: 995, quantity: 5_000, label: "5,000 coins" }], other: ["The ability to cook karambwan properly", "The Tai Bwo Wannai parcel service"] }, rewardItemId: 3142,
    startText: "speaking to <col=800000>Timfraku<col=000080> above Tai Bwo Wannai village.",
    journal: () => ["Help Timfraku's three sons return home:", "Tiadeche must catch karambwan, Tamayu must defeat the Shaikahan,", "and Tinsay needs his unusual foods. Learn Lubufu's fishing method."],
    register(quest, registry) {
        const timfrakuIds = [4698];
        const timfraku = (event: NpcInteractionEvent): void => {
            const stage = getQuestStage(event.player, quest);
            if (stage === 0) { if (!meetsQuestRequirements(event.player, event.services, quest)) { startConversation(npcContext(event, "Timfraku"), [sayNpc("You lack the skills needed to help my sons.")]); return; } startConversation(npcContext(event, "Timfraku"), [sayNpc("Find Tiadeche, Tinsay and Tamayu, and convince them to return home."), run(({ player, services }) => { for (const id of [321, 322, 323, 324]) setVarp(player, services, id, 0); setQuestStage(player, quest, services, 3); })]); return; }
            const done = event.player.varps.getVarpValue(321) >= 6 && event.player.varps.getVarpValue(322) >= 7 && event.player.varps.getVarpValue(323) >= 4 && event.player.varps.getVarpValue(324) >= 31;
            if (stage === 3 && done) setQuestStage(event.player, quest, event.services, 4);
            if (getQuestStage(event.player, quest) === 4) { startConversation(npcContext(event, "Timfraku"), [sayNpc("All three sons will return. You have reunited the Tai Bwo Wannai family."), run(({ player, services }) => completeQuest(player, services, quest))]); return; }
            startConversation(npcContext(event, "Timfraku"), [sayNpc("My sons still need your help.")]);
        };
        for (const npcId of timfrakuIds) registry.registerNpcScript({ npcId, option: "talk-to", handler: timfraku });
        const lubufu = (event: NpcInteractionEvent): void => { if (getQuestStage(event.player, quest) < 3) return; if (!has(event.player, event.services, 3150, 20)) { startConversation(npcContext(event, "Lubufu"), [sayNpc("Bring me twenty raw karambwanji and I will teach you my method.")]); return; } startConversation(npcContext(event, "Lubufu"), [sayNpc("You may become my apprentice. Take this karambwan vessel."), run(({ player, services }) => { take(player, services, 3150, 20); give(player, services, 3157); setVarp(player, services, 324, 31); })]); };
        registry.registerNpcScript({ npcId: 4707, option: "talk-to", handler: lubufu });
        const tiadeche = (event: NpcInteractionEvent): void => { if (getQuestStage(event.player, quest) < 3) return; if (!has(event.player, event.services, 3142)) { startConversation(npcContext(event, "Tiadeche"), [sayNpc("Use Lubufu's vessel to catch a raw karambwan for me.")]); return; } startConversation(npcContext(event, "Tiadeche"), [sayNpc("At last, I can teach the village this fishing method and return home."), run(({ player, services }) => { take(player, services, 3142); setVarp(player, services, 321, 6); })]); };
        for (const npcId of [4699, 4700]) registry.registerNpcScript({ npcId, option: "talk-to", handler: tiadeche });
        const tinsay = (event: NpcInteractionEvent): void => { if (getQuestStage(event.player, quest) < 3) return; if (!has(event.player, event.services, 3164) || !has(event.player, event.services, 3168) || (!has(event.player, event.services, 3130) && !has(event.player, event.services, 3133))) { startConversation(npcContext(event, "Tinsay"), [sayNpc("Bring sliced banana rum, a seaweed sandwich and burnt jogre bones marinated in karambwanji.")]); return; } startConversation(npcContext(event, "Tinsay"), [sayNpc("What a feast! I will return to my father."), run(({ player, services }) => { take(player, services, 3164); take(player, services, 3168); if (!take(player, services, 3130)) take(player, services, 3133); setVarp(player, services, 322, 7); })]); };
        for (const npcId of [4701, 4702]) registry.registerNpcScript({ npcId, option: "talk-to", handler: tinsay });
        const tamayu = (event: NpcInteractionEvent): void => { if (getQuestStage(event.player, quest) < 3) return; const spear = [3176, 3175, 3174, 3173, 3172, 3171, 3170].find((itemId) => has(event.player, event.services, itemId)); if (spear === undefined) { startConversation(npcContext(event, "Tamayu"), [sayNpc("Bring me a karambwan-poisoned spear so I can face the Shaikahan.")]); return; } startConversation(npcContext(event, "Tamayu"), [sayNpc("The poisoned spear defeated the Shaikahan. I will return home."), run(({ player, services }) => { take(player, services, spear); setVarp(player, services, 323, 4); })]); };
        for (const npcId of [4703, 4704]) registry.registerNpcScript({ npcId, option: "talk-to", handler: tamayu });
        const combine = (first: number, second: number, result: number, message: string): void => {
            registry.registerItemOnItem(first, second, ({ player, services }) => {
                if (getQuestStage(player, quest) < 3) return;
                if (!take(player, services, first) || !take(player, services, second)) return;
                if (give(player, services, result)) services.messaging.sendGameMessage(player, message);
            });
        };
        combine(431, 3162, 3164, "You slip the sliced banana into the Karamjan rum.");
        combine(3167, 401, 3168, "You stuff the monkey skin with seaweed.");
        combine(3127, 3155, 3133, "You marinate the burnt jogre bones in karambwanji paste.");
        combine(3127, 3156, 3133, "You marinate the burnt jogre bones in karambwanji paste.");
        for (const [spear, poisoned] of [[1237, 3170], [1239, 3171], [1241, 3172], [1243, 3173], [1245, 3174], [1247, 3175], [1249, 3176]] as const) {
            combine(spear, 3154, poisoned, "You coat the spear with karambwan poison.");
        }
    },
});

export const preservationRemainderQuests = [
    eadgarsRuseQuest,
    horrorFromTheDeepQuest,
    watchtowerQuest,
    shadesOfMorttonQuest,
    undergroundPassQuest,
    regicideQuest,
    fremennikTrialsQuest,
    shiloVillageQuest,
    taiBwoWannaiTrioQuest,
    legendsQuest,
] as const;
