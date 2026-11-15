// Focus/Break timer. Pure functions over TimerState so the logic is testable;
// the main process calls tick() once a second while a phase is running.
import type { TimerPhase, TimerState } from '../shared/types';

const MIN = 60_000;

export function phaseLength(state: Pick<TimerState, 'focusMin' | 'breakMin'>, phase: TimerPhase): number {
  return (phase === 'focus' ? state.focusMin : state.breakMin) * MIN;
}

export function initialTimer(focusMin = 25, breakMin = 5): TimerState {
  return { phase: 'focus', running: false, endsAt: null, remainingMs: focusMin * MIN, focusMin, breakMin, completedFocus: 0 };
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
  return { ...state, phase: 'focus', running: false, endsAt: null, remainingMs: phaseLength(state, 'focus') };
}

/** Ends the current phase now and moves to the next one (not started). */
export function skip(state: TimerState): TimerState {
  const next: TimerPhase = state.phase === 'focus' ? 'break' : 'focus';
  return { ...state, phase: next, running: false, endsAt: null, remainingMs: phaseLength(state, next) };
}

/** New lengths from settings. A stopped timer picks them up right away. */
export function configure(state: TimerState, focusMin: number, breakMin: number): TimerState {
  const next = { ...state, focusMin, breakMin };
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
  const length = phaseLength(state, next);
  return {
    finished,
    state: {
      ...state,
      phase: next,
      running: true,
      endsAt: now + length,
      remainingMs: length,
      completedFocus: state.completedFocus + (finished === 'focus' ? 1 : 0),
    },
  };
}
