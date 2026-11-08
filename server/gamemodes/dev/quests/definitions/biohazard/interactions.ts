import { EquipmentSlot } from "../../../../../../client/rs/config/player/Equipment";
import { SkillId } from "../../../../../../client/rs/skill/skills";
import type { PlayerState } from "../../../../../src/game/player";
import type { IScriptRegistry, NpcInteractionEvent, ScriptServices } from "../../../../../src/game/scripts/types";
import { completeQuest, countCarriedItem, getQuestStage, setQuestStage } from "../../QuestService";
import { choose, option, run, sayNpc, sayPlayer, showItem, startConversation, type DialogueOption } from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    DANCING_DONKEY_ZONE,
    DISTRACTION_ZONE,
    ERRAND,
    ITEM,
    LOC,
    NPC,
    STAGE_CLIMBED_LADDER,
    STAGE_COMPLETE,
    STAGE_FOUND_DISTILLATOR,
    STAGE_FOUND_SECRET,
    STAGE_GIVEN_DISTILLATOR,
    STAGE_NOT_STARTED,
    STAGE_POISONED_STEW,
    STAGE_RELEASED_PIGEONS,
    STAGE_REPORTED_TO_ELENA,
    STAGE_SPOKEN_TO_CHEMIST,
    STAGE_SPOKEN_TO_JERICO,
    STAGE_STARTED,
    STAGE_USED_BIRD_FEED,
    TILE,
    VARP_BIO_DUMMIES,
    VARP_BIO_ERRAND,
} from "./constants";

function ctx(event: NpcInteractionEvent, name: string) {
    return { player: event.player, services: event.services, npcId: event.npc.typeId, npcName: name };
}

function owns(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    return services.inventory.findOwnedItemLocation(player, itemId) !== undefined;
}

function freeSlots(player: PlayerState, services: ScriptServices): number {
    return services.inventory.getInventoryItems(player).filter((entry) => entry.itemId < 0 || entry.quantity <= 0).length;
}

function give(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    const result = services.inventory.addItemToInventory(player, itemId, 1);
    if (result.added !== 1) {
        services.messaging.sendGameMessage(player, "You need a free inventory space.");
        return false;
    }
    services.inventory.snapshotInventory(player);
    return true;
}

function remove(player: PlayerState, services: ScriptServices, itemId: number): boolean {
    const entry = services.inventory.getInventoryItems(player).find((slot) => slot.itemId === itemId && slot.quantity > 0);
    if (!entry) return false;
    const next = entry.quantity - 1;
    services.inventory.setInventorySlot(player, entry.slot, next > 0 ? itemId : -1, next);
    services.inventory.snapshotInventory(player);
    return true;
}

function setErrands(player: PlayerState, services: ScriptServices, value: number): void {
    player.varps.setVarpValue(VARP_BIO_ERRAND, value);
    services.variables.sendVarp(player, VARP_BIO_ERRAND, value);
}

function bit(index: number): number {
    return 1 << index;
}

function hasErrand(player: PlayerState, index: number): boolean {
    return (player.varps.getVarpValue(VARP_BIO_ERRAND) & bit(index)) !== 0;
}

type Courier = {
    name: string;
    originId: number;
    destinationId: number;
    destination: { x: number; y: number; level: number };
    givenBit: number;
    correctBit: number;
    wrongBit: number;
    correctItem: number;
};

const COURIERS: readonly Courier[] = [
    { name: "Hops", originId: NPC.hopsRimmington, destinationId: NPC.hopsVarrock, destination: TILE.hopsVarrock, givenBit: ERRAND.hopsGiven, correctBit: ERRAND.hopsCorrect, wrongBit: ERRAND.hopsWrong, correctItem: ITEM.sulphuricBroline },
    { name: "Chancy", originId: NPC.chancyRimmington, destinationId: NPC.chancyVarrock, destination: TILE.chancyVarrock, givenBit: ERRAND.chancyGiven, correctBit: ERRAND.chancyCorrect, wrongBit: ERRAND.chancyWrong, correctItem: ITEM.liquidHoney },
    { name: "Da Vinci", originId: NPC.daVinciRimmington, destinationId: NPC.daVinciVarrock, destination: TILE.daVinciVarrock, givenBit: ERRAND.daVinciGiven, correctBit: ERRAND.daVinciCorrect, wrongBit: ERRAND.daVinciWrong, correctItem: ITEM.ethenea },
];

function ensureVarrockCouriers(player: PlayerState, services: ScriptServices): void {
    for (const courier of COURIERS) {
        if (!hasErrand(player, courier.givenBit)) continue;
        if (services.npc.findNearbyNpc(player, courier.destinationId, 64)) continue;
        services.npc.spawnNpc({
            id: courier.destinationId,
            x: courier.destination.x,
            y: courier.destination.y,
            level: courier.destination.level,
            worldViewId: player.worldViewId,
            ownerPlayerId: player.id,
            lifetimeTicks: 10_000,
        });
    }
}

function createElenaHandler(quest: QuestDefinition, fallback?: (event: NpcInteractionEvent) => void) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage === STAGE_NOT_STARTED && event.player.varps.getVarpValue(165) < 29) {
            fallback?.(event);
            return;
        }
        const context = ctx(event, "Elena");
        if (stage === STAGE_NOT_STARTED) {
            startConversation(context, [
                sayNpc("The mourners confiscated my distillator. I cannot test the plague samples without it."),
                sayNpc("They keep it in their headquarters in West Ardougne. Will you retrieve it?"),
                choose([
                    option("I'll retrieve it.", [
                        sayNpc("The old tunnel was filled in. Speak to my father's friend Jerico near the chapel."),
                        run(({ player, services }) => setQuestStage(player, quest, services, STAGE_STARTED)),
                    ]),
                    option("Not right now."),
                ]),
            ]);
            return;
        }
        if (stage === STAGE_FOUND_DISTILLATOR) {
            if (!owns(event.player, event.services, ITEM.distillator)) {
                startConversation(context, [sayNpc("Please keep searching the mourner headquarters for my distillator.")]);
                return;
            }
            if (freeSlots(event.player, event.services) < 3) {
                event.services.messaging.sendGameMessage(event.player, "You need three more free inventory spaces.");
                return;
            }
            startConversation(context, [
                sayPlayer("I recovered your distillator."),
                sayNpc("Excellent. The sample does not react as expected. Take these reagents and the sample to my old mentor Guidor."),
                run(({ player, services }) => {
                    if (!remove(player, services, ITEM.distillator)) return;
                    for (const itemId of [ITEM.ethenea, ITEM.liquidHoney, ITEM.sulphuricBroline, ITEM.plagueSample]) give(player, services, itemId);
                    setErrands(player, services, 0);
                    setQuestStage(player, quest, services, STAGE_GIVEN_DISTILLATOR);
                }),
                sayNpc("First visit the Chemist in Rimmington for touch paper. He has couriers who can smuggle the fragile vials into Varrock."),
            ]);
            return;
        }
        if (stage === STAGE_GIVEN_DISTILLATOR || stage === STAGE_SPOKEN_TO_CHEMIST) {
            startConversation(context, [
                sayNpc("Have you lost any of the reagents or the plague sample?"),
                run(({ player, services }) => {
                    const missing = [ITEM.ethenea, ITEM.liquidHoney, ITEM.sulphuricBroline, ITEM.plagueSample]
                        .filter((itemId) => !owns(player, services, itemId));
                    if (freeSlots(player, services) < missing.length) {
                        services.messaging.sendGameMessage(player, `You need ${missing.length} free inventory spaces.`);
                        return;
                    }
                    for (const itemId of missing) give(player, services, itemId);
                    if (missing.length) services.messaging.sendGameMessage(player, "Elena replaces your missing samples.");
                }),
                sayNpc("Take everything to Guidor in south-east Varrock. Dress as a priest so his wife lets you in."),
            ]);
            return;
        }
        if (stage === STAGE_FOUND_SECRET) {
            startConversation(context, [
                sayPlayer("Guidor proved the plague sample is harmless. There is no plague."),
                sayNpc("Then this is bigger than both of us. Report it directly to King Lathas upstairs in Ardougne Castle."),
                run(({ player, services }) => setQuestStage(player, quest, services, STAGE_REPORTED_TO_ELENA)),
            ]);
            return;
        }
        if (stage === STAGE_REPORTED_TO_ELENA) {
            startConversation(context, [sayNpc("You must speak to King Lathas immediately.")]);
            return;
        }
        if (stage >= STAGE_COMPLETE) {
            startConversation(context, [sayNpc("Let me know when King Lathas learns more about the lands beyond the mountains.")]);
            return;
        }
        const guidance = stage < STAGE_SPOKEN_TO_JERICO
            ? "Jerico can help you cross the wall."
            : stage < STAGE_CLIMBED_LADDER
              ? "Distract the watchtower with bird feed and Jerico's pigeons, then see Omart."
              : "Search the mourner headquarters for my distillator.";
        startConversation(context, [sayNpc(guidance)]);
    };
}

function createJericoHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const context = ctx(event, "Jerico");
        if (stage === STAGE_STARTED) {
            startConversation(context, [
                sayNpc("My friends Omart and Kilron can lower a rope ladder, but first the watchtower must be distracted."),
                sayNpc("Take bird feed from my cupboard and a cage of messenger pigeons."),
                run(({ player, services }) => {
                    const missing = [ITEM.birdFeed, ITEM.pigeonCage].filter((itemId) => !owns(player, services, itemId));
                    if (freeSlots(player, services) < missing.length) return services.messaging.sendGameMessage(player, "You need two free inventory spaces.");
                    for (const itemId of missing) give(player, services, itemId);
                    setQuestStage(player, quest, services, STAGE_SPOKEN_TO_JERICO);
                }),
            ]);
            return;
        }
        if (stage === STAGE_SPOKEN_TO_JERICO) {
            for (const itemId of [ITEM.birdFeed, ITEM.pigeonCage]) if (!owns(event.player, event.services, itemId)) give(event.player, event.services, itemId);
            startConversation(context, [sayNpc("Throw the feed at the watchtower, then open the pigeon cage nearby.")]);
            return;
        }
        startConversation(context, [sayNpc(stage >= STAGE_CLIMBED_LADDER ? "Omart can help you cross the wall again." : "Hello, traveller.")]);
    };
}

function createChemistHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage !== STAGE_GIVEN_DISTILLATOR && stage !== STAGE_SPOKEN_TO_CHEMIST) {
            startConversation(ctx(event, "Chemist"), [sayNpc("I'm busy with an experiment.")]);
            return;
        }
        startConversation(ctx(event, "Chemist"), [
            sayNpc("Guidor needs touch paper? Take this sheet, but let my three couriers carry the volatile vials into Varrock."),
            run(({ player, services }) => {
                if (!owns(player, services, ITEM.touchPaper) && !give(player, services, ITEM.touchPaper)) return;
                setQuestStage(player, quest, services, STAGE_SPOKEN_TO_CHEMIST);
            }),
            sayNpc("Hops should carry the sulphuric broline, Chancy the liquid honey, and Da Vinci the ethenea."),
        ]);
    };
}

function courierOptions(event: NpcInteractionEvent, quest: QuestDefinition, courier: Courier): DialogueOption[] {
    const choices = [
        { itemId: ITEM.ethenea, text: "Give him the ethenea." },
        { itemId: ITEM.liquidHoney, text: "Give him the liquid honey." },
        { itemId: ITEM.sulphuricBroline, text: "Give him the sulphuric broline." },
    ];
    return choices.filter((choice) => countCarriedItem(event.player, event.services, choice.itemId) > 0).map((choice) =>
        option(choice.text, [
            run(({ player, services }) => {
                if (!remove(player, services, choice.itemId)) return;
                let errands = player.varps.getVarpValue(VARP_BIO_ERRAND) | bit(courier.givenBit);
                errands |= bit(choice.itemId === courier.correctItem ? courier.correctBit : courier.wrongBit);
                setErrands(player, services, errands);
                ensureVarrockCouriers(player, services);
                services.messaging.sendGameMessage(player, `${courier.name} leaves for the Dancing Donkey Inn in Varrock.`);
            }),
        ]),
    );
}

function createCourierOriginHandler(quest: QuestDefinition, courier: Courier) {
    return (event: NpcInteractionEvent): void => {
        if (getQuestStage(event.player, quest) !== STAGE_SPOKEN_TO_CHEMIST) {
            startConversation(ctx(event, courier.name), [sayNpc("The Chemist hasn't given me an errand for you.")]);
            return;
        }
        if (hasErrand(event.player, courier.givenBit)) {
            startConversation(ctx(event, courier.name), [sayNpc("I'll meet you at the Dancing Donkey Inn in Varrock.")]);
            return;
        }
        const options = courierOptions(event, quest, courier);
        if (!options.length) {
            startConversation(ctx(event, courier.name), [sayNpc("You don't have a vial for me to carry.")]);
            return;
        }
        startConversation(ctx(event, courier.name), [sayNpc("Which vial am I taking to Varrock?"), choose(options)]);
    };
}

function createCourierDestinationHandler(courier: Courier) {
    return (event: NpcInteractionEvent): void => {
        const errands = event.player.varps.getVarpValue(VARP_BIO_ERRAND);
        if ((errands & bit(courier.givenBit)) === 0) {
            startConversation(ctx(event, courier.name), [sayNpc("I have no package for you.")]);
            return;
        }
        const correct = (errands & bit(courier.correctBit)) !== 0;
        startConversation(ctx(event, courier.name), [
            sayNpc(correct ? "The trip went smoothly. Here is your vial." : "I'm afraid your vial met with an unfortunate accident."),
            run(({ player, services }) => {
                if (correct && !give(player, services, courier.correctItem)) return;
                const cleared = player.varps.getVarpValue(VARP_BIO_ERRAND) & ~bit(courier.givenBit) & ~bit(courier.correctBit) & ~bit(courier.wrongBit);
                setErrands(player, services, cleared);
            }),
        ]);
    };
}

function createGuidorHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        if (stage !== STAGE_SPOKEN_TO_CHEMIST) {
            startConversation(ctx(event, "Guidor"), [sayNpc("I am far too ill for visitors.")]);
            return;
        }
        const top = event.services.equipment.getEquippedItem(event.player, EquipmentSlot.BODY);
        const bottom = event.services.equipment.getEquippedItem(event.player, EquipmentSlot.LEGS);
        if (top !== ITEM.priestGownTop || bottom !== ITEM.priestGownBottom) {
            startConversation(ctx(event, "Guidor"), [sayNpc("My wife asked for a priest. She will not allow other visitors.")]);
            return;
        }
        const required = [ITEM.ethenea, ITEM.liquidHoney, ITEM.sulphuricBroline, ITEM.plagueSample, ITEM.touchPaper];
        if (!required.every((itemId) => countCarriedItem(event.player, event.services, itemId) > 0)) {
            startConversation(ctx(event, "Guidor"), [sayNpc("I need all three reagents, the plague sample, and touch paper.")]);
            return;
        }
        startConversation(ctx(event, "Guidor"), [
            sayNpc("Elena sent this? Let me apply the reagents to the sample..."),
            run(({ player, services }) => {
                for (const itemId of required) remove(player, services, itemId);
                setQuestStage(player, quest, services, STAGE_FOUND_SECRET);
            }),
            sayNpc("The touch paper has not reacted. This sample is harmless. There is no plague at all."),
        ]);
    };
}

function registerQuestLocations(quest: QuestDefinition, registry: IScriptRegistry): void {
    const cupboard = ({ player, services }: { player: PlayerState; services: ScriptServices }) => {
        if (getQuestStage(player, quest) < STAGE_SPOKEN_TO_JERICO || owns(player, services, ITEM.birdFeed)) {
            services.messaging.sendGameMessage(player, "You find nothing else that you need.");
            return;
        }
        if (give(player, services, ITEM.birdFeed)) services.messaging.sendGameMessage(player, "You take some bird feed.");
    };
    for (const locId of LOC.jericoCupboard) registry.registerLocScript({ locId, action: "search", handler: cupboard as never });
    for (const locId of LOC.watchtower) {
        registry.registerItemOnLoc(ITEM.birdFeed, locId, ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_SPOKEN_TO_JERICO) return services.messaging.sendGameMessage(player, "You should not waste the bird feed here.");
            if (!remove(player, services, ITEM.birdFeed)) return;
            setQuestStage(player, quest, services, STAGE_USED_BIRD_FEED);
            services.messaging.sendGameMessage(player, "You scatter the bird feed beside the watchtower.");
        });
    }
    registry.registerItemAction(ITEM.pigeonCage, ({ player, services }) => {
        if (getQuestStage(player, quest) !== STAGE_USED_BIRD_FEED || player.tileX < DISTRACTION_ZONE.bounds.minX || player.tileX > DISTRACTION_ZONE.bounds.maxX || player.tileY < DISTRACTION_ZONE.bounds.minY || player.tileY > DISTRACTION_ZONE.bounds.maxY) {
            services.messaging.sendGameMessage(player, "The pigeons do not want to leave the cage here.");
            return;
        }
        if (!remove(player, services, ITEM.pigeonCage)) return;
        give(player, services, ITEM.emptyPigeonCage);
        setQuestStage(player, quest, services, STAGE_RELEASED_PIGEONS);
        services.messaging.sendGameMessage(player, "The pigeons swarm the watchtower and distract the mourners.");
    }, "open");
    registry.registerLocScript({
        locId: LOC.rottenAppleTrough,
        action: "search",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_CLIMBED_LADDER || owns(player, services, ITEM.rottenApple)) return services.messaging.sendGameMessage(player, "You find nothing useful.");
            give(player, services, ITEM.rottenApple);
        },
    });
    for (const locId of LOC.mournerCauldron) {
        registry.registerItemOnLoc(ITEM.rottenApple, locId, ({ player, services }) => {
            if (getQuestStage(player, quest) !== STAGE_CLIMBED_LADDER) return;
            if (!remove(player, services, ITEM.rottenApple)) return;
            setQuestStage(player, quest, services, STAGE_POISONED_STEW);
            services.messaging.sendGameMessage(player, "The rotten apple dissolves into the mourners' stew.");
        });
    }
    for (const locId of LOC.nurseCupboard) {
        registry.registerLocScript({
            locId,
            action: "search",
            handler: ({ player, services }) => {
                if (getQuestStage(player, quest) < STAGE_POISONED_STEW || owns(player, services, ITEM.medicalGown)) return services.messaging.sendGameMessage(player, "The cupboard contains nothing you need.");
                give(player, services, ITEM.medicalGown);
            },
        });
    }
    for (const locId of LOC.mournerHqGates) {
        const gate = ({ player, services, tile, level }: { player: PlayerState; services: ScriptServices; tile: { x: number; y: number }; level: number }) => {
            const doctor = services.equipment.getEquippedItem(player, EquipmentSlot.BODY) === ITEM.medicalGown;
            if (!doctor && !owns(player, services, ITEM.mournerKey)) return services.messaging.sendGameMessage(player, "The gate is locked. You need a key or a convincing medical disguise.");
            services.movement.teleportPlayer(player, player.tileX <= tile.x ? tile.x + 1 : tile.x - 1, tile.y, level);
        };
        registry.registerLocScript({ locId, action: "open", handler: gate as never });
        registry.registerItemOnLoc(ITEM.mournerKey, locId, gate as never);
    }
    registry.registerLocScript({
        locId: LOC.distillatorCrate,
        action: "search",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_POISONED_STEW || getQuestStage(player, quest) > STAGE_FOUND_DISTILLATOR || owns(player, services, ITEM.distillator)) return services.messaging.sendGameMessage(player, "The crate is empty.");
            if (!give(player, services, ITEM.distillator)) return;
            setQuestStage(player, quest, services, STAGE_FOUND_DISTILLATOR);
            services.messaging.sendGameMessage(player, "You find Elena's distillator.");
        },
    });
    registry.registerLocScript({
        locId: LOC.guidorDoor,
        action: "open",
        handler: ({ player, services, tile, level }) => {
            if (getQuestStage(player, quest) < STAGE_SPOKEN_TO_CHEMIST || services.equipment.getEquippedItem(player, EquipmentSlot.BODY) !== ITEM.priestGownTop || services.equipment.getEquippedItem(player, EquipmentSlot.LEGS) !== ITEM.priestGownBottom) {
                services.messaging.sendGameMessage(player, "Guidor's wife will only admit a priest.");
                return;
            }
            services.movement.teleportPlayer(player, player.tileX <= tile.x ? tile.x + 1 : tile.x - 1, tile.y, level);
        },
    });
    registry.registerLocScript({
        locId: LOC.trainingDummy,
        action: "hit",
        handler: ({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_COMPLETE) return services.messaging.sendGameMessage(player, "Only authorised trainees may use this dummy.");
            const used = player.varps.getVarpValue(VARP_BIO_DUMMIES);
            if (used >= 6) return services.messaging.sendGameMessage(player, "You have learned all you can from the training dummies.");
            player.varps.setVarpValue(VARP_BIO_DUMMIES, used + 1);
            services.variables.sendVarp(player, VARP_BIO_DUMMIES, used + 1);
            services.skills.addSkillXp(player, SkillId.Attack, 50);
            services.messaging.sendGameMessage(player, "You strike the dummy and improve your technique.");
        },
    });
}

export function registerBiohazardInteractions(quest: QuestDefinition, registry: IScriptRegistry, _services: ScriptServices): void {
    const elenaFallback = registry.findNpcInteractionDirect(NPC.elena, "talk-to");
    registry.registerNpcScript({ npcId: NPC.elena, option: "talk-to", handler: createElenaHandler(quest, elenaFallback) });
    registry.registerNpcScript({ npcId: NPC.jerico, option: "talk-to", handler: createJericoHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.chemist, option: "talk-to", handler: createChemistHandler(quest) });
    registry.registerNpcScript({ npcId: NPC.guidor, option: "talk-to", handler: createGuidorHandler(quest) });
    registry.registerNpcScript({
        npcId: NPC.nurseSarah,
        option: "talk-to",
        handler: (event) => {
            if (getQuestStage(event.player, quest) >= STAGE_POISONED_STEW && !owns(event.player, event.services, ITEM.medicalGown)) give(event.player, event.services, ITEM.medicalGown);
            startConversation(ctx(event, "Nurse Sarah"), [sayNpc("The mourners say they have food poisoning. A medical gown should get you inside.")]);
        },
    });
    for (const omartId of NPC.omart) {
        registry.registerNpcScript({
            npcId: omartId,
            option: "talk-to",
            handler: (event) => {
                const stage = getQuestStage(event.player, quest);
                if (stage < STAGE_RELEASED_PIGEONS) return startConversation(ctx(event, "Omart"), [sayNpc("Distract the watchtower before we lower the ladder.")]);
                if (stage === STAGE_RELEASED_PIGEONS) setQuestStage(event.player, quest, event.services, STAGE_CLIMBED_LADDER);
                event.services.movement.teleportPlayer(event.player, TILE.westWallInside.x, TILE.westWallInside.y, TILE.westWallInside.level);
                event.services.messaging.sendGameMessage(event.player, "You climb the rope ladder into West Ardougne.");
            },
        });
    }
    for (const courier of COURIERS) {
        registry.registerNpcScript({ npcId: courier.originId, option: "talk-to", handler: createCourierOriginHandler(quest, courier) });
        registry.registerNpcScript({ npcId: courier.destinationId, option: "talk-to", handler: createCourierDestinationHandler(courier) });
    }
    for (const kingId of NPC.kingLathas) {
        registry.registerNpcScript({
            npcId: kingId,
            option: "talk-to",
            handler: (event) => {
                if (getQuestStage(event.player, quest) !== STAGE_REPORTED_TO_ELENA) {
                    startConversation(ctx(event, "King Lathas"), [sayNpc(getQuestStage(event.player, quest) >= STAGE_COMPLETE ? "Prepare yourself. I may need your aid beyond the mountains." : "I have no business with you at present.")]);
                    return;
                }
                startConversation(ctx(event, "King Lathas"), [
                    sayPlayer("Guidor proved the plague is a hoax."),
                    sayNpc("It is true. The wall protects Kandarin from my corrupted brother Tyras and the Dark Lord beyond the mountains."),
                    sayNpc("You have earned access to my Combat Training Camp. I will call on you when the scouts find a route west."),
                    run(({ player, services }) => completeQuest(player, services, quest)),
                ]);
            },
        });
    }
    registry.registerZone({ id: DANCING_DONKEY_ZONE.id, ...DANCING_DONKEY_ZONE.bounds }, { enter: ({ player, services }) => ensureVarrockCouriers(player, services) });
    registerQuestLocations(quest, registry);
}
