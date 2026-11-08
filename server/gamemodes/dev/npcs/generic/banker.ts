import type { IScriptRegistry } from "../../../../src/game/scripts/types";
import {
    type DialogueOption,
    type DialogueStep,
    greetingWithOptions,
    openBank,
    option,
    sayNpc,
} from "../dialogue";
import { npcIdsByNames, registerTalkTo, startNpcConversation } from "../helpers";

function whatIsThisPlace(): DialogueStep[] {
    return [
        sayNpc([
            "This is a branch of the Bank of Gielinor. We have branches in many towns.",
            "If you look after your money now, it will bring peace to every stage of your life.",
            "We store items and money for you safely, and for free.",
        ]),
    ];
}

function howToUseBank(): DialogueStep[] {
    return [
        sayNpc([
            "Using the bank is simple. Speak to a banker or click on a bank booth to open your bank.",
            "You can deposit items from your inventory, withdraw them later, and rearrange them into tabs.",
            "Collected items from certain activities can be claimed through the Collect option.",
        ]),
    ];
}

function pinUnavailable(): DialogueStep[] {
    return [
        sayNpc([
            "Bank PINs aren't available yet on this world. Your account is still protected by your login details.",
        ]),
    ];
}

function bankerOptions(includeTutorial: boolean): DialogueStep[] {
    const options: DialogueOption[] = [];

    if (includeTutorial) {
        options.push(option("How do I use the bank?", howToUseBank()));
    }

    options.push(
        option("I'd like to access my bank account, please.", [openBank("bank")]),
        option("I'd like to check my PIN settings.", pinUnavailable()),
        option("I'd like to collect items.", [openBank("collect")]),
        option("What is this place?", whatIsThisPlace()),
    );

    return greetingWithOptions("Good day, how may I help you?", options);
}

export function registerBankerHandlers(registry: IScriptRegistry): void {
    const bankers = npcIdsByNames("Banker");
    const tutors = npcIdsByNames("Banker tutor");

    if (bankers.length) {
        registerTalkTo(registry, bankers, (event) => {
            startNpcConversation(event, bankerOptions(false));
        });
    }

    if (tutors.length) {
        registerTalkTo(registry, tutors, (event) => {
            startNpcConversation(event, bankerOptions(true));
        });
    }
}
