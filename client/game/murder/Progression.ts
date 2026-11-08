// Your progression (coins, cosmetics and bank) is kept in this browser, one save per name, so it
// goes with you to any copy of the game: the server you log in to asks for it
// (hud.progressWanted) and sends every change back (hud.progress) to be saved here.
import { sendGamemodeMessage } from "../../network/ServerConnection";
import { subscribeMurderHud } from "./MurderHudStore";

const STORAGE_PREFIX = "sinclair.progress.v1.";

function load(name: string): unknown {
    try {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + name);
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
}

function save(name: string, progress: unknown): void {
    try {
        window.localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(progress));
    } catch {}
}

let started = false;
/** The last progressWanted answered, so each request is answered once (until it's asked again). */
let answered: string | undefined;
let answeredAt = 0;
const RESEND_MS = 5000;

/** Keep the browser's save and the server in step (idempotent). */
export function startProgressSync(): void {
    if (started) return;
    started = true;
    subscribeMurderHud((state) => {
        const hud = state?.hud;
        if (!hud) {
            answered = undefined; // logged out: the next server asks afresh
            return;
        }
        const wanted = hud.progressWanted;
        // Asked again a while after answering: the answer was lost (a reconnect), so send it again.
        if (wanted && (wanted !== answered || performance.now() - answeredAt > RESEND_MS)) {
            answered = wanted;
            answeredAt = performance.now();
            // No save yet (a first game on this browser): the server keeps what it has and sends it to save.
            sendGamemodeMessage("sinclair_progress", { progress: load(wanted) ?? null });
        } else if (!wanted) {
            answered = undefined;
        }
        if (hud.progress?.name) save(hud.progress.name, hud.progress);
    });
}
