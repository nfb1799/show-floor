/**
 * The walkthrough is scripted prose over live arithmetic: the steps say "watch
 * the offer jump" and "watch the multiplier bite". These check that the
 * scripted case still produces those beats, so a change to the value or
 * interest constants fails here rather than making the tutorial lie.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { pitch, toggleSelection, type ShowDeps } from '../show/showEngine';
import { previewPitch } from '../show/showEngine';
import {
  W,
  WALKTHROUGH_BUYERS,
  WALKTHROUGH_QUOTA,
  walkthroughShow,
} from './walkthrough';

const deps = (): ShowDeps => ({
  rng: createRng('walkthrough'),
  upgrades: [],
  conditions: [],
});

function showWith(...cardIds: string[]) {
  const d = deps();
  let state = walkthroughShow(d);
  for (const id of cardIds) state = toggleSelection(state, id);
  return { state, result: previewPitch(state, d)!, deps: d };
}

describe('the scripted case', () => {
  it('seats the collector first and the grader second', () => {
    const state = walkthroughShow(deps());
    expect(state.buyer?.id).toBe(WALKTHROUGH_BUYERS[0]!.id);
    expect(state.queue).toHaveLength(2);
    expect(state.config.buyerCount).toBe(2);
  });

  it('opens with a single card that the collector can actually afford', () => {
    const { result } = showWith(W.lich);
    expect(result.pitchTypeLabel).toBe('Loose Single');
    // The first number the player ever sees should not be a capped one.
    expect(result.cappedByBudget).toBe(false);
  });

  it('pays more for two Grimoire cards than one', () => {
    const one = showWith(W.lich).result.offer;
    const two = showWith(W.lich, W.golem).result;

    expect(two.pitchTypeLabel).toBe('Pair');
    expect(two.offer).toBeGreaterThan(one);
  });

  it('has a third card that turns the Pair into a Set Run', () => {
    const { result } = showWith(W.lich, W.golem, W.bloom);
    expect(result.pitchTypeLabel).toBe('Set Run');
  });

  it('caps the collector, which is the lesson of the second beat', () => {
    const { result } = showWith(W.lich, W.golem);
    expect(result.cappedByBudget).toBe(true);
    expect(result.offer).toBe(WALKTHROUGH_BUYERS[0]!.budget);
  });
});

describe('the grader beat', () => {
  /** Plays through the collector so the grader is the one at the table. */
  function atGrader() {
    const d = deps();
    let state = walkthroughShow(d);
    state = toggleSelection(state, W.lich);
    state = toggleSelection(state, W.golem);
    state = pitch(state, d);
    return { state, deps: d };
  }

  it('seats the grader with the clean and beaten cards still in the case', () => {
    const { state } = atGrader();
    const ids = state.displayCase.map((c) => c.id);

    expect(state.buyer?.id).toBe(WALKTHROUGH_BUYERS[1]!.id);
    expect(ids).toContain(W.dell);
    expect(ids).toContain(W.vance);
    expect(ids).toContain(W.ruiz);
  });

  it('punishes the beaten card with a visible multiplier', () => {
    const { state, deps: d } = atGrader();
    const clean = toggleSelection(toggleSelection(state, W.dell), W.vance);
    const spoiled = toggleSelection(clean, W.ruiz);

    expect(previewPitch(clean, d)!.interestMultLines).toHaveLength(0);
    // The clean pitch has to sit under the wallet, or the penalty lands on a
    // capped number and the player watches nothing happen.
    expect(previewPitch(clean, d)!.cappedByBudget).toBe(false);

    // One beaten raw card, and the whole pitch is worth a quarter.
    expect(previewPitch(spoiled, d)!.interestMultLines).toHaveLength(1);
    // The script says "watch it fall off a cliff", so a shrug is a failure:
    // one beaten card has to cost a quarter of the offer at minimum.
    expect(previewPitch(spoiled, d)!.offer).toBeLessThan(previewPitch(clean, d)!.offer * 0.75);
  });
});

describe('the show as a whole', () => {
  it('clears its quota when both scripted pitches are taken', () => {
    const d = deps();
    let state = walkthroughShow(d);

    state = pitch(toggleSelection(toggleSelection(state, W.lich), W.golem), d);
    state = pitch(toggleSelection(toggleSelection(state, W.dell), W.vance), d);

    expect(state.phase).toBe('over');
    expect(state.outcome).toBe('cleared');
    expect(state.earned).toBeGreaterThanOrEqual(WALKTHROUGH_QUOTA);
  });
});
