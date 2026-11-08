import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    LocInteractionEvent,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { getQuestStage, setQuestStage } from "../../QuestService";
import { startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    AGGIE_NPC_IDS,
    BEER_ITEM_ID,
    BLONDE_WIG_ITEM_ID,
    BRONZE_BAR_ITEM_ID,
    BRONZE_KEY_ITEM_ID,
    GREY_WIG_ITEM_ID,
    HASSAN_NPC_ID,
    JAIL_ZONE,
    JOE_NPC_IDS,
    JOE_TILE,
    JOE_VISIBLE_NPC_ID,
    KEY_PRINT_ITEM_ID,
    LADY_KELI_NPC_IDS,
    LADY_KELI_TILE,
    LADY_KELI_VISIBLE_NPC_ID,
    LEELA_NPC_ID,
    NED_NPC_ID,
    OSMAN_NPC_IDS,
    PINK_SKIRT_ITEM_ID,
    PRINCE_ALI_NPC_IDS,
    PRINCE_ALI_TILE,
    PRINCE_ALI_VISIBLE_NPC_ID,
    PRISON_GATE_LOC_ID,
    REDBERRIES_ITEM_ID,
    ROPE_ITEM_ID,
    SKIN_PASTE_ITEM_ID,
    STAGE_GUARD_DRUNK,
    STAGE_KELI_TIED,
    STAGE_PREPARATION_COMPLETE,
    STAGE_PRINCE_SAVED,
    YELLOW_DYE_ITEM_ID,
} from "./constants";
import {
    createHassanTalkHandler,
    createLeelaTalkHandler,
    createOsmanTalkHandler,
    createPrinceAliTalkHandler,
} from "./mainDialogue";
import { carriesItem, giveItem, takeItem } from "./items";
import {
    createAggieTalkHandler,
    createJoeTalkHandler,
    createLadyKeliTalkHandler,
    createNedTalkHandler,
    joeBeerSteps,
} from "./supportDialogue";

type SpawnRole = "joe" | "keli" | "prince";
type SpawnedActors = Partial<Record<SpawnRole, number>>;

const actorsByPlayer = new Map<number, SpawnedActors>();
const registeredEventBuses = new WeakSet<object>();

function insideJailZone(player: PlayerState): boolean {
    return (
        player.tileX >= JAIL_ZONE.minX &&
        player.tileX <= JAIL_ZONE.maxX &&
        player.tileY >= JAIL_ZONE.minY &&
        player.tileY <= JAIL_ZONE.maxY &&
        player.level === 0
    );
}

function removeRole(playerId: number, role: SpawnRole, services: ScriptServices): void {
    const actors = actorsByPlayer.get(playerId);
    const npcId = actors?.[role];
    if (npcId === undefined) return;
    services.npc.removeNpc(npcId);
    delete actors![role];
    if (Object.keys(actors!).length === 0) actorsByPlayer.delete(playerId);
}

function clearActors(playerId: number, services: ScriptServices): void {
    for (const role of ["joe", "keli", "prince"] as const) {
        removeRole(playerId, role, services);
    }
}

function spawnRole(
    player: PlayerState,
    role: SpawnRole,
    npcTypeId: number,
    name: string,
    tile: { x: number; y: number; level: number },
    services: ScriptServices,
): void {
    const actors = actorsByPlayer.get(player.id) ?? {};
    if (actors[role] !== undefined) return;
    const npc = services.npc.spawnNpc({
        id: npcTypeId,
        name,
        ...tile,
        wanderRadius: role === "keli" ? 2 : 0,
        ownerPlayerId: player.id,
    });
    if (!npc) return;
    actors[role] = npc.id;
    actorsByPlayer.set(player.id, actors);
}

function ensureJailActors(
    player: PlayerState,
    services: ScriptServices,
    quest: QuestDefinition,
): void {
    const stage = getQuestStage(player, quest);
    spawnRole(player, "joe", JOE_VISIBLE_NPC_ID, "Joe", JOE_TILE, services);
    if (stage < STAGE_KELI_TIED || stage >= STAGE_PRINCE_SAVED) {
        spawnRole(
            player,
            "keli",
            LADY_KELI_VISIBLE_NPC_ID,
            "Lady Keli",
            LADY_KELI_TILE,
            services,
        );
    } else {
        removeRole(player.id, "keli", services);
    }
    if (stage < STAGE_PRINCE_SAVED) {
        spawnRole(
            player,
            "prince",
            PRINCE_ALI_VISIBLE_NPC_ID,
            "Prince Ali",
            PRINCE_ALI_TILE,
            services,
        );
    } else {
        removeRole(player.id, "prince", services);
    }
}

function registerActorLifecycle(quest: QuestDefinition, services: ScriptServices): void {
    const eventBus = services.system.eventBus;
    if (!eventBus || registeredEventBuses.has(eventBus)) return;
    registeredEventBuses.add(eventBus);
    eventBus.on("player:login", ({ player }) => {
        if (insideJailZone(player)) ensureJailActors(player, services, quest);
    });
    eventBus.on("player:logout", ({ playerId }) => clearActors(playerId, services));
}

function openPrisonGate(event: LocInteractionEvent): void {
    const { player, services, tile, level, locId, tick } = event;
    const result = services.location.doorManager?.toggleDoor({
        x: tile.x,
        y: tile.y,
        level,
        currentId: locId,
        action: "open",
        currentTick: tick,
    });
    if (result?.success && result.newLocId !== undefined) {
        services.location.emitLocChange(locId, result.newLocId, tile, level, {
            oldTile: tile,
            newTile: result.newTile ?? tile,
            oldRotation: result.oldRotation,
            newRotation: result.newRotation,
        });
        return;
    }
    const destinationY = player.tileY > tile.y ? tile.y - 1 : tile.y + 1;
    services.movement.teleportPlayer(player, tile.x, destinationY, level);
}

function asNpcEvent(
    event: {
        player: PlayerState;
        services: ScriptServices;
        tick: number;
        target: NpcInteractionEvent["npc"];
    },
): NpcInteractionEvent {
    return { player: event.player, services: event.services, tick: event.tick, npc: event.target };
}

export function registerPrinceAliRescueInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    services: ScriptServices,
): void {
    const hassanTalk = createHassanTalkHandler(quest);
    registry.registerNpcScript({ npcId: HASSAN_NPC_ID, option: "talk-to", handler: hassanTalk });
    registry.registerNpcScript({ npcId: HASSAN_NPC_ID, option: undefined, handler: hassanTalk });

    const osmanTalk = createOsmanTalkHandler(quest);
    for (const npcId of OSMAN_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: osmanTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: osmanTalk });
        for (const itemId of [KEY_PRINT_ITEM_ID, BRONZE_BAR_ITEM_ID]) {
            registry.registerItemOnNpc(itemId, npcId, (event) => osmanTalk(asNpcEvent(event)));
        }
    }

    const leelaTalk = createLeelaTalkHandler(quest);
    registry.registerNpcScript({ npcId: LEELA_NPC_ID, option: "talk-to", handler: leelaTalk });
    registry.registerNpcScript({ npcId: LEELA_NPC_ID, option: undefined, handler: leelaTalk });

    const nedTalk = createNedTalkHandler(quest);
    registry.registerNpcScript({ npcId: NED_NPC_ID, option: "talk-to", handler: nedTalk });
    registry.registerNpcScript({ npcId: NED_NPC_ID, option: undefined, handler: nedTalk });

    const aggieTalk = createAggieTalkHandler(quest);
    for (const npcId of AGGIE_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: aggieTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: aggieTalk });
        registry.registerItemOnNpc(REDBERRIES_ITEM_ID, npcId, (event) =>
            aggieTalk(asNpcEvent(event)),
        );
    }

    const joeTalk = createJoeTalkHandler(quest);
    for (const npcId of JOE_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: joeTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: joeTalk });
        registry.registerItemOnNpc(BEER_ITEM_ID, npcId, (event) => {
            const npcEvent = asNpcEvent(event);
            if (getQuestStage(event.player, quest) !== STAGE_PREPARATION_COMPLETE) {
                joeTalk(npcEvent);
                return;
            }
            startConversation(
                {
                    player: event.player,
                    services: event.services,
                    npcId: JOE_VISIBLE_NPC_ID,
                    npcName: "Joe",
                },
                joeBeerSteps(quest, npcEvent),
            );
        });
    }

    const keliTalk = createLadyKeliTalkHandler(quest);
    for (const npcId of LADY_KELI_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: keliTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: keliTalk });
        registry.registerItemOnNpc(ROPE_ITEM_ID, npcId, (event) => {
            const stage = getQuestStage(event.player, quest);
            if (stage >= STAGE_PRINCE_SAVED) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You have already rescued the Prince; that plan will not work again.",
                );
                return;
            }
            if (stage < STAGE_GUARD_DRUNK || !carriesItem(event.player, event.services, ROPE_ITEM_ID)) {
                event.services.messaging.sendGameMessage(
                    event.player,
                    "You cannot tie Keli up until the guard is disabled and the plan is ready.",
                );
                return;
            }
            takeItem(event.player, event.services, ROPE_ITEM_ID);
            setQuestStage(event.player, quest, event.services, STAGE_KELI_TIED);
            removeRole(event.player.id, "keli", event.services);
            event.services.messaging.sendGameMessage(
                event.player,
                "You overpower Keli, tie her up, and put her in the cupboard.",
            );
        });
    }

    const princeTalk = createPrinceAliTalkHandler(quest, (event) => {
        removeRole(event.player.id, "prince", event.services);
    });
    for (const npcId of PRINCE_ALI_NPC_IDS) {
        registry.registerNpcScript({ npcId, option: "talk-to", handler: princeTalk });
        registry.registerNpcScript({ npcId, option: undefined, handler: princeTalk });
        for (const itemId of [BLONDE_WIG_ITEM_ID, PINK_SKIRT_ITEM_ID, SKIN_PASTE_ITEM_ID]) {
            registry.registerItemOnNpc(itemId, npcId, (event) => princeTalk(asNpcEvent(event)));
        }
    }

    const dyeWig = ({ player, services: eventServices }: { player: PlayerState; services: ScriptServices }) => {
        if (
            !carriesItem(player, eventServices, GREY_WIG_ITEM_ID) ||
            !carriesItem(player, eventServices, YELLOW_DYE_ITEM_ID)
        ) {
            return;
        }
        takeItem(player, eventServices, GREY_WIG_ITEM_ID);
        takeItem(player, eventServices, YELLOW_DYE_ITEM_ID);
        giveItem(player, eventServices, BLONDE_WIG_ITEM_ID);
        eventServices.messaging.sendGameMessage(player, "You dye the wig blonde.");
    };
    registry.registerItemOnItem(YELLOW_DYE_ITEM_ID, GREY_WIG_ITEM_ID, dyeWig);

    registry.registerLocScript({
        locId: PRISON_GATE_LOC_ID,
        action: "open",
        handler: (event) => {
            if (event.player.tileY > event.tile.y) {
                event.services.messaging.sendGameMessage(event.player, "The prison gate is locked.");
                return;
            }
            openPrisonGate(event);
        },
    });
    registry.registerItemOnLoc(BRONZE_KEY_ITEM_ID, PRISON_GATE_LOC_ID, (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_KELI_TIED) {
            event.services.messaging.sendGameMessage(
                event.player,
                "You should deal with Lady Keli before unlocking the prison.",
            );
            return;
        }
        event.services.messaging.sendGameMessage(event.player, "You unlock the prison gate.");
        openPrisonGate({
            player: event.player,
            services: event.services,
            tick: event.tick,
            locId: event.target.locId,
            tile: event.target.tile,
            level: event.target.level,
            action: "open",
        });
    });

    registry.registerZone(JAIL_ZONE, {
        enter: ({ player, services: eventServices }) =>
            ensureJailActors(player, eventServices, quest),
        exit: ({ player, services: eventServices }) => clearActors(player.id, eventServices),
    });
    registerActorLifecycle(quest, services);
}
