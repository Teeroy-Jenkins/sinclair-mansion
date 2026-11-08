// Murder at Sinclair Mansion login: pick a name and design your character on
// the title screen, then play. No password: the server runs passwordless.
// The look is kept in this browser and sent (a "sinclair_look" message) after every login, so it
// comes along to a friend's game too (joining one logs in again there).
import { useEffect, useMemo, useRef, useState } from "react";

import { sendGamemodeMessage, subscribeLoginResponse } from "../../network/ServerConnection";
import { PlayerAppearance } from "../../rs/config/player/PlayerAppearance";
import { PLAYER_BODY_RECOLOR_TO_1 } from "../../rs/config/player/PlayerDesignColors";
import { PlayerModelLoader } from "../../rs/config/player/PlayerModelLoader";
import { Model2DRenderer } from "../../ui/model/Model2DRenderer";
import type { OsrsClient } from "../OsrsClient";
import "./LoginDesigner.css";
import { subscribeMurderHud } from "./MurderHudStore";
import { startProgressSync } from "./Progression";

const STORAGE_KEY = "sinclair.look.v1";
const PARTS = ["Hair", "Jaw", "Torso", "Arms", "Hands", "Legs", "Feet"];
const COLOURS = ["Hair", "Torso", "Legs", "Feet", "Skin"];
/** Pushes the model down the preview box so the whole character (head included) is in view. */
const PREVIEW_OFFSET_Y = 120;
/** Smaller zoom = bigger model: fill most of the preview box. */
const PREVIEW_ZOOM = 500;

interface Appearance {
    gender: number;
    kits: number[]; // identity kit ids
    colors: number[];
}

interface Look {
    name: string;
    gender: 0 | 1;
    kits: number[]; // index into the selectable kit list per part
    colors: number[];
    /** The look as kit ids, saved on Play: what's sent to every server you log in to. */
    appearance?: Appearance;
}

const DEFAULT_LOOK: Look = { name: "", gender: 0, kits: [0, 0, 0, 0, 0, 0, 0], colors: [0, 0, 0, 0, 0] };

/**
 * Each gender's default look (kit ids per part: hair, jaw, torso, arms, hands, legs, feet), as
 * 2009scape's Gender enum has it. Switching gender starts again from these, colours reset, as
 * its CharacterDesign.changeGender does. Women have no jaw kit (-1).
 */
const GENDER_DEFAULT_KITS: Record<0 | 1, number[]> = {
    0: [0, 10, 18, 26, 33, 36, 42],
    1: [45, -1, 56, 61, 68, 70, 79],
};

/** The default look's kits as indexes into this gender's selectable kits (first one if missing). */
function defaultKitIndexes(options: number[][], gender: 0 | 1): number[] {
    return GENDER_DEFAULT_KITS[gender].map((kitId, p) => Math.max(0, options[p]?.indexOf(kitId) ?? 0));
}

/** While the model parts are still streaming in, the preview redraws this often (ms), up to this many times. */
const DRAW_RETRY_MS = 100;
const MAX_DRAW_RETRIES = 300;

/** The rotate arrows turn the model this much (of 2048) per step while held, like RuneScape's. */
const ROTATE_STEP = 48;
const ROTATE_EVERY_MS = 40;
/** Facing you, as the designer opens. */
const FRONT_ANGLE = 0;

function loadLook(): Look {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...DEFAULT_LOOK, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_LOOK;
}

function saveLook(look: Look): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(look));
    } catch {}
}

/** Logged in (to your own copy or a friend's): send the look with the first overlay update. */
let lookWanted = false;
/** The Store or Bank button was pressed: open it once logged in. */
let pendingScreen: "store" | "bank" | undefined;
let lookHooked = false;
/** Send the designed look after every login: the first overlay update arrives once it completes. */
function hookLookSender(): void {
    startProgressSync();
    if (lookHooked) return;
    lookHooked = true;
    subscribeLoginResponse((info) => {
        if (info.success) lookWanted = true;
    });
    subscribeMurderHud((state) => {
        if (!state) return;
        const look = lookWanted ? loadLook().appearance : undefined;
        lookWanted = false;
        if (look) {
            console.log("[LoginDesigner] sending designed appearance", look);
            sendGamemodeMessage("sinclair_look", { ...look });
        }
        // Wait for your saved coins and cosmetics to arrive from the browser first.
        if (pendingScreen && !state.hud.progressWanted) {
            sendGamemodeMessage("sinclair_store", { open: pendingScreen });
            pendingScreen = undefined;
        }
    });
}

/** Selectable identity kits for each body part of a gender (kit ids). */
function kitOptions(client: OsrsClient, gender: 0 | 1): number[][] {
    const out: number[][] = PARTS.map(() => []);
    const loader = client.idkTypeLoader;
    const count = loader.getCount();
    for (let id = 0; id < count; id++) {
        const kit = loader.load(id) as { nonSelectable?: boolean; bodyPartId?: number; bodyPartyId?: number } | undefined;
        if (!kit || kit.nonSelectable) continue;
        const part = (kit.bodyPartId ?? kit.bodyPartyId ?? -1) - (gender === 1 ? 7 : 0);
        if (part >= 0 && part < 7) out[part].push(id);
    }
    return out;
}

export function LoginDesigner({ osrsClient }: { osrsClient: OsrsClient }) {
    const [look, setLook] = useState<Look>(loadLook);
    const [error, setError] = useState("");
    const [angle, setAngle] = useState(FRONT_ANGLE);
    // Bumped to redraw while the cache is still streaming the model parts in. Without it the
    // preview stayed blank on first open until something else (rotating) redrew it.
    const [retry, setRetry] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rotateTimer = useRef<number | undefined>(undefined);
    const drag = useRef<{ x: number; angle: number } | undefined>(undefined);
    const ready = !!osrsClient.idkTypeLoader && !!osrsClient.modelLoader && !!osrsClient.textureLoader;

    const options = useMemo(() => (ready ? kitOptions(osrsClient, look.gender) : PARTS.map(() => [])), [ready, look.gender, osrsClient]);
    const renderers = useMemo(() => {
        if (!ready) return undefined;
        return {
            body: new PlayerModelLoader(osrsClient.idkTypeLoader, osrsClient.objTypeLoader, osrsClient.modelLoader, osrsClient.textureLoader),
            draw: new Model2DRenderer(osrsClient.objTypeLoader, osrsClient.modelLoader, osrsClient.textureLoader),
        };
    }, [ready, osrsClient]);

    const appearance = useMemo(() => {
        const kits = PARTS.map((_, p) => {
            const list = options[p];
            return list.length ? list[((look.kits[p] % list.length) + list.length) % list.length] : -1;
        });
        return { gender: look.gender, kits, colors: look.colors.slice() };
    }, [look, options]);

    // A new look gets a fresh set of redraw tries.
    useEffect(() => setRetry(0), [appearance]);

    // Once the kits have loaded, the saved look carries its kit ids too (sent at every login).
    useEffect(() => saveLook(ready ? { ...look, appearance } : look), [look, appearance, ready]);

    // RuneScape's designer (2009scape's interface 771) shows you facing forward and turns you
    // only with the rotate arrows under the model, for as long as they're held. Dragging the
    // model turns it too.
    const stopRotate = () => {
        if (rotateTimer.current !== undefined) window.clearInterval(rotateTimer.current);
        rotateTimer.current = undefined;
    };
    const startRotate = (dir: 1 | -1) => {
        stopRotate();
        setAngle((a) => (a + dir * ROTATE_STEP) & 2047);
        rotateTimer.current = window.setInterval(() => setAngle((a) => (a + dir * ROTATE_STEP) & 2047), ROTATE_EVERY_MS);
    };
    useEffect(() => {
        window.addEventListener("mouseup", stopRotate);
        return () => {
            window.removeEventListener("mouseup", stopRotate);
            stopRotate();
        };
    }, []);

    /** A different gender starts from that gender's default look (2009scape's changeGender). */
    const setGender = (gender: 0 | 1) =>
        setLook((l) => {
            if (l.gender === gender) return l;
            const genderOptions = ready ? kitOptions(osrsClient, gender) : PARTS.map(() => []);
            return { ...l, gender, kits: defaultKitIndexes(genderOptions, gender), colors: DEFAULT_LOOK.colors.slice() };
        });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const tryAgain = () => {
            if (retry >= MAX_DRAW_RETRIES) return undefined;
            const t = window.setTimeout(() => setRetry((r) => r + 1), DRAW_RETRY_MS);
            return () => window.clearTimeout(t);
        };
        if (!renderers) return tryAgain();
        const missesBefore = osrsClient.modelLoader?.missCount ?? 0;
        const pa = new PlayerAppearance(appearance.gender, appearance.colors, appearance.kits, new Array(14).fill(-1), { prayer: -1 } as any);
        const model = renderers.body.buildStaticModel(pa);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (!model) return tryAgain(); // parts still streaming in: keep the last drawing until then
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const out = renderers.draw.renderModelInstanceToCanvasWidget(
            model,
            { xan2d: 60, yan2d: angle, zan2d: 0, zoom2d: PREVIEW_ZOOM, offsetY2d: PREVIEW_OFFSET_Y },
            canvas.width,
            canvas.height,
        );
        if (out) ctx.drawImage(out.canvas, 0, 0);
        // Some parts (or the drawing itself) were still missing: draw again shortly.
        if (!out || (osrsClient.modelLoader?.missCount ?? 0) !== missesBefore) return tryAgain();
        return undefined;
    }, [renderers, appearance, angle, retry, osrsClient]);

    const cycle = (kind: "kits" | "colors", index: number, delta: number) =>
        setLook((l) => {
            const arr = l[kind].slice();
            const size = kind === "colors" ? PLAYER_BODY_RECOLOR_TO_1[index]?.length ?? 1 : Math.max(1, options[index].length);
            arr[index] = (((arr[index] ?? 0) + delta) % size + size) % size;
            return { ...l, [kind]: arr };
        });

    /** Log in; the Store and Bank buttons then open that interface (with your pack beside it). */
    const play = (screen?: "store" | "bank") => {
        const name = look.name.trim();
        if (!/^[A-Za-z0-9 _-]{1,12}$/.test(name)) {
            setError("Pick a name: 1-12 letters, numbers, spaces, _ or -.");
            return;
        }
        setError("");
        hookLookSender();
        saveLook({ ...look, appearance });
        pendingScreen = screen;
        if (!osrsClient.quickLogin(name)) setError("Couldn't connect. Check the server and try again.");
    };

    const partRows = PARTS.map((label, p) => (look.gender === 1 && p === 1) || !options[p].length ? null : (
        <div className="ld-row" key={label}>
            <button onClick={() => cycle("kits", p, -1)}>&lsaquo;</button>
            <span>{label}</span>
            <button onClick={() => cycle("kits", p, 1)}>&rsaquo;</button>
        </div>
    ));
    const colourRows = COLOURS.map((label, c) => (
        <div className="ld-row" key={label}>
            <button onClick={() => cycle("colors", c, -1)}>&lsaquo;</button>
            <span>{label}</span>
            <button onClick={() => cycle("colors", c, 1)}>&rsaquo;</button>
        </div>
    ));

    return (
        <div className="login-designer" onKeyDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            <div className="ld-title">Murder at Sinclair Mansion</div>
            <div className="ld-body">
                <div className="ld-col">
                    <div className="ld-heading">Style</div>
                    {partRows}
                    <div className="ld-gender">
                        <button className={look.gender === 0 ? "on" : ""} onClick={() => setGender(0)}>Male</button>
                        <button className={look.gender === 1 ? "on" : ""} onClick={() => setGender(1)}>Female</button>
                    </div>
                </div>
                <div className="ld-model">
                    <canvas
                        ref={canvasRef}
                        className="ld-preview"
                        width={150}
                        height={220}
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            drag.current = { x: e.clientX, angle };
                        }}
                        onMouseMove={(e) => {
                            const d = drag.current;
                            if (!d || (e.buttons & 1) === 0) return;
                            setAngle((d.angle - Math.round((e.clientX - d.x) * 8)) & 2047);
                        }}
                        onMouseUp={() => (drag.current = undefined)}
                        onMouseLeave={() => (drag.current = undefined)}
                    />
                    <div className="ld-rotate">
                        <button title="Rotate left" onMouseDown={(e) => { e.stopPropagation(); startRotate(1); }} onMouseUp={stopRotate} onMouseLeave={stopRotate}>&#x21BA;</button>
                        <button title="Rotate right" onMouseDown={(e) => { e.stopPropagation(); startRotate(-1); }} onMouseUp={stopRotate} onMouseLeave={stopRotate}>&#x21BB;</button>
                    </div>
                </div>
                <div className="ld-col">
                    <div className="ld-heading">Colour</div>
                    {colourRows}
                </div>
            </div>
            <div className="ld-footer">
                <label>
                    Name:{" "}
                    <input
                        value={look.name}
                        maxLength={12}
                        autoFocus
                        spellCheck={false}
                        onChange={(e) => setLook((l) => ({ ...l, name: e.target.value }))}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") play();
                        }}
                    />
                </label>
                <button className="ld-play" onClick={() => play()}>Play</button>
            </div>
            <div className="ld-shops">
                <button onClick={() => play("store")}>Store</button>
                <button onClick={() => play("bank")}>Bank</button>
            </div>
            <div className="ld-error">{error}</div>
        </div>
    );
}
