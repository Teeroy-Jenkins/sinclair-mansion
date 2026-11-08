import {
    ITEM_SPAWNER_MODAL_COMPONENT_HELPER,
    ITEM_SPAWNER_MODAL_COMPONENT_QUERY,
    ITEM_SPAWNER_MODAL_COMPONENT_RESULTS_SCROLLBAR,
    ITEM_SPAWNER_MODAL_COMPONENT_RESULTS_VIEW,
    ITEM_SPAWNER_MODAL_COMPONENT_SEARCH_BACKGROUND,
    ITEM_SPAWNER_MODAL_COMPONENT_SLOT_BACKGROUND_START,
    ITEM_SPAWNER_MODAL_COMPONENT_SLOT_ICON_START,
    ITEM_SPAWNER_MODAL_COMPONENT_SUMMARY,
    ITEM_SPAWNER_MODAL_GROUP_ID,
} from "../../../common/ui/widgets";

export function itemSpawnerWidgetUid(componentId: number): number {
    return ((ITEM_SPAWNER_MODAL_GROUP_ID & 0xffff) << 16) | (componentId & 0xffff);
}

export const itemSpawnerUids = {
    query: () => itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_QUERY),
    searchBackground: () => itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_SEARCH_BACKGROUND),
    helper: () => itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_HELPER),
    summary: () => itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_SUMMARY),
    resultsView: () => itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_RESULTS_VIEW),
    resultsScrollbar: () => itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_RESULTS_SCROLLBAR),
    slotBackground: (slotIndex: number) =>
        itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_SLOT_BACKGROUND_START + slotIndex),
    slotIcon: (slotIndex: number) =>
        itemSpawnerWidgetUid(ITEM_SPAWNER_MODAL_COMPONENT_SLOT_ICON_START + slotIndex),
} as const;

export function isItemSpawnerSearchComponent(componentId: number): boolean {
    const normalized = componentId | 0;
    return (
        normalized === ITEM_SPAWNER_MODAL_COMPONENT_QUERY ||
        normalized === ITEM_SPAWNER_MODAL_COMPONENT_SEARCH_BACKGROUND
    );
}

export function escapeItemSpawnerSearchText(value: string): string {
    return String(value ?? "").replace(/[<>]/g, "");
}

export function formatItemSpawnerSearchText(query: string, focused: boolean): string {
    const escaped = escapeItemSpawnerSearchText(query);
    if (escaped.length === 0) {
        return focused ? "<col=ffcf70>|</col>" : "<col=8f7f66>Search items...</col>";
    }
    return focused
        ? `<col=e8ded0>${escaped}</col><col=ffcf70>|</col>`
        : `<col=e8ded0>${escaped}</col>`;
}
