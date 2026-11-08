// Optional per-viewer visibility for players and NPCs, on top of the normal view distance.
// A gamemode can set it to hide actors from each other (e.g. only show people in your zone).
import type { PlayerState } from "../player";

export type VisibilityTarget = { kind: "player" | "npc"; id: number; x: number; y: number; level: number };
export type ActorVisibilityFilter = (viewer: PlayerState, target: VisibilityTarget) => boolean;
/** Whether a player hears a sound played at a tile (combat hits, eating...). */
export type SoundAudibilityFilter = (listener: PlayerState, at: { x: number; y: number; level: number }) => boolean;

let filter: ActorVisibilityFilter | undefined;
let soundFilter: SoundAudibilityFilter | undefined;

export function setActorVisibilityFilter(next: ActorVisibilityFilter | undefined): void {
    filter = next;
}

export function canViewerSee(viewer: PlayerState, target: VisibilityTarget): boolean {
    return filter ? filter(viewer, target) : true;
}

/** A gamemode can limit how far positioned sounds carry (e.g. no further than its view distance). */
export function setSoundAudibilityFilter(next: SoundAudibilityFilter | undefined): void {
    soundFilter = next;
}

let defaultRadius: number | undefined;

/**
 * The radius (tiles) given to positioned sounds that don't name one (combat hits, swings): the
 * client then fades them with distance, silent at the radius. Undefined plays them at full volume.
 */
export function setDefaultSoundRadius(tiles: number | undefined): void {
    defaultRadius = tiles;
}

export function defaultSoundRadius(): number | undefined {
    return defaultRadius;
}

export function canListenerHear(listener: PlayerState, at: { x: number; y: number; level: number }): boolean {
    return soundFilter ? soundFilter(listener, at) : true;
}
