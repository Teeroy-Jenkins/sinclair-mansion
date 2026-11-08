/** Shared destinations / constants for Port Sarim ferries. */

export const COINS = 995;
/** Karamjan rum — confiscated by customs (Pirate's Treasure). */
export const KARAMJAN_RUM = 431;
export const FARE_COINS = 30;

/** Musa Point dock (OSRS arrival). */
export const MUSA_POINT = { x: 2956, y: 3146, level: 0 } as const;

/** Port Sarim dock near the sailors. */
export const PORT_SARIM_DOCK = { x: 3029, y: 3217, level: 0 } as const;

/** Entrana ship deck (LostCity 1_44_52_18_3 — plane 1). Cross gangplank to island. */
export const ENTRANA_DOCK = { x: 2834, y: 3331, level: 1 } as const;

/** Port Sarim Entrana ferry deck (LostCity 1_47_50_40_31 — plane 1). */
export const ENTRANA_RETURN_DOCK = { x: 3048, y: 3231, level: 1 } as const;

export const PORT_SARIM_SAILOR_IDS = [3644, 3645, 3646] as const; // Tobias, Lorris, Thresnor
export const CUSTOMS_OFFICER_IDS = [3648] as const;

/** Port Sarim → Entrana monks. */
export const ENTRANA_TO_MONK_IDS = [1165, 1166, 1167] as const;
/** Entrana → Port Sarim monks. */
export const ENTRANA_FROM_MONK_IDS = [1168, 1169, 1170] as const;
