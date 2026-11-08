import type { IScriptRegistry } from "../../../../../../src/game/scripts/types";
import { registerLumbridgeCookHandlers } from "./cook";
import { registerDukeHoracioHandlers } from "./dukeHoracio";
import { registerFatherAereckHandlers } from "./fatherAereck";
import { registerFatherUrhneyHandlers } from "./fatherUrhney";

export function registerLumbridgeAreaHandlers(registry: IScriptRegistry): void {
    registerFatherAereckHandlers(registry);
    registerFatherUrhneyHandlers(registry);
    registerDukeHoracioHandlers(registry);
    registerLumbridgeCookHandlers(registry);
}
