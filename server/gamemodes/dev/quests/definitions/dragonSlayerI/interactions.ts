import type { PlayerState } from "../../../../../src/game/player";
import { NpcPreDeathDecision, type IScriptRegistry, type NpcInteractionEvent, type ScriptServices } from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, meetsQuestRequirements, setQuestStage, takeQuestItems } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import { ITEM, LOC, MAP_MELZAR_BIT, MAP_ORACLE_BIT, MAP_WORMBRAIN_BIT, NPC, STAGE_BOUGHT_SHIP, STAGE_COMPLETE, STAGE_CRANDOR, STAGE_GUILDMASTER, STAGE_NED_READY, STAGE_OZIACH, STAGE_REPAIR_1, STAGE_REPAIR_2, STAGE_REPAIR_3, TILE, VARP_DRAGON_AUX, VARP_NED_HIRED, VARP_ORACLE } from "./constants";

function context(event: NpcInteractionEvent, name: string) { return { player: event.player, services: event.services, npcId: event.npc.typeId, npcName: name }; }
function has(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1) { return countCarriedItem(player, services, itemId) >= quantity; }
function owns(player: PlayerState, services: ScriptServices, itemId: number) { return services.inventory.findOwnedItemLocation(player, itemId) !== undefined; }
function give(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) { services.messaging.sendGameMessage(player, "You need more free inventory space."); return false; }
    services.inventory.snapshotInventory(player); return true;
}
function take(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1) { return takeQuestItems(player, services, [{ itemId, quantity, journalLabel: "" }]); }
function setVarp(player: PlayerState, services: ScriptServices, id: number, value: number) { player.varps.setVarpValue(id, value); services.variables.sendVarp(player, id, value); }
function setMapBit(player: PlayerState, services: ScriptServices, bit: number) { setVarp(player, services, VARP_DRAGON_AUX, player.varps.getVarpValue(VARP_DRAGON_AUX) | bit); }

function guildmaster(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === 0) {
            if (!meetsQuestRequirements(event.player, event.services, quest)) { startConversation(context(event, "Guildmaster"), [sayNpc("Only champions with at least 32 Quest Points may take this challenge.")]); return; }
            startConversation(context(event, "Guildmaster"), [sayNpc("Oziach seeks a champion capable of slaying the dragon Elvarg."), choose([option("I'll take the challenge.", [run(({ player, services }) => setQuestStage(player, quest, services, STAGE_GUILDMASTER))]), option("Not yet.")])]); return;
        }
        if (stage === STAGE_OZIACH) {
            startConversation(context(event, "Guildmaster"), [
                sayNpc("Three map pieces reveal Crandor. One lies in Melzar's Maze, one beyond the Oracle's magic door, and Wormbrain stole the last."),
                sayNpc("Buy the Lady Lumbridge from Klarense, repair her, ask Ned to captain her, and obtain a shield from Duke Horacio."),
                run(({ player, services }) => { if (!owns(player, services, ITEM.mazeKey)) give(player, services, ITEM.mazeKey); }),
                showItem(ITEM.mazeKey, "The Guildmaster gives you the key to Melzar's Maze."),
            ]); return;
        }
        startConversation(context(event, "Guildmaster"), [sayNpc(stage >= STAGE_COMPLETE ? "You are a true champion." : "Prepare carefully. Elvarg's dragonfire is deadly.")]);
    };
}

function oziach(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_GUILDMASTER) {
            startConversation(context(event, "Oziach"), [sayPlayer("The Guildmaster sent me to prove I can wear rune platebody."), sayNpc("Then slay Elvarg of Crandor and return alive."), run(({ player, services }) => setQuestStage(player, quest, services, STAGE_OZIACH))]); return;
        }
        startConversation(context(event, "Oziach"), [sayNpc(stage >= STAGE_COMPLETE ? "Elvarg is dead. You have earned the right." : "Elvarg still lives. Speak to the Guildmaster for the preparations.")]);
    };
}

function oracle(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_OZIACH) { startConversation(context(event, "Oracle"), [sayNpc("The future is clouded.")]); return; }
        setVarp(event.player, event.services, VARP_ORACLE, Math.max(2, event.player.varps.getVarpValue(VARP_ORACLE)));
        startConversation(context(event, "Oracle"), [sayNpc("A door below Ice Mountain opens to silk, an unfired bowl, a lobster pot and a wizard's mind bomb.")]);
    };
}

function duke(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_OZIACH) { startConversation(context(event, "Duke Horacio"), [sayNpc("Welcome to Lumbridge Castle.")]); return; }
        startConversation(context(event, "Duke Horacio"), owns(event.player, event.services, ITEM.antiDragonShield) ? [sayNpc("Keep that shield between yourself and the dragonfire.")] : [sayNpc("Take this anti-dragon shield. You will need it against Elvarg."), run(({ player, services }) => { give(player, services, ITEM.antiDragonShield); })]);
    };
}

function klarense(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage < STAGE_OZIACH) { startConversation(context(event, "Klarense"), [sayNpc("The Lady Lumbridge is not for sale to you.")]); return; }
        if (stage === STAGE_OZIACH) {
            startConversation(context(event, "Klarense"), [sayNpc("Two thousand coins buys the Lady Lumbridge, holes and all."), choose([option("Buy the ship for 2,000 coins.", [run(({ player, services }) => { if (!take(player, services, ITEM.coins, 2_000)) { services.messaging.sendGameMessage(player, "You need 2,000 coins."); return; } setQuestStage(player, quest, services, STAGE_BOUGHT_SHIP); })]), option("No thanks.")])]); return;
        }
        startConversation(context(event, "Klarense"), [sayNpc("She's your ship now.")]);
    };
}

function wormbrain(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) < STAGE_OZIACH || owns(event.player, event.services, ITEM.mapWormbrain) || owns(event.player, event.services, ITEM.crandorMap)) { startConversation(context(event, "Wormbrain"), [sayNpc("Go away, human!")]); return; }
        startConversation(context(event, "Wormbrain"), [sayNpc("I sell the map scrap for ten thousand coins."), choose([option("Pay 10,000 coins.", [run(({ player, services }) => { if (!take(player, services, ITEM.coins, 10_000)) { services.messaging.sendGameMessage(player, "You need 10,000 coins."); return; } if (give(player, services, ITEM.mapWormbrain)) setMapBit(player, services, MAP_WORMBRAIN_BIT); })]), option("No deal.")])]);
    };
}

function combineMaps(player: PlayerState, services: ScriptServices): void {
    if (![ITEM.mapMelzar, ITEM.mapWormbrain, ITEM.mapOracle].every((id) => has(player, services, id))) { services.messaging.sendGameMessage(player, "You need all three pieces of the Crandor map."); return; }
    for (const id of [ITEM.mapMelzar, ITEM.mapWormbrain, ITEM.mapOracle]) take(player, services, id);
    give(player, services, ITEM.crandorMap);
    services.messaging.sendGameMessage(player, "You fit the three scraps together into a complete map of Crandor.");
}

function registerMapsAndMaze(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const pair of [[ITEM.mapMelzar, ITEM.mapWormbrain], [ITEM.mapMelzar, ITEM.mapOracle], [ITEM.mapWormbrain, ITEM.mapOracle]] as const) registry.registerItemOnItem(pair[0], pair[1], ({ player, services }) => combineMaps(player, services));
    registry.registerItemOnLoc(ITEM.mazeKey, LOC.melzarEntrance, ({ player, services }) => { if (getQuestStage(player, quest) < STAGE_OZIACH) return; services.movement.teleportPlayer(player, TILE.melzarInside.x, TILE.melzarInside.y, TILE.melzarInside.level); });
    const keys = [ITEM.redKey, ITEM.orangeKey, ITEM.yellowKey, ITEM.blueKey, ITEM.magentaKey, ITEM.greenKey];
    LOC.mazeDoors.forEach((locId, index) => registry.registerItemOnLoc(keys[index], locId, ({ player, services, target }) => { if (!take(player, services, keys[index])) return; services.movement.teleportPlayer(player, target.tile.x + (player.tileX <= target.tile.x ? 1 : -1), target.tile.y, target.level); }));
    NPC.mazeKeyDroppers.forEach((npcId, index) => registry.registerNpcPreDeath(npcId, (event) => { const player = event.killer; if (!player || getQuestStage(player, quest) < STAGE_OZIACH) return NpcPreDeathDecision.Allow; if (!owns(player, event.services, keys[index])) give(player, event.services, keys[index]); return NpcPreDeathDecision.Allow; }));
    for (const locId of LOC.melzarChest) registry.registerLocScript({ locId, action: undefined, handler: ({ player, services }) => { if (getQuestStage(player, quest) < STAGE_OZIACH || owns(player, services, ITEM.mapMelzar) || owns(player, services, ITEM.crandorMap)) { services.messaging.sendGameMessage(player, "You find nothing in the chest."); return; } if (give(player, services, ITEM.mapMelzar)) setMapBit(player, services, MAP_MELZAR_BIT); } });
    registry.registerLocScript({ locId: LOC.magicDoor, action: "open", handler: ({ player, services, tile, level }) => {
        if (player.varps.getVarpValue(VARP_ORACLE) < 2) { services.messaging.sendGameMessage(player, "The magic door is locked."); return; }
        const offerings = [ITEM.silk, ITEM.unfiredBowl, ITEM.lobsterPot, ITEM.wizardMindBomb];
        if (player.varps.getVarpValue(VARP_ORACLE) < 3) {
            if (!offerings.every((id) => has(player, services, id))) { services.messaging.sendGameMessage(player, "The door remains locked. The Oracle's four offerings are required."); return; }
            offerings.forEach((id) => take(player, services, id)); setVarp(player, services, VARP_ORACLE, 3);
        }
        services.movement.teleportPlayer(player, tile.x + (player.tileX <= tile.x ? 1 : -1), tile.y, level);
    }});
    for (const locId of LOC.oracleChest) registry.registerLocScript({ locId, action: undefined, handler: ({ player, services }) => { if (player.varps.getVarpValue(VARP_ORACLE) < 3 || owns(player, services, ITEM.mapOracle) || owns(player, services, ITEM.crandorMap)) { services.messaging.sendGameMessage(player, "You find nothing useful."); return; } if (give(player, services, ITEM.mapOracle)) setMapBit(player, services, MAP_ORACLE_BIT); } });
}

function registerShip(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnLoc(ITEM.plank, LOC.shipHole, ({ player, services }) => {
        const stage = getQuestStage(player, quest);
        if (stage < STAGE_BOUGHT_SHIP || stage >= STAGE_REPAIR_3) return;
        if (!has(player, services, ITEM.steelNails, 30)) { services.messaging.sendGameMessage(player, "You need 30 steel nails for each repair."); return; }
        if (!take(player, services, ITEM.plank) || !take(player, services, ITEM.steelNails, 30)) return;
        setQuestStage(player, quest, services, stage === STAGE_BOUGHT_SHIP ? STAGE_REPAIR_1 : stage === STAGE_REPAIR_1 ? STAGE_REPAIR_2 : STAGE_REPAIR_3);
        services.messaging.sendGameMessage(player, "You nail a plank securely across one of the holes.");
    });
    const ned = (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_REPAIR_3 && has(event.player, event.services, ITEM.crandorMap)) {
            startConversation(context(event, "Ned"), [sayNpc("Crandor! I thought I'd never see that island again."), sayPlayer("Will you captain my ship?"), sayNpc("Aye. Meet me aboard the Lady Lumbridge."), run(({ player, services }) => { if (!take(player, services, ITEM.crandorMap)) return; setVarp(player, services, VARP_NED_HIRED, 1); setQuestStage(player, quest, services, STAGE_NED_READY); })]); return;
        }
        startConversation(context(event, "Ned"), [sayNpc(stage >= STAGE_NED_READY ? "I'll meet you aboard the Lady Lumbridge." : "Bring me a complete map and a seaworthy ship.")]);
    };
    for (const npcId of NPC.captainNed) { registry.registerNpcScript({ npcId, option: "talk-to", handler: ned }); registry.registerNpcScript({ npcId, option: undefined, handler: ned }); }
    for (const locId of LOC.shipGangplanks) registry.registerLocScript({ locId, action: undefined, handler: ({ player, services }) => { if (getQuestStage(player, quest) !== STAGE_NED_READY) { services.messaging.sendGameMessage(player, "The ship is not ready to sail."); return; } setQuestStage(player, quest, services, STAGE_CRANDOR); services.movement.teleportPlayer(player, TILE.crandor.x, TILE.crandor.y, TILE.crandor.level); services.messaging.sendGameMessage(player, "The Lady Lumbridge crashes onto Crandor's shore."); } });
}

function registerCrandor(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({ locId: LOC.crandorOpening, action: undefined, handler: ({ player, services }) => services.movement.teleportPlayer(player, TILE.elvargLair.x, TILE.elvargLair.y, TILE.elvargLair.level) });
    registry.registerLocScript({ locId: LOC.crandorRope, action: undefined, handler: ({ player, services }) => services.movement.teleportPlayer(player, TILE.crandorSurface.x, TILE.crandorSurface.y, TILE.crandorSurface.level) });
    registry.registerNpcPreDeath(NPC.elvarg, (event) => { const player = event.killer; if (!player || getQuestStage(player, quest) !== STAGE_CRANDOR) return NpcPreDeathDecision.Allow; completeQuest(player, event.services, quest); setVarp(player, event.services, VARP_NED_HIRED, 0); setVarp(player, event.services, VARP_DRAGON_AUX, 0); return NpcPreDeathDecision.Allow; });
}

export function registerDragonSlayerIInteractions(quest: QuestDefinition, registry: IScriptRegistry, _services: ScriptServices): void {
    const handlers = [[NPC.guildmaster, guildmaster(quest)], [NPC.oziach, oziach(quest)], [NPC.oracle, oracle(quest)], [NPC.dukeHoracio, duke(quest)], [NPC.klarense, klarense(quest)], [NPC.wormbrain, wormbrain(quest)]] as const;
    for (const [npcId, handler] of handlers) { registry.registerNpcScript({ npcId, option: "talk-to", handler }); registry.registerNpcScript({ npcId, option: undefined, handler }); }
    registerMapsAndMaze(quest, registry); registerShip(quest, registry); registerCrandor(quest, registry);
}
