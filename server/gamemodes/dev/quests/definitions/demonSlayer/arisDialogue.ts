import type { NpcInteractionEvent } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    startConversation,
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    ARIS_VISIBLE_NPC_ID,
    COINS_ITEM_ID,
    STAGE_COMPLETE,
    STAGE_KEY_HUNT,
    STAGE_SILVERLIGHT,
    STAGE_SPOKEN_TO_ARIS,
} from "./constants";
import { carriesItem, takeItem } from "./items";
import { setDemonStage } from "./state";

function pressOnSteps(): DialogueStep[] {
    return [sayPlayer("Well I'd better press on with it."), sayNpc("See you anon.")];
}

function incantationSteps(): DialogueStep[] {
    return [
        sayPlayer("What is the magical incantation?"),
        sayNpc("Oh yes, let me think a second..."),
        sayNpc(
            "It goes: Carlem... Aber... Camerinthum... Purchai... Gabindo. Have you got that?",
        ),
        sayPlayer("I think so, yes."),
        choose([
            option("Okay, thanks. I'll do my best to stop the demon.", [
                sayNpc("Good luck, and may Guthix be with you!"),
            ]),
            option("Where can I find Silverlight?", silverlightSteps(), { echo: false }),
        ]),
    ];
}

function silverlightSteps(): DialogueStep[] {
    return [
        sayPlayer("Where can I find Silverlight?"),
        sayNpc(
            "Silverlight was passed down through Wally's descendants. It is now in the care of one of the King's knights, Sir Prysin.",
        ),
        sayNpc(
            "He lives in the royal palace in this city. Tell him Aris sent you.",
        ),
        choose([
            option("Okay, thanks. I'll do my best to stop the demon.", [
                sayNpc("Good luck, and may Guthix be with you!"),
            ]),
            option("What is the magical incantation?", incantationSteps(), { echo: false }),
        ]),
    ];
}

function ageRiddleSteps(): DialogueStep[] {
    return [
        sayNpc("Count the number of legs of the chairs in the Blue Moon Inn."),
        sayNpc("And multiply that number by seven."),
        sayPlayer("Errr, yeah, whatever."),
    ];
}

function ageSteps(preQuest: boolean, quest?: QuestDefinition): DialogueStep[] {
    if (!preQuest) return ageRiddleSteps();
    return [
        sayNpc("Older than you imagine."),
        choose([
            option("Believe me, I have a good imagination.", [
                sayNpc("You seem like just the sort of person who would want their fortune told."),
                choose([
                    option("No, I don't believe in that stuff.", [
                        sayNpc("Okay, suit yourself."),
                    ]),
                    option("Yes, please.", fortunePaymentSteps(quest), { echo: false }),
                ]),
            ]),
            option("How do you know how old I think you are?", [
                sayNpc(
                    "I have the power to know, just as I have the power to foresee the future.",
                ),
                choose([
                    option("Okay, what am I thinking now?", [
                        sayNpc("You are thinking that I'll never guess what you are thinking."),
                    ]),
                    option("Okay, but how old are you?", ageRiddleSteps()),
                    option("Go on then, what's my future?", fortunePaymentSteps(quest)),
                ]),
            ]),
            option("Oh, pretty old then.", [
                sayNpc("Yes I'm old! Don't rub it in."),
            ]),
        ]),
    ];
}

function stopCallingSteps(preQuest = false, quest?: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("Stop calling me that!"),
        sayNpc("In the scheme of things you are very young."),
        choose([
            option("Okay, but how old are you?", ageSteps(preQuest, quest), { echo: false }),
            option("Oh, if it's in the scheme of things that's okay.", [
                sayNpc("You show wisdom for one so young."),
            ]),
        ]),
    ];
}

function destinySteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Delrith is a powerful demon."),
        sayNpc(
            "He tried to destroy this city 150 years ago, but the great hero Wally stopped him with the magical sword Silverlight.",
        ),
        sayNpc(
            "Wally trapped Delrith in the stone circle south of Varrock. Silverlight was the sword in my vision: you are destined to stop him this time.",
        ),
        choose([
            option("How am I meant to fight a demon who can destroy cities?", [
                sayNpc("I admit it won't be easy."),
                ...destroyDelrithSteps(quest),
            ]),
            option("Okay, where is he? I'll kill him for you!", [
                sayNpc("You cannot simply fight him. Ordinary weapons cannot harm him."),
                ...destroyDelrithSteps(quest),
            ]),
            option("Wally doesn't sound like a very heroic name.", [
                sayNpc(
                    "Maybe that is why history forgot him, but he was a very great hero. Without Wally, Delrith would have caused terrible suffering.",
                ),
                sayNpc("It looks like you will need to perform similar heroics."),
                ...destroyDelrithSteps(quest),
            ]),
        ]),
    ];
}

function destroyDelrithSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc(
            "Wally reached the stone circle as Delrith was summoned by chaos druids.",
        ),
        sayNpc(
            "By reciting the correct incantation and thrusting Silverlight into the newly summoned demon, he imprisoned Delrith again.",
        ),
        sayNpc(
            "Delrith will soon come forth from the stone circle. An evil sorcerer may already be starting the rituals.",
        ),
        run(({ player, services }) => {
            setDemonStage(player, quest, services, STAGE_SPOKEN_TO_ARIS);
        }),
        choose([
            option("What is the magical incantation?", incantationSteps(), { echo: false }),
            option("Where can I find Silverlight?", silverlightSteps(), { echo: false }),
        ]),
    ];
}

function paidVisionSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("Okay, here you go."),
        run(({ player, services }) => {
            takeItem(player, services, COINS_ITEM_ID);
        }),
        sayNpc(
            "Come closer and listen carefully as I peer into the swirling mists of the crystal ball.",
        ),
        sayNpc("I can see images forming. I can see you holding an impressive-looking sword."),
        sayNpc("There is a big dark shadow appearing now."),
        sayNpc("Aaargh!"),
        choose([
            option("Very interesting. What does that 'Aaargh' mean?", []),
            option("Are you all right?", []),
            option("Aaargh?", []),
        ]),
        sayNpc("It's Delrith! Delrith is coming!"),
        choose([
            option("Who's Delrith?", destinySteps(quest)),
            option("Get a grip!", [
                sayNpc(
                    "Sorry. I did not expect to see Delrith and had to break away before he detected me.",
                ),
                ...destinySteps(quest),
            ]),
        ]),
    ];
}

function fortunePaymentSteps(quest?: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Cross my palm with silver, then."),
        choose([
            option(
                "Okay, here you go.",
                quest
                    ? paidVisionSteps(quest)
                    : [sayNpc("Come back when you are ready to hear your future.")],
                { echo: false },
            ),
            option("Oh, you want me to pay. No thanks.", [sayNpc("Go away then.")]),
        ]),
    ];
}

function startSteps(quest: QuestDefinition, hasCoin: boolean): DialogueStep[] {
    const payment = hasCoin
        ? fortunePaymentSteps(quest)
        : [sayPlayer("Okay, here you go."), sayPlayer("Oh dear. I don't have any money.")];
    return [
        sayNpc("Hello, young one. Cross my palm with silver and the future will be revealed."),
        choose([
            option("Okay, here you go.", payment, { echo: false }),
            option("Who are you calling young one?!", [
                sayNpc(
                    "You have been in this world a relatively short time, at least compared with me. Do you want your fortune told or not?",
                ),
                choose([
                    option("Yes, please.", payment, { echo: false }),
                    option("No, I don't believe in that stuff.", [sayNpc("Okay, suit yourself.")]),
                    option("Ooh, how old are you then?", ageSteps(true, quest)),
                ]),
            ]),
            option("No, I don't believe in that stuff.", [sayNpc("Okay, suit yourself.")]),
        ]),
    ];
}

export function createArisTalkHandler(quest: QuestDefinition) {
    return ({ player, services }: NpcInteractionEvent): void => {
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage === 0) {
            steps = startSteps(quest, carriesItem(player, services, COINS_ITEM_ID));
        } else if (stage === STAGE_SPOKEN_TO_ARIS) {
            steps = [
                sayNpc("How goes the quest?"),
                sayPlayer("I'm still working on it."),
                sayNpc("If you need any advice, I'm always here, young one."),
                choose([
                    option("What is the magical incantation?", incantationSteps(), {
                        echo: false,
                    }),
                    option("Where can I find Silverlight?", silverlightSteps(), { echo: false }),
                    option("Well I'd better press on with it.", pressOnSteps(), { echo: false }),
                    option("Stop calling me that!", stopCallingSteps(), { echo: false }),
                ]),
            ];
        } else if (stage >= STAGE_KEY_HUNT && stage < STAGE_SILVERLIGHT) {
            steps = [
                sayNpc("How goes the quest?"),
                sayPlayer("I found Sir Prysin, but I have not got the sword yet."),
                sayNpc("Hurry, we haven't much time."),
                choose([
                    option("What is the magical incantation?", incantationSteps(), {
                        echo: false,
                    }),
                    option("Well I'd better press on with it.", pressOnSteps(), { echo: false }),
                ]),
            ];
        } else if (stage === STAGE_SILVERLIGHT) {
            steps = [
                sayNpc("How goes the quest?"),
                sayPlayer("I have the sword. I just need to kill the demon."),
                sayNpc("Yep, that's right."),
                choose([
                    option("What is the magical incantation?", incantationSteps(), {
                        echo: false,
                    }),
                    option("Well I'd better press on with it.", pressOnSteps(), { echo: false }),
                    option("Where can I find the demon?", [
                        sayNpc("Head south to the stone circle just outside the city gate."),
                    ]),
                ]),
            ];
        } else if (stage >= STAGE_COMPLETE) {
            steps = [
                sayNpc("Greetings, young one. You're a hero now. That was good demonslaying."),
                choose([
                    option("How do you know I killed it?", [
                        sayNpc("You forget: I'm good at knowing things."),
                    ]),
                    option("Thanks.", []),
                    option("Stop calling me that!", stopCallingSteps(false), { echo: false }),
                ]),
            ];
        } else {
            steps = pressOnSteps();
        }
        startConversation(
            { player, services, npcId: ARIS_VISIBLE_NPC_ID, npcName: "Aris" },
            steps,
        );
    };
}
