import { RoomMaker, RoomParameters, RoomCreationResult } from "../browser/roomMaker";
export { RoomMaker, RoomParameters, RoomCreationResult } from "../browser/roomMaker";
export { createBot, LOG_LEVELS } from "bonktools";

export async function startRoom(params: RoomParameters): Promise<RoomCreationResult> {
  const maker = new RoomMaker();
  await maker.init();
  return maker.createRoom(params);
}
