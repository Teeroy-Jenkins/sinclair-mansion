/**
 * Classic key doors (LostCity brasskeydoor / deepdungeondoor / dungeonjail).
 * Loc IDs from rsmod loc.sym; item IDs from obj.sym.
 */
export type KeyDoorDef = {
    locId: number;
    keyItemId: number;
    /** Loc display name used in dusty/jail messages ("door" / "gate"). */
    kind: "door" | "gate";
    note: string;
};

export const KEY_DOORS: readonly KeyDoorDef[] = [
    {
        locId: 1804, // brasskeydoor
        keyItemId: 983, // Brass key / edgevilledungeonkey
        kind: "door",
        note: "Edgeville dungeon shed (west of Cooking Guild)",
    },
    {
        locId: 2623, // deepdungeondoor
        keyItemId: 1590, // Dusty key
        kind: "gate",
        note: "Taverley dungeon deep gate",
    },
    {
        locId: 2631, // dungeonjail
        keyItemId: 1591, // Jail key
        kind: "door",
        note: "Taverley dungeon jail cell",
    },
];

export const DOOR_OPEN_SOUND = 60;
export const GATE_OPEN_SOUND = 71;
