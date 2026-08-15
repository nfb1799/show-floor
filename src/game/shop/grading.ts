/**
 * Grading: the bridge between raw and slab, and a real risk.
 *
 * Concentrates value into fewer cards and locks the card out of half the buyer
 * pool (Set Builders and Kids refuse slabs), so a well-graded case can whiff
 * badly against a casual crowd.
 */

import { GRADE_ROLL, GRADING_FEE_BASE, GRADING_FEE_VALUE_PCT } from '../constants';
import { cardValue } from '../cards/value';
import type { Rng } from '../rng';
import type { Card, Condition, RawCard, SlabCard } from '../types';

export function gradingFee(card: RawCard): number {
  return Math.round(GRADING_FEE_BASE + cardValue(card) * GRADING_FEE_VALUE_PCT);
}

export function rollGrade(condition: Condition, rng: Rng): number {
  return rng.weighted(GRADE_ROLL[condition]);
}

/** Builds the slab a raw card would become at a given grade. */
export function asSlab(card: RawCard, grade: number): SlabCard {
  return {
    id: card.id,
    subject: card.subject,
    franchise: card.franchise,
    setId: card.setId,
    setNumber: card.setNumber,
    rarity: card.rarity,
    slabbed: true,
    grade,
  };
}

/** Submits a raw card and gets a slab back. The grade is the unknown. */
export function gradeCard(card: RawCard, rng: Rng): SlabCard {
  return asSlab(card, rollGrade(card.condition, rng));
}

/** Best- and worst-case value, for showing the player what they are betting on. */
export function gradingOutcomeRange(card: RawCard): { low: number; high: number } {
  const values = GRADE_ROLL[card.condition].map(([grade]) => cardValue(asSlab(card, grade)));
  return { low: Math.min(...values), high: Math.max(...values) };
}

export function isRaw(card: Card): card is RawCard {
  return !card.slabbed;
}
