import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestDefinitionByKey } from "../../QuestRegistry";
import { getQuestStage, setQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import { BOSS_NPC as DT_BOSS, ITEM as DT_ITEM } from "../desertTreasureI/constants";
import { ITEM as PRIEST_ITEM, NPC as PRIEST_NPC } from "../priestInPeril/constants";
import { ITEM as TOURIST_ITEM, NPC as TOURIST_NPC } from "../touristTrap/constants";
import { ITEM as TROLL_ITEM, NPC as TROLL_NPC } from "../trollStronghold/constants";
import { QUEST_KEYS } from "./constants";
import { gameMessage, giveItem, hasItem } from "./helpers";
import {
    type BossKind,
    activeBosses,
    bossKey,
    knownPlayers,
    trackPlayer,
    trackedBosses,
} from "./state";

function getQuest(key: string): QuestDefinition | undefined {
    return getQuestDefinitionByKey(key);
}

export function isBossActive(player: PlayerState, kind: BossKind): boolean {
    return activeBosses.has(bossKey(player.id, kind));
}

export function spawnBoss(
    player: PlayerState,
    services: ScriptServices,
    kind: BossKind,
    config: { id: number; name: string; x: number; y: number; level: number },
): boolean {
    if (isBossActive(player, kind)) {
        gameMessage(player, services, `${config.name} is already waiting for you.`);
        return false;
    }
    const npc = services.npc.spawnNpc({ ...config, wanderRadius: 2 });
    if (!npc) {
        gameMessage(player, services, `${config.name} could not be summoned right now.`);
        return false;
    }
    trackPlayer(player);
    trackedBosses.set(npc.id, { player, kind });
    activeBosses.add(bossKey(player.id, kind));
    return true;
}

function handleStaticQuestNpcDeath(
    services: ScriptServices,
    npcTypeId: number,
    player: PlayerState,
): void {
    const tourist = getQuest(QUEST_KEYS.touristTrap);
    const priest = getQuest(QUEST_KEYS.priestInPeril);
    const troll = getQuest(QUEST_KEYS.trollStronghold);

    if (
        tourist &&
        TOURIST_NPC.mercenaryCaptain.includes(npcTypeId as 4635) &&
        getQuestStage(player, tourist) === 1
    ) {
        giveItem(player, services, TOURIST_ITEM.metalKey, 1, "metal key");
        setQuestStage(player, tourist, services, 10);
        gameMessage(
            player,
            services,
            "The Mercenary Captain is defeated. Al Shabim may help you enter the camp.",
        );
        return;
    }
    if (
        priest &&
        PRIEST_NPC.templeGuardian.includes(npcTypeId as 3487) &&
        getQuestStage(player, priest) === 10
    ) {
        setQuestStage(player, priest, services, 20);
        gameMessage(
            player,
            services,
            "The temple guardian falls. You should report to King Roald.",
        );
        return;
    }
    if (
        priest &&
        PRIEST_NPC.monksOfZamorak.includes(npcTypeId as 3484 | 3485 | 3486) &&
        getQuestStage(player, priest) === 30
    ) {
        if (giveItem(player, services, PRIEST_ITEM.goldenKey, 1, "golden key")) {
            setQuestStage(player, priest, services, 40);
        }
        return;
    }
    if (!troll) return;
    if (TROLL_NPC.dad.includes(npcTypeId as 4130) && getQuestStage(player, troll) === 10) {
        setQuestStage(player, troll, services, 20);
        gameMessage(
            player,
            services,
            "Dad is defeated. The path into the Troll Stronghold is open.",
        );
        return;
    }
    if (
        TROLL_NPC.trollGeneral.includes(npcTypeId as 4120 | 4121 | 4122) &&
        getQuestStage(player, troll) === 20
    ) {
        if (giveItem(player, services, TROLL_ITEM.prisonKey, 1, "prison key")) {
            setQuestStage(player, troll, services, 30);
        }
        return;
    }
    if (
        TROLL_NPC.twig.includes(npcTypeId as 4133) &&
        getQuestStage(player, troll) >= 30 &&
        getQuestStage(player, troll) < 40 &&
        !hasItem(player, services, TROLL_ITEM.cellKey1)
    ) {
        giveItem(player, services, TROLL_ITEM.cellKey1, 1, "cell key 1");
    }
    if (
        TROLL_NPC.berry.includes(npcTypeId as 4134) &&
        getQuestStage(player, troll) >= 30 &&
        getQuestStage(player, troll) < 40 &&
        !hasItem(player, services, TROLL_ITEM.cellKey2)
    ) {
        giveItem(player, services, TROLL_ITEM.cellKey2, 1, "cell key 2");
    }
    if (
        getQuestStage(player, troll) >= 30 &&
        getQuestStage(player, troll) < 40 &&
        hasItem(player, services, TROLL_ITEM.cellKey1) &&
        hasItem(player, services, TROLL_ITEM.cellKey2)
    ) {
        setQuestStage(player, troll, services, 40);
        gameMessage(player, services, "You now have both cell keys. Free Godric from the prison.");
    }
}

function handleTrackedBossDeath(
    services: ScriptServices,
    npcId: number,
    killerPlayerId: number | undefined,
): boolean {
    const tracked = trackedBosses.get(npcId);
    if (!tracked) return false;
    trackedBosses.delete(npcId);
    activeBosses.delete(bossKey(tracked.player.id, tracked.kind));
    if (killerPlayerId !== tracked.player.id) return true;

    const player = tracked.player;
    const temple = getQuest(QUEST_KEYS.templeOfIkov);
    switch (tracked.kind) {
        case "fire-warrior":
            if (temple && getQuestStage(player, temple) === 50) {
                setQuestStage(player, temple, services, 60);
                gameMessage(
                    player,
                    services,
                    "The Fire Warrior falls. Find the Guardians of Armadyl.",
                );
            }
            break;
        case "damis-1":
            spawnBoss(player, services, "damis-2", {
                id: DT_BOSS.damisSecond,
                name: "Damis",
                x: 2739,
                y: 5091,
                level: 0,
            });
            gameMessage(player, services, "Damis rises again in a far more powerful form!");
            break;
        case "damis-2":
            giveItem(player, services, DT_ITEM.shadowDiamond, 1, "shadow diamond");
            break;
        case "dessous":
            giveItem(player, services, DT_ITEM.bloodDiamond, 1, "blood diamond");
            break;
        case "kamil":
            giveItem(player, services, DT_ITEM.iceDiamond, 1, "ice diamond");
            break;
        case "fareed":
            giveItem(player, services, DT_ITEM.smokeDiamond, 1, "smoke diamond");
            break;
    }
    return true;
}

export function registerQuestDeathHandlers(services: ScriptServices): void {
    const eventBus = services.system.eventBus;
    if (!eventBus) {
        services.system.logger.warn(
            "[quests:desert-treasure-i] Event bus unavailable; boss progression disabled",
        );
        return;
    }
    eventBus.on("player:login", ({ player }) => trackPlayer(player));
    eventBus.on("player:logout", ({ playerId }) => {
        knownPlayers.delete(playerId);
        for (const [npcId, tracked] of trackedBosses) {
            if (tracked.player.id !== playerId) continue;
            services.npc.removeNpc(npcId);
            trackedBosses.delete(npcId);
            activeBosses.delete(bossKey(playerId, tracked.kind));
        }
    });
    eventBus.on("npc:death", ({ npc, npcTypeId, killerPlayerId }) => {
        if (handleTrackedBossDeath(services, npc.id, killerPlayerId)) return;
        if (killerPlayerId === undefined) return;
        const player = knownPlayers.get(killerPlayerId);
        if (!player) return;
        handleStaticQuestNpcDeath(services, npcTypeId, player);
    });
}
