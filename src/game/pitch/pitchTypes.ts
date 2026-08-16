/**
 * Pitch type detection.
 *
 * Detection depends on the buyer, not just the cards, because The Grail is
 * defined against the buyer's named chase card.
 */

import {
  GRADED_RUN_MIN_CARDS,
  GRADED_RUN_REQUIRE_SAME_FRANCHISE,
  HOLO_MIN_RARITY,
  LOOSE_SINGLE_LABEL,
  MAX_PITCH_CARDS,
  MIN_PITCH_CARDS,
  PITCH_TYPES,
  RAINBOW_MIN_CARDS,
  RAINBOW_MIN_RARITY,
  SET_RUN_MAX_GAPS,
  SET_RUN_MIN_CARDS,
  SHARED_ATTRIBUTES,
  type PitchTypeDef,
} from '../constants';
import type { Buyer, Card, PitchTypeId } from '../types';
import { isHolo, rarityRank } from '../cards/value';

const DEFS_BY_ID = new Map<PitchTypeId, PitchTypeDef>(PITCH_TYPES.map((t) => [t.id, t]));

export function pitchTypeDef(id: PitchTypeId): PitchTypeDef {
  const def = DEFS_BY_ID.get(id);
  if (!def) throw new Error(`Unknown pitch type: ${id}`);
  return def;
}

/**
 * Position in the design doc's table, weakest first. Used only as a tiebreak
 * when two valid types produce the same offer.
 */
export function pitchTypeRank(id: PitchTypeId): number {
  return PITCH_TYPES.findIndex((t) => t.id === id);
}

export function pitchTypeLabel(id: PitchTypeId, cardCount: number): string {
  if (id === 'looseCards' && cardCount === 1) return LOOSE_SINGLE_LABEL;
  return pitchTypeDef(id).label;
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

function allSame<T>(values: readonly T[]): boolean {
  if (values.length === 0) return false;
  const first = values[0];
  return values.every((v) => v === first);
}

function allDistinct<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

/** True if every card matches on at least one of the shared-attribute keys. */
function sharesAnyAttribute(cards: readonly Card[]): boolean {
  return SHARED_ATTRIBUTES.some((attr) => allSame(cards.map((c) => c[attr])));
}

/**
 * A run of set numbers, allowing SET_RUN_MAX_GAPS missing ones. Measured as the
 * span rather than step by step: three cards spanning four numbers have exactly
 * one hole in them, wherever it falls.
 */
function isConsecutiveRun(numbers: readonly number[]): boolean {
  if (numbers.length < 2) return false;
  if (!allDistinct(numbers)) return false;

  const sorted = [...numbers].sort((a, b) => a - b);
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];
  if (lowest === undefined || highest === undefined) return false;

  const span = highest - lowest + 1;
  return span - numbers.length <= SET_RUN_MAX_GAPS;
}

const isPair = (cards: readonly Card[]): boolean =>
  cards.length === 2 && sharesAnyAttribute(cards);

const isBundle = (cards: readonly Card[]): boolean =>
  cards.length === 3 && sharesAnyAttribute(cards);

const isRainbow = (cards: readonly Card[]): boolean =>
  cards.length >= RAINBOW_MIN_CARDS &&
  allDistinct(cards.map((c) => c.subject)) &&
  allSame(cards.map((c) => c.rarity)) &&
  rarityRank(cards[0]!.rarity) >= rarityRank(RAINBOW_MIN_RARITY);

const isPlayset = (cards: readonly Card[]): boolean =>
  cards.length === 4 && allSame(cards.map((c) => c.subject));

const isSetRun = (cards: readonly Card[]): boolean =>
  cards.length >= SET_RUN_MIN_CARDS &&
  allSame(cards.map((c) => c.setId)) &&
  isConsecutiveRun(cards.map((c) => c.setNumber));

const isFullCase = (cards: readonly Card[]): boolean =>
  cards.length === MAX_PITCH_CARDS && allSame(cards.map((c) => c.franchise));

/**
 * "3+ slabs, ascending grades". Since the player controls pitch order, that
 * reduces to distinct grades; the franchise requirement is what keeps it from
 * being strictly easier than Set Run while scoring higher.
 */
function isGradedRun(cards: readonly Card[]): boolean {
  if (cards.length < GRADED_RUN_MIN_CARDS) return false;
  if (!cards.every((c) => c.slabbed)) return false;
  if (GRADED_RUN_REQUIRE_SAME_FRANCHISE && !allSame(cards.map((c) => c.franchise))) return false;
  return allDistinct(cards.map((c) => (c.slabbed ? c.grade : -1)));
}

const isHoloWall = (cards: readonly Card[]): boolean =>
  cards.length === MAX_PITCH_CARDS &&
  cards.every((c) => rarityRank(c.rarity) >= rarityRank(HOLO_MIN_RARITY));

function isGrail(cards: readonly Card[], buyer: Buyer): boolean {
  if (cards.length !== MAX_PITCH_CARDS) return false;
  if (!buyer.chaseCard) return false;
  if (!allSame(cards.map((c) => c.franchise))) return false;
  return cards.some((c) => c.subject === buyer.chaseCard);
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

export function isValidPitchSize(cards: readonly Card[]): boolean {
  return cards.length >= MIN_PITCH_CARDS && cards.length <= MAX_PITCH_CARDS;
}

/**
 * Every type the given cards legally qualify as, in table order. `looseCards`
 * is always present for a legally sized pitch, which guarantees that no card
 * selection is ever unscoreable.
 */
export function detectPitchTypes(cards: readonly Card[], buyer: Buyer): PitchTypeId[] {
  if (!isValidPitchSize(cards)) return [];

  const found: PitchTypeId[] = ['looseCards'];
  if (isPair(cards)) found.push('pair');
  if (isBundle(cards)) found.push('bundle');
  if (isRainbow(cards)) found.push('rainbow');
  if (isPlayset(cards)) found.push('playset');
  if (isSetRun(cards)) found.push('setRun');
  if (isFullCase(cards)) found.push('fullCase');
  if (isGradedRun(cards)) found.push('gradedRun');
  if (isHoloWall(cards)) found.push('holoWall');
  if (isGrail(cards, buyer)) found.push('grail');
  return found;
}

/** Re-exported so the UI can badge holo cards without reaching into value.ts. */
export { isHolo };
