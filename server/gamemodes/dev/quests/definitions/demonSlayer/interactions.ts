import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { NpcPreDeathDecision } from "../../../../../src/game/scripts/types";
import { completeQuest, getQuestStage } from "../../QuestService";
import {
    choose,
    option,
    run,
    sayPlayer,
    showItem,
    startConversation,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { createArisTalkHandler } from "./arisDialogue";
import {
    ARIS_NPC_IDS,
    ARIS_TILE,
    ARIS_VISIBLE_NPC_ID,
    ARIS_ZONE,
    BUCKET_OF_WATER_ITEM_ID,
    CAPTAIN_ROVIN_NPC_IDS,
    CORRECT_INCANTATION,
    DELRITH_NPC_ID,
    DELRITH_TILE,
    DELRITH_ZONE,
    DEMON_DRAIN_LOC_IDS,
    EMPTY_BUCKET_ITEM_ID,
    INCANTATION_OPTIONS,
    PRYSIN_KEY_ITEM_ID,
    SEWER_KEY_TILE,
    SILVERLIGHT_ITEM_ID,
    SIR_PRYSIN_NPC_IDS,
    STAGE_COMPLETE,
    STAGE_KEY_HUNT,
    STAGE_SILVERLIGHT,
    TRAIBORN_NPC_ID,
    VARBIT_DEMON_DRAIN,
    WEAKENED_DELRITH_NPC_ID,
} from "./constants";
import { createCaptainRovinTalkHandler, createSirPrysinTalkHandler, createTraibornTalkHandler } from "./keyDialogue";
import { giveItem, ownsItem, takeItem } from "./items";
import { setDemonDrainState, syncDemonDrainState } from "./state";

type QuestNpcState = { npcId: number; expiresAt?: number };

const knownPlayers = new Map<number, PlayerState>();
const arisByPlayer = new Map<number, QuestNpcState>();
const delrithByPlayer = new Map<number, QuestNpcState>();
const weakenedByPlayer = new Map<number, QuestNpcState>();
const registeredEventBuses = new WeakSet<object>();

function inside(
    player: PlayerState,
    zone: { minX: number; maxX: number; minY: number; maxY: number; levels: readonly number[] },
): boolean {
    return (
        player.tileX >= zone.minX &&
        player.tileX <= zone.maxX &&
        player.tileY >= zone.minY &&
        player.tileY <= zone.maxY &&
        zone.levels.includes(player.level)
    );
}

function removeTrackedNpc(
    playerId: number,
    map: Map<number, QuestNpcState>,
    services: ScriptServices,
): void {
    const tracked = map.get(playerId);
    if (!tracked) return;
    services.npc.removeNpc(tracked.npcId);
    map.delete(playerId);
}

function ensureAris(player: PlayerState, services: ScriptServices): void {
    if (arisByPlayer.has(player.id)) return;
    const npc = services.npc.spawnNpc({
        id: ARIS_VISIBLE_NPC_ID,
        name: "Aris",
        ...ARIS_TILE,
        wanderRadius: 0,
        ownerPlayerId: player.id,
    });
    if (npc) arisByPlayer.set(player.id, { npcId: npc.id });
}

function hasSilverlightEquipped(player: PlayerState, services: ScriptServices): boolean {
    return services.inventory.findOwnedItemLocation(player, SILVERLIGHT_ITEM_ID) === "equipment";
}

function ensureDelrith(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): void {
    if (
        getQuestStage(player, quest) !== STAGE_SILVERLIGHT ||
        !hasSilverlightEquipped(player, services) ||
        delrithByPlayer.has(player.id) ||
        weakenedByPlayer.has(player.id)
    ) {
        return;
    }
    const npc = services.npc.spawnNpc({
        id: DELRITH_NPC_ID,
        name: "Delrith",
        ...DELRITH_TILE,
        wanderRadius: 2,
        ownerPlayerId: player.id,
    });
    if (npc) delrithByPlayer.set(player.id, { npcId: npc.id });
}

function spawnWeakenedDelrith(
    player: PlayerState,
    services: ScriptServices,
    tile: { x: number; y: number; level: number },
): void {
    const npc = services.npc.spawnNpc({
        id: WEAKENED_DELRITH_NPC_ID,
        name: "Weakened Delrith",
        ...tile,
        wanderRadius: 0,
        ownerPlayerId: player.id,
    });
    if (!npc) return;
    weakenedByPlayer.set(player.id, {
        npcId: npc.id,
        expiresAt: services.system.getCurrentTick() + 100,
    });
}

function clearDemonEncounter(playerId: number, services: ScriptServices): void {
    removeTrackedNpc(playerId, delrithByPlayer, services);
    removeTrackedNpc(playerId, weakenedByPlayer, services);
}

function registerQuestNpcLifecycle(quest: QuestDefinition, services: ScriptServices): void {
    const eventBus = services.system.eventBus;
    if (!eventBus || registeredEventBuses.has(eventBus)) return;
    registeredEventBuses.add(eventBus);

    eventBus.on("player:login", ({ player }) => {
        knownPlayers.set(player.id, player);
        if (inside(player, ARIS_ZONE)) ensureAris(player, services);
        if (inside(player, DELRITH_ZONE)) ensureDelrith(player, services, quest);
    });
    eventBus.on("player:logout", ({ playerId }) => {
        knownPlayers.delete(playerId);
        removeTrackedNpc(playerId, arisByPlayer, services);
        clearDemonEncounter(playerId, services);
    });
    eventBus.on("equipment:equip", ({ player, itemId }) => {
        knownPlayers.set(player.id, player);
        if (itemId === SILVERLIGHT_ITEM_ID && inside(player, DELRITH_ZONE)) {
            ensureDelrith(player, services, quest);
        }
    });
    eventBus.on("equipment:unequip", ({ player, itemId }) => {
        if (itemId === SILVERLIGHT_ITEM_ID) clearDemonEncounter(player.id, services);
    });
}

function registerDrain(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const locId of DEMON_DRAIN_LOC_IDS) {
        registry.registerLocScript({
            locId,
            action: "search",
            handler: ({ player, services }) => {
                const stage = getQuestStage(player, quest);
                if (stage < STAGE_KEY_HUNT) {
                    services.messaging.sendGameMessage(
                        player,
                        "You can see a key in the drain, but you cannot quite reach it.",
                    );
                } else if (stage >= STAGE_SILVERLIGHT || ownsItem(player, services, PRYSIN_KEY_ITEM_ID)) {
                    services.messaging.sendGameMessage(
                        player,
                        "Nothing interesting seems to have been dropped down here today.",
                    );
                } else if (player.varps.getVarbitValue(VARBIT_DEMON_DRAIN) >= 2) {
                    services.messaging.sendGameMessage(player, "The key has been washed into the sewer.");
                } else {
                    services.messaging.sendGameMessage(
                        player,
                        "You can see a key, but it is stuck just out of reach. Perhaps water could dislodge it.",
                    );
                }
            },
        });
        registry.registerItemOnLoc(
            BUCKET_OF_WATER_ITEM_ID,
            locId,
            ({ player, services }) => {
                const stage = getQuestStage(player, quest);
                if (stage >= STAGE_SILVERLIGHT) {
                    services.messaging.sendGameMessage(player, "There is no reason to pour water there.");
                    return;
                }
                takeItem(player, services, BUCKET_OF_WATER_ITEM_ID);
                giveItem(player, services, EMPTY_BUCKET_ITEM_ID);
                services.messaging.sendGameMessage(player, "You pour the water down the drain.");
                if (ownsItem(player, services, PRYSIN_KEY_ITEM_ID)) return;
                const existing = services.groundItems
                    .query(SEWER_KEY_TILE, { radius: 0, observer: player })
                    .some((item) => item.itemId === PRYSIN_KEY_ITEM_ID);
                if (!existing) {
                    services.groundItems.spawn(PRYSIN_KEY_ITEM_ID, 1, SEWER_KEY_TILE, {
                        ownerId: player.id,
                        privateTicks: 300,
                        durationTicks: 300,
                    });
                }
                setDemonDrainState(player, services, 2);
                services.messaging.sendGameMessage(
                    player,
                    "The key washes into the sewer. You should retrieve it before somebody else does.",
                );
            },
        );
    }
}

function banishSteps(
    event: NpcInteractionEvent,
    quest: QuestDefinition,
): ReturnType<typeof choose>[] | never[] {
    const choices = INCANTATION_OPTIONS.map((incantation) =>
        option(incantation, [
            sayPlayer(incantation),
            showItem(
                SILVERLIGHT_ITEM_ID,
                incantation === CORRECT_INCANTATION
                    ? [
                          "As you chant, Delrith is sucked towards the vortex...",
                          "Back to the dark dimension from which he came.",
                      ]
                    : [
                          "As you chant, Delrith is pulled towards the vortex...",
                          "Suddenly the vortex collapses. That was the wrong incantation.",
                      ],
            ),
            run(({ player, services }) => {
                const tracked = weakenedByPlayer.get(player.id);
                if (!tracked || tracked.npcId !== event.npc.id) return;
                services.npc.removeNpc(tracked.npcId);
                weakenedByPlayer.delete(player.id);
                if (incantation === CORRECT_INCANTATION) {
                    if (completeQuest(player, services, quest)) {
                        syncDemonDrainState(player, services);
                    }
                } else {
                    ensureDelrith(player, services, quest);
                }
            }),
        ]),
    );
    return [choose(choices)];
}

export function registerDemonSlayerInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const arisTalk = createArisTalkHandler(quest);
    for (const npcId of ARIS_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: arisTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: arisTalk });
    }
    const prysinTalk = createSirPrysinTalkHandler(quest);
    for (const npcId of SIR_PRYSIN_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: prysinTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: prysinTalk });
    }
    const rovinTalk = createCaptainRovinTalkHandler(quest);
    for (const npcId of CAPTAIN_ROVIN_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: rovinTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: rovinTalk });
    }
    const traibornTalk = createTraibornTalkHandler(quest);
    registry.registerNpcScript({ npcId: TRAIBORN_NPC_ID, option: "talk-to", handler: traibornTalk });
    registry.registerNpcScript({ npcId: TRAIBORN_NPC_ID, option: undefined, handler: traibornTalk });

    registerDrain(quest, registry);

    registry.registerNpcPreDeath(DELRITH_NPC_ID, (event) => {
        const player = event.killer ??
            (event.killerPlayerId === undefined
                ? undefined
                : knownPlayers.get(event.killerPlayerId));
        if (!player) return;
        const tracked = delrithByPlayer.get(player.id);
        if (
            !tracked ||
            tracked.npcId !== event.npc.id ||
            getQuestStage(player, quest) !== STAGE_SILVERLIGHT
        ) {
            return;
        }

        delrithByPlayer.delete(player.id);
        event.services.npc.removeNpc(event.npc.id);
        spawnWeakenedDelrith(player, event.services, {
            x: event.npc.tileX,
            y: event.npc.tileY,
            level: event.npc.level,
        });
        event.services.messaging.sendGameMessage(
            player,
            "Delrith is weakened. Use the Banish option and recite the incantation!",
        );
        return NpcPreDeathDecision.Prevent;
    });

    registry.registerNpcScript({
        npcId: WEAKENED_DELRITH_NPC_ID,
        option: "banish",
        handler: (event) => {
            const tracked = weakenedByPlayer.get(event.player.id);
            if (!tracked || tracked.npcId !== event.npc.id) return;
            startConversation(
                {
                    player: event.player,
                    services: event.services,
                    npcId: WEAKENED_DELRITH_NPC_ID,
                    npcName: "Weakened Delrith",
                },
                [sayPlayer("Now what was that incantation again?"), ...banishSteps(event, quest)],
            );
        },
    });

    registry.registerZone(ARIS_ZONE, {
        enter: ({ player, services: eventServices }) => {
            knownPlayers.set(player.id, player);
            ensureAris(player, eventServices);
        },
        exit: ({ player, services: eventServices }) => {
            removeTrackedNpc(player.id, arisByPlayer, eventServices);
        },
    });
    registry.registerZone(DELRITH_ZONE, {
        enter: ({ player, services: eventServices }) => {
            knownPlayers.set(player.id, player);
            ensureDelrith(player, eventServices, quest);
        },
        exit: ({ player, services: eventServices }) => {
            clearDemonEncounter(player.id, eventServices);
        },
    });
    registry.registerTickHandler(({ tick, services: eventServices }) => {
        for (const [playerId, weakened] of weakenedByPlayer) {
            if (weakened.expiresAt === undefined || weakened.expiresAt > tick) continue;
            eventServices.npc.removeNpc(weakened.npcId);
            weakenedByPlayer.delete(playerId);
            const player = knownPlayers.get(playerId);
            if (player && inside(player, DELRITH_ZONE)) ensureDelrith(player, eventServices, quest);
        }
    });
    registerQuestNpcLifecycle(quest, services);
}
