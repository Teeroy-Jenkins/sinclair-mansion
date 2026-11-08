import type { CacheItemSearchEntry } from "../../../common/items/CacheItemSearchIndex";
import {
    ITEM_SPAWNER_MODAL_GROUP_ID,
    ITEM_SPAWNER_MODAL_RESULT_SLOT_COUNT,
    ITEM_SPAWNER_MODAL_SLOT_COLUMNS,
} from "../../../common/ui/widgets";
import { markWidgetInteractionDirty } from "../../../widgets/WidgetInteraction";
import type { WidgetManager } from "../../../widgets/WidgetManager";
import {
    ITEM_SPAWNER_SLOT_BACKGROUND_BASE_RAW_Y,
    ITEM_SPAWNER_SLOT_ICON_BASE_RAW_Y,
    ITEM_SPAWNER_SLOT_PITCH_Y,
} from "./ItemSpawnerConstants";
import { escapeItemSpawnerSearchText, itemSpawnerUids } from "./ItemSpawnerUids";
import {
    type ItemSpawnerScrollbarDeps,
    refreshItemSpawnerScrollbar,
} from "./ItemSpawnerScrollbar";

export type ItemSpawnerResultsState = {
    searchResults: CacheItemSearchEntry[];
    searchResultsVersion: number;
    renderedResultsVersion: number;
    visibleStartRow: number;
};

function isModalMounted(widgetManager: WidgetManager | undefined): boolean {
    return (
        (widgetManager?.getInterfaceParentContainerUid(ITEM_SPAWNER_MODAL_GROUP_ID) ??
            undefined) !== undefined
    );
}

function setWidgetText(widgetManager: WidgetManager, widgetUid: number, text: string): void {
    const widget = widgetManager.getWidgetByUid(widgetUid);
    if (!widget || widget.text === text) {
        return;
    }
    widget.text = text;
    markWidgetInteractionDirty(widget);
    widgetManager.invalidateWidgetRender(widget);
}

export function refreshItemSpawnerVisibleSlots(
    widgetManager: WidgetManager | undefined,
    state: ItemSpawnerResultsState,
    force: boolean = false,
): void {
    if (!widgetManager || !isModalMounted(widgetManager)) {
        return;
    }

    const resultsView = widgetManager.getWidgetByUid(itemSpawnerUids.resultsView()) as any;
    if (!resultsView) {
        return;
    }

    const scrollY = Math.max(0, (resultsView.scrollY ?? 0) | 0);
    const startRow = Math.max(0, Math.floor(scrollY / ITEM_SPAWNER_SLOT_PITCH_Y));
    if (
        !force &&
        startRow === state.visibleStartRow &&
        state.renderedResultsVersion === state.searchResultsVersion
    ) {
        return;
    }

    state.visibleStartRow = startRow;
    state.renderedResultsVersion = state.searchResultsVersion;

    for (let slotIndex = 0; slotIndex < ITEM_SPAWNER_MODAL_RESULT_SLOT_COUNT; slotIndex++) {
        const poolRow = Math.floor(slotIndex / ITEM_SPAWNER_MODAL_SLOT_COLUMNS);
        const column = slotIndex % ITEM_SPAWNER_MODAL_SLOT_COLUMNS;
        const resultRow = startRow + poolRow;
        const resultIndex = resultRow * ITEM_SPAWNER_MODAL_SLOT_COLUMNS + column;
        const result = state.searchResults[resultIndex];
        const backgroundWidget = widgetManager.getWidgetByUid(
            itemSpawnerUids.slotBackground(slotIndex),
        ) as any;
        const iconWidget = widgetManager.getWidgetByUid(itemSpawnerUids.slotIcon(slotIndex)) as any;
        if (!backgroundWidget || !iconWidget) {
            continue;
        }

        const backgroundRawY =
            ITEM_SPAWNER_SLOT_BACKGROUND_BASE_RAW_Y + resultRow * ITEM_SPAWNER_SLOT_PITCH_Y;
        const iconRawY = ITEM_SPAWNER_SLOT_ICON_BASE_RAW_Y + resultRow * ITEM_SPAWNER_SLOT_PITCH_Y;

        backgroundWidget.rawY = backgroundRawY;
        backgroundWidget.y = backgroundRawY;
        iconWidget.rawY = iconRawY;
        iconWidget.y = iconRawY;

        const hidden = !result;
        backgroundWidget.hidden = hidden;
        backgroundWidget.isHidden = hidden;
        iconWidget.hidden = hidden;
        iconWidget.isHidden = hidden;

        if (result) {
            const resultName = escapeItemSpawnerSearchText(result.name);
            iconWidget.itemId = result.itemId | 0;
            iconWidget.itemQuantity = 1;
            iconWidget.itemAmount = 1;
            iconWidget.text = `<col=ffcf70>${resultName}</col> <col=c5b79b>(id ${result.itemId})</col>`;
        } else {
            iconWidget.itemId = -1;
            iconWidget.itemQuantity = 0;
            iconWidget.itemAmount = 0;
            iconWidget.text = "";
        }

        markWidgetInteractionDirty(backgroundWidget);
        markWidgetInteractionDirty(iconWidget);
        widgetManager.invalidateWidgetRender(backgroundWidget);
        widgetManager.invalidateWidgetRender(iconWidget);
    }

    widgetManager.invalidateScroll(resultsView);
}

export function refreshItemSpawnerSearchResults(options: {
    widgetManager: WidgetManager | undefined;
    state: ItemSpawnerResultsState;
    searchQuery: string;
    search: (query: string) => CacheItemSearchEntry[];
    scrollbarDeps: ItemSpawnerScrollbarDeps;
    resetScroll?: boolean;
}): void {
    const { widgetManager, state, searchQuery, search, scrollbarDeps, resetScroll = false } =
        options;
    if (!widgetManager || !isModalMounted(widgetManager)) {
        return;
    }

    const resultsView = widgetManager.getWidgetByUid(itemSpawnerUids.resultsView()) as any;
    if (!resultsView) {
        return;
    }

    const query = escapeItemSpawnerSearchText(searchQuery);
    const nextResults = query.length > 0 ? search(query) : [];
    state.searchResults = nextResults;
    state.searchResultsVersion++;

    const totalRows = Math.max(
        1,
        Math.ceil(nextResults.length / Math.max(1, ITEM_SPAWNER_MODAL_SLOT_COLUMNS)),
    );
    const viewHeight = Math.max(0, (resultsView.height ?? 0) | 0);
    const scrollHeight = Math.max(viewHeight, totalRows * ITEM_SPAWNER_SLOT_PITCH_Y);
    resultsView.scrollWidth = Math.max(0, (resultsView.width ?? 0) | 0);
    resultsView.scrollHeight = scrollHeight;

    const maxScrollY = Math.max(0, scrollHeight - viewHeight);
    const currentScrollY = (resultsView.scrollY ?? 0) | 0;
    resultsView.scrollY = resetScroll ? 0 : Math.min(Math.max(0, currentScrollY), maxScrollY);

    setWidgetText(
        widgetManager,
        itemSpawnerUids.helper(),
        "<col=c5b79b>Type to search cache items.</col>",
    );
    setWidgetText(
        widgetManager,
        itemSpawnerUids.summary(),
        query.length === 0
            ? "<col=c5b79b>Start typing to filter cache item names.</col>"
            : nextResults.length > 0
              ? `Matches: <col=40ff40>${nextResults.length}</col>`
              : "<col=ff981f>No matches found in cache.</col>",
    );

    state.visibleStartRow = -1;
    state.renderedResultsVersion = -1;
    refreshItemSpawnerVisibleSlots(widgetManager, state, true);
    refreshItemSpawnerScrollbar(scrollbarDeps);
    widgetManager.invalidateWidget(resultsView, "item-spawner-results");
}
