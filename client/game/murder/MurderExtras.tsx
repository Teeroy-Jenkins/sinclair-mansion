// Murder at Sinclair Mansion client extras:
// - QuestMarker: RuneScape's yellow hint arrow over the tile of your current chore step
// - MouseTooltips: RuneLite's Mouse Tooltips (the left-click option next to the cursor)
import { useEffect, useRef, useState } from "react";

import { MenuTargetType } from "../../rs/MenuEntry";
import type { OsrsClient } from "../OsrsClient";
import "./MurderExtras.css";
import { getMurderHud, subscribeMurderHud, type MurderHud } from "./MurderHudStore";

function useHud(): MurderHud | undefined {
    const [hud, setHud] = useState<MurderHud | undefined>(getMurderHud()?.hud);
    useEffect(() => subscribeMurderHud((s) => setHud(s?.hud)), []);
    return hud;
}

// ------------------------------------------------------------------ quest hint arrow
// RuneScape's quest/minigame hint arrow: a yellow arrow hovering over one tile. When that tile
// is out of the camera's view, the arrow sits on the edge of the game view and points at it.
type ArrowHost = {
    sampleHeightAtExactPlane?: (x: number, z: number, plane: number) => number;
    pinnedLocHighlights?: unknown[];
};

const ARROW_W = 30;
const ARROW_H = 38;
/** Height of the arrow's tip above the ground, in tiles (OSRS hovers it about a tile up). */
const ARROW_LIFT = 1.15;
/** How far in from the view's edge the off-screen arrow sits, in CSS pixels. */
const EDGE_INSET = 28;

type ArrowPos = { x: number; y: number; deg: number; edge: boolean };

export function QuestMarker({ osrsClient }: { osrsClient: OsrsClient }) {
    const hud = useHud();
    const m = hud?.marker;
    const root = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<ArrowPos | undefined>();

    useEffect(() => {
        // The old cyan outline is gone: make sure nothing is left pinned from it.
        const renderer = osrsClient.renderer as unknown as ArrowHost | undefined;
        if (renderer?.pinnedLocHighlights?.length) renderer.pinnedLocHighlights = [];
        if (!m) {
            setPos(undefined);
            return;
        }
        // One tile: the middle of the spot's footprint.
        const wx = m.x + Math.max(1, m.w) / 2;
        const wz = m.y + Math.max(1, m.h) / 2;
        const level = m.level;
        let raf = 0;
        let last = "";
        const mul = (mat: ArrayLike<number>, src: ArrayLike<number>): number[] => {
            const out = [0, 0, 0, 0];
            for (let r = 0; r < 4; r++) out[r] = mat[r] * src[0] + mat[4 + r] * src[1] + mat[8 + r] * src[2] + mat[12 + r] * src[3];
            return out;
        };
        const loop = () => {
            raf = requestAnimationFrame(loop);
            const rect = root.current?.getBoundingClientRect();
            const cam = osrsClient.camera;
            const host = osrsClient.renderer as unknown as ArrowHost | undefined;
            if (!rect || !cam || rect.width <= 0 || !cam.screenWidth || !cam.screenHeight) return;
            let ground = 0;
            try {
                ground = host?.sampleHeightAtExactPlane?.(wx, wz, level) ?? 0;
            } catch {
                ground = 0;
            }
            // Project the arrow's tip (world x, height, world z) the way the renderer does.
            const clip = mul(cam.projectionMatrix, mul(cam.viewMatrix, [wx, ground - ARROW_LIFT, wz, 1]));
            const w = clip[3];
            const scaleX = rect.width / cam.screenWidth;
            const scaleY = rect.height / cam.screenHeight;
            // The 3D view's box on screen, in CSS pixels.
            const vx = (cam.viewportXOffset | 0) * scaleX;
            const vy = (cam.viewportYOffset | 0) * scaleY;
            const vw = (cam.viewportWidth || cam.screenWidth) * scaleX;
            const vh = (cam.viewportHeight || cam.screenHeight) * scaleY;
            let next: ArrowPos | undefined;
            if (Math.abs(w) > 1e-6) {
                const sx = (clip[0] / w + 1) * 0.5 * cam.screenWidth * scaleX;
                const sy = (1 - (clip[1] / w + 1) * 0.5) * cam.screenHeight * scaleY;
                const onScreen = w > 0 && sx >= vx + 4 && sx <= vx + vw - 4 && sy - ARROW_H >= vy && sy <= vy + vh - 4;
                if (onScreen) {
                    next = { x: sx, y: sy, deg: 0, edge: false };
                } else {
                    // Off the view (or behind the camera): pin it to the edge, pointing the way.
                    const cx = vx + vw / 2;
                    const cy = vy + vh / 2;
                    let dx = sx - cx;
                    let dy = sy - cy;
                    if (w < 0) {
                        dx = -dx;
                        dy = -dy;
                    }
                    if (dx === 0 && dy === 0) dy = 1;
                    const hw = Math.max(1, vw / 2 - EDGE_INSET);
                    const hh = Math.max(1, vh / 2 - EDGE_INSET);
                    const t = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
                    // The arrow is drawn pointing down (+y); turn it to face (dx, dy).
                    const deg = (Math.atan2(dy, dx) * 180) / Math.PI - 90;
                    next = { x: cx + dx * t, y: cy + dy * t, deg, edge: true };
                }
            }
            const sig = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.deg)},${next.edge}` : "";
            if (sig !== last) {
                last = sig;
                setPos(next);
            }
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [m?.x, m?.y, m?.level, m?.w, m?.h, osrsClient]);

    return (
        <div ref={root} className="mx-hint-layer">
            {m && pos && (
                <div
                    className="mx-hint-arrow"
                    style={{
                        left: pos.x,
                        top: pos.y,
                        // Over the tile the tip touches the point; on the edge it's centred and turned.
                        transform: pos.edge ? `translate(-50%, -50%) rotate(${pos.deg}deg)` : "translate(-50%, -100%)",
                    }}
                >
                    <HintArrowSvg />
                </div>
            )}
        </div>
    );
}

/** The hint arrow, pointing down: yellow with a black outline and a shaded right half. */
function HintArrowSvg() {
    return (
        <svg width={ARROW_W} height={ARROW_H} viewBox="0 0 30 38" aria-hidden="true">
            <path d="M9 1 H21 V20 H29 L15 37 L1 20 H9 Z" fill="#ffff00" />
            <path d="M15 1 H21 V20 H29 L15 37 Z" fill="#d2c000" />
            <path d="M9 1 H21 V20 H29 L15 37 L1 20 H9 Z" fill="none" stroke="#000" strokeWidth="1.6" />
        </svg>
    );
}

// ------------------------------------------------------------------ mouse tooltips
const TARGET_CLASS: Partial<Record<MenuTargetType, string>> = {
    [MenuTargetType.LOC]: "mx-cyan",
    [MenuTargetType.NPC]: "mx-yellow",
    [MenuTargetType.OBJ]: "mx-orange",
    [MenuTargetType.ITEM]: "mx-orange",
    [MenuTargetType.PLAYER]: "mx-white",
};
const stripTags = (s: string) => s.replace(/<[^>]*>/g, "");

type Tip = { x: number; y: number; option: string; parts: Array<{ text: string; cls: string }> };

export function MouseTooltips({ osrsClient }: { osrsClient: OsrsClient }) {
    const root = useRef<HTMLDivElement>(null);
    const mouse = useRef({ x: -1, y: -1 });
    const [tip, setTip] = useState<Tip | undefined>();

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            mouse.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener("mousemove", onMove);
        let raf = 0;
        let last = "";
        const loop = () => {
            raf = requestAnimationFrame(loop);
            const rect = root.current?.getBoundingClientRect();
            const entries = osrsClient.menuEntries ?? [];
            // The left-click option: the last entry, except that Examine never takes the left click.
            let top = entries[entries.length - 1];
            for (let i = entries.length - 1; i >= 0; i--) {
                const e = entries[i] as (typeof entries)[number] & { deprioritized?: boolean };
                if (e.option !== "Examine" && !e.deprioritized) {
                    top = e;
                    break;
                }
            }
            const inside = rect && mouse.current.x >= rect.left && mouse.current.y >= rect.top && mouse.current.x <= rect.right && mouse.current.y <= rect.bottom;
            let next: Tip | undefined;
            if (rect && inside && !osrsClient.menuOpen && top && top.option !== "Walk here" && top.option !== "Cancel" && top.targetType !== MenuTargetType.NONE) {
                const cls = TARGET_CLASS[top.targetType as MenuTargetType] ?? "mx-white";
                const name = stripTags(top.targetName ?? "");
                // "Use Bucket -> Dairy cow": the held item in orange, the target in its own colour.
                const arrow = name.indexOf(" -> ");
                const parts = arrow >= 0
                    ? [{ text: name.slice(0, arrow), cls: "mx-orange" }, { text: " -> ", cls: "mx-white" }, { text: name.slice(arrow + 4), cls }]
                    : [{ text: name, cls }];
                next = { x: mouse.current.x - rect.left, y: mouse.current.y - rect.top, option: top.option, parts };
            }
            const sig = next ? `${next.x},${next.y},${next.option},${next.parts.map((p) => p.text).join("")}` : "";
            if (sig !== last) {
                last = sig;
                setTip(next);
            }
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("mousemove", onMove);
        };
    }, [osrsClient]);

    return (
        <div ref={root} className="mx-tooltip-layer">
            {tip && (
                <div className="mx-tooltip" style={{ left: tip.x + 14, top: tip.y + 18 }}>
                    <span className="mx-white">{tip.option} </span>
                    {tip.parts.map((p, i) => (
                        <span key={i} className={p.cls}>{p.text}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
