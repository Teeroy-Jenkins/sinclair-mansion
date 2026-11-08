import type { IScriptRegistry } from "../../../src/game/scripts/types";
import { registerLumbridgeNpcHandlers } from "./areas/lumbridge";
import { registerBankerHandlers } from "./generic/banker";
import { registerGenericPersonHandlers } from "./generic/person";

/**
 * Registers portable OpenRune/RSMod Talk-to content:
 * Lumbridge NPCs, Varrock shop greeters, generic Man/Woman, bankers.
 */
export function registerNpcDialogueHandlers(registry: IScriptRegistry): void {
    registerGenericPersonHandlers(registry);
    registerBankerHandlers(registry);
    registerLumbridgeNpcHandlers(registry);
}
