/**
 * Tipos do estado do jogo Mbappa.
 * Alinhado à documentação Bonk: Spec=0, FFA=1, Red=2, Blue=3.
 */

export interface Score {
  red: number;
  blue: number;
}

export type TeamSide = "red" | "blue";

export interface TeamNames {
  red: string;
  blue: string;
}

export type GameMode = "casual" | null;

export interface PendingSubstitution {
  losingTeam: TeamSide;
}

export interface SubstitutionState {
  pendingSubstitution: PendingSubstitution | null;
  playersToReplace: Array<{ id: number; username: string }>;
  spectatorsAvailable: Array<{ id: number; username: string }>;
  awaitingSubstitutionAnswer: boolean;
  spectatorAwaitingAnswer: number | null;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  awaitingStartMatchAnswer: boolean;
  substitutionDone: boolean;
}

export interface GameStateData {
  score: Score;
  goalMeta: number | null;
  teamNames: TeamNames;
  teamNamesManual: boolean;
  leaderBefore: TeamSide | null;
  mode: GameMode;
  modeCasualActive: boolean;
  substitution: SubstitutionState;
}
