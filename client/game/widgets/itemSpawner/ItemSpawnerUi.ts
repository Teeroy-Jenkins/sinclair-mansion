import type { ObjTypeLoader } from "../../../rs/config/objtype/ObjTypeLoader";
import {
    type CacheItemSearchEntry,
    CacheItemSearchIndex,
} from "../../../common/items/CacheItemSearchIndex";
import { ITEM_SPAWNER_MODAL_GROUP_ID } from "../../../common/ui/widgets";
import { markWidgetInteractionDirty } from "../../../widgets/WidgetInteraction";
import type { WidgetManager } from "../../../widgets/WidgetManager";
import {
    initializeItemSpawnerScrollView,
    type ItemSpawnerScrollbarDeps,
} from "./ItemSpawnerScrollbar";
import {
    type ItemSpawnerResultsState,
    refreshItemSpawnerSearchResults,
    refreshItemSpawnerVisibleSlots,
} from "./ItemSpawnerResults";
import {
    escapeItemSpawnerSearchText,
    formatItemSpawnerSearchText,
    isItemSpawnerSearchComponent,
    itemSpawnerUids,
} from "./ItemSpawnerUids";

export type ItemSpawnerUiDeps = {
    widgetManager: WidgetManager;
    getObjTypeLoader: () => ObjTypeLoader | undefined;
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

/**
 * Client-side Item Spawner modal search UI (interface group 820).
 */
export class ItemSpawnerUi {
    private searchFocused = false;
    private searchQuery = "";
    private searchIndex?: CacheItemSearchIndex;
    private readonly resultsState: ItemSpawnerResultsState = {
        searchResults: [],
        searchResultsVersion: 0,
        renderedResultsVersion: -1,
        visibleStartRow: -1,
    };

    constructor(private readonly deps: ItemSpawnerUiDeps) {}

    isSearchFocused(): boolean {
        return this.searchFocused;
    }

    onInterfaceOpened(): void {
        this.clearSearchState();
        this.setSearchFocus(true);
        this.refreshSearchResults(true);
    }

    onInterfaceClosed(): void {
        this.clearSearchState();
    }

    handleSetText(uid: number, text: string): boolean {
        if (uid !== itemSpawnerUids.query()) {
            return false;
        }
        this.searchQuery = escapeItemSpawnerSearchText(text);
        this.syncSearchWidgets();
        this.refreshSearchResults(true);
        return true;
    }

    handleWidgetClick(groupId: number, childId: number): boolean {
        const isSearchClick =
            (groupId | 0) === ITEM_SPAWNER_MODAL_GROUP_ID &&
            isItemSpawnerSearchComponent(childId | 0);

        if (this.searchFocused && !isSearchClick) {
            this.setSearchFocus(false);
        }
        if (isSearchClick) {
            this.setSearchFocus(true);
            return true;
        }
        return false;
    }

    handleSearchKeyEvents(
        keyEvents: Array<{ keyTyped: number; keyPressed: number }>,
    ): boolean {
        if (!this.searchFocused) {
            return false;
        }
        if (!this.isModalMounted()) {
            this.clearSearchState();
            return false;
        }

        const OSRS_KEY_ENTER = 84;
        const OSRS_KEY_BACKSPACE = 85;
        const OSRS_KEY_ESCAPE = 13;
        let query = this.searchQuery;
        let changed = false;

        for (const keyEvent of keyEvents) {
            if ((keyEvent.keyTyped | 0) === OSRS_KEY_ESCAPE) {
                this.setSearchFocus(false);
                continue;
            }
            if ((keyEvent.keyTyped | 0) === OSRS_KEY_ENTER) {
                continue;
            }
            if ((keyEvent.keyTyped | 0) === OSRS_KEY_BACKSPACE) {
                if (query.length > 0) {
                    query = query.slice(0, -1);
                    changed = true;
                }
                continue;
            }
            if ((keyEvent.keyPressed | 0) <= 0 || query.length >= 60) {
                continue;
            }

            const char = String.fromCharCode(keyEvent.keyPressed | 0);
            if (!/^[ -~]$/.test(char)) {
                continue;
            }
            query += char;
            changed = true;
        }

        if (changed) {
            this.searchQuery = query;
            this.syncSearchWidgets();
            this.refreshSearchResults(true);
        }

        return true;
    }

    tick(): void {
        if (!this.isModalMounted()) {
            return;
        }
        initializeItemSpawnerScrollView(this.scrollbarDeps());
        refreshItemSpawnerVisibleSlots(this.deps.widgetManager, this.resultsState);
    }

    private scrollbarDeps(): ItemSpawnerScrollbarDeps {
        return {
            getWidgetManager: () => this.deps.widgetManager,
            getCacheSystem: this.deps.getCacheSystem,
            runWidgetScopedClientScript: this.deps.runWidgetScopedClientScript,
        };
    }

    private isModalMounted(): boolean {
        return (
            (this.deps.widgetManager.getInterfaceParentContainerUid(ITEM_SPAWNER_MODAL_GROUP_ID) ??
                undefined) !== undefined
        );
    }

    private getSearchIndex(): CacheItemSearchIndex | undefined {
        const objTypeLoader = this.deps.getObjTypeLoader();
        if (!objTypeLoader) {
            return undefined;
        }
        if (!this.searchIndex) {
            this.searchIndex = new CacheItemSearchIndex(objTypeLoader);
        }
        return this.searchIndex;
    }

    private syncSearchWidgets(): void {
        const widgetManager = this.deps.widgetManager;
        const queryWidget = widgetManager.getWidgetByUid(itemSpawnerUids.query());
        if (queryWidget) {
            queryWidget.text = formatItemSpawnerSearchText(this.searchQuery, this.searchFocused);
            markWidgetInteractionDirty(queryWidget);
            widgetManager.invalidateWidgetRender(queryWidget);
        }

        const backgroundWidget = widgetManager.getWidgetByUid(
            itemSpawnerUids.searchBackground(),
        ) as any;
        if (backgroundWidget) {
            backgroundWidget.color = this.searchFocused ? 0x3a3125 : 0x2b241b;
            backgroundWidget.mouseOverColor = this.searchFocused ? 0x3a3125 : 0x342b20;
            markWidgetInteractionDirty(backgroundWidget);
            widgetManager.invalidateWidgetRender(backgroundWidget);
        }
    }

    private refreshSearchResults(resetScroll: boolean = false): void {
        refreshItemSpawnerSearchResults({
            widgetManager: this.deps.widgetManager,
            state: this.resultsState,
            searchQuery: this.searchQuery,
            search: (query) => this.getSearchIndex()?.search(query) ?? [],
            scrollbarDeps: this.scrollbarDeps(),
            resetScroll,
        });
    }

    private setSearchFocus(focused: boolean): void {
        this.searchFocused = !!focused && this.isModalMounted();
        this.syncSearchWidgets();
    }

    private clearSearchState(): void {
        this.searchFocused = false;
        this.searchQuery = "";
        this.resultsState.searchResults = [];
        this.resultsState.searchResultsVersion = 0;
        this.resultsState.renderedResultsVersion = -1;
        this.resultsState.visibleStartRow = -1;
    }
}

export type { CacheItemSearchEntry };
