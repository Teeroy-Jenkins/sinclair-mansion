import type { PlayerPermission } from "../PlayerPermission";

/**
 * Chat-command access policy. This is checked before built-in and
 * script-registered command handlers are invoked.
 */
const BUILTIN_COMMAND_PERMISSIONS: Readonly<Record<string, PlayerPermission>> = {
    pos: "player",
    allrunes: "developer",
    ancient: "developer",
    arceuus: "developer",
    bond: "developer",
    clear: "developer",
    completequests: "developer",
    bank: "developer",
    devbank: "developer",
    item: "developer",
    itemspawner: "developer",
    kill: "developer",
    levelup: "developer",
    lunar: "developer",
    maxall: "developer",
    magic: "developer",
    onehealth: "developer",
    quest: "developer",
    randomitem: "developer",
    resetquests: "developer",
    rubytest: "developer",
    scroll: "developer",
    sail: "developer",
    unsail: "developer",
    spec: "developer",
    smithing: "developer",
    spawn: "developer",
    standard: "developer",
    tele: "developer",
    teleto: "developer",
    teletome: "developer",
    tickstats: "developer",
    whip: "developer",
};

export function getBuiltinChatCommandPermission(command: string): PlayerPermission | undefined {
    return BUILTIN_COMMAND_PERMISSIONS[command];
}
