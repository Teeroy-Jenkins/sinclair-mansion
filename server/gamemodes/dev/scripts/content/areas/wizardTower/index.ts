import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerSedridorHandlers } from "./sedridor";

export function registerWizardTowerAreaHandlers(registry: IScriptRegistry): void {
    registerSedridorHandlers(registry);
}
