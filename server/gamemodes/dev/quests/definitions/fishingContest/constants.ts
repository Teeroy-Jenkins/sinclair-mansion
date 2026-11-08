export const FISHING_CONTEST_QUEST_KEY = "fishing_contest";
export const VARP_FISHING_CONTEST = 11;
export const VARP_COMPETITION_CATCHES = 12;
export const VARP_PIPE_STASHED = 13;
export const STAGE_STARTED = 1;
export const STAGE_COMPETING = 2;
export const STAGE_GARLIC = 3;
export const STAGE_WON = 4;
export const STAGE_COMPLETE = 5;
export const ITEM = {
    worm: 25,
    trophy: 26,
    pass: 27,
    bait: 313,
    rod: 307,
    carp: 338,
    sardine: 327,
    garlic: 1550,
    coins: 995,
    spade: 952,
} as const;

export const NPC = {
    bonzo: 4069,
    morris: 4072,
    austri: 4077,
    vestri: 4078,
    normalSpot: 4079,
    pipeSpot: 4080,
} as const;

export const LOC = {
    pipe: 41,
    gate: [47, 48],
    westTunnelOutside: 55,
    eastTunnelOutside: 57,
    westTunnelInside: 54,
    eastTunnelInside: 56,
    redVine: [58, 2013, 2989, 2990, 2991, 2992, 2993, 2994],
} as const;

export const TUNNEL_DESTINATION = {
    westInside: { x: 2820, y: 9882, level: 0 },
    westOutside: { x: 2820, y: 3486, level: 0 },
    eastInside: { x: 2876, y: 9878, level: 0 },
    eastOutside: { x: 2877, y: 3482, level: 0 },
} as const;
