import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerBaraekHandlers } from "./baraek";
import { registerReldoHandlers } from "./reldo";

export function registerVarrockAreaHandlers(registry: IScriptRegistry): void {
    registerReldoHandlers(registry);
    registerBaraekHandlers(registry);
}
