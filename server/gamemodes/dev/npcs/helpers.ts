import fs from "fs";
import path from "path";
import type { PlayerState } from "../../../src/game/player";
import type {
    IScriptRegistry,
    NpcInteractionEvent,
    ScriptServices,
} from "../../../src/game/scripts/types";
import {
    type DialogueContext,
    type DialogueStep,
    startConversation,
} from "../quests/dialogue";

export type { DialogueContext, DialogueStep };
export type { DialogueExec, DialogueOption } from "../quests/dialogue";
export {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
} from "../quests/dialogue";

type NpcSpawnRow = { id?: number; name?: string };

let spawnsByNameCache: Map<string, number[]> | undefined;

function loadSpawnsByName(): Map<string, number[]> {
    if (spawnsByNameCache) return spawnsByNameCache;
    const map = new Map<string, number[]>();
    const candidates = [
        path.resolve(__dirname, "../../../data/npc-spawns.json"),
        path.resolve(process.cwd(), "data/npc-spawns.json"),
        path.resolve(process.cwd(), "server/data/npc-spawns.json"),
    ];
    for (const filePath of candidates) {
        if (!fs.existsSync(filePath)) continue;
        try {
            const rows = JSON.parse(fs.readFileSync(filePath, "utf8")) as NpcSpawnRow[];
            for (const row of rows) {
                if (!row?.name || !(row.id! > 0)) continue;
                const key = row.name.toLowerCase();
                const list = map.get(key);
                if (list) {
                    if (!list.includes(row.id!)) list.push(row.id!);
                } else {
                    map.set(key, [row.id!]);
                }
            }
            break;
        } catch {
            /* try next path */
        }
    }
    spawnsByNameCache = map;
    return map;
}

/** Unique NPC type IDs for the given exact spawn names (case-insensitive). */
export function npcIdsByNames(...names: string[]): number[] {
    const map = loadSpawnsByName();
    const ids = new Set<number>();
    for (const name of names) {
        for (const id of map.get(name.toLowerCase()) ?? []) ids.add(id);
    }
    return [...ids].sort((a, b) => a - b);
}

export function dialogueContextFromEvent(event: NpcInteractionEvent): DialogueContext | undefined {
    const typeId = event.npc?.typeId;
    if (typeId == null) return undefined;
    const npcName =
        event.npc?.name && event.npc.name !== "null"
            ? String(event.npc.name)
            : `NPC ${typeId}`;
    return {
        player: event.player,
        services: event.services,
        npcId: typeId,
        npcName,
    };
}

export function startNpcConversation(
    event: NpcInteractionEvent,
    steps: DialogueStep[],
): boolean {
    const ctx = dialogueContextFromEvent(event);
    if (!ctx) return false;
    startConversation(ctx, steps);
    return true;
}

export function openShopForNpc(event: NpcInteractionEvent): void {
    const typeId = event.npc?.typeId;
    if (typeId == null) return;
    event.services.shopping?.openShop?.(event.player, { npcTypeId: typeId });
}

export function registerNpcOptions(
    registry: IScriptRegistry,
    npcIds: number[],
    options: Array<string | undefined>,
    handler: (event: NpcInteractionEvent) => void,
): void {
    for (const npcId of npcIds) {
        for (const option of options) {
            registry.registerNpcScript({ npcId, option, handler });
        }
    }
}

export function registerTalkTo(
    registry: IScriptRegistry,
    npcIds: number[],
    handler: (event: NpcInteractionEvent) => void,
): void {
    registerNpcOptions(registry, npcIds, ["talk-to", undefined], handler);
}

export function requestTradeOpen(
    player: PlayerState,
    services: ScriptServices,
    npcTypeId: number,
    tick: number,
): void {
    services.combat.requestAction(
        player,
        {
            kind: "npc.trade",
            data: { npcTypeId },
            delayTicks: 0,
            cooldownTicks: 0,
            groups: ["npc.trade"],
        },
        tick,
    );
}
