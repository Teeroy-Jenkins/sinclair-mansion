import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerFaladorShopHandlers } from "./shops";
import { registerWysonHandlers } from "./wyson";

export function registerFaladorAreaHandlers(registry: IScriptRegistry): void {
    registerWysonHandlers(registry);
    registerFaladorShopHandlers(registry);
}
