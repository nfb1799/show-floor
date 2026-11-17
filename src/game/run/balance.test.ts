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
import {
  createShow,
  quotaForShow,
  remainingInventory,
  tableFeeForShow,
  type ShowDeps,
  type ShowState,
} from '../show/showEngine';
import { playShow as playWithBot, simulateRuns } from '../sim/harness';
import { summarize } from '../sim/report';

/**
 * Plays a whole show with the sim's bot: every card set priced for everyone at
 * the table. One bot for the guards and the report, so they cannot disagree
 * about what "good play" is.
 */
function playPerfectly(state: ShowState, deps: ShowDeps): ShowState {
  return playWithBot(state, deps);
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
// One sample for every guard below. Pricing each card set for everyone at the
// table is the expensive part of the suite, so it is played once.
const SUMMARY = summarize(simulateRuns(12));

describe('pitches are decisions', () => {
  const summary = SUMMARY;

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

/**
 * The crowd is the decision the one-buyer game never had. With a single buyer
 * the best pitch beat the runner-up by 1.5%; these guard that who gets served,
 * and when, is worth thinking about.
 */
describe('the crowd is a decision', () => {
  it('matters who is served', () => {
    // If the best buyer were barely ahead of the next, three seats would be
    // one seat with extra reading.
    expect(SUMMARY.medianSeatMargin).toBeGreaterThan(0.15);
  });

  it('loses some buyers, but not most of them', () => {
    // Nobody ever walking means patience is decoration; half of them walking
    // means the table is a queue again.
    expect(SUMMARY.walkedShare).toBeGreaterThan(0.05);
    expect(SUMMARY.walkedShare).toBeLessThan(0.4);
  });

  it('builds Buzz over a show without pinning it at the ceiling', () => {
    expect(SUMMARY.meanPeakBuzz).toBeGreaterThan(1.5);
    expect(SUMMARY.meanBuzz).toBeLessThan(3.5);
  });
});

describe('the difficulty curve is a curve', () => {
  it('does not put a wall on one show', () => {
    // 17 runs in 40 used to end on show 9, where condition stacking switched on
    // at the same moment three of the harshest house rules became legal.
    const summary = SUMMARY;
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
