// Focus/Break timer. Pure functions over TimerState so the logic is testable;
// the main process calls tick() once a second while a phase is running.
import type { TimerPhase, TimerState } from '../shared/types';

const MIN = 60_000;

export function phaseLength(state: Pick<TimerState, 'focusMin' | 'breakMin' | 'longBreakMin' | 'longBreak'>, phase: TimerPhase): number {
  return (phase === 'focus' ? state.focusMin : state.longBreak ? state.longBreakMin : state.breakMin) * MIN;
}

export function initialTimer(focusMin = 25, breakMin = 5, longBreakMin = 15, longEvery = 4): TimerState {
  return { phase: 'focus', running: false, endsAt: null, remainingMs: focusMin * MIN, focusMin, breakMin, longBreakMin, longEvery, longBreak: false, completedFocus: 0 };
}

/** Whether the break after `completed` finished focus sessions is the long one. */
export function isLongBreak(completed: number, longEvery: number): boolean {
  return longEvery > 0 && completed > 0 && completed % longEvery === 0;
}

export function remaining(state: TimerState, now: number): number {
  return state.running && state.endsAt != null ? Math.max(0, state.endsAt - now) : state.remainingMs;
}

export function start(state: TimerState, now: number): TimerState {
  if (state.running) return state;
  const left = state.remainingMs > 0 ? state.remainingMs : phaseLength(state, state.phase);
  return { ...state, running: true, endsAt: now + left, remainingMs: left };
}

export function pause(state: TimerState, now: number): TimerState {
  if (!state.running) return state;
  return { ...state, running: false, endsAt: null, remainingMs: remaining(state, now) };
}

export function reset(state: TimerState): TimerState {
  return { ...state, phase: 'focus', running: false, endsAt: null, longBreak: false, remainingMs: phaseLength(state, 'focus') };
}

/** Ends the current phase now and moves to the next one (not started). A skipped focus session earns a short break. */
export function skip(state: TimerState): TimerState {
  const next: TimerPhase = state.phase === 'focus' ? 'break' : 'focus';
  const moved = { ...state, phase: next, running: false, endsAt: null, longBreak: false };
  return { ...moved, remainingMs: phaseLength(moved, next) };
}

/** New lengths from settings. A stopped timer picks them up right away. */
export function configure(state: TimerState, focusMin: number, breakMin: number, longBreakMin = state.longBreakMin, longEvery = state.longEvery): TimerState {
  const next = { ...state, focusMin, breakMin, longBreakMin, longEvery };
  if (!state.running) next.remainingMs = phaseLength(next, state.phase);
  return next;
}

/**
 * Advances time. When the running phase is over, switches to the other phase
 * and starts it automatically, and reports which phase finished.
 */
export function tick(state: TimerState, now: number): { state: TimerState; finished: TimerPhase | null } {
  if (!state.running || state.endsAt == null || now < state.endsAt) return { state, finished: null };
  const finished = state.phase;
  const next: TimerPhase = finished === 'focus' ? 'break' : 'focus';
  const completedFocus = state.completedFocus + (finished === 'focus' ? 1 : 0);
  // Every few focus sessions the break is the long one.
  const longBreak = next === 'break' && isLongBreak(completedFocus, state.longEvery);
  const length = phaseLength({ ...state, longBreak }, next);
  return {
    finished,
    state: {
      ...state,
      phase: next,
      running: true,
      endsAt: now + length,
      remainingMs: length,
      longBreak,
      completedFocus,
    },
  };
}
