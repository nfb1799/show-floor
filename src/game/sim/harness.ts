/**
 * The balance measuring instrument.
 *
 * `balance.test.ts` asks yes/no questions ("is show 1 winnable?"). This asks
 * *how much* — it plays whole runs and counts what actually happened: which
 * pitch types ever fire, how many different card sets are tied for best, how
 * much it matters which buyer is served, how many walk, and where runs die.
 *
 * Nothing here asserts. It reports. `report.test.ts` prints it, `balance.test.ts`
 * guards the handful of numbers that must not regress.
 *
 * The bot is deliberately simple and deliberately fixed: it prices every card
 * set for everyone at the table, serves whoever is worth most once the people
 * about to walk are accounted for, and never digs or holds. Pack-only
 * restocking, no upgrades, no grading, no online dumping. It is not a model of
 * a good player — it is a *constant*, so before/after numbers compare.
 */

import {
  MAX_PITCH_CARDS,
  PACK_TIERS,
  STARTING_BANKROLL,
  STARTING_INVENTORY_SIZE,
} from '../constants';
import { generateCards } from '../cards/generate';
import { nextCaseCost, openPack } from '../shop/shop';
import { collectionModifiers } from '../run/collection';
import { conditionsForShow } from '../conditions/registry';
import { createRng, type Rng } from '../rng';
import { resolvePitch } from '../pitch/resolvePitch';
import {
  buzzMultiplier,
  createShow,
  pitch,
  planShow,
  remainingInventory,
  toggleSelection,
  type Seat,
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
  /** How many distinct card sets are worth exactly as much to this buyer. */
  readonly ties: number;
  /** (best - best alternative) / best, for this buyer. Zero whenever anything ties. */
  readonly density: number;
  readonly cappedByBudget: boolean;
  /** Buyers at the table when the sale was made. */
  readonly seated: number;
  /**
   * (best buyer - next best buyer) / best buyer, each at their own best pitch.
   * Zero means it did not matter who was served; null with nobody to compare.
   */
  readonly seatMargin: number | null;
  /** Buzz the sale was made at. */
  readonly buzz: number;
  readonly pleased: boolean;
}

export interface ShowSample {
  readonly showIndex: number;
  readonly earned: number;
  readonly quota: number;
  readonly cleared: boolean;
  /** Which house rules were in force, so a killer condition can be named. */
  readonly conditionIds: readonly string[];
  /** Cards in hand when the show opened. The design doc's intended pressure. */
  readonly stockAtStart: number;
  readonly bankrollAtStart: number;
  readonly served: number;
  readonly walked: number;
  readonly peakBuzz: number;
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
// The bot
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

/**
 * What a card on the table is worth keeping, as a share of the show's quota.
 *
 * Without it the bot sells five cards every time, because the fifth always
 * adds a dollar. With a restock of three, those two extra cards are what the
 * next buyer would have been pitched — so a card has to earn its place.
 */
const CARD_HOLD_COST = 0.02;

/** How much of a walking buyer's best pitch counts as lost by not serving them. */
const WALK_LOSS = 0.6;

interface SeatChoice {
  readonly seat: Seat;
  readonly cards: readonly Card[];
  readonly pitchType: PitchTypeId;
  readonly offer: number;
  /** Offer less what the cards were worth keeping. What the bot ranks on. */
  readonly worth: number;
  readonly ties: number;
  readonly density: number;
  readonly cappedByBudget: boolean;
  readonly pleased: boolean;
}

/** The best pitch for one buyer, plus what the alternatives paid. */
function bestForSeat(
  state: ShowState,
  deps: ShowDeps,
  seat: Seat,
  combos: readonly Card[][],
): SeatChoice | null {
  const holdCost = state.config.quota * CARD_HOLD_COST;
  const buzzMult = buzzMultiplier(state.buzz, state.config.buzzStep);

  let best: SeatChoice | null = null;
  let runnerUp = -Infinity;
  let ties = 0;

  for (const combo of combos) {
    const result = resolvePitch({
      cards: combo,
      buyer: seat.buyer,
      upgrades: deps.upgrades,
      conditions: deps.conditions,
      offerRatio: state.offerRatio,
      showIndex: state.config.showIndex,
      buzzMult,
      rng: deps.rng,
    });
    // A happy buyer grows the crowd, which the bot values as a small bonus so
    // that it prefers the pitch that pleases when two pay about the same.
    const worth = result.offer - combo.length * holdCost + (result.pleased ? holdCost : 0);

    if (best === null || worth > best.worth) {
      if (best !== null) runnerUp = Math.max(runnerUp, best.worth);
      ties = 1;
      best = {
        seat,
        cards: combo,
        pitchType: result.pitchType,
        offer: result.offer,
        worth,
        ties: 1,
        density: 0,
        cappedByBudget: result.cappedByBudget,
        pleased: result.pleased,
      };
    } else if (worth === best.worth) {
      ties++;
    } else if (worth > runnerUp) {
      runnerUp = worth;
    }
  }

  if (best === null) return null;

  // A tie *is* the best alternative, so ties collapse density to zero without
  // needing a special case.
  const alternative = ties > 1 ? best.worth : Math.max(0, runnerUp);
  const density = best.worth > 0 ? (best.worth - alternative) / best.worth : 0;

  return { ...best, ties, density };
}

export interface Choice extends SeatChoice {
  readonly seated: number;
  readonly seatMargin: number | null;
}

/**
 * Who to serve, and with what.
 *
 * Each buyer is priced at their own best pitch. Serving one of them makes
 * everybody else wait, so a buyer on their last pip is charged against every
 * choice that is not them.
 */
export function bestChoice(state: ShowState, deps: ShowDeps): Choice | null {
  const sellable = state.displayCase.filter((c) => !state.lockedCardIds.includes(c.id));
  if (sellable.length === 0 || state.seats.length === 0) return null;

  const combos = combinations(sellable);
  const options = state.seats
    .map((seat) => bestForSeat(state, deps, seat, combos))
    .filter((c): c is SeatChoice => c !== null);
  if (options.length === 0) return null;

  const ranked = options
    .map((option) => {
      const lost = options
        .filter((other) => other !== option && other.seat.patience <= 1)
        .reduce((sum, other) => sum + Math.max(0, other.worth) * WALK_LOSS, 0);
      return { option, score: option.worth - lost };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0]!;
  const second = ranked[1];
  const seatMargin =
    second === undefined || top.score <= 0
      ? null
      : (top.score - Math.max(0, second.score)) / top.score;

  return { ...top.option, seated: state.seats.length, seatMargin };
}

/** Plays one show, recording every decision. */
export function playShow(
  state: ShowState,
  deps: ShowDeps,
  into: PitchSample[] = [],
): ShowState {
  let show = state;
  let guard = 0;

  while (show.phase !== 'over' && guard++ < 60) {
    const choice = bestChoice(show, deps);
    if (!choice) break;

    into.push({
      showIndex: show.config.showIndex,
      archetype: choice.seat.buyer.archetype,
      pitchType: choice.pitchType,
      offer: choice.offer,
      cardCount: choice.cards.length,
      ties: choice.ties,
      density: choice.density,
      cappedByBudget: choice.cappedByBudget,
      seated: choice.seated,
      seatMargin: choice.seatMargin,
      buzz: show.buzz,
      pleased: choice.pleased,
    });

    let next = show;
    for (const card of choice.cards) next = toggleSelection(next, card.id);
    show = pitch(next, deps, choice.seat.buyer.id);
  }
  return show;
}

// ---------------------------------------------------------------------------
// Restocking
// ---------------------------------------------------------------------------

/** A stop, not a policy: enough headroom that the cap never binds in practice. */
const MAX_PACKS_PER_VISIT = 12;

/**
 * Spends the takings: permanent case slots first, then the biggest pack it can
 * afford, always keeping the next table fee in reserve.
 *
 * Spending down matters more than it sounds. An earlier version of this bot
 * bought at most three packs and was sitting on $7,392 while it died to a
 * $2,000 quota — the death curve it drew was a portrait of a bot that would not
 * shop, and tuning the quota against it would have been tuning against noise.
 *
 * Still no singles, upgrades or grading: those need a policy the bot has no
 * basis for, and guessing badly would put noise back where the measurement is.
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
  casesBought: number,
): { bankroll: number; inventory: Card[]; casesBought: number } {
  const tiers = [...PACK_TIERS].sort((a, b) => b.cost - a.cost);

  let money = bankroll;
  let cases = casesBought;
  const cards = [...inventory];

  // A permanent slot is a bigger case at every future show, so it outranks any
  // one pack a player could buy with the same money.
  for (;;) {
    const cost = nextCaseCost(cases);
    if (cost === null || money - cost < reserve) break;
    money -= cost;
    cases++;
  }

  for (let i = 0; i < MAX_PACKS_PER_VISIT; i++) {
    const tier = tiers.find((t) => money - t.cost >= reserve);
    if (!tier) break;
    money -= tier.cost;
    cards.push(...openPack(tier, rng, `sim-p${showIndex}-${i}`));
  }

  return { bankroll: money, inventory: cards, casesBought: cases };
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
  let casesBought = 0;

  const shows: ShowSample[] = [];
  const pitches: PitchSample[] = [];

  /** The fee the run will actually be charged to open `showIndex`. */
  const feeFor = (showIndex: number, deps: ShowDeps): number =>
    planShow(showIndex, inventory.length, deps).tableFee;

  const depsFor = (showIndex: number): ShowDeps => ({
    rng,
    upgrades: collectionModifiers(inventory),
    conditions: conditionsForShow(seed, showIndex),
    extraCaseSlots: casesBought,
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
    const stockAtStart = inventory.length;
    const bankrollAtStart = bankroll;
    bankroll -= fee;

    const played = playShow(createShow(showIndex, inventory, deps), deps, pitches);

    shows.push({
      showIndex,
      earned: played.earned,
      quota: played.config.quota,
      cleared: played.outcome === 'cleared',
      conditionIds: played.config.conditionIds,
      stockAtStart,
      bankrollAtStart,
      served: played.stats.buyersServed,
      walked: played.stats.buyersWalked,
      peakBuzz: played.stats.peakBuzz,
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
      casesBought,
    );
    bankroll = restocked.bankroll;
    inventory = restocked.inventory;
    casesBought = restocked.casesBought;
  }

  return { seed, depth: maxShows, deathShow: 0, death: 'survived', shows, pitches };
}

export function simulateRuns(count: number, options: RunOptions = {}): RunSample[] {
  return Array.from({ length: count }, (_, i) => simulateRun(`sim-${i}`, options));
}
