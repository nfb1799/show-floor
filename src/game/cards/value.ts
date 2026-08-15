import {
  CONDITION_MULT,
  CONDITION_ORDER,
  GRADE_MULT,
  GRADE_MULT_FLOOR,
  GRADE_MULT_FLOOR_AT,
  HOLO_MIN_RARITY,
  RARITY_BASE,
  RARITY_ORDER,
} from '../constants';
import type { Card, Condition, Rarity } from '../types';

export function rarityRank(rarity: Rarity): number {
  return RARITY_ORDER.indexOf(rarity);
}

export function conditionRank(condition: Condition): number {
  return CONDITION_ORDER.indexOf(condition);
}

/**
 * The design doc renders holo as a foil treatment rather than a separate
 * label, so "holo" is a property of the rarity tier: rareHolo and above.
 */
export function isHolo(rarity: Rarity): boolean {
  return rarityRank(rarity) >= rarityRank(HOLO_MIN_RARITY);
}

export function gradeMultiplier(grade: number): number {
  if (grade <= GRADE_MULT_FLOOR_AT) return GRADE_MULT_FLOOR;
  return GRADE_MULT[grade] ?? GRADE_MULT_FLOOR;
}

export function conditionMultiplier(condition: Condition): number {
  return CONDITION_MULT[condition];
}

export function rarityBase(rarity: Rarity): number {
  return RARITY_BASE[rarity];
}

/** Value is always computed, never authored on the card. */
export function cardValue(card: Card): number {
  const base = rarityBase(card.rarity);
  return card.slabbed
    ? base * gradeMultiplier(card.grade)
    : base * conditionMultiplier(card.condition);
}

export function totalCardValue(cards: readonly Card[]): number {
  let sum = 0;
  for (const card of cards) sum += cardValue(card);
  return sum;
}

/** Display helper. All internal math stays in floats until the final offer. */
export function formatMoney(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}
