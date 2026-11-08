import type { PlayerState } from "../../../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    NpcInteractionHandler,
    ScriptServices,
} from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, startConversation } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    CRIME_SCENE_TILE,
    EVIDENCE_FINGERPRINTS,
    EVIDENCE_THREAD,
    ITEM,
    LOC,
    MURDERERS,
    NPC,
    POISON_LOCATION_CHECKED,
    POISON_MURDERER_QUESTIONED,
    POISON_NOT_STARTED,
    POISON_SALESMAN_QUESTIONED,
    STAGE_COMPLETE,
    STAGE_NOT_STARTED,
    STAGE_STARTED,
    VARP_MURDER_EVIDENCE,
    VARP_MURDERER,
    VARP_POISON_PROOF,
    type MurdererDefinition,
} from "./constants";

const EVIDENCE_ITEMS = [
    ITEM.silverNecklace,
    ITEM.dustedNecklace,
    ITEM.silverCup,
    ITEM.dustedCup,
    ITEM.silverBottle,
    ITEM.dustedBottle,
    ITEM.silverBook,
    ITEM.dustedBook,
    ITEM.silverNeedle,
    ITEM.dustedNeedle,
    ITEM.silverPot,
    ITEM.dustedSilverPot,
    ITEM.redThread,
    ITEM.greenThread,
    ITEM.blueThread,
    ITEM.flypaper,
    ITEM.pungentPot,
    ITEM.dagger,
    ITEM.dustedDagger,
    ITEM.killersPrint,
    ITEM.annaPrint,
    ITEM.bobPrint,
    ITEM.carolPrint,
    ITEM.davidPrint,
    ITEM.elizabethPrint,
    ITEM.frankPrint,
    ITEM.unknownPrint,
] as const;

function context(event: NpcInteractionEvent, npcName: string) {
    return { player: event.player, services: event.services, npcId: event.npc.typeId, npcName };
}

function murdererId(player: PlayerState): number {
    return player.varps.getVarpValue(VARP_MURDERER);
}

function murderer(player: PlayerState): MurdererDefinition {
    return MURDERERS.find((entry) => entry.id === murdererId(player)) ?? MURDERERS[0];
}

function setVarp(player: PlayerState, services: ScriptServices, id: number, value: number): void {
    player.varps.setVarpValue(id, value);
    services.variables.sendVarp(player, id, value);
}

function setEvidence(player: PlayerState, services: ScriptServices, flag: number): void {
    setVarp(player, services, VARP_MURDER_EVIDENCE, player.varps.getVarpValue(VARP_MURDER_EVIDENCE) | flag);
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function hasInventoryItem(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return countCarriedItem(player, services, itemId) > 0;
}

function removeItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (countCarriedItem(player, services, itemId) < quantity) return false;
    let remaining = quantity;
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        const amount = Math.min(entry.quantity, remaining);
        const left = entry.quantity - amount;
        services.inventory.setInventorySlot(player, entry.slot, left > 0 ? itemId : -1, left);
        remaining -= amount;
        if (remaining === 0) break;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function removeAllInventory(player: PlayerState, services: ScriptServices, itemId: number): void {
    for (const entry of services.inventory.getInventoryItems(player)) {
        if (entry.itemId !== itemId || entry.quantity <= 0) continue;
        services.inventory.setInventorySlot(player, entry.slot, -1, 0);
    }
}

function giveItem(player: PlayerState, services: ScriptServices, itemId: number, quantity = 1): boolean {
    if (!hasInventoryItem(player, services, itemId) && !services.inventory.hasInventorySlot(player)) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    const result = services.inventory.addItemToInventory(player, itemId, quantity);
    if (result.added !== quantity) return false;
    services.inventory.snapshotInventory(player);
    return true;
}

function replaceItems(
    player: PlayerState,
    services: ScriptServices,
    first: number,
    second: number,
    outputs: readonly number[],
): boolean {
    if (!hasInventoryItem(player, services, first) || !hasInventoryItem(player, services, second)) return false;
    const requiredSlots = outputs.filter((itemId) => !hasInventoryItem(player, services, itemId)).length;
    const freedSlots = first === second ? 1 : 2;
    const freeSlots = services.inventory.getInventoryItems(player).filter((entry) => entry.itemId <= 0 || entry.quantity <= 0).length;
    if (requiredSlots > freeSlots + freedSlots) {
        services.messaging.sendGameMessage(player, "You need more inventory space.");
        return false;
    }
    if (!removeItem(player, services, first) || !removeItem(player, services, second)) return false;
    for (const output of outputs) {
        if (!giveItem(player, services, output)) return false;
    }
    return true;
}

function spawnCrimeEvidence(player: PlayerState, services: ScriptServices): void {
    for (const itemId of [ITEM.dagger, ITEM.pungentPot]) {
        if (owns(player, services, itemId)) continue;
        const alreadyVisible = services.groundItems.query(CRIME_SCENE_TILE, { radius: 1, observer: player })
            .some((ground) => ground.itemId === itemId);
        if (alreadyVisible) continue;
        services.groundItems.spawn(itemId, 1, CRIME_SCENE_TILE, {
            ownerId: player.id,
            worldViewId: player.worldViewId,
            privateTicks: 10_000,
            durationTicks: 10_000,
        });
    }
}

function hasConclusiveEvidence(player: PlayerState): boolean {
    const evidence = player.varps.getVarpValue(VARP_MURDER_EVIDENCE);
    return (evidence & EVIDENCE_THREAD) !== 0 &&
        (evidence & EVIDENCE_FINGERPRINTS) !== 0 &&
        player.varps.getVarpValue(VARP_POISON_PROOF) >= POISON_LOCATION_CHECKED;
}

function clearEvidence(player: PlayerState, services: ScriptServices): void {
    for (const itemId of EVIDENCE_ITEMS) removeAllInventory(player, services, itemId);
    services.inventory.snapshotInventory(player);
}

function completeInvestigation(player: PlayerState, services: ScriptServices, quest: QuestDefinition): void {
    const culprit = murderer(player);
    clearEvidence(player, services);
    services.messaging.sendGameMessage(player, `The guard arrests ${culprit.name} for Lord Sinclair's murder.`);
    if (!completeQuest(player, services, quest)) return;
    setVarp(player, services, VARP_POISON_PROOF, 0);
    setVarp(player, services, VARP_MURDER_EVIDENCE, 0);
    setVarp(player, services, VARP_MURDERER, 0);
}

function createGuardHandler(quest: QuestDefinition): NpcInteractionHandler {
    return (event) => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context(event, "Guard"), [
                sayNpc("Lord Sinclair has been murdered, and we have no idea who did it. Will you help?"),
                choose([
                    option("Sure, I'll help.", [
                        sayPlayer("Sure, I'll help."),
                        sayNpc("Investigate the crime scene, family and servants. Every murder leaves clues."),
                        run(({ player, services }) => {
                            setQuestStage(player, quest, services, STAGE_STARTED);
                            const selected = ((event.tick + player.id) % MURDERERS.length) + 1;
                            setVarp(player, services, VARP_MURDERER, selected);
                            setVarp(player, services, VARP_POISON_PROOF, POISON_NOT_STARTED);
                            setVarp(player, services, VARP_MURDER_EVIDENCE, 0);
                            spawnCrimeEvidence(player, services);
                        }),
                    ]),
                    option("Do your own dirty work.", [sayNpc("Then leave this private property.")]),
                ]),
            ]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context(event, "Guard"), [sayNpc("Excellent work. The murderer remains under guard awaiting trial.")]);
            return;
        }
        spawnCrimeEvidence(event.player, event.services);
        startConversation(context(event, "Guard"), [
            choose([
                option("What should I be doing?", [sayNpc("Find evidence identifying the killer and show that the death was not an intruder's work.")]),
                option("How did Lord Sinclair die?", [sayNpc("He appeared stabbed in a locked study, but there was an odd smell and no sound of a struggle.")]),
                option("I know who did it!", [
                    run(({ player, services }) => {
                        if (!hasConclusiveEvidence(player)) {
                            services.messaging.sendGameMessage(player, "The guard needs the thread, matching fingerprints and proof of the poison lie.");
                            return;
                        }
                        completeInvestigation(player, services, quest);
                    }),
                ]),
            ]),
        ]);
    };
}

function registerGuard(quest: QuestDefinition, registry: IScriptRegistry): void {
    const handler = createGuardHandler(quest);
    for (const npcId of NPC.guard) registry.registerNpcScript({ npcId, option: "talk-to", handler });
}

function suspectDialogue(event: NpcInteractionEvent, suspect: MurdererDefinition, quest: QuestDefinition): void {
    if (getQuestStage(event.player, quest) !== STAGE_STARTED) {
        startConversation(context(event, suspect.name), [sayNpc("I have nothing to say to you.")]);
        return;
    }
    const options = [
        option("Who do you think is responsible?", [sayNpc("It was probably an intruder, or one of the useless servants.")]),
        option("Where were you when it happened?", [sayNpc(suspect.alibi)]),
    ];
    if (event.player.varps.getVarpValue(VARP_MURDER_EVIDENCE) & EVIDENCE_THREAD) {
        options.push(option("Do you recognise this thread?", [
            sayNpc(
                owns(event.player, event.services, suspect.threadItem)
                    ? `It is the same colour as my trousers, but ${suspect.threadItem === ITEM.redThread ? "red" : suspect.threadItem === ITEM.greenThread ? "green" : "blue"} thread is hardly rare.`
                    : "It is just some thread. What is your point?",
            ),
        ]));
    }
    if (event.player.varps.getVarpValue(VARP_POISON_PROOF) >= POISON_SALESMAN_QUESTIONED) {
        options.push(option("Why did you buy poison?", [
            sayNpc(`I used it on the ${suspect.poisonTarget}. You can inspect it yourself.`),
            run(({ player, services }) => {
                if (murdererId(player) === suspect.id && player.varps.getVarpValue(VARP_POISON_PROOF) === POISON_SALESMAN_QUESTIONED) {
                    setVarp(player, services, VARP_POISON_PROOF, POISON_MURDERER_QUESTIONED);
                }
            }),
        ]));
    }
    startConversation(context(event, suspect.name), [
        sayPlayer("I'm helping the guards investigate Lord Sinclair's murder."),
        sayNpc("Ask what you want, then."),
        choose(options),
    ]);
}

function registerSuspects(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const suspect of MURDERERS) {
        registry.registerNpcScript({
            npcId: suspect.npcId,
            option: "talk-to",
            handler: (event) => suspectDialogue(event, suspect, quest),
        });
    }
    const servants: Array<[number, string, string]> = [
        [NPC.donovan, "Donovan", "I heard Bob arguing with Lord Sinclair about missing silverware."],
        [NPC.pierre, "Pierre", "The guard dog did not bark, so an intruder seems unlikely."],
        [NPC.hobbes, "Hobbes", "I heard no struggle. David had recently threatened his father."],
        [NPC.louisa, "Louisa", "I was in the kitchen with Hobbes and Mary when the body was found."],
        [NPC.mary, "Mary", "I brought Lord Sinclair's meal to the study and found the body."],
        [NPC.stanford, "Stanford", "I heard no struggle and no barking from the guard dog."],
    ];
    for (const [npcId, name, clue] of servants) {
        registry.registerNpcScript({
            npcId,
            option: "talk-to",
            handler: (event) => startConversation(context(event, name), [
                sayNpc(getQuestStage(event.player, quest) === STAGE_STARTED ? clue : "The guards told me not to discuss the murder with strangers."),
            ]),
        });
    }
    registry.registerNpcScript({
        npcId: NPC.gossip,
        option: "talk-to",
        handler: (event) => startConversation(context(event, "Gossip"), [
            sayNpc("Every Sinclair child had a motive, and a poison salesman recently sold bottles to the whole family."),
            sayNpc("Fine powder and sticky paper can lift unique fingerprints from shiny objects."),
        ]),
    });
}

function registerPoisonSalesman(quest: QuestDefinition, registry: IScriptRegistry): void {
    const fallback = registry.findNpcInteractionDirect(NPC.poisonSalesman, "talk-to");
    const handler: NpcInteractionHandler = (event) => {
        if (getQuestStage(event.player, quest) !== STAGE_STARTED) {
            if (fallback) {
                void fallback(event);
                return;
            }
            startConversation(context(event, "Poison Salesman"), [sayNpc("I'm afraid I am all sold out of poison.")]);
            return;
        }
        startConversation(context(event, "Poison Salesman"), [
            sayPlayer("Who did you sell poison to at Sinclair Mansion?"),
            sayNpc("Anna, Bob, Carol, David, Elizabeth and Frank each bought a bottle of my patented poison!"),
            run(({ player, services }) => {
                if (player.varps.getVarpValue(VARP_POISON_PROOF) < POISON_SALESMAN_QUESTIONED) {
                    setVarp(player, services, VARP_POISON_PROOF, POISON_SALESMAN_QUESTIONED);
                }
            }),
            sayNpc(
                owns(event.player, event.services, ITEM.pungentPot)
                    ? "That pungent pot smells exactly like my poison. It must have been put in Lord Sinclair's drink."
                    : "My poison has a unique, immediately recognisable smell.",
            ),
        ]);
    };
    registry.registerNpcScript({ npcId: NPC.poisonSalesman, option: "talk-to", handler });
}

function registerPoisonLocations(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const suspect of MURDERERS) {
        for (const locId of suspect.poisonLocIds) {
            registry.registerLocScript({
                locId,
                action: "investigate",
                handler: ({ player, services }) => {
                    if (getQuestStage(player, quest) !== STAGE_STARTED) {
                        services.messaging.sendGameMessage(player, "You need the guard's permission to investigate.");
                        return;
                    }
                    if (player.varps.getVarpValue(VARP_POISON_PROOF) < POISON_MURDERER_QUESTIONED) {
                        services.messaging.sendGameMessage(player, `It is the Sinclair ${suspect.poisonTarget}.`);
                        return;
                    }
                    if (murdererId(player) === suspect.id) {
                        setVarp(player, services, VARP_POISON_PROOF, POISON_LOCATION_CHECKED);
                        services.messaging.sendGameMessage(player, `The ${suspect.poisonTarget} is untouched. ${suspect.name} lied about using poison here.`);
                        return;
                    }
                    services.messaging.sendGameMessage(player, `The ${suspect.poisonTarget} shows clear traces of recently used poison.`);
                },
            });
        }
    }
}

function registerPhysicalEvidence(quest: QuestDefinition, registry: IScriptRegistry): void {
    for (const locId of LOC.smashedWindow) {
        registry.registerLocScript({
            locId,
            action: "investigate",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) !== STAGE_STARTED) {
                    services.messaging.sendGameMessage(player, "You need the guard's permission to investigate.");
                    return;
                }
                const thread = murderer(player).threadItem;
                if (!owns(player, services, thread) && !giveItem(player, services, thread)) return;
                setEvidence(player, services, EVIDENCE_THREAD);
                services.messaging.sendGameMessage(player, "You take coloured thread caught on a nail in the smashed window.");
            },
        });
    }
    for (const locId of LOC.dogGates) {
        registry.registerLocScript({
            locId,
            action: "investigate",
            handler: ({ player, services }) => services.messaging.sendGameMessage(
                player,
                getQuestStage(player, quest) === STAGE_STARTED
                    ? "The guard dog barks loudly. An unknown intruder could not have passed unnoticed."
                    : "A vicious guard dog waits behind the sturdy gate.",
            ),
        });
    }

    for (const suspect of MURDERERS) {
        registry.registerLocScript({
            locId: suspect.barrelId,
            action: "search",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) !== STAGE_STARTED) {
                    services.messaging.sendGameMessage(player, "You need the guard's permission to search here.");
                    return;
                }
                if (owns(player, services, suspect.originalItem) || owns(player, services, suspect.dustedItem) || owns(player, services, suspect.printItem)) {
                    services.messaging.sendGameMessage(player, `You already took ${suspect.name}'s silver belonging.`);
                    return;
                }
                if (giveItem(player, services, suspect.originalItem)) {
                    services.messaging.sendGameMessage(player, `You find ${suspect.name}'s silver belonging in the barrel.`);
                }
            },
        });
    }

    for (const locId of LOC.flourBarrel) {
        const takeFlour = (player: PlayerState, services: ScriptServices): void => {
            if (getQuestStage(player, quest) !== STAGE_STARTED) {
                services.messaging.sendGameMessage(player, "You need the guard's permission to use the flour.");
                return;
            }
            if (!removeItem(player, services, ITEM.emptyPot)) {
                services.messaging.sendGameMessage(player, "You need an empty pot to hold the flour.");
                return;
            }
            giveItem(player, services, ITEM.potOfFlour);
            services.messaging.sendGameMessage(player, "You fill the pot with finely sifted flour.");
        };
        registry.registerLocScript({ locId, action: "take-from", handler: ({ player, services }) => takeFlour(player, services) });
        registry.registerItemOnLoc(ITEM.emptyPot, locId, ({ player, services }) => takeFlour(player, services));
        registry.registerItemOnLoc(ITEM.pungentPot, locId, ({ player, services }) => services.messaging.sendGameMessage(player, "You should not use evidence from the crime scene to hold flour."));
    }
    registry.registerLocScript({
        locId: LOC.flypaperSacks,
        action: "investigate",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_STARTED) {
                services.messaging.sendGameMessage(player, "You need the guard's permission to search the sacks.");
                return;
            }
            if (giveItem(player, services, ITEM.flypaper)) services.messaging.sendGameMessage(player, "You take a piece of sticky flypaper.");
        },
    });
}

function registerFingerprintRecipes(registry: IScriptRegistry): void {
    const proofs = [
        ...MURDERERS.map((suspect) => ({ original: suspect.originalItem, dusted: suspect.dustedItem, print: suspect.printItem, name: suspect.name })),
        { original: ITEM.dagger, dusted: ITEM.dustedDagger, print: ITEM.unknownPrint, name: "the murder weapon" },
    ];
    for (const proof of proofs) {
        registry.registerItemOnItem(ITEM.potOfFlour, proof.original, ({ player, services }) => {
            if (!replaceItems(player, services, ITEM.potOfFlour, proof.original, [ITEM.emptyPot, proof.dusted])) return;
            services.messaging.sendGameMessage(player, `You coat ${proof.name} with a thin layer of flour.`);
        });
        registry.registerItemOnItem(ITEM.flypaper, proof.dusted, ({ player, services }) => {
            if (!replaceItems(player, services, ITEM.flypaper, proof.dusted, [proof.original, proof.print])) return;
            services.messaging.sendGameMessage(player, `You lift a clean fingerprint from ${proof.name}.`);
        });
    }
    for (const suspect of MURDERERS) {
        registry.registerItemOnItem(ITEM.unknownPrint, suspect.printItem, ({ player, services }) => {
            if (murdererId(player) !== suspect.id) {
                removeItem(player, services, suspect.printItem);
                services.messaging.sendGameMessage(player, `The prints do not match. This clears ${suspect.name}.`);
                return;
            }
            if (!replaceItems(player, services, ITEM.unknownPrint, suspect.printItem, [ITEM.killersPrint])) return;
            setEvidence(player, services, EVIDENCE_FINGERPRINTS);
            services.messaging.sendGameMessage(player, `${suspect.name}'s fingerprints exactly match those on the murder weapon.`);
        });
    }
}

export function registerMurderMysteryInteractions(
    quest: QuestDefinition,
    registry: IScriptRegistry,
    _services: ScriptServices,
): void {
    registerGuard(quest, registry);
    registerSuspects(quest, registry);
    registerPoisonSalesman(quest, registry);
    registerPoisonLocations(quest, registry);
    registerPhysicalEvidence(quest, registry);
    registerFingerprintRecipes(registry);
}
