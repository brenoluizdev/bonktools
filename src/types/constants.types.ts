/** Timeout para resposta do espectador na substituição (ms). API Bonk / Mbappa. */
export const SUBSTITUTION_TIMEOUT_MS = 15_000;

/** Ativar logs detalhados de investigação para Trigger Start / GAME_START. Ver docs/investigation/TRIGGER_START_GAME_START.md */
export const INVESTIGATION_TRIGGER_START = process.env.INVESTIGATION === "1";

/** API Bonk - tipos de mensagem cliente (outgoing). Payload conforme doc: 42[type, payload]. */
export const CLIENT_MESSAGE_TYPES_NUM = {
  KICK_BAN_PLAYER: 9,
  CHANGE_OTHER_TEAM: 26,
  TRIGGER_START: 5,
  SEND_START_COUNTDOWN: 36,
  SET_READY: 16,
  ALL_READY_RESET: 17,
  SEND_HOST_CHANGE: 34,
} as const;

export const SERVER_MESSAGE_TYPES = {
    PLAYER_PINGS: 1,
    ROOM_ADDRESS: 2,
    JOIN_ROOM: 3,
    PLAYER_JOIN: 4,
    PLAYER_LEAVE: 5,
    HOST_LEAVE: 6,
    PLAYER_INPUT: 7,
    READY_CHANGE: 8,
    GAME_END: 13,
    GAME_START: 15,
    STATUS_MESSAGE: 16,
    TEAM_CHANGE: 18,
    TEAMLOCK_TOGGLE: 19,
    CHAT_MESSAGE: 20,
    INITIAL_DATA: 21,
    TIMESYNC: 23,
    PLAYER_KICK: 24,
    MAP_REORDER: 25,
    GAMEMODE_CHANGE: 26,
    CHANGE_ROUNDS: 27,
    MAP_SWITCH: 29,
    TYPING: 30,
    AFK_WARNING: 32,
    MAP_SUGGEST: 33,
    MAP_SUGGEST2: 34,
    BALANCE_SET: 36,
    DEBUG_WINNER: 38,
    SAVE_REPLAY: 40,
    HOST_TRANSFER: 41,
    FRIEND_REQUEST: 42,
    COUNTDOWN: 43,
    ABORT_COUNTDOWN: 44,
    PLAYER_LEVEL_UP: 45,
    LOCAL_GAINED_XP: 46,
    STATE: 48,
    ROOM_SHARE_LINK: 49,
    PLAYER_TABBED: 52,
    CURATE_RESULT: 57,
    ROOM_NAME_UPDATE: 58,
    ROOM_PASSWORD_UPDATE: 59,
};