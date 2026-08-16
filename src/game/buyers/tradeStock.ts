/**
 * What a buyer pulls out of their own binder when your pitch is worth more than
 * the cash they brought.
 *
 * The cards are shaped by what that buyer collects, because that is what they
 * would actually be carrying: a Grimoire collector hands you Grimoire, a grader
 * hands you slabs. It also makes the trade legible — you can see whose binder
 * you are looking at without being told.
 *
 * Pure and RNG-injected like everything else in `game/`, so a trade replays
 * identically from a seed.
 */

import {
  CONDITION_WEIGHTS,
  GRADE_WEIGHTS,
  HOLO_MIN_RARITY,
  RARITY_BASE,
  RARITY_ORDER,
  SLAB_VALUE_ALLOWANCE,
  TRADE_MAX_CARDS,
  TRADE_OFFER_ATTEMPTS,
} from '../constants';
import { cardValue, conditionRank, rarityRank } from '../cards/value';
import { FRANCHISES, getFranchise, getSet, setsForFranchise } from '../cards/catalog';
import type { Rng } from '../rng';
import type { Buyer, Card, Condition, Rarity, Want } from '../types';

const CONDITION_ENTRIES = Object.entries(CONDITION_WEIGHTS) as [Condition, number][];
const GRADE_ENTRIES = Object.entries(GRADE_WEIGHTS).map(
  ([grade, weight]) => [Number(grade), weight] as [number, number],
);

/** The shape of a card this buyer would plausibly be carrying. */
interface Shape {
  franchiseId?: string;
  setId?: string;
  minRarity?: Rarity;
  minGrade?: number;
  minCondition?: Condition;
  forceRaw?: boolean;
}

/**
 * Reads a collector's identity off their demands. Only the wants that describe
 * *cards they own* are used: "pitches of 4+" and "one of each franchise" say
 * something about how they buy, not about what is in their binder.
 */
function shapeFromWants(rng: Rng, wants: readonly Want[]): Shape {
  const shape: Shape = {};

  for (const want of wants) {
    switch (want.kind) {
      case 'franchise':
        shape.franchiseId = want.franchiseId;
        break;
      case 'fromSets': {
        const setId = rng.pick(want.setIds);
        if (setId !== undefined) {
          shape.setId = setId;
          shape.franchiseId = getSet(setId).franchise;
        }
        break;
      }
      case 'holo':
        shape.minRarity = HOLO_MIN_RARITY;
        break;
      case 'minGrade':
        shape.minGrade = want.minGrade;
        break;
      case 'rawMinCondition':
        shape.minCondition = want.minCondition;
        shape.forceRaw = true;
        break;
      case 'volume':
      case 'distinctFranchises':
        break;
    }
  }

  return shape;
}

/** Weighted pick, then floored: keeps the usual distribution above a minimum. */
function atLeast<T>(rng: Rng, entries: readonly (readonly [T, number])[], min: T, rank: (v: T) => number): T {
  const allowed = entries.filter(([value]) => rank(value) >= rank(min));
  return allowed.length > 0 ? rng.weighted(allowed) : min;
}

/**
 * The dearest rarity that could plausibly come in under `target`.
 *
 * Without this the binder is drawn on the ordinary rarity weights, which are
 * mostly commons worth $2 — five of them cannot come near a $150 shortfall, and
 * the trade quietly paid out a tenth of what it promised. A buyer covering a
 * big gap reaches for the good stuff, which is also the honest fiction.
 */
function rarityForTarget(rng: Rng, target: number, min: Rarity | undefined): Rarity {
  const floor = min ? rarityRank(min) : 0;
  const affordable = RARITY_ORDER.filter(
    (rarity, i) => i >= floor && RARITY_BASE[rarity] <= target,
  );
  if (affordable.length === 0) return RARITY_ORDER[floor] ?? 'common';
  // The top two rather than the single best, so a binder is not uniform.
  return rng.pick(affordable.slice(-2));
}

function shapedCard(rng: Rng, shape: Shape, target: number, id: string): Card {
  const franchise = shape.franchiseId
    ? getFranchise(shape.franchiseId)
    : rng.pick(FRANCHISES);
  const set = shape.setId ? getSet(shape.setId) : rng.pick(setsForFranchise(franchise.id));

  // Slabs multiply their base by up to 6x, so aim lower when one is coming.
  const slabbing = shape.minGrade !== undefined && !shape.forceRaw;
  const rarityTarget = target / (slabbing ? SLAB_VALUE_ALLOWANCE : 1);

  const base = {
    id,
    subject: rng.pick(franchise.subjects),
    franchise: franchise.id,
    setId: set.id,
    setNumber: rng.int(1, set.size),
    rarity: rarityForTarget(rng, rarityTarget, shape.minRarity),
  };

  if (shape.minGrade !== undefined && !shape.forceRaw) {
    const grades = GRADE_ENTRIES.filter(([grade]) => grade >= (shape.minGrade ?? 0));
    return {
      ...base,
      slabbed: true,
      grade: grades.length > 0 ? rng.weighted(grades) : shape.minGrade,
    };
  }

  return {
    ...base,
    slabbed: false,
    condition: shape.minCondition
      ? atLeast(rng, CONDITION_ENTRIES, shape.minCondition, conditionRank)
      : rng.weighted(CONDITION_ENTRIES),
  };
}

/**
 * Cards worth up to `value` in total, never over it.
 *
 * Greedy rather than exact: it rolls cards from the buyer's collection and
 * keeps the ones that still fit. An exact fit would need a knapsack solve and
 * would make every trade land on a suspiciously round number — a binder does
 * not owe you change.
 */
export function generateTradeOffer(
  rng: Rng,
  buyer: Buyer,
  value: number,
  idPrefix: string,
): Card[] {
  if (value <= 0) return [];

  const shape = shapeFromWants(rng, buyer.wants);
  const offered: Card[] = [];
  let spent = 0;

  for (let slot = 0; slot < TRADE_MAX_CARDS; slot++) {
    const remaining = value - spent;
    if (remaining <= 0) break;

    // Spread what is left over the slots that are left, so the binder comes out
    // as a handful of cards worth picking between rather than one big one.
    const target = remaining / (TRADE_MAX_CARDS - offered.length);

    let best: Card | null = null;
    let bestWorth = 0;
    for (let attempt = 0; attempt < TRADE_OFFER_ATTEMPTS; attempt++) {
      const card = shapedCard(rng, shape, target, `${idPrefix}-${slot}-${attempt}`);
      const worth = cardValue(card);
      if (worth <= 0 || worth > remaining) continue;
      if (worth > bestWorth) {
        best = card;
        bestWorth = worth;
      }
    }

    if (!best) break;
    offered.push(best);
    spent += bestWorth;
  }

  return offered;
}

/** What the offered cards come to, for the "up to" line in the UI. */
export function tradeOfferValue(cards: readonly Card[]): number {
  return cards.reduce((sum, card) => sum + cardValue(card), 0);
}
