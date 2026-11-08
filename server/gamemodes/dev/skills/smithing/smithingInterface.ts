import type { SmithingProductSlot } from "./smithingData";

/** OSRS interface.smithing (group 312). */
export const SMITHING_GROUP_ID = 312;

/** Clientscript that opens the chatbox numeric input (title string arg). */
export const SCRIPT_COUNT_DIALOG = 108;

export const SMITHING_COMP = {
    make1: 3,
    make5: 4,
    make10: 5,
    makeX: 6,
    makeAll: 7,
    makeSome: 8,
    dagger: 9,
    sword: 10,
    scimitar: 11,
    longsword: 12,
    twoHand: 13,
    axe: 14,
    mace: 15,
    warhammer: 16,
    battleaxe: 17,
    claws: 18,
    chainbody: 19,
    platelegs: 20,
    plateskirt: 21,
    platebody: 22,
    nails: 23,
    medhelm: 24,
    fullhelm: 25,
    squareshield: 26,
    kiteshield: 27,
    other2: 28,
    darttips: 29,
    arrowheads: 30,
    knives: 31,
    other1: 32,
    other3: 33,
    bolts: 34,
    limbs: 35,
} as const;

/** Product slot keyed by smithing interface child component. */
export const SMITHING_SLOT_BY_COMPONENT: ReadonlyMap<number, SmithingProductSlot> = new Map([
    [SMITHING_COMP.dagger, "dagger"],
    [SMITHING_COMP.sword, "sword"],
    [SMITHING_COMP.scimitar, "scimitar"],
    [SMITHING_COMP.longsword, "longsword"],
    [SMITHING_COMP.twoHand, "2h"],
    [SMITHING_COMP.axe, "axe"],
    [SMITHING_COMP.mace, "mace"],
    [SMITHING_COMP.warhammer, "warhammer"],
    [SMITHING_COMP.battleaxe, "battleaxe"],
    [SMITHING_COMP.claws, "claws"],
    [SMITHING_COMP.chainbody, "chainbody"],
    [SMITHING_COMP.platelegs, "platelegs"],
    [SMITHING_COMP.plateskirt, "plateskirt"],
    [SMITHING_COMP.platebody, "platebody"],
    [SMITHING_COMP.nails, "nails"],
    [SMITHING_COMP.medhelm, "medhelm"],
    [SMITHING_COMP.fullhelm, "fullhelm"],
    [SMITHING_COMP.squareshield, "squareshield"],
    [SMITHING_COMP.kiteshield, "kiteshield"],
    [SMITHING_COMP.other2, "other_2"],
    [SMITHING_COMP.darttips, "darttips"],
    [SMITHING_COMP.arrowheads, "arrowheads"],
    [SMITHING_COMP.knives, "knives"],
    [SMITHING_COMP.other1, "other_1"],
    [SMITHING_COMP.other3, "other_3"],
    [SMITHING_COMP.bolts, "bolts"],
    [SMITHING_COMP.limbs, "limbs"],
]);

/** Fixed quantity buttons → mode (0=1, 1=5, 2=10, 4=all). Make X/? is handled separately. */
export const SMITHING_FIXED_QUANTITY_MODE_BY_COMPONENT: ReadonlyMap<number, number> = new Map([
    [SMITHING_COMP.make1, 0],
    [SMITHING_COMP.make5, 1],
    [SMITHING_COMP.make10, 2],
    [SMITHING_COMP.makeAll, 4],
]);

export const SMITHING_CUSTOM_QUANTITY_COMPONENTS = new Set<number>([
    SMITHING_COMP.makeX,
    SMITHING_COMP.makeSome,
]);
