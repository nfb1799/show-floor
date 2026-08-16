/**
 * The balance measuring instrument.
 *
 * `balance.test.ts` asks yes/no questions ("is show 1 winnable?"). This asks
 * *how much* — it plays whole runs at the skill ceiling and counts what actually
 * happened: which pitch types ever fire, how many different card sets are tied
 * for best, how far apart good and bad play are, and where runs die.
 *
 * Nothing here asserts. It reports. `report.test.ts` prints it, `balance.test.ts`
 * guards the handful of numbers that must not regress.
 *
 * The bot is deliberately simple and deliberately fixed: brute-force best pitch,
 * pack-only restocking, no upgrades, no grading, no online dumping. It is not a
 * model of a good player — it is a *constant*, so before/after numbers compare.
 */

import { MAX_PITCH_CARDS, PACK_TIERS, STARTING_BANKROLL, STARTING_INVENTORY_SIZE } from '../constants';
import { generateCards } from '../cards/generate';
import { openPack } from '../shop/shop';
import { collectionModifiers } from '../run/collection';
import { conditionsForShow } from '../conditions/registry';
import { createRng, type Rng } from '../rng';
import { resolvePitch } from '../pitch/resolvePitch';
import {
  createShow,
  pitch,
  planShow,
  remainingInventory,
  toggleSelection,
  type ShowDeps,
  type ShowState,
} from '../show/showEngine';
import type { BuyerArchetypeId, Card, PitchTypeId } from '../types';

// ---------------------------------------------------------------------------
// Samples
// ---------------------------------------------------------------------------

export interface PitchSample {
  readonly showIndex: number;
  readonly archetype: BuyerArchetypeId;
  readonly pitchType: PitchTypeId;
  readonly offer: number;
  readonly cardCount: number;
  /** How many distinct card sets pay exactly the winning offer. 1 = one right answer. */
  readonly ties: number;
  /** (best - best alternative) / best. Zero whenever anything ties. */
  readonly density: number;
  readonly cappedByBudget: boolean;
}

export interface ShowSample {
  readonly showIndex: number;
  readonly earned: number;
  readonly quota: number;
  readonly cleared: boolean;
}

export type DeathCause = 'quota' | 'tableFee' | 'soldOut' | 'survived';

export interface RunSample {
  readonly seed: string;
  /** Shows actually played to the end. */
  readonly depth: number;
  /**
   * The show the run died at. For a quota death that is the show they played
   * and lost; for a fee death it is the show they could not open, which is one
   * further on than `depth`.
   */
  readonly deathShow: number;
  readonly death: DeathCause;
  readonly shows: readonly ShowSample[];
  readonly pitches: readonly PitchSample[];
}

// ---------------------------------------------------------------------------
// The ceiling player
// ---------------------------------------------------------------------------

/** Every subset of `cards` with 1..MAX_PITCH_CARDS members. */
export function combinations(cards: readonly Card[]): Card[][] {
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

interface Choice {
  readonly cards: readonly Card[];
  readonly pitchType: PitchTypeId;
  readonly offer: number;
  readonly ties: number;
  readonly density: number;
  readonly cappedByBudget: boolean;
}

/**
 * The best pitch available, plus what the alternatives paid.
 *
 * `ties` and `density` are the whole point: a pitch where nineteen card sets pay
 * the same is not a decision, however good the winning number looks.
 */
export function bestChoice(state: ShowState, deps: ShowDeps): Choice | null {
  if (!state.buyer) return null;
  const sellable = state.displayCase.filter((c) => !state.lockedCardIds.includes(c.id));
  if (sellable.length === 0) return null;

  let best: Choice | null = null;
  let runnerUp = -1;
  let ties = 0;

  for (const combo of combinations(sellable)) {
    const result = resolvePitch({
      cards: combo,
      buyer: state.buyer,
      upgrades: deps.upgrades,
      conditions: deps.conditions,
      offerRatio: state.offerRatio,
      showIndex: state.config.showIndex,
      rng: deps.rng,
    });

    if (best === null || result.offer > best.offer) {
      if (best !== null) runnerUp = Math.max(runnerUp, best.offer);
      ties = 1;
      best = {
        cards: combo,
        pitchType: result.pitchType,
        offer: result.offer,
        ties: 1,
        density: 0,
        cappedByBudget: result.cappedByBudget,
      };
    } else if (result.offer === best.offer) {
      ties++;
    } else if (result.offer > runnerUp) {
      runnerUp = result.offer;
    }
  }

  if (best === null) return null;

  // A tie *is* the best alternative, so ties collapse density to zero without
  // needing a special case.
  const alternative = ties > 1 ? best.offer : Math.max(0, runnerUp);
  const density = best.offer > 0 ? (best.offer - alternative) / best.offer : 0;

  return { ...best, ties, density };
}

/** Plays one show at the skill ceiling, recording every decision. */
export function playShow(
  state: ShowState,
  deps: ShowDeps,
  into: PitchSample[],
): ShowState {
  let show = state;
  let guard = 0;

  while (show.phase !== 'over' && guard++ < 60) {
    const choice = bestChoice(show, deps);
    if (!choice || !show.buyer) break;

    into.push({
      showIndex: show.config.showIndex,
      archetype: show.buyer.archetype,
      pitchType: choice.pitchType,
      offer: choice.offer,
      cardCount: choice.cards.length,
      ties: choice.ties,
      density: choice.density,
      cappedByBudget: choice.cappedByBudget,
    });

    let next = show;
    for (const card of choice.cards) next = toggleSelection(next, card.id);
    show = pitch(next, deps);
  }
  return show;
}

// ---------------------------------------------------------------------------
// Restocking
// ---------------------------------------------------------------------------

/** Packs the bot may buy at one shop visit, before it walks away with the rest. */
const MAX_PACKS_PER_VISIT = 3;

/**
 * Buys the biggest pack it can afford while keeping the next table fee in
 * reserve, up to three packs. No singles, no upgrades, no grading — those are
 * player decisions the bot has no policy for, and modelling them badly would
 * put noise where the measurement is supposed to be.
 *
 * `reserve` is the *planned* fee, conditions included, mirroring the store's
 * `reservedForFee`. Reserving the unconditioned fee instead makes the bot
 * bankrupt itself on every Convention Center show and reports it as a death
 * curve, which is a bug in the instrument rather than a fact about the game.
 */
function restock(
  bankroll: number,
  inventory: readonly Card[],
  rng: Rng,
  showIndex: number,
  reserve: number,
): { bankroll: number; inventory: Card[] } {
  const tiers = [...PACK_TIERS].sort((a, b) => b.cost - a.cost);

  let money = bankroll;
  const cards = [...inventory];

  for (let i = 0; i < MAX_PACKS_PER_VISIT; i++) {
    const tier = tiers.find((t) => money - t.cost >= reserve);
    if (!tier) break;
    money -= tier.cost;
    cards.push(...openPack(tier, rng, `sim-p${showIndex}-${i}`));
  }

  return { bankroll: money, inventory: cards };
}

// ---------------------------------------------------------------------------
// A whole run
// ---------------------------------------------------------------------------

export interface RunOptions {
  readonly maxShows?: number;
  readonly startingInventory?: number;
}

export function simulateRun(seed: string, options: RunOptions = {}): RunSample {
  const maxShows = options.maxShows ?? 20;
  const rng = createRng(seed);

  let inventory: Card[] = generateCards(rng, options.startingInventory ?? STARTING_INVENTORY_SIZE, `${seed}-start`);
  let bankroll = STARTING_BANKROLL;

  const shows: ShowSample[] = [];
  const pitches: PitchSample[] = [];

  /** The fee the run will actually be charged to open `showIndex`. */
  const feeFor = (showIndex: number, deps: ShowDeps): number =>
    planShow(showIndex, inventory.length, deps).tableFee;

  const depsFor = (showIndex: number): ShowDeps => ({
    rng,
    upgrades: collectionModifiers(inventory),
    conditions: conditionsForShow(seed, showIndex),
  });

  for (let showIndex = 1; showIndex <= maxShows; showIndex++) {
    const deps = depsFor(showIndex);

    if (inventory.length === 0) {
      return { seed, depth: showIndex - 1, deathShow: showIndex, death: 'soldOut', shows, pitches };
    }

    const fee = feeFor(showIndex, deps);
    if (bankroll < fee) {
      return { seed, depth: showIndex - 1, deathShow: showIndex, death: 'tableFee', shows, pitches };
    }
    bankroll -= fee;

    const played = playShow(createShow(showIndex, inventory, deps), deps, pitches);

    shows.push({
      showIndex,
      earned: played.earned,
      quota: played.config.quota,
      cleared: played.outcome === 'cleared',
    });

    bankroll += played.earned;
    inventory = remainingInventory(played);

    if (played.outcome !== 'cleared') {
      return { seed, depth: showIndex, deathShow: showIndex, death: 'quota', shows, pitches };
    }

    const restocked = restock(
      bankroll,
      inventory,
      rng,
      showIndex,
      feeFor(showIndex + 1, depsFor(showIndex + 1)),
    );
    bankroll = restocked.bankroll;
    inventory = restocked.inventory;
  }

  return { seed, depth: maxShows, deathShow: 0, death: 'survived', shows, pitches };
}

export function simulateRuns(count: number, options: RunOptions = {}): RunSample[] {
  return Array.from({ length: count }, (_, i) => simulateRun(`sim-${i}`, options));
}
