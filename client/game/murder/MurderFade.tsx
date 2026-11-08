// Quest-style fades for Murder at Sinclair Mansion, driven by the HUD data:
// - the opening cutscene: the screen fades to black, the title fades in and out on the black,
//   then the screen fades in on the dinner table. The server seats everyone and cuts the camera
//   in only once the screen is black (MURDER_CONFIG.intro.seatSec, 2.4 s), so nothing changes in
//   view. At the end the camera glides back to your own view (the camera reset's hand-back in
//   inboundWorld.ts), with no black;
// - a chore's long moment (hud.fade) blacks your screen out with its caption until the server
//   says it's over (dying doesn't cut it short), and blocks clicks while it lasts;
// - when the grandfather clock strikes the screen fades to black, then back in on the household
//   seated around the dining table.
import { useEffect, useRef, useState } from "react";

import "./MurderHudOverlay.css";
import { getMurderHud, subscribeMurderHud } from "./MurderHudStore";

/** The screen's fade (the CSS transition on .murder-fade). */
const FADE_MS = 1400;
/** The title shows on the black for this long (it fades in and out over CAPTION_FADE_MS). */
const INTRO_TITLE_MS = 2000;
const CAPTION_FADE_MS = 800;

export function MurderFade() {
    const [black, setBlack] = useState(false);
    const [busy, setBusy] = useState(false);
    const [caption, setCaption] = useState("");
    // The caption fades on its own: the intro's title only appears once the screen is black.
    const [captionOn, setCaptionOn] = useState(false);
    const lastPhase = useRef(getMurderHud()?.hud.phase);
    const choreFade = useRef<number | undefined>(undefined);

    useEffect(() => {
        let timers: number[] = [];
        const clearTimers = () => {
            for (const t of timers) window.clearTimeout(t);
            timers = [];
        };
        const after = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
        /** Black with a caption showing at once (the clock, a chore's long moment). */
        const blackWith = (text: string) => {
            setCaption(text);
            setCaptionOn(true);
            setBlack(true);
        };
        const unsub = subscribeMurderHud((state) => {
            const phase = state?.hud.phase;
            const prev = lastPhase.current;
            const fade = state?.hud.fade;
            // A chore's long moment: black until the server drops it from the HUD.
            if (fade && fade.id !== choreFade.current) {
                choreFade.current = fade.id;
                clearTimers();
                blackWith(fade.caption);
                setBusy(true);
            } else if (!fade && choreFade.current !== undefined) {
                choreFade.current = undefined;
                setBusy(false);
                if (phase === "investigation") setBlack(false);
            }
            if (phase === prev) return;
            lastPhase.current = phase;
            if (fade) return;
            clearTimers();
            if (phase === "intro") {
                // Fade to black, then the title on the black, then fade in on the dinner table
                // (the server has seated everyone and cut the camera in by then, under the black).
                setCaption("Murder at Sinclair Mansion");
                setCaptionOn(false);
                setBlack(true);
                after(FADE_MS, () => setCaptionOn(true));
                after(FADE_MS + INTRO_TITLE_MS, () => setCaptionOn(false));
                after(FADE_MS + INTRO_TITLE_MS + CAPTION_FADE_MS, () => setBlack(false));
            } else if (prev === "intro" && phase === "investigation") {
                // No black: the camera glides from the last shot back to your own view.
                setCaptionOn(false);
                setBlack(false);
            } else if (phase === "freeze") {
                blackWith("*DONG* ... *DONG* ... The grandfather clock strikes.");
            } else if (prev === "freeze" && phase === "arrest") {
                // Everyone has just been seated; hold the black a moment, then reveal the table.
                blackWith("The household gathers around the dining table...");
                after(1200, () => setBlack(false));
            } else {
                setBlack(false);
            }
        });
        return () => {
            unsub();
            clearTimers();
        };
    }, []);

    return (
        <div className={`murder-fade ${black ? "on" : ""} ${busy ? "busy" : ""}`}>
            <div className={`murder-fade-caption ${captionOn ? "on" : ""}`}>{caption}</div>
        </div>
    );
}
