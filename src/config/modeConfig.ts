/**
 * Configuração central de todos os modos.
 * Para adicionar um novo modo: inclua aqui e implemente em src/modes/<id>/.
 */

export type FlowType = '2v2-sub' | '1v1-pick' | 'hybrid' | 'ffa';

export type BonkGameMode = 'b' | 'bs' | 'ar' | 'ard' | 'sp' | 'v' | 'f';

export interface ModeConfigEntry {
  id: string;
  name: string;
  /** ID do mapa em config/maps.json (para referência) */
  mapId: number;
  /**
   * Posição do mapa na lista de favoritos do Bonk.io (0 = primeiro, 1 = segundo, ...).
   * O mapa carregado na sala será o que está nessa posição nos seus favoritos.
   * Ajuste conforme a ordem dos seus mapas favoritos no jogo.
   */
  favoriteIndex: number;
  /** Modo do jogo no Bonk.io: b=barkball, v=volleyball, f=football, ar=arrow, ard=death arrow, sp=grapple */
  gameMode: BonkGameMode;
  rounds: number;
  teams: boolean;
  flowType: FlowType;
  /** Nome da variável de ambiente para o nome da sala, ex: ROOM_NAME_MBAPPA_1X1 */
  roomNameEnvKey: string;
}

/** Ordem dos seus favoritos (0=1º, 1=2º, …): Cart, BL Volleyball, BL Basketball, Barkball, Volei 1x1, BL Classic, Death Arrow, Grapple, Classic 1x1, Mbappa. */
export const MODE_CONFIGS: ModeConfigEntry[] = [
  { id: 'mbappa1x1', name: 'Mbappa 1x1', mapId: 1345744, favoriteIndex: 9, gameMode: 'b', rounds: 5, teams: true, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_MBAPPA_1X1' },
  { id: 'mbappa2x2', name: 'Mbappa 2x2', mapId: 1345744, favoriteIndex: 9, gameMode: 'b', rounds: 5, teams: true, flowType: '2v2-sub', roomNameEnvKey: 'ROOM_NAME_MBAPPA_2X2' },
  { id: 'classic1x1', name: 'Classic 1x1', mapId: 123, favoriteIndex: 8, gameMode: 'b', rounds: 3, teams: false, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_CLASSIC_1X1' },
  { id: 'grapple1x1', name: 'Grapple 1v1', mapId: 225844, favoriteIndex: 7, gameMode: 'sp', rounds: 3, teams: false, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_GRAPPLE_1X1' },
  { id: 'deatharrow1x1', name: 'Death Arrow 1v1', mapId: 1071270, favoriteIndex: 6, gameMode: 'ard', rounds: 3, teams: false, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_DEATHARROW_1X1' },
  { id: 'blclassic', name: 'BL Classic', mapId: 594396, favoriteIndex: 5, gameMode: 'b', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BL_CLASSIC' },
  { id: 'volei1x1', name: 'Vôlei de rua 1x1', mapId: 848488, favoriteIndex: 4, gameMode: 'v', rounds: 5, teams: true, flowType: '1v1-pick', roomNameEnvKey: 'ROOM_NAME_VOLEI_1X1' },
  { id: 'barkball', name: 'Barkball', mapId: 1139002, favoriteIndex: 3, gameMode: 'b', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BARKBALL' },
  { id: 'blbasketball', name: 'BL Basketball', mapId: 863406, favoriteIndex: 2, gameMode: 'b', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BL_BASKETBALL' },
  { id: 'blvolleyball', name: 'BL Volleyball', mapId: 908951, favoriteIndex: 1, gameMode: 'v', rounds: 5, teams: true, flowType: 'hybrid', roomNameEnvKey: 'ROOM_NAME_BL_VOLLEYBALL' },
  { id: 'corridacart', name: 'Corrida de Cart', mapId: 1176992, favoriteIndex: 0, gameMode: 'f', rounds: 5, teams: false, flowType: 'ffa', roomNameEnvKey: 'ROOM_NAME_CORRIDA_CART' },
];

const byId = new Map<string, ModeConfigEntry>();
for (const c of MODE_CONFIGS) byId.set(c.id, c);

export function getModeConfig(modeId: string): ModeConfigEntry | undefined {
  return byId.get(modeId.toLowerCase());
}

export function getRoomNameEnvKey(modeId: string): string {
  return getModeConfig(modeId)?.roomNameEnvKey ?? 'ROOM_NAME';
}

/** Índice do mapa na lista de favoritos do Bonk.io para o modo (0-based). */
export function getFavoriteIndexForMode(modeId: string): number {
  const config = getModeConfig(modeId);
  return config?.favoriteIndex ?? 0;
}
