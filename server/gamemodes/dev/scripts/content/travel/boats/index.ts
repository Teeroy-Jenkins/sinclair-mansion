import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerCustomsOfficer } from "./customsOfficer";
import { registerEntranaMonks } from "./entranaMonks";
import { registerGangplanks } from "./gangplanks";
import { registerPortSarimSailors } from "./portSarimSailors";

export function registerBoatTravelHandlers(registry: IScriptRegistry): void {
    registerPortSarimSailors(registry);
    registerCustomsOfficer(registry);
    registerEntranaMonks(registry);
    registerGangplanks(registry);
}
