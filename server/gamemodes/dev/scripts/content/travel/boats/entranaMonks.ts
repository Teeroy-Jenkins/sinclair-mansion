/**
 * Monks of Entrana — Port Sarim ↔ Entrana (LostCity monk_of_entrana.rs2).
 * Soft gear gate: occupied combat equipment slots (full inv category scan deferred).
 */
import type { IScriptRegistry, NpcInteractionEvent } from "../../../../../../src/game/scripts/types";
import {
    choose,
    option,
    registerNpcOptions,
    registerTalkTo,
    run,
    sayNpc,
    startNpcConversation,
} from "../../../../npcs/helpers";
import {
    ENTRANA_DOCK,
    ENTRANA_FROM_MONK_IDS,
    ENTRANA_RETURN_DOCK,
    ENTRANA_TO_MONK_IDS,
} from "./constants";
import { sailTo } from "./fare";

/**
 * Soft Entrana worn check (LostCity also scans inventory categories).
 * HEAD, CAPE, WEAPON, BODY, SHIELD, LEGS, GLOVES.
 */
const RESTRICTED_EQUIP_SLOTS = [0, 1, 3, 4, 5, 6, 7] as const;

const TAKE_BOAT_OPTIONS = ["take-boat", "take boat"] as const;

function hasRestrictedGear(event: NpcInteractionEvent): boolean {
    const equip = event.services.equipment.getEquipArray(event.player) ?? [];
    return RESTRICTED_EQUIP_SLOTS.some((slot) => (equip[slot] ?? 0) > 0);
}

/** Nested start after `run` must wait until the current conversation ends. */
function resumeAfter(event: NpcInteractionEvent, steps: Parameters<typeof startNpcConversation>[1]): void {
    setImmediate(() => {
        startNpcConversation(event, steps);
    });
}

function refuseRestrictedGear(event: NpcInteractionEvent): void {
    startNpcConversation(event, [
        sayNpc([
            "NO WEAPONS OR ARMOUR are permitted on holy Entrana AT ALL. We will not allow you to travel there in breach of mighty Saradomin's edict.",
        ]),
        sayNpc([
            "Do not try and deceive us again. Come back when you have laid down your Zamorakian instruments of death.",
        ]),
    ]);
}

/** OSRS Take-boat — skip chat, search + sail (or refuse). */
function searchAndSailToEntrana(event: NpcInteractionEvent): void {
    event.services.messaging.sendGameMessage(event.player, "The monk quickly searches you.");
    if (hasRestrictedGear(event)) {
        refuseRestrictedGear(event);
        return;
    }
    sailTo(
        event.player,
        event.services,
        ENTRANA_DOCK,
        "After a quick search, the monk smiles at you and allows you to board.",
    );
}

function sailFromEntrana(event: NpcInteractionEvent): void {
    sailTo(
        event.player,
        event.services,
        ENTRANA_RETURN_DOCK,
        "The ship takes you to Port Sarim.",
    );
}

function offerToEntrana(event: NpcInteractionEvent): void {
    startNpcConversation(event, [
        sayNpc([
            "Do you seek passage to holy Entrana? If so, you must leave your weaponry and armour behind. This is Saradomin's will.",
        ]),
        choose([
            option("No, not right now.", [sayNpc("Very well.")]),
            option("Yes, okay, I'm ready to go.", [
                sayNpc("Very well. One moment please."),
                run((ctx) => {
                    ctx.services.messaging.sendGameMessage(
                        ctx.player,
                        "The monk quickly searches you.",
                    );
                    if (hasRestrictedGear(event)) {
                        resumeAfter(event, [
                            sayNpc([
                                "NO WEAPONS OR ARMOUR are permitted on holy Entrana AT ALL. We will not allow you to travel there in breach of mighty Saradomin's edict.",
                            ]),
                            sayNpc([
                                "Do not try and deceive us again. Come back when you have laid down your Zamorakian instruments of death.",
                            ]),
                        ]);
                        return;
                    }
                    resumeAfter(event, [
                        sayNpc("All is satisfactory. You may board the boat now."),
                        run((inner) => {
                            sailTo(
                                inner.player,
                                inner.services,
                                ENTRANA_DOCK,
                                "After a quick search, the monk smiles at you and allows you to board.",
                            );
                        }),
                    ]);
                }),
            ]),
        ]),
    ]);
}

function offerFromEntrana(event: NpcInteractionEvent): void {
    startNpcConversation(event, [
        sayNpc("Do you wish to leave holy Entrana?"),
        choose([
            option("Yes, I'm ready to go.", [
                sayNpc("Okay, let's board..."),
                run((ctx) => {
                    sailTo(
                        ctx.player,
                        ctx.services,
                        ENTRANA_RETURN_DOCK,
                        "The ship takes you to Port Sarim.",
                    );
                }),
            ]),
            option("Not just yet."),
        ]),
    ]);
}

export function registerEntranaMonks(registry: IScriptRegistry): void {
    const toIds = [...ENTRANA_TO_MONK_IDS];
    const fromIds = [...ENTRANA_FROM_MONK_IDS];

    registerTalkTo(registry, toIds, offerToEntrana);
    registerTalkTo(registry, fromIds, offerFromEntrana);

    registerNpcOptions(registry, toIds, [...TAKE_BOAT_OPTIONS], searchAndSailToEntrana);
    registerNpcOptions(registry, fromIds, [...TAKE_BOAT_OPTIONS], sailFromEntrana);
}
