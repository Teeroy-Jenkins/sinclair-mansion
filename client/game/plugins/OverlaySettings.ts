// OSRS's own All Settings toggles (Interfaces > General) switch the overlays this client draws:
// ground item labels, the hover/interact highlight and the current/destination tile markers.
// The plugins keep their own saved state (browser storage), so that wins when the server sends
// its copy of the variables; flipping a checkbox in Settings updates the plugin.

import type { GroundItemsPlugin } from "./grounditems/GroundItemsPlugin";
import type { InteractHighlightPlugin } from "./interacthighlight/InteractHighlightPlugin";
import type { TileMarkersPlugin } from "./tilemarkers/TileMarkersPlugin";

interface VarbitAccess {
    getVarbit(id: number): number;
    setVarbit(id: number, value: number): boolean;
}

interface OverlayToggle {
    /** The setting's varbit (found by toggling each in game and watching the var writes); 1 = on. */
    varbit: number;
    get(): boolean;
    set(on: boolean): void;
}

export class OverlaySettings {
    private readonly toggles: OverlayToggle[];
    private applying = false;

    constructor(
        private readonly vars: VarbitAccess,
        plugins: { groundItems: GroundItemsPlugin; interactHighlight: InteractHighlightPlugin; tileMarkers: TileMarkersPlugin },
    ) {
        const { groundItems, interactHighlight, tileMarkers } = plugins;
        this.toggles = [
            // "Ground Items Overlay"
            { varbit: 14869, get: () => groundItems.getConfig().enabled, set: (on) => groundItems.setConfig({ enabled: on }) },
            // "Highlight entities on mouse-over"
            { varbit: 13088, get: () => interactHighlight.getConfig().enabled, set: (on) => interactHighlight.setConfig({ enabled: on }) },
            // "Highlight current tile" / "Highlight destination tile"
            { varbit: 12978, get: () => tileMarkers.getConfig().showCurrentTile, set: (on) => tileMarkers.setConfig({ enabled: true, showCurrentTile: on }) },
            { varbit: 12979, get: () => tileMarkers.getConfig().showDestinationTile, set: (on) => tileMarkers.setConfig({ enabled: true, showDestinationTile: on }) },
        ];
    }

    /**
     * After any variable change. From the server (login, or its saved copy): put the plugins'
     * saved choices back into the settings. From the client (a Settings checkbox): update the plugin.
     */
    onVarChange(fromServer: boolean): void {
        if (this.applying) return;
        for (const t of this.toggles) {
            const setting = this.vars.getVarbit(t.varbit) === 1;
            const plugin = t.get();
            if (setting === plugin) continue;
            if (fromServer) {
                this.applying = true;
                try {
                    this.vars.setVarbit(t.varbit, plugin ? 1 : 0);
                } finally {
                    this.applying = false;
                }
            } else {
                t.set(setting);
            }
        }
    }
}
