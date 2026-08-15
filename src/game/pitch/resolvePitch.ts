/**
 * The scoring boundary. Pure, no React, no module state, no global RNG.
 *
 *   Appeal = (pitchValue + sum(cardValues)) x interest
 *   Offer  = min(Appeal x offerRatio, buyerBudget), then post-cap hooks
 *
 * Interest has two channels that the design doc conflates under one name:
 * additive bonuses (buyer wants, most upgrades) and multiplicative modifiers
 * (buyer refusals, Snob Crowd). Additives are summed and floored at
 * MIN_INTEREST first, then multipliers apply.
 */

import {
  MAX_PITCH_CARDS,
  MIN_INTEREST,
  MIN_PITCH_CARDS,
  OFFER_RATIO_START,
} from '../constants';
import { cardValue, conditionRank, isHolo, totalCardValue } from '../cards/value';
import type { Rng } from '../rng';
import type {
  Buyer,
  Card,
  Modifier,
  PitchResult,
  PitchTypeId,
  ScoreLine,
  Want,
} from '../types';
import { detectPitchTypes, pitchTypeDef, pitchTypeLabel, pitchTypeRank } from './pitchTypes';
import { allModifiers, runOfferHooks, runPitchScoreHooks } from './hooks';

export interface PitchInput {
  readonly cards: readonly Card[];
  readonly buyer: Buyer;
  readonly upgrades: readonly Modifier[];
  readonly conditions: readonly Modifier[];
  /** Rises by HAGGLE_RATIO_STEP each time the player pushes. */
  readonly offerRatio?: number;
  readonly showIndex?: number;
  /**
   * Injected, never global. resolvePitch only ever forks from this, so the
   * caller's stream is not advanced and the same input always scores the same.
   */
  readonly rng: Rng;
}

// ---------------------------------------------------------------------------
// Buyer wants
// ---------------------------------------------------------------------------

function cardsMatchingWant(cards: readonly Card[], want: Want): Card[] {
  switch (want.kind) {
    case 'fromSets':
      return cards.filter((c) => want.setIds.includes(c.setId));
    case 'subject':
      return cards.filter((c) => c.subject === want.subject);
    case 'rawMinCondition':
      return cards.filter(
        (c) => !c.slabbed && conditionRank(c.condition) >= conditionRank(want.minCondition),
      );
    case 'minGrade':
      return cards.filter((c) => c.slabbed && c.grade >= want.minGrade);
    case 'holo':
      return cards.filter((c) => isHolo(c.rarity));
    case 'volume':
      return cards.length >= want.minCards ? [...cards] : [];
    case 'valueOnly':
      // Not a per-card bonus: it changes how the offer is built.
      return [];
  }
}

function wantLabel(want: Want, count: number): string {
  const suffix = count > 1 ? ` x${count}` : '';
  switch (want.kind) {
    case 'fromSets':
      return `Wanted set${suffix}`;
    case 'subject':
      return `${want.subject}${suffix}`;
    case 'rawMinCondition':
      return `Clean raw${suffix}`;
    case 'minGrade':
      return `Grade ${want.minGrade}+${suffix}`;
    case 'holo':
      return `Holo${suffix}`;
    case 'volume':
      return `Volume${suffix}`;
    case 'valueOnly':
      return 'Cards only';
  }
}

function turnoffApplies(cards: readonly Card[], buyer: Buyer): boolean {
  const turnoff = buyer.turnoff;
  if (!turnoff) return false;
  switch (turnoff.kind) {
    case 'anyRaw':
      return cards.some((c) => !c.slabbed);
    case 'anySlab':
      return cards.some((c) => c.slabbed);
    case 'rawBelowCondition':
      return cards.some(
        (c) => !c.slabbed && conditionRank(c.condition) < conditionRank(turnoff.minCondition),
      );
  }
}

// ---------------------------------------------------------------------------
// Scoring one candidate type
// ---------------------------------------------------------------------------

function combineInterest(
  base: number,
  addLines: readonly ScoreLine[],
  multLines: readonly ScoreLine[],
): number {
  let sum = base;
  for (const line of addLines) sum += line.amount;
  let interest = Math.max(MIN_INTEREST, sum);
  for (const line of multLines) interest *= line.amount;
  return interest;
}

function scoreAs(pitchType: PitchTypeId, input: PitchInput, rng: Rng): PitchResult {
  const { cards, buyer } = input;
  const offerRatio = input.offerRatio ?? OFFER_RATIO_START;
  const showIndex = input.showIndex ?? 1;
  const def = pitchTypeDef(pitchType);

  // --- Value ---------------------------------------------------------------
  const cardValueTotal = totalCardValue(cards);

  // The Flipper prices the cards themselves — the pitch type adds nothing for
  // him. Interest still applies, so a clever pitch of good cards still pays;
  // a clever pitch of junk does not.
  const pricesCardsOnly = buyer.wants.some((w) => w.kind === 'valueOnly');
  const pitchValue = pricesCardsOnly ? 0 : def.value;

  const valueLines: ScoreLine[] = [
    {
      label: pricesCardsOnly ? `${def.label} — not counted` : def.label,
      amount: pitchValue,
      source: 'pitchType',
    },
    { label: `${cards.length} card${cards.length === 1 ? '' : 's'}`, amount: cardValueTotal, source: 'cards' },
  ];

  // --- Interest from wants -------------------------------------------------
  const interestAddLines: ScoreLine[] = [];
  const interestMultLines: ScoreLine[] = [];

  for (const want of buyer.wants) {
    if (want.kind === 'valueOnly') continue; // shapes the offer, adds no interest
    const matches = cardsMatchingWant(cards, want);
    if (matches.length === 0) continue;
    interestAddLines.push({
      label: wantLabel(want, matches.length),
      amount: want.interestPerCard * matches.length,
      source: 'want',
    });
  }

  // --- Interest from the buyer's refusal -----------------------------------
  if (buyer.turnoff && turnoffApplies(cards, buyer)) {
    interestMultLines.push({
      label:
        buyer.turnoff.kind === 'anyRaw'
          ? 'Refuses raw'
          : buyer.turnoff.kind === 'anySlab'
            ? 'Refuses slabs'
            : 'Insulted by beaten cards',
      amount: buyer.turnoff.interestMult,
      source: 'turnoff',
    });
  }

  // --- Modifier hooks ------------------------------------------------------
  const mods = allModifiers(input.upgrades, input.conditions);
  const hooked = runPitchScoreHooks(mods, { cards, buyer, pitchType, showIndex, rng });
  valueLines.push(...hooked.valueLines);
  interestAddLines.push(...hooked.interestAddLines);
  interestMultLines.push(...hooked.interestMultLines);

  // --- Combine -------------------------------------------------------------
  const value = valueLines.reduce((sum, l) => sum + l.amount, 0);
  const interest = combineInterest(def.interest, interestAddLines, interestMultLines);
  const appeal = value * interest;

  const uncappedOffer = appeal * offerRatio;
  const cappedByBudget = uncappedOffer > buyer.budget;
  const cappedOffer = Math.min(uncappedOffer, buyer.budget);

  const finalized = runOfferHooks(mods, {
    cards,
    buyer,
    pitchType,
    showIndex,
    rng,
    appeal,
    offerRatio,
    uncappedOffer,
    cappedOffer,
    cappedByBudget,
  });

  return {
    pitchType,
    pitchTypeLabel: pitchTypeLabel(pitchType, cards.length),
    cardIds: cards.map((c) => c.id),
    pitchValue,
    pitchValueCounted: !pricesCardsOnly,
    cardValue: cardValueTotal,
    valueLines,
    value,
    baseInterest: def.interest,
    interestAddLines,
    interestMultLines,
    interest,
    appeal,
    offerRatio,
    uncappedOffer,
    budget: buyer.budget,
    cappedByBudget,
    offerLines: finalized.offerLines,
    offer: Math.max(0, Math.round(finalized.offer)),
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export class InvalidPitchError extends Error {}

/**
 * Scores a pitch and returns the result for the best-paying valid pitch type.
 *
 * Every candidate type is evaluated in full, including hooks, because a hook
 * can change which type pays best (Rival Vendor rewards matching a type).
 * Each candidate gets its own forked RNG stream keyed by type, so evaluating
 * the alternatives never perturbs the winner's roll.
 */
export function resolvePitch(input: PitchInput): PitchResult {
  const { cards, buyer } = input;

  if (cards.length < MIN_PITCH_CARDS || cards.length > MAX_PITCH_CARDS) {
    throw new InvalidPitchError(
      `A pitch must be ${MIN_PITCH_CARDS}-${MAX_PITCH_CARDS} cards, got ${cards.length}`,
    );
  }
  if (new Set(cards.map((c) => c.id)).size !== cards.length) {
    throw new InvalidPitchError('A pitch cannot contain the same card twice');
  }

  const candidates = detectPitchTypes(cards, buyer);
  const scored = candidates.map((type) => scoreAs(type, input, input.rng.fork(`pitch:${type}`)));

  let best = scored[0];
  if (best === undefined) {
    throw new InvalidPitchError('No valid pitch type; expected looseCards to always apply');
  }
  for (const candidate of scored) {
    if (
      candidate.offer > best.offer ||
      // Tiebreak on the doc's table order so the stronger-sounding type wins.
      (candidate.offer === best.offer &&
        pitchTypeRank(candidate.pitchType) > pitchTypeRank(best.pitchType))
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Convenience for UI previews that only need the headline number. */
export function previewOffer(input: PitchInput): number {
  return resolvePitch(input).offer;
}

export { cardValue };
