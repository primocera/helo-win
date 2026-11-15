// How Helo sets up the work map (see shared/map/README.md for where the map comes from).
import { setupFrom } from './map/setup';
import type { Board } from './map/types';

/** One setup for both sides: the main process classifies tool calls with it, the island draws with it. */
export const MAP_SETUP = setupFrom({ memoryServers: 'memory', theme: 'dark', background: 'transparent' });

/** What the island shows on the map tab: the board of the session that last had something going on. */
export interface WorkMapState {
  board: Board;
  /** The folder name of that session. */
  project: string;
}

export const EMPTY_BOARD: Board = { entries: [], counts: {} };
