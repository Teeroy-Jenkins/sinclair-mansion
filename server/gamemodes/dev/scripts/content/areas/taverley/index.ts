import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerCrystalChestHandlers } from "./crystalChest";

export function registerTaverleyAreaHandlers(registry: IScriptRegistry): void {
    registerCrystalChestHandlers(registry);
}
