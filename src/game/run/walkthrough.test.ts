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
  WALKTHROUGH_PATIENCE,
  WALKTHROUGH_QUOTA,
  walkthroughShow,
} from './walkthrough';
import { TOUR_STEPS } from '../../ui/tour/steps';

const COLLECTOR = WALKTHROUGH_BUYERS[0]!.id;
const GRADER = WALKTHROUGH_BUYERS[1]!.id;
const BUILDER = WALKTHROUGH_BUYERS[2]!.id;

const deps = (): ShowDeps => ({
  rng: createRng('walkthrough'),
  upgrades: [],
  conditions: [],
});

function select(state: ShowState, ...cardIds: string[]): ShowState {
  let next = state;
  for (const id of cardIds) next = toggleSelection(next, id);
  return next;
}

/** The opening table with some cards picked, priced for one of the buyers. */
function showWith(buyerId: string, ...cardIds: string[]) {
  const d = deps();
  const state = select(walkthroughShow(d), ...cardIds);
  return { state, result: previewPitch(state, d, buyerId)!, deps: d };
}

/** The scripted first sale: the Pair, to the collector. */
function afterCollector(): { state: ShowState; deps: ShowDeps } {
  const d = deps();
  const state = pitch(select(walkthroughShow(d), W.lich, W.golem), d, COLLECTOR);
  return { state, deps: d };
}

/** The scripted first two sales, leaving only the set builder. */
function afterGrader(): { state: ShowState; deps: ShowDeps } {
  const { state, deps: d } = afterCollector();
  return { state: pitch(select(state, W.dell, W.vance), d, GRADER), deps: d };
}

describe('the quoted figures', () => {
  // The script used to hand-author these ("$59 to $210"), so every rebalance
  // silently rewrote the tutorial: the words held still while the game moved.
  // They are read off resolvePitch now, and these check the reading matches
  // what the player will actually be looking at when the step appears.
  it('quotes what the first beat really pays', () => {
    expect(WALKTHROUGH_OFFERS.single).toBe(showWith(COLLECTOR, W.lich).result.offer);
    expect(WALKTHROUGH_OFFERS.pair).toBe(showWith(COLLECTOR, W.lich, W.golem).result.offer);
  });

  it('quotes what the refusal really costs, at the Buzz the collector left behind', () => {
    const { state, deps: d } = afterCollector();

    expect(WALKTHROUGH_OFFERS.clean).toBe(
      previewPitch(select(state, W.dell, W.vance), d, GRADER)!.offer,
    );
    expect(WALKTHROUGH_OFFERS.refused).toBe(
      previewPitch(select(state, W.dell, W.vance, W.slab), d, GRADER)!.offer,
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

  it('never reaches for gambling words', () => {
    for (const step of TOUR_STEPS) {
      expect(`${step.title} ${step.text}`, step.id).not.toMatch(/\b(gambl\w*|bets?|betting|wager\w*|odds)\b/i);
    }
  });

  it('still shows a fall worth writing a step about', () => {
    expect(WALKTHROUGH_OFFERS.refused).toBeLessThan(WALKTHROUGH_OFFERS.clean / 2);
    expect(WALKTHROUGH_OFFERS.pair).toBeGreaterThan(WALKTHROUGH_OFFERS.single * 2);
  });
});

describe('the scripted table', () => {
  it('puts all three buyers at the table at once, with nobody in line', () => {
    const state = walkthroughShow(deps());

    expect(state.seats.map((s) => s.buyer.id)).toEqual([COLLECTOR, GRADER, BUILDER]);
    expect(state.config.buyerCount).toBe(3);
    expect(state.queueIndex).toBe(3);
    expect(state.buzz).toBe(0);
  });

  it('gives everyone the patience to last the script', () => {
    // Two sales happen before the set builder is served. Anything less and
    // they walk in the middle of the lesson about not letting people walk.
    expect(WALKTHROUGH_PATIENCE).toBeGreaterThan(2);
    const { state } = afterGrader();
    expect(state.seats.map((s) => s.buyer.id)).toEqual([BUILDER]);
    expect(state.stats.buyersWalked).toBe(0);
  });

  it('opens with a single card that the collector can actually afford', () => {
    const { result } = showWith(COLLECTOR, W.lich);
    expect(result.pitchTypeLabel).toBe('Loose Single');
    // The first number the player ever sees should not be a capped one.
    expect(result.cappedByBudget).toBe(false);
  });

  it('prices that one card higher for the collector than for anyone else', () => {
    // "The collector wants it; the other two shrug."
    const collector = showWith(COLLECTOR, W.lich).result;
    expect(collector.pleased).toBe(true);
    for (const other of [GRADER, BUILDER]) {
      expect(showWith(other, W.lich).result.offer, other).toBeLessThan(collector.offer);
    }
  });

  it('pays more for two Grimoire cards than one', () => {
    const one = showWith(COLLECTOR, W.lich).result.offer;
    const two = showWith(COLLECTOR, W.lich, W.golem).result;

    expect(two.pitchTypeLabel).toBe('Pair');
    expect(two.offer).toBeGreaterThan(one);
  });

  it('has a third card that turns the Pair into a Set Run', () => {
    const { result } = showWith(COLLECTOR, W.lich, W.golem, W.bloom);
    expect(result.pitchTypeLabel).toBe('Set Run');
  });

  it('caps the collector, which is the lesson of the second beat', () => {
    const { result } = showWith(COLLECTOR, W.lich, W.golem);
    const budget = WALKTHROUGH_BUYERS[0]!.budget;

    expect(result.cappedByBudget).toBe(true);
    // The step says they stretch past their wallet, but only a little. Both
    // halves of that have to stay true or the beat teaches the wrong rule.
    expect(result.offer).toBeGreaterThan(budget);
    expect(result.offer).toBeLessThan(result.uncappedOffer);
  });
});

describe('what the first sale does to the table', () => {
  it('grows the Buzz, because the collector got what they came for', () => {
    const { state } = afterCollector();
    expect(state.buzz).toBe(1);
  });

  it('costs the other two a pip each', () => {
    const { state } = afterCollector();
    expect(state.seats.map((s) => s.buyer.id)).toEqual([GRADER, BUILDER]);
    for (const seat of state.seats) expect(seat.patience).toBe(WALKTHROUGH_PATIENCE - 1);
  });

  it('restocks the case to full after a two-card sale', () => {
    const before = walkthroughShow(deps());
    const { state } = afterCollector();
    expect(state.displayCase).toHaveLength(before.displayCase.length);
  });
});

describe('the grader beat', () => {
  it('keeps the clean and beaten cards on the table for it', () => {
    const { state } = afterCollector();
    const ids = state.displayCase.map((c) => c.id);

    expect(ids).toContain(W.dell);
    expect(ids).toContain(W.vance);
    expect(ids).toContain(W.ruiz);
    expect(ids).toContain(W.slab);
  });

  it('refuses a slab rather than a beaten card', () => {
    const { state, deps: d } = afterCollector();
    const clean = select(state, W.dell, W.vance);
    const spoiled = toggleSelection(clean, W.slab);

    expect(previewPitch(clean, d, GRADER)!.interestMultLines).toHaveLength(0);
    // The clean pitch has to sit under the wallet, or the refusal lands on a
    // capped number and the player watches nothing happen.
    expect(previewPitch(clean, d, GRADER)!.cappedByBudget).toBe(false);

    // One graded card, and the whole pitch is worth a quarter.
    expect(previewPitch(spoiled, d, GRADER)!.interestMultLines).toHaveLength(1);
    expect(previewPitch(spoiled, d, GRADER)!.offer).toBeLessThan(
      previewPitch(clean, d, GRADER)!.offer * 0.75,
    );
  });

  it('lets a beaten raw card earn nothing without punishing the pitch', () => {
    // A grader buys to submit, so a Played card is simply not what they came
    // for. It used to quarter the pitch, which read as a trap rather than a
    // preference — and the chip describing it said "Any slab" regardless.
    const { state, deps: d } = afterCollector();
    const clean = select(state, W.dell, W.vance);
    const withBeaten = toggleSelection(clean, W.ruiz);

    expect(previewPitch(withBeaten, d, GRADER)!.interestMultLines).toHaveLength(0);
    expect(previewPitch(withBeaten, d, GRADER)!.offer).toBeGreaterThan(
      previewPitch(clean, d, GRADER)!.offer * 0.9,
    );
  });
});

describe('the dig beat', () => {
  it('leaves a buyer nothing on the table can satisfy, on their last pip', () => {
    const { state, deps: d } = afterGrader();

    expect(state.seats).toHaveLength(1);
    expect(state.seats[0]!.patience).toBe(1);
    // The whole point of the step: no pitch from the case earns the want.
    for (const card of state.displayCase) {
      const only = toggleSelection(state, card.id);
      expect(previewPitch(only, d, BUILDER)!.interestAddLines, card.id).toHaveLength(0);
    }
  });

  it('keeps the card they want out of the case until it is dug for', () => {
    // Restocks draw from stock, so this is a real risk rather than a
    // formality: if the run ever hands the Origin card over for free, the dig
    // step has nothing left to teach.
    const { state } = afterGrader();
    expect(state.displayCase.map((c) => c.id)).not.toContain(W.origin);
    expect(state.inventory.map((c) => c.id)).toContain(W.origin);
  });

  it('pays for the dug card once it is on the table', () => {
    const { state, deps: d } = afterGrader();
    const spare = state.displayCase.find((c) => c.id !== W.origin)!;
    const dug = digFromStock(state, spare.id, W.origin);

    expect(dug.goodwill).toBe(state.goodwill - 1);
    expect(dug.selection).toContain(W.origin);
    // Digging is free of patience: the buyer on one pip is still there.
    expect(dug.seats).toEqual(state.seats);

    const result = previewPitch(dug, d, BUILDER)!;
    expect(result.interestAddLines.length).toBeGreaterThan(0);
    expect(result.offer).toBeGreaterThan(100);
  });
});

describe('the show as a whole', () => {
  function playScript(): ShowState {
    const { state, deps: d } = afterGrader();
    const spare = state.displayCase.find((c) => c.id !== W.origin)!;
    return pitch(digFromStock(state, spare.id, W.origin), d, BUILDER);
  }

  it('clears its quota when all three scripted pitches are taken', () => {
    const state = playScript();

    expect(state.phase).toBe('over');
    expect(state.outcome).toBe('cleared');
    expect(state.earned).toBeGreaterThanOrEqual(WALKTHROUGH_QUOTA);
  });

  it('ends with every buyer pleased and nobody walked', () => {
    const state = playScript();
    expect(state.stats.buyersServed).toBe(3);
    expect(state.stats.buyersWalked).toBe(0);
    expect(state.stats.peakBuzz).toBe(3);
  });
});

describe('the cards the shop leg points at', () => {
  it('leaves the graded-in-the-tutorial card unsold and raw', () => {
    // The script tells the player to grade Gravebloom by name, so it has to
    // still be theirs, and still raw, when the shop opens.
    const { state, deps: d } = afterGrader();
    const spare = state.displayCase.find((c) => c.id !== W.origin && c.id !== W.bloom)!;
    const done = pitch(digFromStock(state, spare.id, W.origin), d, BUILDER);

    const owned = [...done.inventory, ...done.displayCase];
    const bloom = owned.find((c) => c.id === W.bloom);

    expect(bloom, 'Gravebloom was sold or lost').toBeDefined();
    expect(bloom!.slabbed).toBe(false);
  });

  it('sends the Bramblepup back to stock, where the dig step says it went', () => {
    const { state } = afterGrader();
    const dug = digFromStock(state, W.pup, W.origin);

    expect(dug.inventory.map((c) => c.id)).toContain(W.pup);
    expect(dug.displayCase[0]!.id).toBe(W.origin);
    expect(dug.selection).toContain(W.origin);
  });
});
