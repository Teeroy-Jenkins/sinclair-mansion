import type { PlayerState } from "../../../../../src/game/player";
import type { ScriptServices } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import type { QuestDefinition } from "../../types";
import {
    STAGE_COMPLETE,
    STAGE_DEFEATED_BOUNCER,
    STAGE_DEFEATED_SCORPION,
    STAGE_FREED_SERVILS,
    STAGE_GUARD_DRUNK,
    STAGE_NOT_STARTED,
    STAGE_OBTAINED_ARMOUR,
    STAGE_OGRE_FIGHT,
    STAGE_SCORPION_FIGHT,
    STAGE_SPOKEN_GUARD,
    STAGE_STARTED,
} from "./constants";

export function buildFightArenaJournal(
    player: PlayerState,
    _services: ScriptServices,
    quest: QuestDefinition,
): string[] {
    const stage = getQuestStage(player, quest);
    if (stage === STAGE_NOT_STARTED) {
        return ["I can start this quest by speaking to <col=800000>Lady Servil</col> north of the Khazard Fight Arena."];
    }
    const lines = ["<str>I agreed to rescue Lady Servil's family from General Khazard.</str>", ""];
    if (stage === STAGE_STARTED) lines.push("I need a disguise. I should search the guards' <col=800000>chest</col>.");
    else if (stage === STAGE_OBTAINED_ARMOUR) lines.push("I should wear the Khazard armour and speak to the <col=800000>guard</col> by the cells.");
    else if (stage === STAGE_SPOKEN_GUARD) lines.push("The guard wants a drink. The <col=800000>Khazard barman</col> sells Khali brew.");
    else if (stage === STAGE_GUARD_DRUNK) lines.push("I have the cell keys and should free <col=800000>Jeremy Servil</col>.");
    else if (stage === STAGE_OGRE_FIGHT) lines.push("I must defeat the <col=800000>Khazard Ogre</col>.");
    else if (stage === STAGE_SCORPION_FIGHT) lines.push("General Khazard forced me to fight his <col=800000>scorpion</col>.");
    else if (stage === STAGE_DEFEATED_SCORPION) lines.push("Now I must defeat <col=800000>Bouncer</col>.");
    else if (stage === STAGE_DEFEATED_BOUNCER) lines.push("I should unlock the prison gate and free the <col=800000>Servils</col>.");
    else if (stage === STAGE_FREED_SERVILS) lines.push("The Servils are safe. I should return to <col=800000>Lady Servil</col>.");
    else if (stage >= STAGE_COMPLETE) lines.push("<str>I rescued the Servil family.</str>", "", "<col=ff0000>QUEST COMPLETE!</col>");
    return lines;
}
