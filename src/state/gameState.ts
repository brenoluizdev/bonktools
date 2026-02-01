/**
 * Estado único do jogo Mbappa (placar, meta, nomes, modo casual, substituição).
 * Tudo tipado em TypeScript para evitar variáveis soltas.
 */

import {
  type Score,
  type TeamSide,
  type TeamNames,
  type GameMode,
  type SubstitutionState,
} from "../types/gameState.types";
import { SUBSTITUTION_TIMEOUT_MS } from "../types/constants.types";

const DEFAULT_TEAM_NAMES: TeamNames = { red: "Vermelho", blue: "Azul" };

const initialState = {
  score: { red: 0, blue: 0 } as Score,
  goalMeta: null as number | null,
  teamNames: { ...DEFAULT_TEAM_NAMES },
  teamNamesManual: false,
  leaderBefore: null as TeamSide | null,
  mode: null as GameMode,
  modeCasualActive: false,
  substitution: {
    pendingSubstitution: null,
    playersToReplace: [],
    spectatorsAvailable: [],
    awaitingSubstitutionAnswer: false,
    spectatorAwaitingAnswer: null as number | null,
    timeoutHandle: null as ReturnType<typeof setTimeout> | null,
    awaitingStartMatchAnswer: false,
    substitutionDone: false,
  } as SubstitutionState,
};

let state = { ...initialState };

function cloneState() {
  return {
    score: { ...state.score },
    goalMeta: state.goalMeta,
    teamNames: { ...state.teamNames },
    teamNamesManual: state.teamNamesManual,
    leaderBefore: state.leaderBefore,
    mode: state.mode,
    modeCasualActive: state.modeCasualActive,
    substitution: {
      ...state.substitution,
      pendingSubstitution: state.substitution.pendingSubstitution
        ? { ...state.substitution.pendingSubstitution }
        : null,
      playersToReplace: [...state.substitution.playersToReplace],
      spectatorsAvailable: [...state.substitution.spectatorsAvailable],
    },
  };
}

// --- Score ---
export function getScore(): Score {
  return { ...state.score };
}

export function setScore(score: Score): void {
  state = { ...state, score: { ...score } };
}

export function incrementGoal(team: TeamSide): void {
  state = {
    ...state,
    score: {
      ...state.score,
      [team]: state.score[team] + 1,
    },
  };
}

// --- Goal meta ---
export function getGoalMeta(): number | null {
  return state.goalMeta;
}

export function setGoalMeta(meta: number | null): void {
  state = { ...state, goalMeta: meta };
}

// --- Team names ---
export function getTeamNames(): TeamNames {
  return { ...state.teamNames };
}

export function setTeamNames(names: TeamNames): void {
  state = {
    ...state,
    teamNames: { ...names },
    teamNamesManual: true,
  };
}

export function isTeamNamesManual(): boolean {
  return state.teamNamesManual;
}

export function setTeamNamesManual(value: boolean): void {
  state = { ...state, teamNamesManual: value };
}

/** Atualiza nomes dos times sem marcar como manual (ex.: X1). */
export function updateTeamNamesAuto(names: TeamNames): void {
  if (state.teamNamesManual) return;
  state = { ...state, teamNames: { ...names } };
}

// --- Leader (virada) ---
export function getLeaderBefore(): TeamSide | null {
  return state.leaderBefore;
}

export function setLeaderBefore(leader: TeamSide | null): void {
  state = { ...state, leaderBefore: leader };
}

/** Retorna o time que está liderando pelo placar atual. */
export function getCurrentLeader(): TeamSide | null {
  if (state.score.red > state.score.blue) return "red";
  if (state.score.blue > state.score.red) return "blue";
  return null;
}

// --- Mode ---
export function getMode(): GameMode {
  return state.mode;
}

export function setMode(mode: GameMode): void {
  state = { ...state, mode };
}

export function isModeCasualActive(): boolean {
  return state.modeCasualActive;
}

export function setModeCasualActive(active: boolean): void {
  state = { ...state, modeCasualActive: active };
}

// --- Substitution ---
export function getSubstitutionState(): SubstitutionState {
  return cloneState().substitution;
}

export function setPendingSubstitution(losingTeam: TeamSide | null): void {
  state = {
    ...state,
    substitution: {
      ...state.substitution,
      pendingSubstitution: losingTeam ? { losingTeam } : null,
    },
  };
}

export function setPlayersToReplace(
  players: Array<{ id: number; username: string }>
): void {
  state = {
    ...state,
    substitution: { ...state.substitution, playersToReplace: players },
  };
}

export function setSpectatorsAvailable(
  spectators: Array<{ id: number; username: string }>
): void {
  state = {
    ...state,
    substitution: { ...state.substitution, spectatorsAvailable: spectators },
  };
}

export function setAwaitingSubstitutionAnswer(value: boolean): void {
  state = {
    ...state,
    substitution: { ...state.substitution, awaitingSubstitutionAnswer: value },
  };
}

export function setSpectatorAwaitingAnswer(id: number | null): void {
  state = {
    ...state,
    substitution: { ...state.substitution, spectatorAwaitingAnswer: id },
  };
}

export function setSubstitutionTimeoutHandle(
  handle: ReturnType<typeof setTimeout> | null
): void {
  state = {
    ...state,
    substitution: { ...state.substitution, timeoutHandle: handle },
  };
}

export function setAwaitingStartMatchAnswer(value: boolean): void {
  state = {
    ...state,
    substitution: { ...state.substitution, awaitingStartMatchAnswer: value },
  };
}

export function setSubstitutionDone(value: boolean): void {
  state = {
    ...state,
    substitution: { ...state.substitution, substitutionDone: value },
  };
}

export function resetSubstitutionState(): void {
  if (state.substitution.timeoutHandle) {
    clearTimeout(state.substitution.timeoutHandle);
  }
  state = {
    ...state,
    substitution: {
      pendingSubstitution: null,
      playersToReplace: [],
      spectatorsAvailable: [],
      awaitingSubstitutionAnswer: false,
      spectatorAwaitingAnswer: null,
      timeoutHandle: null,
      awaitingStartMatchAnswer: false,
      substitutionDone: false,
    },
  };
}

export { SUBSTITUTION_TIMEOUT_MS };
