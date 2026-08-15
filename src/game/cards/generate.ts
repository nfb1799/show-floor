import {
  CONDITION_WEIGHTS,
  GRADE_WEIGHTS,
  RARITY_WEIGHTS,
  SLAB_CHANCE,
} from '../constants';
import type { Rng } from '../rng';
import type { Card, Condition, Rarity } from '../types';
import { FRANCHISES, setsForFranchise } from './catalog';

const RARITY_ENTRIES = Object.entries(RARITY_WEIGHTS) as [Rarity, number][];
const CONDITION_ENTRIES = Object.entries(CONDITION_WEIGHTS) as [Condition, number][];
const GRADE_ENTRIES = Object.entries(GRADE_WEIGHTS).map(
  ([grade, weight]) => [Number(grade), weight] as [number, number],
);

/**
 * Ids are supplied by the caller rather than generated from a module counter,
 * so a given seed always produces byte-identical cards.
 */
export function generateCard(rng: Rng, id: string): Card {
  const franchise = rng.pick(FRANCHISES);
  const set = rng.pick(setsForFranchise(franchise.id));
  const subject = rng.pick(franchise.subjects);
  const rarity = rng.weighted(RARITY_ENTRIES);
  const setNumber = rng.int(1, set.size);
  const slabbed = rng.next() < SLAB_CHANCE;

  const base = {
    id,
    subject,
    franchise: franchise.id,
    setId: set.id,
    setNumber,
    rarity,
  };

  return slabbed
    ? { ...base, slabbed: true, grade: rng.weighted(GRADE_ENTRIES) }
    : { ...base, slabbed: false, condition: rng.weighted(CONDITION_ENTRIES) };
}

/** `idPrefix` keeps cards from different sources (start, shop, packs) distinct. */
export function generateCards(rng: Rng, count: number, idPrefix: string): Card[] {
  return Array.from({ length: count }, (_, i) => generateCard(rng, `${idPrefix}-${i}`));
}
