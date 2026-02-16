import type { GameMode, GameModeId } from './types';
import { mbappa2x2Mode } from './mbappa2x2';
import { mbappa1x1Mode } from './mbappa1x1';
import { classic1x1Mode } from './classic1x1';
import { grapple1x1Mode } from './grapple1x1';
import { deatharrow1x1Mode } from './deatharrow1x1';
import { blclassicMode } from './blclassic';
import { volei1x1Mode } from './volei1x1';
import { barkballMode } from './barkball';
import { blbasketballMode } from './blbasketball';
import { blvolleyballMode } from './blvolleyball';
import { corridacartMode } from './corridacart';

const modes: Record<GameModeId, GameMode> = {
  mbappa1x1: mbappa1x1Mode,
  mbappa2x2: mbappa2x2Mode,
  classic1x1: classic1x1Mode,
  grapple1x1: grapple1x1Mode,
  deatharrow1x1: deatharrow1x1Mode,
  blclassic: blclassicMode,
  volei1x1: volei1x1Mode,
  barkball: barkballMode,
  blbasketball: blbasketballMode,
  blvolleyball: blvolleyballMode,
  corridacart: corridacartMode,
};

export function getMode(id: GameModeId): GameMode {
  const mode = modes[id];
  if (!mode) throw new Error(`Unknown mode: ${id}`);
  return mode;
}

export function getModeOrDefault(id: string | undefined): GameMode {
  const modeId = (id ?? 'mbappa2x2').toLowerCase() as GameModeId;
  if (modeId in modes) return modes[modeId];
  return mbappa2x2Mode;
}

export function getAllModeIds(): GameModeId[] {
  return Object.keys(modes) as GameModeId[];
}

export { mbappa2x2Mode };
export type { GameMode, GameModeId, IRoomForMode } from './types';
export { getGeneralHelpMessage, getDiscordLink } from './common/commands';
