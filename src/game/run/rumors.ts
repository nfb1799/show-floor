/**
 * Setup-phase rumours: one partial, truthful fact about the crowd.
 *
 * The buyer queue is generated from a per-show RNG fork, so the rumour can be
 * computed during setup and still describe the buyers who actually turn up.
 */

import { BUYERS_PER_SHOW } from '../constants';
import { generateBuyer } from '../buyers/generate';
import type { Rng } from '../rng';
import type { BuyerArchetypeId } from '../types';

/** The stream the show's buyer queue is drawn from. */
export function queueRng(rng: Rng, showIndex: number): Rng {
  return rng.fork(`queue:${showIndex}`);
}

/**
 * Archetypes of the first few buyers. Reads the same fork the show will use,
 * so this is a peek rather than a guess.
 */
export function peekArchetypes(rng: Rng, showIndex: number, count = BUYERS_PER_SHOW): BuyerArchetypeId[] {
  const peek = queueRng(rng, showIndex);
  return Array.from(
    { length: count },
    (_, i) => generateBuyer(peek, showIndex, `peek-${i}`).archetype,
  );
}

interface RumorRule {
  readonly test: (counts: Partial<Record<BuyerArchetypeId, number>>) => boolean;
  readonly text: string;
}

const RULES: readonly RumorRule[] = [
  {
    test: (c) => (c.investor ?? 0) >= 2,
    text: 'Word is the investors are out in force.',
  },
  {
    test: (c) => (c.nostalgia ?? 0) >= 2,
    text: 'Heavy vintage turnout expected.',
  },
  {
    test: (c) => (c.kid ?? 0) + (c.bulkGuy ?? 0) >= 3,
    text: 'Family day — expect a young crowd.',
  },
  {
    test: (c) => (c.grader ?? 0) + (c.investor ?? 0) >= 3,
    text: "Everybody's going to want to talk about grades.",
  },
  {
    test: (c) => (c.setBuilder ?? 0) >= 2,
    text: 'A lot of people are chasing set completion this weekend.',
  },
  {
    test: (c) => (c.typeCollector ?? 0) >= 2,
    text: 'Type set builders are out today. Bring variety.',
  },
  {
    test: (c) => (c.personalCollector ?? 0) >= 2,
    text: 'Hearing a few people are hunting one franchise in particular.',
  },
  {
    test: (c) => (c.kid ?? 0) >= 2,
    text: 'Someone booked a birthday party in the next hall.',
  },
];

export function rollRumor(rng: Rng, showIndex: number): string {
  const archetypes = peekArchetypes(rng, showIndex);
  const counts: Partial<Record<BuyerArchetypeId, number>> = {};
  for (const a of archetypes) counts[a] = (counts[a] ?? 0) + 1;

  for (const rule of RULES) {
    if (rule.test(counts)) return rule.text;
  }
  return 'Mixed crowd. Nothing unusual on the floor.';
}

export const ARCHETYPE_RUMOR_LABEL = 'Price Guide says';
