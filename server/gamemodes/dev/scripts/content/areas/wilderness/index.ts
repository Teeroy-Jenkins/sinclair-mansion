import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerMuddyChestHandlers } from "./muddyChest";

export function registerWildernessAreaHandlers(registry: IScriptRegistry): void {
    registerMuddyChestHandlers(registry);
}
