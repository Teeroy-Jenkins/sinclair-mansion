import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerPortSarimShopHandlers } from "./shops";

export function registerPortSarimAreaHandlers(registry: IScriptRegistry): void {
    registerPortSarimShopHandlers(registry);
}
