import { getCacheLoaderFactory } from "../../client/rs/cache/loader/CacheLoaderFactory";
import { config } from "./config";
import { damageTracker } from "./game/combat/DamageTracker";
import { createGamemode } from "./game/gamemodes/GamemodeRegistry";
import { NpcManager } from "./game/npcManager";
import { initSpellWidgetMapping } from "./game/spells/SpellDataProvider";
import { GameTicker } from "./game/ticker";
import { WSServer } from "./network/wsServer";
import { serverPath } from "./paths";
import { PathService } from "./pathfinding/PathService";
import { logger } from "./utils/logger";
import { getUpdater } from "./update/Updater";
import { setViewportEnumService } from "./widgets/viewport";
import { ViewportEnumService } from "./widgets/viewport/ViewportEnumService";
import { initCacheEnv } from "./world/CacheEnv";
import { LocTileLookupService, setSharedLocTileLookup } from "./world/LocTileLookupService";
import { MapCollisionService } from "./world/MapCollisionService";

async function main() {
    logger.info(
        `Boot: starting server with tickMs=${config.tickMs}, host=${config.host}, port=${config.port}`,
    );
    const ticker = new GameTicker(config.tickMs);

    // Initialize cache + collision + path services
    logger.info("Boot: initializing cache environment (caches/)...");
    const cacheEnv = initCacheEnv("caches");
    logger.info(`Boot: cache ready (rev=${cacheEnv.info.revision}, name=${cacheEnv.info.name})`);

    // Build full scenes like the editor (models included) so server has parity
    logger.info("Boot: creating map collision service (precomputed=true)...");
    const mapService = new MapCollisionService(cacheEnv, false, {
        precomputedRoot: serverPath("cache", "collision"),
        usePrecomputed: true,
    });
    logger.info("Boot: map collision service ready");
    const pathService = new PathService(mapService);
    setSharedLocTileLookup(new LocTileLookupService(cacheEnv));
    logger.info("Boot: path service ready");

    const cacheFactory = getCacheLoaderFactory(cacheEnv.info, cacheEnv.cacheSystem);
    const npcTypeLoader = cacheFactory.getNpcTypeLoader();
    const basTypeLoader = cacheFactory.getBasTypeLoader();

    logger.info(`Boot: creating gamemode "${config.gamemode}"...`);
    const gamemode = createGamemode(config.gamemode);
    if (gamemode.getLootDistributionConfig) {
        damageTracker.lootConfigResolver = (npcTypeId) =>
            gamemode.getLootDistributionConfig!(npcTypeId);
    }
    logger.info(`Boot: gamemode "${gamemode.name}" created`);

    // Initialize viewport enum service for display mode component mapping
    const enumTypeLoader = cacheFactory.getEnumTypeLoader();
    if (enumTypeLoader) {
        const viewportEnumService = new ViewportEnumService(enumTypeLoader);
        setViewportEnumService(viewportEnumService);
        logger.info("Boot: viewport enum service ready (enum 1745 loaded)");
    } else {
        logger.warn("Boot: viewport enum service unavailable, using hardcoded fallbacks");
    }

    const npcManager = new NpcManager(mapService, pathService, npcTypeLoader, basTypeLoader);
    if (gamemode.shouldLoadDefaultNpcSpawns()) {
        npcManager.loadFromFile(serverPath("data", "npc-spawns.json"));
        logger.info("Boot: NPC manager ready (default spawns loaded)");
    } else {
        logger.info(`Boot: NPC manager ready (default spawns disabled by ${gamemode.id})`);
    }

    logger.info("Boot: constructing WebSocket server...");
    const server = new WSServer({
        host: config.host,
        port: config.port,
        tickMs: config.tickMs,
        ticker,
        pathService,
        mapService,
        npcManager,
        cacheEnv,
        serverName: config.serverName,
        maxPlayers: config.maxPlayers,
        gamemode,
    });
    logger.info("Boot: WebSocket server constructed");

    // The WSServer constructor already calls gamemode.initialize() with proper
    // serverServices (initGamemode → initialize).  A second call with null
    // serverServices would overwrite this.hudServices and break HUD delivery.

    // Register gamemode-specific snapshot encoders (needs WSServer instance)
    if ("registerOverlayEncoder" in gamemode && typeof (gamemode as any).registerOverlayEncoder === "function") {
        (gamemode as any).registerOverlayEncoder(server.registerSnapshotEncoder.bind(server));
    }

    // Initialize spell-widget mappings from cache (must happen after gamemode registers SpellDataProvider)
    logger.info("Boot: initializing spell-widget mappings from cache...");
    initSpellWidgetMapping(cacheEnv.info, cacheEnv.cacheSystem);
    logger.info("Boot: spell-widget mappings initialized");

    // Start the game tick
    ticker.start();
    logger.info("Boot: game ticker started");

    // Check GitHub for a newer release (the main menu offers it).
    getUpdater().start();

    // Graceful shutdown
    let shuttingDown = false;
    const shutdown = (signal: string) => async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info(`Received ${signal}, shutting down...`);
        ticker.stop();
        try {
            await server.flushPlayerSaves();
        } catch (err) {
            logger.warn("Final player save failed", err);
        }
        gamemode.dispose?.();
        // 64 when the player chose Exit Game (wsServer's /exit), so the launcher quits quietly;
        // 65 to install a downloaded update (wsServer's /update/restart, see Launcher.cs).
        process.exit(typeof process.exitCode === "number" ? process.exitCode : 0);
    };
    process.on("SIGINT", shutdown("SIGINT"));
    process.on("SIGTERM", shutdown("SIGTERM"));
}

main().catch((err) => {
    logger.error(err);
    process.exit(1);
});
