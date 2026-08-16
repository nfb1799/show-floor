/**
 * Where the walkthrough is up to. Separate from the run store on purpose: the
 * game does not know it is being demonstrated, and nothing in `src/game`
 * changes shape because a tour exists.
 */

import { create } from 'zustand';
import { markTutorialSeen } from '../../game/run/persistence';
import { useRun } from '../../state/runStore';
import { TOUR_STEPS } from './steps';

interface TourState {
  active: boolean;
  index: number;
  start: () => void;
  next: () => void;
  back: () => void;
  quit: () => void;
}

export const useTour = create<TourState>((set, get) => ({
  active: false,
  index: 0,

  start: () => {
    markTutorialSeen();
    useRun.getState().startWalkthrough();
    set({ active: true, index: 0 });
  },

  next: () => {
    const last = get().index >= TOUR_STEPS.length - 1;
    if (last) {
      get().quit();
      return;
    }
    set({ index: get().index + 1 });
  },

  /**
   * Only walks back over steps the player has not acted on. Stepping back past
   * a click would leave the script talking about a state the game has already
   * moved on from, so those are one-way.
   */
  back: () => set({ index: Math.max(0, get().index - 1) }),

  quit: () => {
    markTutorialSeen();
    useRun.getState().endWalkthrough();
    set({ active: false, index: 0 });
  },
}));
