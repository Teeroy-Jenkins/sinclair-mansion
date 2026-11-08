import {
    INSTANCE_CHUNK_COUNT,
    INSTANCE_SIZE,
    createEmptyTemplateChunks,
    packTemplateChunk,
} from "../../../client/common/instance/InstanceTypes";
import type { ServerServices } from "../game/ServerServices";
import type { NpcSpawnConfig } from "../game/npc";
import type { PlayerState } from "../game/player";
import type { TemporaryLocChange } from "../game/services/LocationService";
import { SailingWorldView } from "../game/sailing/SailingWorldView";

export interface InstanceAreaCopy {
    sourceBaseX: number;
    sourceBaseY: number;
    widthChunks: number;
    heightChunks: number;
    sourcePlanes?: readonly number[];
    destinationChunkX?: number;
    destinationChunkY?: number;
    rotation?: number;
}

export interface QuestInstanceNpc extends Omit<NpcSpawnConfig, "x" | "y" | "worldViewId" | "ownerPlayerId"> {
    offsetX: number;
    offsetY: number;
}

export interface QuestInstanceLoc {
    id: number;
    offsetX: number;
    offsetY: number;
    level: number;
    shape: number;
    rotation: number;
}

export interface QuestInstanceSpec {
    templateChunks: number[][][];
    destination: { x: number; y: number; level: number };
    npcs?: readonly QuestInstanceNpc[];
    locs?: readonly QuestInstanceLoc[];
    exit?: { x: number; y: number; level: number };
}

export interface QuestInstanceHandle {
    readonly playerId: number;
    readonly worldViewId: number;
    readonly baseX: number;
    readonly baseY: number;
    readonly exit?: { x: number; y: number; level: number };
}

export function buildInstanceTemplate(copies: readonly InstanceAreaCopy[]): number[][][] {
    const templates = createEmptyTemplateChunks();
    for (const copy of copies) {
        const sourceChunkX = Math.floor(copy.sourceBaseX / 8);
        const sourceChunkY = Math.floor(copy.sourceBaseY / 8);
        const destinationChunkX = Math.trunc(copy.destinationChunkX ?? 6);
        const destinationChunkY = Math.trunc(copy.destinationChunkY ?? 6);
        const planes = copy.sourcePlanes ?? [0, 1, 2, 3];
        for (const plane of planes) {
            const targetPlane = Math.max(0, Math.min(3, Math.trunc(plane)));
            for (let x = 0; x < Math.max(1, Math.trunc(copy.widthChunks)); x++) {
                for (let y = 0; y < Math.max(1, Math.trunc(copy.heightChunks)); y++) {
                    const targetX = destinationChunkX + x;
                    const targetY = destinationChunkY + y;
                    if (
                        targetX < 0 ||
                        targetY < 0 ||
                        targetX >= INSTANCE_CHUNK_COUNT ||
                        targetY >= INSTANCE_CHUNK_COUNT
                    ) {
                        continue;
                    }
                    templates[targetPlane][targetX][targetY] = packTemplateChunk(
                        targetPlane,
                        sourceChunkX + x,
                        sourceChunkY + y,
                        copy.rotation ?? 0,
                    );
                }
            }
        }
    }
    return templates;
}

export class InstancedAreaManager {
    private nextWorldViewId = 4000;
    private readonly activeByPlayer = new Map<number, QuestInstanceHandle>();
    private readonly locsByPlayer = new Map<number, TemporaryLocChange[]>();

    constructor(private readonly services: ServerServices) {}

    create(player: PlayerState, spec: QuestInstanceSpec): QuestInstanceHandle | undefined {
        this.dispose(player);
        const mapService = this.services.mapService;
        const pathService = this.services.pathService;
        const npcManager = this.services.npcManager;
        if (!mapService || !pathService || !npcManager) return undefined;

        const worldViewId = this.allocateWorldViewId();
        const baseX = ((Math.trunc(spec.destination.x) >> 3) - 6) * 8;
        const baseY = ((Math.trunc(spec.destination.y) >> 3) - 6) * 8;
        const collisionMaps = mapService.buildInstanceCollision(
            spec.templateChunks,
            0,
            0,
            INSTANCE_SIZE,
            INSTANCE_SIZE,
        );
        if (!collisionMaps) return undefined;

        const view = new SailingWorldView(
            worldViewId,
            baseX,
            baseY,
            INSTANCE_SIZE,
            INSTANCE_SIZE,
            collisionMaps,
        );
        pathService.registerWorldViewCollision(worldViewId, view);

        const handle: QuestInstanceHandle = {
            playerId: player.id,
            worldViewId,
            baseX,
            baseY,
            exit: spec.exit,
        };
        this.activeByPlayer.set(player.id, handle);
        player.worldViewId = worldViewId;
        this.services.movementService.teleportToInstance(
            player,
            spec.destination.x,
            spec.destination.y,
            spec.destination.level,
            spec.templateChunks,
        );

        for (const spawn of spec.npcs ?? []) {
            const npc = npcManager.spawnTransientNpc({
                ...spawn,
                x: baseX + Math.trunc(spawn.offsetX),
                y: baseY + Math.trunc(spawn.offsetY),
                worldViewId,
                ownerPlayerId: player.id,
            });
            if (npc) player.instanceNpcIds.add(npc.id);
        }

        const locs: TemporaryLocChange[] = [];
        for (const loc of spec.locs ?? []) {
            locs.push(
                this.services.locationService.replaceTemporaryLoc(
                    { worldViewId },
                    0,
                    loc.id,
                    { x: baseX + Math.trunc(loc.offsetX), y: baseY + Math.trunc(loc.offsetY) },
                    loc.level,
                    { newShape: loc.shape, newRotation: loc.rotation },
                ),
            );
        }
        this.locsByPlayer.set(player.id, locs);
        return handle;
    }

    get(playerId: number): QuestInstanceHandle | undefined {
        return this.activeByPlayer.get(Math.trunc(playerId));
    }

    dispose(
        player: PlayerState,
        destination?: { x: number; y: number; level: number },
    ): boolean {
        const handle = this.activeByPlayer.get(player.id);
        if (!handle) return false;

        for (const loc of this.locsByPlayer.get(player.id) ?? []) {
            this.services.locationService.clearTemporaryLoc(
                loc.scope,
                loc.oldId,
                loc.tile,
                loc.level,
                loc.oldShape,
            );
        }
        this.locsByPlayer.delete(player.id);
        this.services.scriptScheduler.cancelOwner({ kind: "player", id: player.id });
        this.services.npcManager?.removeNpcsOwnedByPlayer(player.id);
        this.services.groundItems.removeOwnedByPlayer(player.id, handle.worldViewId);
        this.services.pathService?.removeWorldViewCollision(handle.worldViewId);
        player.instanceNpcIds.clear();
        player.worldViewId = -1;
        this.activeByPlayer.delete(player.id);

        const exit = destination ?? handle.exit;
        if (exit) {
            this.services.movementService.teleportPlayer(
                player,
                exit.x,
                exit.y,
                exit.level,
                true,
            );
        }
        return true;
    }

    private allocateWorldViewId(): number {
        for (let attempts = 0; attempts < 60_000; attempts++) {
            const candidate = this.nextWorldViewId++;
            if (this.nextWorldViewId > 65_000) this.nextWorldViewId = 4000;
            if ([...this.activeByPlayer.values()].some((handle) => handle.worldViewId === candidate)) {
                continue;
            }
            return candidate;
        }
        throw new Error("Quest instance world-view id space exhausted");
    }
}
