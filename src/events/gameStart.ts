import bot from "../bot";

type RoomLike = {
    roundStartTime?: number;
    map?: unknown;
    state?: unknown;
    inGame?: boolean;
    gt?: number;
    rounds?: number;
    wl?: number;
    quickplay?: boolean;
    teamsLocked?: boolean;
    teams?: boolean;
    engine?: string;
    mode?: string;
};

/** Log detalhado do GAME_START para comparar humano (host) vs bot. */
function logGameStartDetail(room: RoomLike | undefined) {
    if (!room) {
        console.log("[GAME_START] room indisponível");
        return;
    }
    const map = room.map;
    const mapType = map === null || map === undefined ? "null/undefined" : typeof map;
    const mapPreview =
        typeof map === "string"
            ? `string length=${map.length} prefix="${map.slice(0, 60)}..."`
            : mapType === "object" && map !== null && !Array.isArray(map)
              ? `object keys=[${Object.keys(map as object).join(", ")}]`
              : String(mapType);
    if (typeof map === "string" && map.length > 0) {
        console.log("[GAME_START] map LZ (copiar para DEFAULT_LZ_MAP em constants.types.ts):", map);
    }
    const state = room.state as Record<string, unknown> | undefined;
    console.log("---------- [GAME_START] ----------");
    console.log("[GAME_START] roundStartTime:", room.roundStartTime);
    console.log("[GAME_START] inGame:", room.inGame);
    console.log("[GAME_START] map:", mapPreview);
    console.log("[GAME_START] gt:", room.gt ?? state?.gt);
    console.log("[GAME_START] rounds/wl:", room.rounds ?? room.wl ?? state?.wl);
    console.log("[GAME_START] state.ga (engine):", state?.ga);
    console.log("[GAME_START] state.mo (mode):", state?.mo);
    if (state && typeof state.map !== "undefined") {
        const sm = state.map;
        console.log("[GAME_START] state.map type:", typeof sm, typeof sm === "string" ? `len=${(sm as string).length}` : "");
    }
    console.log("----------------------------------");
}

export default function gameStart(botInstance: typeof bot) {
    botInstance.events.on("GAME_START", () => {
        const room = (botInstance as unknown as { room?: RoomLike }).room;
        console.log("GAME_START event received!");
        logGameStartDetail(room);
    });
}