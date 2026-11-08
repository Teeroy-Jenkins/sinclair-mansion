import type { NpcInteractionEvent } from "../../../../../src/game/scripts/types";
import { getQuestStage } from "../../QuestService";
import {
    choose,
    option,
    run,
    sayNpc,
    sayPlayer,
    showItem,
    startConversation,
    type DialogueStep,
} from "../../dialogue";
import type { QuestDefinition } from "../../types";
import {
    BONES_ITEM_ID,
    BONES_REQUIRED,
    CAPTAIN_ROVIN_NPC_IDS,
    COINS_ITEM_ID,
    PRYSIN_KEY_ITEM_ID,
    ROVIN_KEY_ITEM_ID,
    SILVERLIGHT_ITEM_ID,
    SIR_PRYSIN_NPC_IDS,
    SPINACH_ROLL_ITEM_ID,
    STAGE_COLLECTING_BONES,
    STAGE_COMPLETE,
    STAGE_KEY_HUNT,
    STAGE_SILVERLIGHT,
    STAGE_TRAIBORN_KEY,
    TRAIBORN_KEY_ITEM_ID,
    TRAIBORN_NPC_ID,
    VARBIT_DEMON_DRAIN,
} from "./constants";
import { carriesItem, giveItem, ownsItem, takeItem } from "./items";
import { setDemonDrainState, setDemonStage } from "./state";

function keyDirectionsSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("I kept one key and gave the other two to people for safekeeping."),
        sayNpc("One went to Captain Rovin, at the top of the north-west palace tower."),
        sayNpc("The other went to Wizard Traiborn, on the first floor of the Wizards' Tower."),
        sayNpc("Unfortunately, I dropped my own key down the kitchen drain."),
        run(({ player, services }) => {
            if (getQuestStage(player, quest) < STAGE_KEY_HUNT) {
                setDemonStage(player, quest, services, STAGE_KEY_HUNT);
                if (player.varps.getVarbitValue(VARBIT_DEMON_DRAIN) < 1) {
                    setDemonDrainState(player, services, 1);
                }
            }
        }),
        choose([
            option("Can you give me your key?", [
                sayNpc("I told you: I dropped it down the drain."),
                sayPlayer("So what does the drain connect to?"),
                sayNpc("The kitchen sink drains into the palace sewers."),
            ]),
            option("Where can I find Captain Rovin?", [
                sayNpc("At the top of the guards' quarters in the palace's north-west wing."),
            ]),
            option("Where does the wizard live?", [
                sayNpc("At the Wizards' Tower on the island south of Draynor Village."),
            ]),
            option("Well I'd better go key hunting.", [sayNpc("Okay, goodbye.")]),
        ]),
    ];
}

function prySinIntroductionSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Aris? Is she still alive? I remember her from when I was young."),
        choose([
            option("I need to find Silverlight.", silverlightRequestSteps(quest), {
                echo: false,
            }),
            option("Yes, she is still alive.", [
                sayNpc("I thought she would have died by now. She was old even when I was a lad."),
                ...silverlightRequestSteps(quest),
            ]),
        ]),
    ];
}

function silverlightRequestSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("I need to find Silverlight."),
        sayNpc("What do you need it for?"),
        sayPlayer("I need it to fight Delrith."),
        sayNpc("Delrith? I thought the world was rid of him."),
        choose([
            option("Aris's crystal ball says otherwise.", [
                sayNpc("If the ball says so, I had better help you."),
            ]),
            option("He's back and unfortunately I've got to deal with him.", [
                sayNpc("You don't look up to much, but Silverlight may carry you through."),
            ]),
        ]),
        sayNpc(
            "Silverlight is locked in a special case that needs three different keys, so it cannot fall into the wrong hands.",
        ),
        choose([
            option("So give me the keys!", [
                sayNpc("It is not that easy."),
                ...keyDirectionsSteps(quest),
            ]),
            option("And why is this a problem?", keyDirectionsSteps(quest)),
        ]),
    ];
}

function giveSilverlightSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayPlayer("I've got all three keys!"),
        sayNpc("Excellent! Now I can give you Silverlight."),
        run(({ player, services }) => {
            if (
                !carriesItem(player, services, TRAIBORN_KEY_ITEM_ID) ||
                !carriesItem(player, services, ROVIN_KEY_ITEM_ID) ||
                !carriesItem(player, services, PRYSIN_KEY_ITEM_ID)
            ) {
                return;
            }
            takeItem(player, services, TRAIBORN_KEY_ITEM_ID);
            takeItem(player, services, ROVIN_KEY_ITEM_ID);
            takeItem(player, services, PRYSIN_KEY_ITEM_ID);
            giveItem(player, services, SILVERLIGHT_ITEM_ID);
            setDemonStage(player, quest, services, STAGE_SILVERLIGHT);
            setDemonDrainState(player, services, 3);
        }),
        showItem(SILVERLIGHT_ITEM_ID, [
            "You give all three keys to Sir Prysin.",
            "He hands you the magical sword Silverlight.",
        ]),
    ];
}

function keyProgressSteps(quest: QuestDefinition, event: NpcInteractionEvent): DialogueStep[] {
    const { player, services } = event;
    const hasTraiborn = carriesItem(player, services, TRAIBORN_KEY_ITEM_ID);
    const hasRovin = carriesItem(player, services, ROVIN_KEY_ITEM_ID);
    const hasPrysin = carriesItem(player, services, PRYSIN_KEY_ITEM_ID);
    if (hasTraiborn && hasRovin && hasPrysin) return giveSilverlightSteps(quest);
    const found = [hasTraiborn, hasRovin, hasPrysin].filter(Boolean).length;
    return [
        sayNpc("How are you doing with the keys?"),
        sayPlayer(found === 0 ? "I've not found any yet." : "I've made a start."),
        ...(hasTraiborn ? [sayPlayer("I've got Wizard Traiborn's key.")] : []),
        ...(hasRovin ? [sayPlayer("I've got Captain Rovin's key.")] : []),
        ...(hasPrysin ? [sayPlayer("I've got the key you dropped down the drain.")] : []),
        choose([
            option("Can you remind me where all the keys were again?", keyDirectionsSteps(quest)),
            option("I'm still looking.", [sayNpc("Tell me when you've got them all.")]),
        ]),
    ];
}

function lostSilverlightSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Have you sorted out that demon yet?"),
        choose([
            option("No, not yet.", [
                sayNpc("Get on with it. He will be powerful when he reaches full strength."),
            ]),
            option("No, I'm afraid I've lost Silverlight.", [
                sayNpc("Someone returned it to me. Take better care of it this time."),
                run(({ player, services }) => {
                    if (!ownsItem(player, services, SILVERLIGHT_ITEM_ID)) {
                        giveItem(player, services, SILVERLIGHT_ITEM_ID);
                        setDemonStage(player, quest, services, STAGE_SILVERLIGHT);
                    }
                }),
                showItem(SILVERLIGHT_ITEM_ID, "Sir Prysin returns Silverlight."),
            ]),
        ]),
    ];
}

function postQuestPrysinSteps(event: NpcInteractionEvent): DialogueStep[] {
    if (ownsItem(event.player, event.services, SILVERLIGHT_ITEM_ID)) {
        return [
            sayNpc("I heard you stopped the demon. Well done!"),
            sayPlayer("Yes, that's right."),
            sayNpc("A good job well done."),
        ];
    }
    return [
        sayNpc("I heard you stopped the demon. Well done!"),
        choose([
            option("Yes, that's right.", [sayNpc("A good job well done.")]),
            option("Yes, although I'm afraid I've lost Silverlight.", [
                sayNpc(
                    "News of your carelessness is as widespread as your victory. Silverlight has returned to me.",
                ),
                choose([
                    option("Phew, that's a relief!", []),
                    option("Could I borrow it again?", [
                        sayNpc(
                            "It is too important to give away so easily. It will cost 500 gold pieces this time.",
                        ),
                        choose([
                            option("No way, it's not worth that much.", []),
                            option("Okay, I'll pay.", [
                                run(({ player, services }) => {
                                    if (!carriesItem(player, services, COINS_ITEM_ID, 500)) {
                                        services.messaging.sendGameMessage(
                                            player,
                                            "You don't have enough money.",
                                        );
                                        return;
                                    }
                                    takeItem(player, services, COINS_ITEM_ID, 500);
                                    giveItem(player, services, SILVERLIGHT_ITEM_ID);
                                }),
                                showItem(SILVERLIGHT_ITEM_ID, "Sir Prysin sells you Silverlight."),
                            ]),
                        ]),
                    ]),
                ]),
            ]),
        ]),
    ];
}

export function createSirPrysinTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const { player, services } = event;
        const stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (stage < STAGE_KEY_HUNT) {
            steps = [
                sayNpc("Hello, who are you?"),
                choose([
                    option("I am a mighty adventurer. Who are you?", [
                        sayNpc("I am Sir Prysin, a bold and famous knight of the realm."),
                    ]),
                    option("I was hoping you could tell me.", [
                        sayNpc("Well, I've never met you before."),
                    ]),
                    ...(stage > 0
                        ? [
                              option(
                                  "Aris said I should come and talk to you.",
                                  prySinIntroductionSteps(quest),
                              ),
                          ]
                        : []),
                ]),
            ];
        } else if (stage < STAGE_SILVERLIGHT) {
            steps = keyProgressSteps(quest, event);
        } else if (stage === STAGE_SILVERLIGHT) {
            steps = ownsItem(player, services, SILVERLIGHT_ITEM_ID)
                ? [
                      sayNpc("Have you sorted out that demon yet?"),
                      sayPlayer("No, not yet."),
                      sayNpc("Get on with it before he reaches full strength."),
                  ]
                : lostSilverlightSteps(quest);
        } else {
            steps = postQuestPrysinSteps(event);
        }
        startConversation(
            { player, services, npcId: SIR_PRYSIN_NPC_IDS[0], npcName: "Sir Prysin" },
            steps,
        );
    };
}

function rovinGenericSteps(questAvailable: boolean, event: NpcInteractionEvent): DialogueStep[] {
    return [
        sayNpc("What are you doing up here? Only palace guards are allowed."),
        choose([
            option("I am one of the palace guards.", [
                sayNpc("No, you're not! I know all the palace guards."),
                choose([
                    option("I'm a new recruit.", [
                        sayNpc("I interview all recruits. Get out of my sight."),
                    ]),
                    option("I've had extensive plastic surgery.", [
                        sayNpc("I've never heard of that, and you still should not be here."),
                    ]),
                ]),
            ]),
            option("What about the King?", [
                sayNpc("The King may come up here. You are not the King, so leave."),
            ]),
            ...(questAvailable
                ? [
                      option("Yes, I know, but this is important.", [
                          sayNpc("Tell me what is so important."),
                          choose([
                              option("There's a demon who wants to invade this city.", [
                                  sayNpc("Is it a powerful demon?"),
                                  sayPlayer("Yes, very, and I must fight it with Silverlight."),
                                  sayPlayer("Sir Prysin said you have one of its keys."),
                                  sayNpc("You are right. Here you go."),
                                  run(({ player, services }) => {
                                      if (!ownsItem(player, services, ROVIN_KEY_ITEM_ID)) {
                                          giveItem(player, services, ROVIN_KEY_ITEM_ID);
                                      }
                                  }),
                                  showItem(ROVIN_KEY_ITEM_ID, "Captain Rovin hands you a key."),
                              ]),
                              option("Erm, I forgot.", [sayNpc("Then it cannot be important. Go away.")]),
                              option("The castle has received its ale delivery.", [
                                  sayNpc("Important, but you should tell the kitchen staff."),
                              ]),
                          ]),
                      ]),
                  ]
                : []),
        ]),
    ];
}

export function createCaptainRovinTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const stage = getQuestStage(event.player, quest);
        const available = stage >= STAGE_KEY_HUNT && stage < STAGE_SILVERLIGHT;
        startConversation(
            {
                player: event.player,
                services: event.services,
                npcId: CAPTAIN_ROVIN_NPC_IDS[0],
                npcName: "Captain Rovin",
            },
            rovinGenericSteps(available, event),
        );
    };
}

function standardTraibornSteps(canAskKey: boolean, quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Ello, young thingummywut."),
        choose([
            option("What's a thingummywut?", [
                sayNpc("A thingummywut? Where? Those pesky things get everywhere."),
                choose([
                    option("You just called me a thingummywut.", [
                        sayNpc("You're one? They said I was mad! Now where can I find a cage?"),
                        choose([
                            option("I'd better be off.", [
                                sayNpc("Watch out for sheep. They're more cunning than they look."),
                            ]),
                            option("They're right, you are mad.", [
                                sayNpc("That's a pity. I thought they were winding me up."),
                            ]),
                        ]),
                    ]),
                    option("Tell me what they look like and I'll mash them.", [
                        sayNpc("Nobody has seen one. They may be invisible, mythical, or imaginary."),
                    ]),
                ]),
            ]),
            option("Teach me to be a mighty and powerful wizard.", [
                sayNpc("Wizards? You don't want any truck with that sort. They're not trustworthy."),
                choose([
                    option("So aren't you a wizard?", [
                        sayNpc("Of course I am! Don't be cheeky or I'll turn you into a frog."),
                    ]),
                    option("I'd better stop talking to you then.", [sayNpc("Cheerio, then.")]),
                ]),
            ]),
            ...(canAskKey
                ? [
                      option("I need the key Sir Prysin gave you.", [
                          sayNpc("Sir Prysin? Who is that? Why would I want his key?"),
                          choose([
                              option("He told me you were looking after it.", keySearchSteps(quest)),
                              option("He's one of the King's knights.", spinachSteps(quest)),
                              option("Have you got any keys knocking around?", keySearchSteps(quest)),
                          ]),
                      ]),
                  ]
                : []),
        ]),
    ];
}

function spinachSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("I remember a knight with nice shoes. Would you like a spinach roll?"),
        choose([
            option("Yes please.", [
                run(({ player, services }) => {
                    giveItem(player, services, SPINACH_ROLL_ITEM_ID);
                }),
                showItem(SPINACH_ROLL_ITEM_ID, "Traiborn presents you with a spinach roll."),
                ...keySearchSteps(quest),
            ]),
            option("Just tell me if you have the key.", keySearchSteps(quest)),
        ]),
    ];
}

function keySearchSteps(quest: QuestDefinition): DialogueStep[] {
    return [
        sayNpc("Now you mention it, I have a key in my special closet of valuable stuff."),
        sayNpc("I sealed it with a magic ritual, so another ritual should open it."),
        sayNpc("A simple drazier ritual should work, but I need 25 sets of bones."),
        choose([
            option("That's too bad. I really need that key.", [
                sayNpc("Sorry I couldn't be more help."),
            ]),
            option("I'll get the bones for you.", [
                sayNpc("That would be very good of you."),
                run(({ player, services }) => {
                    setDemonStage(player, quest, services, STAGE_COLLECTING_BONES);
                }),
            ]),
        ]),
    ];
}

function boneHandoverSteps(quest: QuestDefinition, event: NpcInteractionEvent): DialogueStep[] {
    const stage = getQuestStage(event.player, quest);
    const given = stage - STAGE_COLLECTING_BONES;
    const needed = BONES_REQUIRED - given;
    const available = Math.min(
        needed,
        event.services.inventory
            .getInventoryItems(event.player)
            .filter((entry) => entry.itemId === BONES_ITEM_ID)
            .reduce((total, entry) => total + entry.quantity, 0),
    );
    if (available <= 0) {
        return [
            sayNpc("How are you doing finding bones?"),
            sayPlayer("I haven't got any at the moment."),
            sayNpc(`Never mind. I still need ${needed}.`),
        ];
    }
    const reachesKey = available === needed;
    return [
        sayNpc("How are you doing finding bones?"),
        sayPlayer("I have some bones."),
        sayNpc("Give 'em here then."),
        run(({ player, services }) => {
            takeItem(player, services, BONES_ITEM_ID, available);
            setDemonStage(player, quest, services, stage + available);
        }),
        showItem(BONES_ITEM_ID, `You give Traiborn ${available} set${available === 1 ? "" : "s"} of bones.`),
        ...(reachesKey
            ? [
                  sayNpc("Hurrah! That's all 25 sets of bones."),
                  sayNpc(
                      "Wings of dark and colour too, spreading in the morning dew; locked away I have a key; return it now, please, unto me.",
                  ),
                  run(({ player, services }) => {
                      giveItem(player, services, TRAIBORN_KEY_ITEM_ID);
                  }),
                  showItem(TRAIBORN_KEY_ITEM_ID, "Traiborn hands you a Silverlight key."),
              ]
            : [sayNpc(`I still need ${needed - available} more sets.`)]),
    ];
}

export function createTraibornTalkHandler(quest: QuestDefinition) {
    return (event: NpcInteractionEvent): void => {
        const { player, services } = event;
        let stage = getQuestStage(player, quest);
        let steps: DialogueStep[];
        if (
            stage === STAGE_TRAIBORN_KEY &&
            !ownsItem(player, services, TRAIBORN_KEY_ITEM_ID)
        ) {
            steps = [
                sayPlayer("I've lost the key you gave me."),
                sayNpc("It was returned to me. You will need another 25 sets of bones."),
                run(({ player: questPlayer, services: questServices }) => {
                    setDemonStage(questPlayer, quest, questServices, STAGE_COLLECTING_BONES);
                }),
            ];
        } else if (stage >= STAGE_COLLECTING_BONES && stage < STAGE_TRAIBORN_KEY) {
            steps = boneHandoverSteps(quest, event);
        } else {
            stage = getQuestStage(player, quest);
            steps = standardTraibornSteps(
                stage >= STAGE_KEY_HUNT && stage < STAGE_TRAIBORN_KEY,
                quest,
            );
        }
        startConversation(
            { player, services, npcId: TRAIBORN_NPC_ID, npcName: "Wizard Traiborn" },
            steps,
        );
    };
}
