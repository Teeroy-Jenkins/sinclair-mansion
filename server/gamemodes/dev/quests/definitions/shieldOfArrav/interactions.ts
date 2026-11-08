import type { PlayerState } from "../../../../../src/game/player";
import {
    NpcPreDeathDecision,
    type IScriptRegistry,
    type NpcInteractionEvent,
    type NpcInteractionHandler,
    type ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    AUX,
    ITEM,
    LOC,
    NPC,
    STAGE_CERTIFICATE,
    STAGE_COMPLETE,
    STAGE_GANG_TASK,
    STAGE_JOINED_GANG,
    STAGE_NOT_STARTED,
    STAGE_READ_BOOK,
    STAGE_STARTED,
    VARP_SHIELD_OF_ARRAV,
} from "./constants";

function context(event: NpcInteractionEvent, npcName: string) {
    return {
        player: event.player,
        services: event.services,
        npcId: event.npc.typeId,
        npcName,
    };
}

function hasFlag(player: PlayerState, flag: number): boolean {
    return (player.varps.getVarpValue(VARP_SHIELD_OF_ARRAV) & flag) !== 0;
}

function setFlag(player: PlayerState, services: ScriptServices, flag: number, enabled: boolean): void {
    const raw = player.varps.getVarpValue(VARP_SHIELD_OF_ARRAV);
    const value = enabled ? raw | flag : raw & ~flag;
    player.varps.setVarpValue(VARP_SHIELD_OF_ARRAV, value);
    services.variables.sendVarp(player, VARP_SHIELD_OF_ARRAV, value);
}

function chooseGang(player: PlayerState, services: ScriptServices, phoenix: boolean): void {
    setFlag(player, services, AUX.gangChosen, true);
    setFlag(player, services, AUX.phoenixGang, phoenix);
}

function isPhoenix(player: PlayerState): boolean {
    return hasFlag(player, AUX.gangChosen) && hasFlag(player, AUX.phoenixGang);
}

function isBlackArm(player: PlayerState): boolean {
    return hasFlag(player, AUX.gangChosen) && !hasFlag(player, AUX.phoenixGang);
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function hasInventoryItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return countCarriedItem(player, services, itemId) > 0;
}

function canReceive(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return hasInventoryItem(player, services, itemId) || services.inventory.hasInventorySlot(player);
}

function removeItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const amount = Math.min(remaining, entry.quantity);
        const left = entry.quantity - amount;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= amount;
        if (remaining === 0) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (!canReceive(player, services, itemId)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function createReldoHandler(quest: QuestDefinition, fallback?: NpcInteractionHandler): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "Reldo"), [
                sayNpc("Hello stranger. I am the palace librarian."),
                choose([
                    option("I'm in search of a quest.", [
                        sayPlayer("I'm in search of a quest."),
                        sayNpc("Look for a book called 'The Shield of Arrav'. It may contain just the adventure you seek."),
                        run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                    ]),
                    option("What do you do?", [sayNpc("I catalogue the knowledge stored in this library.")]),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_STARTED) {
            startConversation(context(event, "Reldo"), [sayNpc("The Shield of Arrav book is somewhere among these shelves.")]);
            return;
        }
        if (stage === STAGE_READ_BOOK && !hasFlag(event.player, AUX.gangChosen)) {
            startConversation(context(event, "Reldo"), [
                sayPlayer("I've read the book. Where can I find the gangs?"),
                sayNpc("Baraek in the market knows about the Phoenix Gang. Charlie the Tramp knows the Black Arm Gang."),
            ]);
            return;
        }
        void fallback?.(event);
    };
}

function registerBook(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerLocScript({
        locId: LOC.bookcase,
        action: "search",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_STARTED) {
                services.messaging.sendGameMessage(player, "A large collection of books.");
                return;
            }
            if (owns(player, services, ITEM.book)) {
                services.messaging.sendGameMessage(player, "You already have The Shield of Arrav.");
                return;
            }
            if (giveItem(player, services, ITEM.book)) {
                services.messaging.sendGameMessage(player, "You take The Shield of Arrav from the bookcase.");
            }
        },
    });
    registry.registerItemAction(
        ITEM.book,
        ({ player, services }) => {
            services.messaging.sendGameMessage(player, "The book tells how the Phoenix Gang stole Arrav's shield and later split in two.");
            if (getQuestStage(player, quest) === STAGE_STARTED) {
                setQuestStage(player, quest, services, STAGE_READ_BOOK);
            }
        },
        "read",
    );
}

function createBaraekHandler(quest: QuestDefinition, fallback?: NpcInteractionHandler): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage !== STAGE_READ_BOOK || hasFlag(event.player, AUX.gangChosen)) {
            void fallback?.(event);
            return;
        }
        startConversation(context(event, "Baraek"), [
            sayPlayer("Can you tell me where I can find the Phoenix Gang?"),
            sayNpc("Perhaps, if I were 20 gold coins richer."),
            choose([
                option("Okay. Have 20 gold coins.", [
                    run(({ player, services }) => {
                        if (!removeItem(player, services, ITEM.coins, 20)) {
                            services.messaging.sendGameMessage(player, "You don't have 20 coins.");
                            return;
                        }
                        chooseGang(player, services, true);
                        setFlag(player, services, AUX.phoenixLocationKnown, true);
                        services.messaging.sendGameMessage(player, "Baraek directs you to an alley near Varrock's south gate.");
                    }),
                ]),
                option("No. I don't like bribery.", []),
            ]),
        ]);
    };
}

function createCharlieHandler(quest: QuestDefinition): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_READ_BOOK && !hasFlag(event.player, AUX.gangChosen)) {
            startConversation(context(event, "Charlie the Tramp"), [
                sayNpc("The Black Arm Gang? Their headquarters is down the alley to the west."),
                run(({ player, services }) => chooseGang(player, services, false)),
            ]);
            return;
        }
        startConversation(context(event, "Charlie the Tramp"), [
            sayNpc(isBlackArm(event.player) ? "You know where the Black Arm hideout is." : "Spare some change for a tramp?"),
        ]);
    };
}

function joinPhoenix(player: PlayerState, services: ScriptServices, quest: QuestDefinition): boolean {
    if (getQuestStage(player, quest) !== STAGE_GANG_TASK || !isPhoenix(player)) return false;
    if (!removeItem(player, services, ITEM.intelReport)) return false;
    if (!giveItem(player, services, ITEM.weaponStoreKey)) return false;
    setQuestStage(player, quest, services, STAGE_JOINED_GANG);
    services.messaging.sendGameMessage(player, "Straven welcomes you to the Phoenix Gang and gives you the weapon store key.");
    return true;
}

function createStravenHandler(quest: QuestDefinition): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (!isPhoenix(event.player)) {
            startConversation(context(event, "Straven"), [sayNpc("Only authorised VTAM personnel may enter.")]);
            return;
        }
        if (stage === STAGE_READ_BOOK && hasFlag(event.player, AUX.phoenixLocationKnown)) {
            startConversation(context(event, "Straven"), [
                sayNpc("Kill Jonny the Beard in the Blue Moon Inn and bring me his intelligence report."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_GANG_TASK)),
            ]);
            return;
        }
        if (stage === STAGE_GANG_TASK) {
            if (hasInventoryItem(event.player, event.services, ITEM.intelReport)) {
                startConversation(context(event, "Straven"), [
                    sayPlayer("I have the intelligence report."),
                    run(({ player, services }) => joinPhoenix(player, services, quest)),
                ]);
            } else {
                startConversation(context(event, "Straven"), [sayNpc("Jonny the Beard still has the report I need.")]);
            }
            return;
        }
        if (stage >= STAGE_JOINED_GANG && stage < STAGE_COMPLETE) {
            if (!owns(event.player, event.services, ITEM.weaponStoreKey)) {
                giveItem(event.player, event.services, ITEM.weaponStoreKey);
            }
            startConversation(context(event, "Straven"), [sayNpc("Greetings, fellow Phoenix.")]);
            return;
        }
        startConversation(context(event, "Straven"), [sayNpc("Keep out of Phoenix Gang business.")]);
    };
}

function createKatrineHandler(quest: QuestDefinition): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (isPhoenix(event.player)) {
            startConversation(context(event, "Katrine"), [sayNpc("Get lost, Phoenix Gang spy!")]);
            return;
        }
        if (stage === STAGE_READ_BOOK && isBlackArm(event.player)) {
            startConversation(context(event, "Katrine"), [
                sayNpc("Steal two crossbows from the Phoenix Gang weapon store and I may trust you."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_GANG_TASK)),
            ]);
            return;
        }
        if (stage === STAGE_GANG_TASK && isBlackArm(event.player)) {
            if (countCarriedItem(event.player, event.services, ITEM.phoenixCrossbow) >= 2) {
                startConversation(context(event, "Katrine"), [
                    sayPlayer("I have the two Phoenix crossbows."),
                    run(({ player, services }) => {
                        if (!removeItem(player, services, ITEM.phoenixCrossbow, 2)) return;
                        setQuestStage(player, quest, services, STAGE_JOINED_GANG);
                    }),
                    sayNpc("Welcome to the Black Arm Gang. You may enter our rooms."),
                ]);
            } else {
                startConversation(context(event, "Katrine"), [sayNpc("I need two Phoenix crossbows before you can join us.")]);
            }
            return;
        }
        startConversation(context(event, "Katrine"), [sayNpc(stage >= STAGE_JOINED_GANG && isBlackArm(event.player) ? "Hello, fellow Black Arm." : "This is a private business.")]);
    };
}

function registerGangDrops(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerNpcPreDeath(NPC.jonnyTheBeard, (event) => {
        const player = event.killer;
        if (!player || !isPhoenix(player) || getQuestStage(player, quest) !== STAGE_GANG_TASK) {
            return NpcPreDeathDecision.Allow;
        }
        if (!owns(player, event.services, ITEM.intelReport)) {
            event.services.groundItems.spawn(
                ITEM.intelReport,
                1,
                { x: event.npc.tileX, y: event.npc.tileY, level: event.npc.level },
                { ownerId: player.id, worldViewId: player.worldViewId, privateTicks: 250 },
            );
        }
        return NpcPreDeathDecision.Allow;
    });
    registry.registerNpcPreDeath(NPC.weaponsmaster, (event) => {
        event.services.groundItems.spawn(
            ITEM.phoenixCrossbow,
            2,
            { x: event.npc.tileX, y: event.npc.tileY, level: event.npc.level },
            { worldViewId: event.npc.worldViewId, durationTicks: 250 },
        );
        return NpcPreDeathDecision.Allow;
    });
}

function registerShieldCaches(quest: QuestDefinition, registry: IScriptRegistry): void {
    const search = (phoenix: boolean) => ({ player, services }: { player: PlayerState; services: ScriptServices }) => {
        if (getQuestStage(player, quest) !== STAGE_JOINED_GANG || isPhoenix(player) !== phoenix) {
            services.messaging.sendGameMessage(player, "You find nothing of interest.");
            return;
        }
        const itemId = phoenix ? ITEM.phoenixShieldHalf : ITEM.blackArmShieldHalf;
        if (owns(player, services, itemId)) {
            services.messaging.sendGameMessage(player, "You already have this half of the Shield of Arrav.");
            return;
        }
        if (giveItem(player, services, itemId)) {
            services.messaging.sendGameMessage(player, "You find half of the Shield of Arrav.");
        }
    };
    registry.registerLocScript({ locId: LOC.phoenixChest, action: "open", handler: search(true) });
    registry.registerLocScript({ locId: LOC.blackArmCupboard, action: "open", handler: search(false) });
}

function ownShieldAndCertificate(player: PlayerState): { shield: number; half: number } | undefined {
    if (!hasFlag(player, AUX.gangChosen)) return undefined;
    return isPhoenix(player)
        ? { shield: ITEM.phoenixShieldHalf, half: ITEM.phoenixCertificateHalf }
        : { shield: ITEM.blackArmShieldHalf, half: ITEM.blackArmCertificateHalf };
}

function createCuratorHandler(quest: QuestDefinition, fallback?: NpcInteractionHandler): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        const own = ownShieldAndCertificate(event.player);
        if (!own || stage < STAGE_JOINED_GANG || stage >= STAGE_COMPLETE) {
            void fallback?.(event);
            return;
        }
        if (stage === STAGE_JOINED_GANG && hasInventoryItem(event.player, event.services, own.shield)) {
            startConversation(context(event, "Curator Haig Halen"), [
                sayNpc("This really is half of the lost Shield of Arrav! I will write two matching certificate halves."),
                run(({ player, services }) => {
                    if (!removeItem(player, services, own.shield)) return;
                    if (!giveItem(player, services, own.half, 2)) return;
                    setQuestStage(player, quest, services, STAGE_CERTIFICATE);
                }),
            ]);
            return;
        }
        if (
            stage === STAGE_CERTIFICATE &&
            !owns(event.player, event.services, ITEM.certificate) &&
            !owns(event.player, event.services, own.half)
        ) {
            startConversation(context(event, "Curator Haig Halen"), [
                sayNpc("I can replace the certificate halves I wrote for you."),
                run(({ player, services }) => giveItem(player, services, own.half, 2)),
            ]);
            return;
        }
        startConversation(context(event, "Curator Haig Halen"), [
            sayNpc(stage === STAGE_JOINED_GANG ? "Bring me your gang's half of the Shield of Arrav." : "Exchange a certificate half with your partner and join the two pieces."),
        ]);
    };
}

function createKingHandler(quest: QuestDefinition, fallback?: NpcInteractionHandler): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (hasInventoryItem(event.player, event.services, ITEM.certificate)) {
            if (stage < STAGE_JOINED_GANG || !hasFlag(event.player, AUX.gangChosen)) {
                startConversation(context(event, "King Roald"), [sayNpc("The name on this certificate is not yours. Complete the quest yourself.")]);
                return;
            }
            if (stage === STAGE_CERTIFICATE) {
                startConversation(context(event, "King Roald"), [
                    sayNpc("The Shield of Arrav has returned to Varrock at last. Here is your half of the old bounty."),
                    run(({ player, services }) => {
                        if (!removeItem(player, services, ITEM.certificate)) return;
                        completeQuest(player, services, quest);
                    }),
                ]);
                return;
            }
        }
        void fallback?.(event);
    };
}

function registerCertificates(quest: QuestDefinition, registry: IScriptRegistry): void {
    registry.registerItemOnItem(
        ITEM.phoenixCertificateHalf,
        ITEM.blackArmCertificateHalf,
        ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_CERTIFICATE) return;
            if (!canReceive(player, services, ITEM.certificate)) return;
            if (!removeItem(player, services, ITEM.phoenixCertificateHalf)) return;
            if (!removeItem(player, services, ITEM.blackArmCertificateHalf)) return;
            if (giveItem(player, services, ITEM.certificate)) {
                services.messaging.sendGameMessage(player, "You fit the two certificate halves together.");
            }
        },
    );

    for (const sourceHalf of [ITEM.phoenixCertificateHalf, ITEM.blackArmCertificateHalf]) {
        registry.registerItemOnPlayer(sourceHalf, ({ player, target, services }) => {
            if (getQuestStage(player, quest) !== STAGE_CERTIFICATE || getQuestStage(target, quest) !== STAGE_CERTIFICATE) return;
            const opposite = sourceHalf === ITEM.phoenixCertificateHalf
                ? ITEM.blackArmCertificateHalf
                : ITEM.phoenixCertificateHalf;
            if (!hasInventoryItem(player, services, sourceHalf) || !hasInventoryItem(target, services, opposite)) {
                services.messaging.sendGameMessage(player, "That player does not have the opposite certificate half.");
                return;
            }
            if (!canReceive(player, services, opposite) || !canReceive(target, services, sourceHalf)) {
                services.messaging.sendGameMessage(player, "Both players need a free inventory space.");
                return;
            }
            if (!removeItem(player, services, sourceHalf) || !removeItem(target, services, opposite)) return;
            giveItem(player, services, opposite);
            giveItem(target, services, sourceHalf);
            services.messaging.sendGameMessage(player, `You exchange certificate halves with ${target.name}.`);
            services.messaging.sendGameMessage(target, `You exchange certificate halves with ${player.name}.`);
        });
    }

    registry.registerItemOnPlayer(ITEM.weaponStoreKey, ({ player, target, services }) => {
        if (!hasInventoryItem(player, services, ITEM.weaponStoreKey)) return;
        if (!canReceive(target, services, ITEM.weaponStoreKey)) {
            services.messaging.sendGameMessage(player, "That player has no inventory space.");
            return;
        }
        if (!removeItem(player, services, ITEM.weaponStoreKey)) return;
        if (giveItem(target, services, ITEM.weaponStoreKey)) {
            services.messaging.sendGameMessage(player, `You give the weapon store key to ${target.name}.`);
            services.messaging.sendGameMessage(target, `${player.name} gives you a weapon store key.`);
        }
    });
}

function crossDoor(player: PlayerState, services: ScriptServices, axis: "x" | "y", coordinate: number): void {
    if (axis === "x") {
        services.movement.teleportPlayer(player, player.tileX >= coordinate ? coordinate - 1 : coordinate + 1, player.tileY, player.level);
    } else {
        services.movement.teleportPlayer(player, player.tileX, player.tileY >= coordinate ? coordinate - 1 : coordinate + 1, player.level);
    }
}

function registerDoors(quest: QuestDefinition, registry: IScriptRegistry): void {
    const weaponStore = ({ player, services }: { player: PlayerState; services: ScriptServices }) => {
        if (!hasInventoryItem(player, services, ITEM.weaponStoreKey)) {
            services.messaging.sendGameMessage(player, "The door is securely locked.");
            return;
        }
        crossDoor(player, services, "x", 3251);
    };
    registry.registerLocScript({ locId: LOC.weaponStoreDoor, action: "open", handler: weaponStore });
    registry.registerItemOnLoc(ITEM.weaponStoreKey, LOC.weaponStoreDoor, weaponStore);
    registry.registerLocScript({
        locId: LOC.blackArmDoor,
        action: "open",
        handler: ({ player, services }) => {
            if (!isBlackArm(player) || getQuestStage(player, quest) < STAGE_JOINED_GANG) {
                services.messaging.sendGameMessage(player, "This door is locked from the inside.");
                return;
            }
            crossDoor(player, services, "x", 3185);
        },
    });
    registry.registerLocScript({
        locId: LOC.phoenixHideoutDoor,
        action: "open",
        handler: ({ player, services }) => {
            if (!isPhoenix(player) || getQuestStage(player, quest) < STAGE_JOINED_GANG) {
                services.messaging.sendGameMessage(player, "Only Phoenix Gang members may pass.");
                return;
            }
            crossDoor(player, services, "y", 9779);
        },
    });
}

export function registerShieldOfArravInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    const reldoFallback = registry.findNpcInteractionDirect(NPC.reldo, "talk-to");
    const baraekFallback = registry.findNpcInteractionDirect(NPC.baraek, "talk-to");
    const curatorFallback = registry.findNpcInteractionDirect(NPC.curator, "talk-to");
    const kingFallback = registry.findNpcInteractionDirect(NPC.kingRoald, "talk-to");

    registry.registerNpcScript({ npcId: NPC.reldo, option: "talk-to", handler: createReldoHandler(quest, reldoFallback) });
    registry.registerNpcScript({ npcId: NPC.baraek, option: "talk-to", handler: createBaraekHandler(quest, baraekFallback) });
    registry.registerNpcScript({ npcId: NPC.charlie, option: "talk-to", handler: createCharlieHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.straven, option: "talk-to", handler: createStravenHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.katrine, option: "talk-to", handler: createKatrineHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.curator, option: "talk-to", handler: createCuratorHandler(quest, curatorFallback) });
    registry.registerNpcScript({ npcId: NPC.kingRoald, option: "talk-to", handler: createKingHandler(quest, kingFallback) });
    registry.registerItemOnNpc(ITEM.intelReport, NPC.straven, ({ player, services }) => {
        joinPhoenix(player, services, quest);
    });

    registerBook(quest, registry);
    registerGangDrops(quest, registry);
    registerShieldCaches(quest, registry);
    registerCertificates(quest, registry);
    registerDoors(quest, registry);
}
