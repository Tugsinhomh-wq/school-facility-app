/**
 * The room finder: given a day, a start and a length, which rooms are free, and for those that are not, what is in the
 * way and when the length would fit next. Works on minutes of one day (no imports: node tests load this file directly).
 */

/** One active (pending or approved) booking of a room, as minutes since midnight on the day being looked at. */
export interface Seg {
  id: string;
  roomId: string;
  start: number;
  end: number;
}

export const STEP = 30;

/** The booking that would clash with [start, end) in this room, if any. */
export function clashOf(segs: Seg[], roomId: string, start: number, end: number): Seg | undefined {
  return segs.find((s) => s.roomId === roomId && s.start < end && s.end > start);
}

/** The earliest half-hour start at or after `from` where `length` minutes fit before `close`, or null. */
export function nextFit(segs: Seg[], roomId: string, from: number, length: number, close: number): number | null {
  for (let m = Math.ceil(from / STEP) * STEP; m + length <= close; m += STEP) {
    if (!clashOf(segs, roomId, m, m + length)) return m;
  }
  return null;
}

export interface BusyRoom {
  roomId: string;
  clash: Seg;
  /** When the same length would fit in this room, if it ever does today. */
  fit: number | null;
}

/** Splits the rooms into those free for [start, start + length) and those that are not. Input order is kept. */
export function splitRooms(
  roomIds: string[],
  segs: Seg[],
  start: number,
  length: number,
  close: number,
): { free: string[]; busy: BusyRoom[] } {
  const free: string[] = [];
  const busy: BusyRoom[] = [];
  for (const roomId of roomIds) {
    const clash = clashOf(segs, roomId, start, start + length);
    if (clash) busy.push({ roomId, clash, fit: nextFit(segs, roomId, start, length, close) });
    else free.push(roomId);
  }
  return { free, busy };
}

/** The earliest start any room can take `length` minutes, with that room, for when nothing is free at the asked time. */
export function earliestFit(busy: BusyRoom[]): { roomId: string; start: number } | null {
  let best: { roomId: string; start: number } | null = null;
  for (const b of busy) if (b.fit !== null && (best === null || b.fit < best.start)) best = { roomId: b.roomId, start: b.fit };
  return best;
}
