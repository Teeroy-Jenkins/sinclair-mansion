import fs from "fs";

import { serverPath } from "../../paths";
import { loadVisibleLocTypeForPlayer } from "../../world/LocTransforms";

/**
 * Modern caches carry no examine text for locs or NPCs, so fall back to
 * data/examine-text.json (by name) and, for items, data/items.json.
 */
type ExamineFallbacks = {
    loc: Record<string, string>;
    npc: Record<string, string>;
    npcById: Record<string, string>;
    obj: Map<number, string>;
};
let fallbacks: ExamineFallbacks | undefined;
function getFallbacks(): ExamineFallbacks {
    if (fallbacks) return fallbacks;
    const result: ExamineFallbacks = { loc: {}, npc: {}, npcById: {}, obj: new Map() };
    try {
        const raw = JSON.parse(fs.readFileSync(serverPath("data", "examine-text.json"), "utf8"));
        result.loc = raw.loc ?? {};
        result.npc = raw.npc ?? {};
        result.npcById = raw.npcById ?? {};
    } catch {}
    try {
        const items = JSON.parse(fs.readFileSync(serverPath("data", "items.json"), "utf8")) as Array<{
            id: number;
            examine?: string;
        }>;
        for (const item of items) if (item.examine) result.obj.set(item.id, item.examine);
    } catch {}
    fallbacks = result;
    return result;
}

type ExamineVarReader = {
    varps: {
        getVarbitValue(varbitId: number): number;
        getVarpValue(varpId: number): number;
    };
};

type LocTypeLoaderLike = {
    load?: (id: number) => unknown;
};

type NpcTypeLoaderLike = {
    load?: (id: number) => { desc?: string } | undefined;
};

type ObjTypeLoaderLike = {
    load?: (id: number) => { examine?: string } | undefined;
};

function normalizeExamineText(text: string | undefined): string | undefined {
    const trimmed = typeof text === "string" ? text.trim() : "";
    return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveLocExamineText(
    loader: LocTypeLoaderLike | undefined,
    player: ExamineVarReader,
    locId: number,
): string | undefined {
    if (!(locId > 0)) {
        return undefined;
    }

    const visible = loadVisibleLocTypeForPlayer(loader, player, locId);
    const type = (visible?.type ?? loader?.load?.(locId)) as { desc?: string; name?: string } | undefined;
    return (
        normalizeExamineText(type?.desc) ??
        normalizeExamineText(type?.name ? getFallbacks().loc[type.name] : undefined)
    );
}

export function resolveNpcExamineText(
    loader: NpcTypeLoaderLike | undefined,
    npcTypeId: number,
): string | undefined {
    if (!(npcTypeId > 0)) {
        return undefined;
    }

    const type = loader?.load?.(npcTypeId) as { desc?: string; name?: string } | undefined;
    const fb = getFallbacks();
    return (
        normalizeExamineText(type?.desc) ??
        normalizeExamineText(type?.name ? fb.npc[type.name] : undefined) ??
        normalizeExamineText(fb.npcById[String(npcTypeId)])
    );
}

export function resolveObjExamineText(
    loader: ObjTypeLoaderLike | undefined,
    itemId: number,
): string | undefined {
    if (!(itemId > 0)) {
        return undefined;
    }

    return (
        normalizeExamineText(loader?.load?.(itemId)?.examine) ??
        normalizeExamineText(getFallbacks().obj.get(itemId))
    );
}
