// Sinclair Mansion (north of Camelot) as found in the OSRS cache.
// Coordinates and loc ids come from `yarn tsx scripts/scan-sinclair-mansion.ts [--plan 0|1]`.
// Play area: both floors of the house plus the walled garden around it.

import { MIRRORED_MANSION_DOOR_OPEN } from "../../../client/rs/config/loctype/VirtualLocs";
import type { DoorSwing } from "../../src/world/DoorStateManager";
import type { EscapeDef, MansionLayout, TaskDef, TaskStep, Tile, WeaponDef } from "./MurderGame";

const t = (x: number, y: number, level = 0): Tile => ({ x, y, level });
const up = (x: number, y: number): Tile => t(x, y, 1);

/** Classic quest items (Cook's Assistant, Merlin's Crystal, Murder Mystery...). */
export const ITEMS = {
    flypaper: 1811, // Detective's print-lifting kit (from Murder Mystery)
    bucket: 1925,
    bucketOfMilk: 1927,
    bucketOfWater: 1929,
    bucketOfWax: 30,
    compost: 6032,
    pot: 1931,
    potOfFlour: 1933,
    breadDough: 2307,
    patOfButter: 6697,
    cheese: 1985,
    jug: 1935,
    jugOfWater: 1937,
    kettle: 7688,
    fullKettle: 7690,
    wateringCan: 5331,
    /** Watering can(8) down to (5): each patch watered uses a dose, as in OSRS. */
    wateringCan8: 5340,
    wateringCan7: 5339,
    wateringCan6: 5338,
    wateringCan5: 5337,
    rake: 5341,
    weeds: 6055,
    potato: 1942,
    bakedPotato: 6701,
    potatoWithButter: 6703,
    insectRepellent: 28,
    rawBeef: 2132,
    cookedMeat: 2142,
    hammer: 2347,
    steelNails: 1539,
    plank: 960,
    tinderbox: 590,
    needle: 1733,
    thread: 1734,
    chisel: 1755,
    lockpick: 1523,
    hatchet: 1351, // Bronze axe
    willowLogs: 1519,
    bowl: 1923,
    bowlOfWater: 1921,
    /** Bowl of water + potato, then + cooked meat, then cooked: OSRS's stew. */
    incompleteStew: 1997,
    uncookedStew: 2001,
} as const;

/** Iconic weapons. One is the murder weapon (random each game); the rest are hidden as decoys. */
export const WEAPON_POOL: WeaponDef[] = [
    { itemId: 1213, name: "Rune dagger", category: "dagger" }, // (the quest's Criminal's dagger can't be wielded)
    { itemId: 1215, name: "Dragon dagger", category: "dagger" },
    { itemId: 4587, name: "Dragon scimitar", category: "scimitar" },
    { itemId: 1333, name: "Rune scimitar", category: "scimitar" },
    { itemId: 1303, name: "Rune longsword", category: "longsword" },
    { itemId: 1305, name: "Dragon longsword", category: "longsword" },
    { itemId: 1373, name: "Rune battleaxe", category: "axe" },
    { itemId: 1377, name: "Dragon battleaxe", category: "axe" },
    { itemId: 1432, name: "Rune mace", category: "mace" },
    { itemId: 1434, name: "Dragon mace", category: "mace" },
    { itemId: 4153, name: "Granite maul", category: "maul" },
];

export const WOUNDS: Record<string, string> = {
    dagger: "a small, deep stab wound. The killer used a dagger.",
    scimitar: "a long, curved slash. The killer used a scimitar.",
    longsword: "a broad, straight cut. The killer used a longsword.",
    axe: "a deep, heavy chop. The killer used an axe.",
    mace: "a flanged crushing blow, no cut at all. The killer used a mace.",
    maul: "a single shattering blow from something enormous. The killer used a maul.",
};

/** Lord Sinclair's body turns up in a different spot each game. */
export const CRIME_SCENES: Tile[] = [
    t(2731, 3581), // kitchen
    t(2746, 3575), // drawing room
    t(2738, 3574), // entrance hall
    t(2727, 3576), // west yard
    t(2744, 3564), // garden, by the fountain
    up(2740, 3581), // library
    up(2735, 3575), // David's room
];

/** The study's original blood stain (loc 654), removed so the crime scene can move. */
export const ORIGINAL_BLOOD = { locId: 654, tile: t(2746, 3578), shape: 22, rotation: 3 };

/** Rooms as rectangles per floor; first match wins. */
export const ROOMS: Array<{ name: string; level: number; x1: number; y1: number; x2: number; y2: number }> = [
    // Ground floor
    { name: "Kitchen", level: 0, x1: 2730, y1: 3579, x2: 2734, y2: 3583 },
    { name: "Entrance Hall", level: 0, x1: 2736, y1: 3573, x2: 2744, y2: 3575 },
    { name: "Corridor", level: 0, x1: 2735, y1: 3574, x2: 2737, y2: 3583 },
    { name: "Servants' Rooms", level: 0, x1: 2733, y1: 3574, x2: 2734, y2: 3578 },
    { name: "West Yard", level: 0, x1: 2724, y1: 3573, x2: 2731, y2: 3583 }, // walled yard outside the west wall
    { name: "Dining Room", level: 0, x1: 2738, y1: 3577, x2: 2744, y2: 3583 },
    { name: "Study", level: 0, x1: 2745, y1: 3577, x2: 2748, y2: 3583 },
    { name: "Drawing Room", level: 0, x1: 2745, y1: 3574, x2: 2748, y2: 3576 },
    { name: "Dog Run", level: 0, x1: 2749, y1: 3574, x2: 2756, y2: 3583 },
    { name: "Vegetable Patch", level: 0, x1: 2730, y1: 3565, x2: 2737, y2: 3572 },
    { name: "Garden", level: 0, x1: 2729, y1: 3556, x2: 2752, y2: 3572 },
    // Upstairs
    { name: "Carol's Room", level: 1, x1: 2733, y1: 3579, x2: 2735, y2: 3582 },
    { name: "Landing", level: 1, x1: 2736, y1: 3578, x2: 2737, y2: 3582 },
    { name: "Library", level: 1, x1: 2738, y1: 3578, x2: 2744, y2: 3582 },
    { name: "Elizabeth's Room", level: 1, x1: 2745, y1: 3578, x2: 2747, y2: 3582 },
    { name: "David's Room", level: 1, x1: 2733, y1: 3574, x2: 2736, y2: 3577 },
    { name: "Frank's Room", level: 1, x1: 2744, y1: 3574, x2: 2747, y2: 3577 },
    { name: "Upstairs Hall", level: 1, x1: 2737, y1: 3574, x2: 2743, y2: 3577 },
];

/**
 * Visibility zones: while the game runs, living players only see the people in their own zone.
 * A zone is a group of rooms; the rooms come from the real walls (room-map.json, built by
 * scripts/build-sinclair-zones.ts, which also draws zones.svg). Outdoors splits into west and
 * east of the front door.
 */
export const ZONE_OF_ROOM: Record<string, string> = {
    "Dining Room": "Dining Room",
    "Entrance Hall": "Entrance Hall",
    Kitchen: "West Wing",
    Corridor: "West Wing",
    "Servants' Rooms": "West Wing",
    Study: "East Wing",
    "Drawing Room": "East Wing",
    "West Yard": "West Yard",
    "Dog Run": "Dog Run",
    Library: "Library",
    "Upstairs Hall": "Upstairs Hall",
    Landing: "Upstairs West",
    "Carol's Room": "Upstairs West",
    "David's Room": "Upstairs West",
    "Elizabeth's Room": "Upstairs East",
    "Frank's Room": "Upstairs East",
};

type RoomMap = Record<string, { x1: number; y1: number; w: number; h: number; names: string[]; rows: string[] }>;
const ROOM_MAP: RoomMap = (() => {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require("./room-map.json") as RoomMap;
    } catch {
        return {}; // not built yet (the build script itself loads this file)
    }
})();

/** The room the walls put a tile in ("Outdoors" for the grounds), if the map covers it. */
function mappedRoom(tile: Tile): string | undefined {
    const m = ROOM_MAP[tile.level];
    if (!m) return undefined;
    const rx = tile.x - m.x1, ry = tile.y - m.y1;
    if (rx < 0 || ry < 0 || rx >= m.w || ry >= m.h) return undefined;
    const name = m.names[m.rows[ry].charCodeAt(rx) - 48];
    return name === "(blocked)" ? undefined : name;
}

export function zoneAt(tile: Tile): string {
    // Tiles the walk map doesn't cover (under furniture) go by the room rectangles.
    const room = mappedRoom(tile) ?? ROOMS.find((r) => r.level === tile.level && tile.x >= r.x1 && tile.x <= r.x2 && tile.y >= r.y1 && tile.y <= r.y2)?.name;
    const zone = room ? ZONE_OF_ROOM[room] : undefined;
    if (zone) return zone;
    if (tile.level !== 0) return "Upstairs";
    return tile.x < 2740 ? "West Grounds" : "East Grounds";
}

/** Crops in the walled garden (Pick, as in OSRS): loc id -> the item you get. */
export const CROPS: Record<number, number> = { 1161: 1965, 313: 1947, 312: 1942 };
/** A picked crop grows back after this long. */
export const CROP_REGROW_SEC = 30;

export function roomAt(tile: Tile): string {
    // Indoors, the walls decide (the hand-drawn rectangles overlap the outside at the edges).
    const mapped = mappedRoom(tile);
    if (mapped && mapped !== "Outdoors" && !mapped.startsWith("(")) return mapped;
    for (const r of ROOMS) {
        if (mapped === "Outdoors" && ZONE_OF_ROOM[r.name] && r.name !== "West Yard" && r.name !== "Dog Run") continue;
        if (r.level === tile.level && tile.x >= r.x1 && tile.x <= r.x2 && tile.y >= r.y1 && tile.y <= r.y2) return r.name;
    }
    return tile.level === 0 ? "Garden" : "Upstairs";
}

/** Bots change floors here: the tile in front of the staircase, which exists on both floors. */
export const STAIR_LANDING = { x: 2736, y: 3580 };

export interface MansionContainer {
    id: string;
    name: string;
    locIds: number[];
    tile: Tile;
    w: number;
    h: number;
    /** The loc's own menu option that searches it (lowercase); empty for chore-only spots. */
    action: string;
    searchable?: boolean;
}

export const CONTAINERS: MansionContainer[] = [
    // Ground floor
    { id: "sacks", name: "Kitchen sacks", locIds: [2663], tile: t(2731, 3582), w: 2, h: 1, action: "investigate" },
    { id: "flour", name: "Barrel of flour", locIds: [26122], tile: t(2733, 3582), w: 1, h: 1, action: "take-from" },
    { id: "range", name: "Range", locIds: [25730], tile: t(2734, 3582), w: 1, h: 1, action: "cook" },
    { id: "sink", name: "Kitchen sink", locIds: [25729], tile: t(2733, 3580), w: 1, h: 1, action: "", searchable: false },
    { id: "churn", name: "Dairy churn", locIds: [25720], tile: t(2730, 3579), w: 1, h: 1, action: "churn" },
    { id: "bobs_barrel", name: "Bob's barrel", locIds: [2657], tile: t(2735, 3579), w: 1, h: 1, action: "search" },
    { id: "drawers_bob", name: "Servants' drawers (north)", locIds: [25714], tile: t(2734, 3577), w: 1, h: 1, action: "open" },
    { id: "drawers_anna", name: "Servants' drawers (south)", locIds: [25708], tile: t(2733, 3576), w: 1, h: 1, action: "open" },
    { id: "annas_barrel", name: "Anna's barrel", locIds: [2656], tile: t(2733, 3575), w: 1, h: 1, action: "search" },
    { id: "bookcase_n", name: "Study bookcase (north)", locIds: [25697], tile: t(2745, 3578), w: 1, h: 1, action: "search" },
    { id: "bookcase_s", name: "Study bookcase (south)", locIds: [25698], tile: t(2745, 3577), w: 1, h: 1, action: "search" },
    { id: "drawers_drawing", name: "Drawing room drawers", locIds: [25710], tile: t(2747, 3575), w: 1, h: 1, action: "open" },
    { id: "fireplace", name: "Study fireplace", locIds: [24970], tile: t(2747, 3580), w: 1, h: 3, action: "", searchable: false },
    // Walled garden
    { id: "crest", name: "Family crest", locIds: [2655], tile: t(2746, 3573), w: 1, h: 1, action: "investigate" },
    { id: "drain", name: "Drain", locIds: [2652], tile: t(2736, 3573), w: 1, h: 1, action: "investigate" },
    { id: "compost", name: "Compost heap", locIds: [26120], tile: t(2730, 3572), w: 2, h: 2, action: "investigate" },
    { id: "veg_patch", name: "Vegetable patch", locIds: [313, 1161, 312], tile: t(2732, 3567), w: 5, h: 6, action: "pick", searchable: false },
    { id: "fountain", name: "Fountain", locIds: [2654], tile: t(2747, 3563), w: 2, h: 2, action: "investigate" },
    { id: "beehive", name: "Beehive", locIds: [26121], tile: t(2730, 3559), w: 1, h: 1, action: "investigate" },
    { id: "dog_gate", name: "Guard dog's gate", locIds: [2664, 2665], tile: t(2749, 3578), w: 2, h: 1, action: "investigate" },
    { id: "cow", name: "Dairy cow", locIds: [8689], tile: t(2739, 3560), w: 1, h: 2, action: "milk", searchable: false },
    { id: "willow", name: "Willow tree", locIds: [10819], tile: t(2747, 3568), w: 2, h: 2, action: "chop down", searchable: false },
    // Upstairs
    { id: "carols_barrel", name: "Carol's barrel", locIds: [2658], tile: up(2733, 3580), w: 1, h: 1, action: "search" },
    { id: "drawers_carol", name: "Carol's drawers", locIds: [25712], tile: up(2735, 3582), w: 1, h: 1, action: "open" },
    { id: "library_w", name: "Library bookcase (west)", locIds: [26053, 25696], tile: up(2738, 3579), w: 1, h: 2, action: "search" },
    { id: "library_e", name: "Library bookcase (east)", locIds: [25694, 25695], tile: up(2742, 3579), w: 1, h: 2, action: "search" },
    { id: "elizabeths_barrel", name: "Elizabeth's barrel", locIds: [2660], tile: up(2747, 3581), w: 1, h: 1, action: "search" },
    { id: "drawers_elizabeth", name: "Elizabeth's drawers", locIds: [25712, 25705], tile: up(2745, 3582), w: 1, h: 1, action: "open" },
    { id: "davids_barrel", name: "David's barrel", locIds: [2659], tile: up(2733, 3577), w: 1, h: 1, action: "search" },
    { id: "drawers_david", name: "David's drawers", locIds: [25708], tile: up(2733, 3576), w: 1, h: 1, action: "open" },
    { id: "franks_barrel", name: "Frank's barrel", locIds: [2661], tile: up(2747, 3577), w: 1, h: 1, action: "search" },
    { id: "drawers_frank", name: "Frank's drawers", locIds: [25710], tile: up(2747, 3576), w: 1, h: 1, action: "open" },
    { id: "spiders_nest", name: "Spiders' nest", locIds: [26109], tile: up(2740, 3574), w: 1, h: 1, action: "investigate" },
];

/*
 * Chores start empty-handed: first find the tool. They lie around the house and grounds
 * (ITEM_SPAWNS) and come back a while after someone takes one. Every chore has at least five
 * steps and works the way it does in RuneScape: water fills buckets, jugs and watering cans at
 * the sink or fountain; the churn turns milk into butter and butter into cheese and hands the
 * bucket back; the range cooks; a watering can loses a dose per patch. Food made along the way
 * is used up or put away by the end, so chores aren't a source of free healing.
 *
 * Each chore has one long moment (`fade`): the screen fades to black with a caption for
 * MURDER_CONFIG.tasks.fadeSec while the chore-doer waits for the bread to bake or waters the
 * plants. They can't see or move, and dying doesn't cut it short: it's the Murderer's moment.
 * `anim` is how a step looks, repeated while it lasts (the animations are 2009scape's: the range,
 * the churn, milking, the watering can, the rake, hammering, sewing, woodcutting, firemaking).
 */
const get = (verb: string, fetch: number): TaskStep => ({ verb, sec: 0, fetch });
const milk = (): TaskStep[] => [
    get("Find a bucket", ITEMS.bucket),
    { c: "cow", verb: "Milk the cow", sec: 3, use: ITEMS.bucket, give: ITEMS.bucketOfMilk, anim: "milk" },
    { c: "churn", verb: "Churn the milk into butter", op: "Churn Milk", sec: 4, use: ITEMS.bucketOfMilk, give: ITEMS.patOfButter, returns: [ITEMS.bucket], anim: "churn" },
];
export const TASKS: TaskDef[] = [
    // Kitchen chores (Cook's Assistant)
    { id: "cheese", name: "Make cheese for the larder", past: "made cheese for the larder", steps: [
        ...milk(),
        { c: "churn", verb: "Churn the butter into cheese", op: "Churn Butter", sec: 4, use: ITEMS.patOfButter, give: ITEMS.cheese, anim: "churn",
            fade: "You churn and churn the butter until it sets into cheese..." },
        { c: "sacks", verb: "Put the cheese in the larder", op: "Store Cheese", sec: 2, use: ITEMS.cheese },
    ] },
    // As in OSRS: flour and water make bread dough (the pot and bucket come back), then the range.
    { id: "bread", name: "Bake the bread", past: "baked the bread", steps: [
        get("Find a pot", ITEMS.pot),
        { c: "flour", verb: "Fill the pot with flour", op: "Fill Pot", sec: 2, use: ITEMS.pot, give: ITEMS.potOfFlour },
        get("Find a bucket", ITEMS.bucket),
        { c: "sink", verb: "Fill the bucket at the sink", op: "Fill Bucket", sec: 2, use: ITEMS.bucket, give: ITEMS.bucketOfWater },
        { verb: "Mix the water into the flour", sec: 0, use: ITEMS.bucketOfWater, mix: ITEMS.potOfFlour, give: ITEMS.breadDough, returns: [ITEMS.pot, ITEMS.bucket] },
        { c: "range", verb: "Bake the bread", sec: 4, use: ITEMS.breadDough, anim: "cook",
            fade: "You wait by the range while the bread bakes..." },
    ] },
    { id: "potatoes", name: "Make buttered potatoes for supper", past: "made buttered potatoes for supper", steps: [
        { c: "veg_patch", verb: "Pick a potato", sec: 1.5, give: ITEMS.potato },
        { c: "range", verb: "Bake the potato", sec: 3, use: ITEMS.potato, give: ITEMS.bakedPotato, anim: "cook",
            fade: "You wait by the range while the potato bakes in its jacket..." },
        ...milk(),
        { verb: "Butter the baked potato", sec: 0, use: ITEMS.patOfButter, mix: ITEMS.bakedPotato, give: ITEMS.potatoWithButter },
        { c: "sacks", verb: "Put the potato in the larder", op: "Store Potato", sec: 2, use: ITEMS.potatoWithButter },
    ] },
    // A tinderbox isn't used up lighting something, as in OSRS.
    { id: "kettle", name: "Put the kettle on", past: "put the kettle on", steps: [
        get("Find a tinderbox", ITEMS.tinderbox),
        { c: "range", verb: "Light the range", sec: 3, use: ITEMS.tinderbox, keep: true, anim: "light" },
        get("Find the kettle", ITEMS.kettle),
        { c: "sink", verb: "Fill the kettle at the sink", op: "Fill Kettle", sec: 2, use: ITEMS.kettle, give: ITEMS.fullKettle },
        { c: "range", verb: "Boil the kettle", sec: 4, use: ITEMS.fullKettle, anim: "cook",
            fade: "You wait by the range for the kettle to boil..." },
    ] },
    // OSRS stew: a bowl of water, then a potato, then cooked meat, then the range.
    { id: "stew", name: "Make a stew for supper", past: "made a stew for supper", steps: [
        get("Find a bowl", ITEMS.bowl),
        { c: "sink", verb: "Fill the bowl at the sink", op: "Fill Bowl", sec: 2, use: ITEMS.bowl, give: ITEMS.bowlOfWater },
        { c: "veg_patch", verb: "Pick a potato", sec: 1.5, give: ITEMS.potato },
        { verb: "Add the potato to the water", sec: 0, use: ITEMS.potato, mix: ITEMS.bowlOfWater, give: ITEMS.incompleteStew },
        get("Find some raw beef", ITEMS.rawBeef),
        { c: "range", verb: "Cook the beef", sec: 3, use: ITEMS.rawBeef, give: ITEMS.cookedMeat, anim: "cook" },
        { verb: "Add the meat to the stew", sec: 0, use: ITEMS.cookedMeat, mix: ITEMS.incompleteStew, give: ITEMS.uncookedStew },
        { c: "range", verb: "Cook the stew", sec: 4, use: ITEMS.uncookedStew, anim: "cook",
            fade: "You stir the stew over the range while it simmers..." },
    ] },
    // Woodcutting and Firemaking: chop willow logs in the garden, then light the study fire.
    { id: "fire", name: "Light the study fire", past: "lit the study fire", steps: [
        get("Find a hatchet", ITEMS.hatchet),
        { c: "willow", verb: "Chop some willow logs", op: "Chop Logs", sec: 4, use: ITEMS.hatchet, keep: true, give: ITEMS.willowLogs, anim: "chop",
            fade: "You chop at the willow tree for some time..." },
        get("Find a tinderbox", ITEMS.tinderbox),
        { c: "fireplace", verb: "Lay the logs in the study fireplace", op: "Lay Logs", sec: 2, use: ITEMS.willowLogs },
        { c: "fireplace", verb: "Light the fire", sec: 3, use: ITEMS.tinderbox, keep: true, anim: "light" },
    ] },
    // Garden
    { id: "water", name: "Water the vegetables", past: "watered the vegetables", steps: [
        get("Find a watering can", ITEMS.wateringCan),
        { c: "fountain", verb: "Fill the watering can", sec: 2, use: ITEMS.wateringCan, give: ITEMS.wateringCan8 },
        { c: "veg_patch", verb: "Water the cabbages", sec: 2, use: ITEMS.wateringCan8, give: ITEMS.wateringCan7, anim: "water" },
        { c: "veg_patch", verb: "Water the wheat", sec: 2, use: ITEMS.wateringCan7, give: ITEMS.wateringCan6, anim: "water",
            fade: "You water the plants for some time..." },
        { c: "veg_patch", verb: "Water the potatoes", sec: 2, use: ITEMS.wateringCan6, give: ITEMS.wateringCan5, anim: "water" },
    ] },
    // OSRS farming: rake the weeds out, compost them, then spread compost from a bucket.
    { id: "compost", name: "Tend the compost heap", past: "tended the compost heap", steps: [
        get("Find a rake", ITEMS.rake),
        { c: "veg_patch", verb: "Rake the weeds from the vegetable patch", sec: 3, use: ITEMS.rake, keep: true, give: ITEMS.weeds, anim: "rake",
            fade: "You rake the weeds out of the vegetable patch for some time..." },
        { c: "compost", verb: "Put the weeds on the compost heap", op: "Add Weeds", sec: 2, use: ITEMS.weeds },
        get("Find a bucket", ITEMS.bucket),
        { c: "compost", verb: "Fill the bucket with compost", op: "Fill Bucket", sec: 2, use: ITEMS.bucket, give: ITEMS.compost },
        { c: "veg_patch", verb: "Spread the compost on the vegetable patch", sec: 3, use: ITEMS.compost, give: ITEMS.bucket, anim: "pour" },
    ] },
    // Merlin's Crystal: insect repellent calms the bees so a bucket can collect their wax.
    { id: "bees", name: "Collect beeswax", past: "collected beeswax", steps: [
        get("Find the insect repellent", ITEMS.insectRepellent),
        { c: "beehive", verb: "Spray the beehive", sec: 3, use: ITEMS.insectRepellent, keep: true },
        get("Find a bucket", ITEMS.bucket),
        { c: "beehive", verb: "Collect the wax", sec: 3, use: ITEMS.bucket, give: ITEMS.bucketOfWax,
            fade: "You wait for the bees to settle, then slowly scrape the wax from the hive..." },
        { c: "drawers_drawing", verb: "Polish the drawing room drawers", op: "Polish Drawers", sec: 4, use: ITEMS.bucketOfWax, give: ITEMS.bucket },
    ] },
    { id: "dog", name: "Feed the guard dog", past: "fed the guard dog", steps: [
        get("Find some raw beef", ITEMS.rawBeef),
        { c: "range", verb: "Cook the beef", sec: 3, use: ITEMS.rawBeef, give: ITEMS.cookedMeat, anim: "cook" },
        { c: "dog_gate", verb: "Feed the dog", sec: 2, use: ITEMS.cookedMeat,
            fade: "You stay with the guard dog while it wolfs down its dinner..." },
        get("Find a bucket", ITEMS.bucket),
        { c: "fountain", verb: "Fill the bucket", sec: 2, use: ITEMS.bucket, give: ITEMS.bucketOfWater },
        { c: "dog_gate", verb: "Give the dog some water", op: "Water Dog", sec: 2, use: ITEMS.bucketOfWater, give: ITEMS.bucket, anim: "pour" },
    ] },
    { id: "drain", name: "Unblock the drain", past: "unblocked the drain", steps: [
        get("Find a chisel", ITEMS.chisel),
        { c: "drain", verb: "Chip out the blockage", sec: 4, use: ITEMS.chisel, keep: true, anim: "chisel",
            fade: "You chip away at the blockage in the drain for some time..." },
        get("Find a bucket", ITEMS.bucket),
        { c: "fountain", verb: "Fill the bucket", sec: 2, use: ITEMS.bucket, give: ITEMS.bucketOfWater },
        { c: "drain", verb: "Flush the drain", sec: 2, use: ITEMS.bucketOfWater, give: ITEMS.bucket, anim: "pour" },
    ] },
    { id: "crest", name: "Wash the family crest", past: "washed the family crest", steps: [
        get("Find a jug", ITEMS.jug),
        { c: "fountain", verb: "Fill the jug", sec: 2, use: ITEMS.jug, give: ITEMS.jugOfWater },
        { c: "crest", verb: "Wash the crest", sec: 3, use: ITEMS.jugOfWater, give: ITEMS.jug,
            fade: "You scrub years of grime off the family crest..." },
        { c: "fountain", verb: "Fill the jug again", sec: 2, use: ITEMS.jug, give: ITEMS.jugOfWater },
        { c: "crest", verb: "Rinse the crest", sec: 3, use: ITEMS.jugOfWater, give: ITEMS.jug, anim: "pour" },
    ] },
    // Upstairs (several cross floors on purpose: traffic on the stairs makes alibis)
    { id: "spiders", name: "Clear the spiders' nest", past: "cleared the spiders' nest", steps: [
        get("Find the insect repellent", ITEMS.insectRepellent),
        { c: "spiders_nest", verb: "Spray the spiders' nest", op: "Spray Nest", sec: 3, use: ITEMS.insectRepellent, keep: true },
        get("Find a bucket", ITEMS.bucket),
        { c: "sink", verb: "Fill the bucket at the sink", op: "Fill Bucket", sec: 2, use: ITEMS.bucket, give: ITEMS.bucketOfWater },
        { c: "spiders_nest", verb: "Wash the nest away", op: "Wash Nest", sec: 3, use: ITEMS.bucketOfWater, give: ITEMS.bucket, anim: "pour",
            fade: "You wash the nest away, cobweb by cobweb..." },
    ] },
    // Construction: a hammer and nails fix a plank in place.
    { id: "library", name: "Fix the library shelves", past: "fixed the library shelves", steps: [
        get("Find a hammer", ITEMS.hammer),
        get("Find some steel nails", ITEMS.steelNails),
        get("Find a plank", ITEMS.plank),
        { c: "library_w", verb: "Nail the plank onto the west shelf", op: "Nail Plank", sec: 3, use: ITEMS.plank, need: [ITEMS.hammer, ITEMS.steelNails], anim: "hammer",
            fade: "You hammer the plank onto the shelf for some time..." },
        { c: "library_e", verb: "Nail the east shelf back together", op: "Fix Shelf", sec: 3, use: ITEMS.steelNails, need: [ITEMS.hammer], anim: "hammer" },
    ] },
    // Crafting: a needle and thread.
    { id: "mending", name: "Mend the family's clothes", past: "mended the family's clothes", steps: [
        get("Find Carol's needle", ITEMS.needle),
        get("Find some thread", ITEMS.thread),
        { c: "drawers_elizabeth", verb: "Mend Elizabeth's dress", sec: 3, use: ITEMS.needle, keep: true, need: [ITEMS.thread], anim: "sew",
            fade: "You sit and mend Elizabeth's dress for some time..." },
        { c: "drawers_carol", verb: "Mend Carol's skirt", sec: 3, use: ITEMS.needle, keep: true, need: [ITEMS.thread], anim: "sew" },
        { c: "drawers_david", verb: "Mend David's shirt", sec: 3, use: ITEMS.thread, need: [ITEMS.needle], anim: "sew" },
    ] },
];

/**
 * Where the chore tools turn up, plus the Murderer's lockpick and chisel: each somewhere it
 * belongs. Out in the open on something it would be left on (tabletops, the range, the garden
 * bench, the cow's trough: the item sits on top and is taken from beside it), or on the floor
 * only where it's set down for its job (the tinderbox at the hearth, the rake by the compost).
 * Small things nobody leaves lying about are kept in furniture (`in`) and found by searching it:
 * the raw beef in the larder sacks, the needle in Carol's drawers. scripts/check-sinclair-chores.ts
 * checks every spot can be reached. A taken item is back after MURDER_CONFIG.items.respawnSec, so
 * one of each is enough; the bucket (most chores want one) and insect repellent have two.
 */
export const ITEM_SPAWNS: Array<{ itemId: number; tiles?: Tile[]; in?: string[] }> = [
    { itemId: ITEMS.bucket, tiles: [t(2730, 3581), t(2737, 3563)] }, // on the kitchen barrels; on the cow's food trough
    { itemId: ITEMS.pot, tiles: [t(2740, 3580)] }, // on the dining table
    { itemId: ITEMS.jug, tiles: [t(2742, 3579)] }, // on the dining table
    { itemId: ITEMS.bowl, tiles: [t(2743, 3580)] }, // on the dining table
    { itemId: ITEMS.hatchet, tiles: [t(2746, 3569)] }, // left by the willow tree
    { itemId: ITEMS.kettle, tiles: [t(2734, 3582)] }, // on the range
    { itemId: ITEMS.rawBeef, in: ["sacks"] }, // in the larder
    { itemId: ITEMS.tinderbox, tiles: [t(2746, 3580)] }, // study, at the hearth
    { itemId: ITEMS.hammer, tiles: [t(2747, 3579)] }, // on the study table
    { itemId: ITEMS.steelNails, in: ["bobs_barrel"] }, // Bob's barrel, in the corridor
    { itemId: ITEMS.plank, tiles: [t(2729, 3581)] }, // West Yard, stacked against the wall
    { itemId: ITEMS.insectRepellent, tiles: [t(2731, 3560)], in: ["davids_barrel"] }, // set down by the beehive; David's barrel, across from the spiders' nest
    { itemId: ITEMS.rake, tiles: [t(2729, 3572)] }, // propped by the compost heap
    { itemId: ITEMS.wateringCan, tiles: [t(2744, 3563)] }, // on the garden bench
    { itemId: ITEMS.chisel, tiles: [t(2728, 3578)] }, // West Yard, by the crumbling wall
    { itemId: ITEMS.lockpick, in: ["drawers_bob"] }, // the servants' drawers
    { itemId: ITEMS.needle, in: ["drawers_carol"] }, // Carol's sewing, in her drawers
    { itemId: ITEMS.thread, in: ["elizabeths_barrel"] }, // Elizabeth's barrel
];

/**
 * The Murderer's ways out. The front gate's lock can be picked; the garden walls at the north-west
 * and north-east corners can have bricks chiselled out until they're climbable. Those stretches of
 * wall are already crumbling (WALL_ESCAPES), which is what the chisel is used on.
 */
export const ESCAPES: EscapeDef[] = [
    { id: "gate", name: "Front gate", tile: t(2741, 3555), tool: ITEMS.lockpick, verb: "Pick the lock", seen: "picking the lock of the front gate", anim: "lockpick" },
    { id: "nw_wall", name: "North-west wall", tile: t(2727, 3583), tool: ITEMS.chisel, verb: "Chisel out a brick", seen: "chiselling bricks out of the north-west wall", anim: "chisel" },
    { id: "ne_wall", name: "North-east wall", tile: t(2753, 3571), tool: ITEMS.chisel, verb: "Chisel out a brick", seen: "chiselling bricks out of the north-east wall", anim: "chisel" },
];

/**
 * The opening cutscene's camera positions (CutsceneShot.camera): where the camera stands and how
 * high above the floor (`height`, 128 = one tile; a storey is about 240), and the spot it looks at. A wide shot of the dinner table from
 * the dining room's south-west corner, the other way from the north-east, then down the length of
 * the table to the Detective at its head.
 */
export const INTRO_CAMERAS: Array<{ from: Tile; height: number; at: Tile; lookHeight: number }> = [
    { from: t(2738, 3577), height: 300, at: t(2743, 3582), lookHeight: 200 },
    { from: t(2744, 3583), height: 300, at: t(2739, 3578), lookHeight: 200 },
    { from: t(2739, 3579), height: 290, at: t(2744, 3579), lookHeight: 270 },
];
/**
 * How a wall escape looks: its stretch of garden wall is swapped for the cache's "Crumbling wall"
 * (the same drystone, half fallen down; it still blocks the way), with fallen rubble on the
 * ground inside it. `wallId`/`rotation` are the wall segment being replaced (rotation 3 = south
 * edge of the tile, 0 = west edge); `rubble` is a tile inside for the fallen bricks.
 */
export const CRUMBLING_WALL = 40355;
/** "Pile of bricks": the bricks already fallen out. Its model only exists as a normal object (shape 10). */
export const LOOSE_BRICKS = 4769;
export const WALL_ESCAPES: Record<string, { wallId: number; rotation: number; rubble: Tile }> = {
    // The bricks lie beside the tile you chisel from (a pile blocks its own tile).
    nw_wall: { wallId: 26134, rotation: 3, rubble: t(2728, 3582) },
    ne_wall: { wallId: 979, rotation: 0, rubble: t(2752, 3570) },
};

/** The mansion's doors (closed positions). They start open; anyone can close them, and bots reopen them. */
export const DOORS: Array<{ locId: number; tile: Tile }> = [
    { locId: 25718, tile: t(2735, 3580) },
    { locId: 25716, tile: t(2731, 3579) },
    { locId: 25718, tile: t(2735, 3578) },
    { locId: 25718, tile: t(2738, 3578) },
    { locId: 25718, tile: t(2741, 3576) },
    { locId: 25718, tile: t(2746, 3576) },
    { locId: 25718, tile: t(2735, 3575) },
    { locId: 25718, tile: t(2745, 3575) },
    { locId: 25748, tile: t(2740, 3572) },
    // Upstairs
    { locId: 25718, tile: up(2745, 3581) },
    { locId: 25718, tile: up(2735, 3580) },
    { locId: 25718, tile: up(2735, 3578) },
    { locId: 25718, tile: up(2740, 3578) },
    { locId: 25718, tile: up(2745, 3578) },
    { locId: 25718, tile: up(2736, 3577) },
    { locId: 25718, tile: up(2744, 3577) },
];

/** The doors' "open" loc ids (also added to data/doors.json). Closing them is blocked during play. */
/**
 * Doors that should swing a particular way. The dining room's west door opens into its own
 * tile (inside the dining room), so the open door doesn't block the narrow hall. It is hinged on the
 * north side of the frame: the open door lies along the tile's north edge. Turned that way the
 * cache model would have its hinge out in the room and the handle at the frame, so the open door
 * is a mirrored copy (a virtual loc) with the hinge at the frame and the handle on the far end.
 */
export const DOOR_SWINGS: Array<{ tile: Tile; swing: DoorSwing }> = [
    // Dining room west door: stays on its tile but uses the mirrored model so it visually swings
    // into the dining room (not the hallway).
    { tile: t(2738, 3578), swing: { dx: 0, dy: 0, rotation: 1, openedId: MIRRORED_MANSION_DOOR_OPEN } },
];

/** The garden's south gate: the walled grounds are the edge of the play area. */
export const BOUNDARY_GATES = [26130, 26131];

/** Bot cast: the Sinclair family and servants from the quest. */
/** The Sinclair family and servants, who fill empty seats as bots (AI players). */
export const HOUSEHOLD: Array<{ name: string; female: boolean }> = [
    { name: "Anna", female: true }, { name: "Bob", female: false }, { name: "Carol", female: true },
    { name: "David", female: false }, { name: "Elizabeth", female: true }, { name: "Frank", female: false },
    { name: "Donovan", female: false }, { name: "Pierre", female: false }, { name: "Hobbes", female: false },
    { name: "Louisa", female: true }, { name: "Mary", female: true }, { name: "Stanford", female: false },
    { name: "Gossip", female: false },
];

/** The dining table (loc 597, 4x2) covers x 2740-2743, y 3579-3580. */
export const TABLE_CENTER: Tile = t(2741, 3579);
const SEATS: Tile[] = [
    t(2740, 3581), t(2741, 3581), t(2742, 3581), t(2743, 3581), // north side
    t(2740, 3578), t(2741, 3578), t(2742, 3578), t(2743, 3578), // south side
    t(2739, 3580), t(2739, 3579), // west end
    t(2744, 3580), // east end, beside the Detective
];

export const SPAWN: Tile = t(2742, 3577);

export const LAYOUT: MansionLayout = {
    containers: CONTAINERS.map(({ id, name, locIds, tile, w, h, action, searchable }) => ({ id, name, locId: locIds[0], locIds, tile, w, h, action, searchable })),
    tasks: TASKS,
    weaponPool: WEAPON_POOL,
    wounds: WOUNDS,
    itemSpawns: ITEM_SPAWNS,
    escapes: ESCAPES,
    crimeScenes: CRIME_SCENES,
    detectiveItemId: ITEMS.flypaper,
    seats: SEATS,
    detectiveSpot: t(2744, 3579), // head of the table
    tableCenter: TABLE_CENTER,
    table: { x1: 2740, y1: 3579, x2: 2743, y2: 3580 },
    weaponDrop: t(2742, 3577),
    lobbyRespawn: t(2741, 3557), // just inside the front gate
    clock: t(2742, 3582), // grandfather clock 25731
    stairs: [
        { tile: t(2736, 3581), w: 2, h: 2, locIds: [25682] },
        { tile: up(2736, 3581), w: 1, h: 1, locIds: [25683] },
    ],
    zoneAt,
};
