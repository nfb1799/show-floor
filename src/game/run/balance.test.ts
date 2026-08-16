/**
 * Balance guards.
 *
 * These play real shows through the real engine with a brute-force "best
 * available pitch" player, which is the ceiling a thinking human approaches but
 * does not exceed. If show 1 stops being winnable, or the early curve stops
 * being survivable, these fail rather than the player finding out.
 */

import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { generateCards } from '../cards/generate';
import { resolvePitch } from '../pitch/resolvePitch';
import { MAX_PITCH_CARDS } from '../constants';
import {
  createShow,
  pitch,
  quotaForShow,
  remainingInventory,
  resolveTrade,
  tableFeeForShow,
  toggleSelection,
  type ShowDeps,
  type ShowState,
} from '../show/showEngine';
import { simulateRuns } from '../sim/harness';
import { summarize } from '../sim/report';
import type { Card } from '../types';

/** Every subset of `cards` with 1..MAX_PITCH_CARDS members. */
function combinations(cards: readonly Card[]): Card[][] {
  const out: Card[][] = [];
  const walk = (start: number, picked: Card[]): void => {
    if (picked.length > 0) out.push([...picked]);
    if (picked.length === MAX_PITCH_CARDS) return;
    for (let i = start; i < cards.length; i++) {
      picked.push(cards[i]!);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return out;
}

/** The highest-paying legal pitch from the current case. */
function bestPitch(state: ShowState, deps: ShowDeps): Card[] | null {
  if (!state.buyer) return null;
  const sellable = state.displayCase.filter((c) => !state.lockedCardIds.includes(c.id));
  if (sellable.length === 0) return null;

  let best: Card[] | null = null;
  let bestOffer = -1;

  for (const combo of combinations(sellable)) {
    const offer = resolvePitch({
      cards: combo,
      buyer: state.buyer,
      upgrades: deps.upgrades,
      conditions: deps.conditions,
      offerRatio: state.offerRatio,
      showIndex: state.config.showIndex,
      rng: deps.rng,
    }).offer;
    if (offer > bestOffer) {
      bestOffer = offer;
      best = combo;
    }
  }
  return best;
}

/** Plays a whole show at the skill ceiling. */
function playPerfectly(state: ShowState, deps: ShowDeps): ShowState {
  let show = state;
  let guard = 0;

  while (show.phase !== 'over' && guard++ < 60) {
    const best = bestPitch(show, deps);
    if (!best) break;

    let next = show;
    for (const card of best) next = toggleSelection(next, card.id);
    show = pitch(next, deps);

    // Lists every card a buyer trades in, rather than keeping any. These tests
    // ask whether a *single show* can be cleared, and cash now beats cards for
    // that: stock is only worth anything at a show this run may never reach.
    // The full-run bot in sim/harness.ts keeps them for exactly that reason.
    if (show.pendingTrade) show = resolveTrade(show, [], deps);
  }
  return show;
}

interface RunOutcome {
  readonly earned: number;
  readonly quota: number;
  readonly cleared: boolean;
}

function playShow(seed: string, showIndex: number, inventorySize: number): RunOutcome {
  const rng = createRng(seed);
  const inventory = generateCards(rng, inventorySize, 'sim');
  const deps: ShowDeps = { rng, upgrades: [], conditions: [] };
  const show = playPerfectly(createShow(showIndex, inventory, deps), deps);
  return {
    earned: show.earned,
    quota: show.config.quota,
    cleared: show.outcome === 'cleared',
  };
}

const SEEDS = Array.from({ length: 24 }, (_, i) => `sim-${i}`);

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

describe('show 1 is winnable from the starting inventory', () => {
  const outcomes = SEEDS.map((seed) => playShow(seed, 1, 32));

  it('clears on the large majority of seeds', () => {
    const cleared = outcomes.filter((o) => o.cleared).length;
    // A starting deck of mostly junk commons should still clear the first
    // quota with good play. Anything under this and the opening is a coin flip.
    expect(cleared / outcomes.length).toBeGreaterThanOrEqual(0.85);
  });

  it('leaves headroom rather than landing exactly on the number', () => {
    const ratios = outcomes.map((o) => o.earned / o.quota);
    expect(median(ratios)).toBeGreaterThanOrEqual(1.4);
  });
});

describe('the early curve stays survivable', () => {
  it('clears shows 2 and 3 with an inventory that has not been restocked much', () => {
    // Approximates a player who banked their earnings rather than restocking:
    // a thinner case each show against a quota that keeps climbing.
    for (const [showIndex, inventorySize] of [
      [2, 26],
      [3, 22],
    ] as const) {
      const outcomes = SEEDS.slice(0, 12).map((seed) =>
        playShow(`${seed}-s${showIndex}`, showIndex, inventorySize),
      );
      const cleared = outcomes.filter((o) => o.cleared).length;
      expect(cleared / outcomes.length, `show ${showIndex}`).toBeGreaterThanOrEqual(0.8);
    }
  });
});

describe('the table fee never outruns the bankroll on its own', () => {
  it('stays a small fraction of the quota it gates', () => {
    for (let showIndex = 1; showIndex <= 10; showIndex++) {
      expect(tableFeeForShow(showIndex) / quotaForShow(showIndex)).toBeLessThan(0.45);
    }
  });
});

/**
 * Guards on the shape of the decision itself, rather than on whether a show is
 * winnable. These are the numbers that were quietly wrong for a long time: the
 * game was winnable throughout, it just was not asking anything.
 *
 * Twelve runs rather than forty, to keep `npm test` quick — `npm run sim` plays
 * more and prints the detail behind every one of these.
 */
describe('pitches are decisions', () => {
  const runs = simulateRuns(12);
  const summary = summarize(runs);

  it('usually has exactly one best answer', () => {
    // 27 different card sets used to pay the winning number, because a hard
    // budget cap flattened everything above it into a tie.
    expect(summary.medianTies).toBe(1);
    expect(summary.tiedShare).toBeLessThan(0.35);
  });

  it('keeps the pitch ladder reachable', () => {
    // Playset, Set Run, Graded Run, Holo Wall and The Grail fired zero times in
    // 1,176 pitches under a uniform draw — half the ladder was decoration. The
    // three below stay rare enough that a twelve-run sample can miss them, so
    // this guards the ceiling of the ladder, which is what was unreachable.
    const stillRare = ['Playset', 'Set Run', 'Graded Run'];
    expect(summary.deadPitchTypes.filter((t) => !stillRare.includes(t))).toEqual([]);
  });

  it('sells combinations rather than singles', () => {
    expect(summary.cardsPerSale).toBeGreaterThan(3.5);
  });
});

describe('the difficulty curve is a curve', () => {
  it('does not put a wall on one show', () => {
    // 17 runs in 40 used to end on show 9, where condition stacking switched on
    // at the same moment three of the harshest house rules became legal.
    const summary = summarize(simulateRuns(12));
    expect(
      summary.worstShowShare,
      `show ${summary.worstShowIndex} takes ${Math.round(summary.worstShowShare * 100)}% of all runs`,
    ).toBeLessThan(0.35);
  });
});

describe('inventory drain', () => {
  it('a show does not consume the whole case at the skill ceiling', () => {
    const rng = createRng('drain');
    const inventory = generateCards(rng, 32, 'sim');
    const deps: ShowDeps = { rng, upgrades: [], conditions: [] };
    const show = playPerfectly(createShow(1, inventory, deps), deps);

    // Selling out entirely every show would make the shop mandatory rather
    // than strategic.
    expect(remainingInventory(show).length).toBeGreaterThan(6);
  });
});
