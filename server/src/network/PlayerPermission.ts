export const PLAYER_PERMISSIONS = ["player", "moderator", "admin", "developer"] as const;

export type PlayerPermission = (typeof PLAYER_PERMISSIONS)[number];

const RANK: Record<PlayerPermission, number> = {
    player: 0,
    moderator: 1,
    admin: 2,
    developer: 3,
};

export function hasPermission(actual: PlayerPermission, required: PlayerPermission): boolean {
    return RANK[actual] >= RANK[required];
}

export function normalizePlayerPermission(value: unknown): PlayerPermission {
    return typeof value === "string" && value in RANK ? (value as PlayerPermission) : "player";
}
