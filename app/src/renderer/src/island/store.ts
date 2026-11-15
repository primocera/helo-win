import { useEffect, useReducer, useState } from 'react';
import type { IslandState } from '../../../shared/types';

/** Island state as pushed by the main process (patches merged in order). */
export function useIslandState(): IslandState | null {
  const [state, merge] = useReducer(
    (prev: IslandState | null, patch: Partial<IslandState>) => ({ ...(prev ?? ({} as IslandState)), ...patch }) as IslandState,
    null,
  );
  useEffect(() => {
    const off = window.helo.onState(merge);
    window.helo.ready();
    return off;
  }, []);
  return state && state.ready ? state : null;
}

/** Re-renders every `ms` while `active` (for countdowns and playback position). */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}
