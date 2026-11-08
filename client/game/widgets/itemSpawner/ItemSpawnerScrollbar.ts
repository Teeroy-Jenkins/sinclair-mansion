import { IndexType } from "../../../rs/cache/IndexType";
import { ITEM_SPAWNER_MODAL_GROUP_ID } from "../../../common/ui/widgets";
import type { WidgetManager } from "../../../widgets/WidgetManager";
import {
    ITEM_SPAWNER_SCROLLBAR_GRAPHICS,
    ITEM_SPAWNER_SCROLLBAR_INIT_SCRIPT_ID,
    ITEM_SPAWNER_SCROLLBAR_RESIZE_SCRIPT_ID,
} from "./ItemSpawnerConstants";
import { itemSpawnerUids } from "./ItemSpawnerUids";

export type ItemSpawnerScrollbarDeps = {
    getWidgetManager: () => WidgetManager | undefined;
    getCacheSystem: () =>
        | { getIndex?: (indexId: number) => { getArchiveId?: (token: string) => number } }
        | undefined;
    runWidgetScopedClientScript: (
        widgetUid: number,
        scriptId: number,
        args: (number | string)[],
        phase: "pre" | "post" | "run_script",
    ) => void;
};

function isModalMounted(widgetManager: WidgetManager | undefined): boolean {
    return (
        (widgetManager?.getInterfaceParentContainerUid(ITEM_SPAWNER_MODAL_GROUP_ID) ??
            undefined) !== undefined
    );
}

function resolveScrollbarGraphicId(
    getCacheSystem: ItemSpawnerScrollbarDeps["getCacheSystem"],
    token: string,
): number {
    let spriteIndex: { getArchiveId?: (token: string) => number } | undefined;
    try {
        spriteIndex = getCacheSystem()?.getIndex?.(IndexType.DAT2.sprites);
    } catch {
        spriteIndex = undefined;
    }
    if (!spriteIndex) {
        return -1;
    }

    const rawToken = String(token ?? "").trim();
    if (rawToken.length === 0) {
        return -1;
    }

    const directArchiveId = spriteIndex.getArchiveId?.(rawToken);
    if (typeof directArchiveId === "number" && directArchiveId >= 0) {
        return directArchiveId | 0;
    }

    let archiveToken = rawToken;
    let frameIndex = 0;
    const commaIndex = rawToken.lastIndexOf(",");
    if (commaIndex >= 0 && commaIndex < rawToken.length - 1) {
        const candidateFrame = Number.parseInt(rawToken.slice(commaIndex + 1), 10);
        if (Number.isFinite(candidateFrame) && candidateFrame >= 0) {
            archiveToken = rawToken.slice(0, commaIndex);
            frameIndex = candidateFrame | 0;
        }
    }

    const archiveId = spriteIndex.getArchiveId?.(archiveToken);
    if (!(typeof archiveId === "number") || archiveId < 0) {
        return -1;
    }

    return ((archiveId & 0xffff) << 16) | (frameIndex & 0xffff);
}

export function initializeItemSpawnerScrollView(deps: ItemSpawnerScrollbarDeps): void {
    const widgetManager = deps.getWidgetManager();
    if (!widgetManager || !isModalMounted(widgetManager)) {
        return;
    }

    const resultsView = widgetManager.getWidgetByUid(itemSpawnerUids.resultsView()) as any;
    const scrollbar = widgetManager.getWidgetByUid(itemSpawnerUids.resultsScrollbar()) as any;
    if (!resultsView || !scrollbar) {
        return;
    }

    scrollbar.scrollBarTargetUid = resultsView.uid | 0;
    scrollbar.scrollBarAxis = "y";

    const hasScrollbarChildren =
        Array.isArray(scrollbar.children) && scrollbar.children.length >= 6;
    if (!hasScrollbarChildren) {
        const graphicIds = ITEM_SPAWNER_SCROLLBAR_GRAPHICS.map((token) =>
            resolveScrollbarGraphicId(deps.getCacheSystem, token),
        );
        if (graphicIds.some((id) => id < 0)) {
            return;
        }
        deps.runWidgetScopedClientScript(
            scrollbar.uid | 0,
            ITEM_SPAWNER_SCROLLBAR_INIT_SCRIPT_ID,
            [scrollbar.uid | 0, resultsView.uid | 0, ...graphicIds],
            "run_script",
        );
    }

    widgetManager.invalidateWidget(scrollbar, "item-spawner-scrollbar-init");
}

export function refreshItemSpawnerScrollbar(deps: ItemSpawnerScrollbarDeps): void {
    const widgetManager = deps.getWidgetManager();
    if (!widgetManager || !isModalMounted(widgetManager)) {
        return;
    }

    const resultsView = widgetManager.getWidgetByUid(itemSpawnerUids.resultsView()) as any;
    const scrollbar = widgetManager.getWidgetByUid(itemSpawnerUids.resultsScrollbar()) as any;
    if (!resultsView || !scrollbar) {
        return;
    }

    initializeItemSpawnerScrollView(deps);
    deps.runWidgetScopedClientScript(
        scrollbar.uid | 0,
        ITEM_SPAWNER_SCROLLBAR_RESIZE_SCRIPT_ID,
        [scrollbar.uid | 0, resultsView.uid | 0, (resultsView.scrollY ?? 0) | 0],
        "run_script",
    );
    widgetManager.invalidateWidget(scrollbar, "item-spawner-scrollbar-resize");
}
