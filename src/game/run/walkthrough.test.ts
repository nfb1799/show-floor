/**
 * The walkthrough is scripted prose over live arithmetic: the steps say "watch
 * the offer jump" and "watch the multiplier bite". These check that the
 * scripted case still produces those beats, so a change to the value or
 * interest constants fails here rather than making the tutorial lie.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import {
  digFromStock,
  pitch,
  previewPitch,
  toggleSelection,
  type ShowDeps,
  type ShowState,
} from '../show/showEngine';
import {
  W,
  WALKTHROUGH_BUYERS,
  WALKTHROUGH_OFFERS,
  WALKTHROUGH_QUOTA,
  walkthroughShow,
} from './walkthrough';
import { TOUR_STEPS } from '../../ui/tour/steps';

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

describe('the quoted figures', () => {
  // The script used to hand-author these ("$59 to $210"), so every rebalance
  // silently rewrote the tutorial: the words held still while the game moved.
  // They are read off resolvePitch now, and these check the reading matches
  // what the player will actually be looking at when the step appears.
  it('quotes what the first beat really pays', () => {
    expect(WALKTHROUGH_OFFERS.single).toBe(showWith(W.lich).result.offer);
    expect(WALKTHROUGH_OFFERS.pair).toBe(showWith(W.lich, W.golem).result.offer);
  });

  it('quotes what the refusal really costs', () => {
    const clean = showWith(W.dell, W.vance);
    const refused = showWith(W.dell, W.vance, W.slab);

    // The grader is buyer two, so the quotes have to be scored against them
    // rather than against whoever happens to be at the table.
    expect(WALKTHROUGH_OFFERS.clean).toBe(
      previewPitch({ ...clean.state, buyer: WALKTHROUGH_BUYERS[1]! }, clean.deps)!.offer,
    );
    expect(WALKTHROUGH_OFFERS.refused).toBe(
      previewPitch({ ...refused.state, buyer: WALKTHROUGH_BUYERS[1]! }, refused.deps)!.offer,
    );
  });

  it('renders every scripted step as readable text', () => {
    // The figures are interpolated now, so a broken import or a renamed key
    // would reach the player as "$NaN to $NaN" rather than as a type error.
    for (const step of TOUR_STEPS) {
      expect(step.title, step.id).not.toMatch(/NaN|undefined|\[object/);
      expect(step.text, step.id).not.toMatch(/NaN|undefined|\[object/);
      expect(step.title.length, step.id).toBeGreaterThan(0);
    }
  });

  it('still shows a fall worth writing a step about', () => {
    expect(WALKTHROUGH_OFFERS.refused).toBeLessThan(WALKTHROUGH_OFFERS.clean / 2);
    expect(WALKTHROUGH_OFFERS.pair).toBeGreaterThan(WALKTHROUGH_OFFERS.single * 2);
  });
});

describe('the scripted case', () => {
  it('seats the collector first, ahead of the grader and the set builder', () => {
    const state = walkthroughShow(deps());
    expect(state.buyer?.id).toBe(WALKTHROUGH_BUYERS[0]!.id);
    expect(state.queue).toHaveLength(3);
    expect(state.config.buyerCount).toBe(3);
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
    const budget = WALKTHROUGH_BUYERS[0]!.budget;

    expect(result.cappedByBudget).toBe(true);
    // The step says they stretch past their wallet, but only a little. Both
    // halves of that have to stay true or the beat teaches the wrong rule.
    expect(result.offer).toBeGreaterThan(budget);
    expect(result.offer).toBeLessThan(result.uncappedOffer);
  });
});

describe('the dig beat', () => {
  /** Plays the scripted first two sales, leaving the set builder at the table. */
  function atSetBuilder(): { state: ShowState; deps: ShowDeps } {
    const d = deps();
    let state = walkthroughShow(d);
    state = pitch(toggleSelection(toggleSelection(state, W.lich), W.golem), d);
    state = pitch(toggleSelection(toggleSelection(state, W.dell), W.vance), d);
    return { state, deps: d };
  }

  it('seats a buyer nothing in the case can satisfy', () => {
    const { state, deps: d } = atSetBuilder();

    expect(state.buyer?.id).toBe(WALKTHROUGH_BUYERS[2]!.id);
    // The whole point of the step: no pitch from the case earns the want.
    for (const card of state.displayCase) {
      const only = toggleSelection(state, card.id);
      expect(previewPitch(only, d)!.interestAddLines, card.id).toHaveLength(0);
    }
  });

  it('keeps the card they want out of the case until it is dug for', () => {
    // Refills draw at random from stock, so this is a real risk rather than a
    // formality: if the run ever hands the Origin card over for free, the dig
    // step has nothing left to teach.
    const { state } = atSetBuilder();
    expect(state.displayCase.map((c) => c.id)).not.toContain(W.origin);
    expect(state.inventory.map((c) => c.id)).toContain(W.origin);
  });

  it('pays for the dug card once it is on the table', () => {
    const { state, deps: d } = atSetBuilder();
    const spare = state.displayCase.find((c) => c.id !== W.origin)!;
    const dug = digFromStock(state, spare.id, W.origin);

    expect(dug.goodwill).toBe(state.goodwill - 1);
    expect(dug.selection).toContain(W.origin);

    const result = previewPitch(dug, d)!;
    expect(result.interestAddLines.length).toBeGreaterThan(0);
    expect(result.offer).toBeGreaterThan(100);
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

  it('refuses a slab rather than a beaten card', () => {
    const { state, deps: d } = atGrader();
    const clean = toggleSelection(toggleSelection(state, W.dell), W.vance);
    const spoiled = toggleSelection(clean, W.slab);

    expect(previewPitch(clean, d)!.interestMultLines).toHaveLength(0);
    // The clean pitch has to sit under the wallet, or the refusal lands on a
    // capped number and the player watches nothing happen.
    expect(previewPitch(clean, d)!.cappedByBudget).toBe(false);

    // One graded card, and the whole pitch is worth a quarter.
    expect(previewPitch(spoiled, d)!.interestMultLines).toHaveLength(1);
    expect(previewPitch(spoiled, d)!.offer).toBeLessThan(previewPitch(clean, d)!.offer * 0.75);
  });

  it('lets a beaten raw card earn nothing without punishing the pitch', () => {
    // A grader buys to submit, so a Played card is simply not what they came
    // for. It used to quarter the pitch, which read as a trap rather than a
    // preference — and the chip describing it said "Any slab" regardless.
    const { state, deps: d } = atGrader();
    const clean = toggleSelection(toggleSelection(state, W.dell), W.vance);
    const withBeaten = toggleSelection(clean, W.ruiz);

    expect(previewPitch(withBeaten, d)!.interestMultLines).toHaveLength(0);
    expect(previewPitch(withBeaten, d)!.offer).toBeGreaterThan(
      previewPitch(clean, d)!.offer * 0.9,
    );
  });
});

describe('the show as a whole', () => {
  it('clears its quota when all three scripted pitches are taken', () => {
    const d = deps();
    let state = walkthroughShow(d);

    state = pitch(toggleSelection(toggleSelection(state, W.lich), W.golem), d);
    state = pitch(toggleSelection(toggleSelection(state, W.dell), W.vance), d);

    const spare = state.displayCase.find((c) => c.id !== W.origin)!;
    state = pitch(digFromStock(state, spare.id, W.origin), d);

    expect(state.phase).toBe('over');
    expect(state.outcome).toBe('cleared');
    expect(state.earned).toBeGreaterThanOrEqual(WALKTHROUGH_QUOTA);
  });
});

describe('the cards the shop leg points at', () => {
  it('leaves the graded-in-the-tutorial card unsold and raw', () => {
    // The script tells the player to grade Gravebloom by name, so it has to
    // still be theirs, and still raw, when the shop opens.
    const d = deps();
    let state = walkthroughShow(d);
    state = pitch(toggleSelection(toggleSelection(state, W.lich), W.golem), d);
    state = pitch(toggleSelection(toggleSelection(state, W.dell), W.vance), d);

    const spare = state.displayCase.find((c) => c.id !== W.origin)!;
    state = pitch(digFromStock(state, spare.id, W.origin), d);

    const owned = [...state.inventory, ...state.displayCase];
    const bloom = owned.find((c) => c.id === W.bloom);

    expect(bloom, 'Gravebloom was sold or lost').toBeDefined();
    expect(bloom!.slabbed).toBe(false);
  });

  it('sends the Bramblepup back to stock, where the dig step says it went', () => {
    const d = deps();
    let state = walkthroughShow(d);
    state = pitch(toggleSelection(toggleSelection(state, W.lich), W.golem), d);
    state = pitch(toggleSelection(toggleSelection(state, W.dell), W.vance), d);
    state = digFromStock(state, W.pup, W.origin);

    expect(state.inventory.map((c) => c.id)).toContain(W.pup);
    expect(state.displayCase[0]!.id).toBe(W.origin);
    expect(state.selection).toContain(W.origin);
  });
});
