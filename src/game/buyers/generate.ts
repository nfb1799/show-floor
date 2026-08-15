import {
  ARCHETYPE_WEIGHTS,
  BUDGET_JITTER,
  CHASE_CARD_CHANCE,
} from '../constants';
import { budgetForShow } from './budget';
import type { Rng } from '../rng';
import type { Buyer, BuyerArchetypeId } from '../types';
import { FRANCHISES } from '../cards/catalog';
import { ARCHETYPES, getArchetype } from './archetypes';
export { budgetForShow } from './budget';

const ARCHETYPE_ENTRIES = ARCHETYPES.map(
  (a) => [a.id, ARCHETYPE_WEIGHTS[a.id]] as [BuyerArchetypeId, number],
);

export function generateBuyer(rng: Rng, showIndex: number, id: string): Buyer {
  const archetypeId = rng.weighted(ARCHETYPE_ENTRIES);
  const def = getArchetype(archetypeId);
  const wants = def.buildWants(rng, showIndex);

  const jitter = 1 + (rng.next() * 2 - 1) * BUDGET_JITTER;
  const budget = Math.max(1, Math.round(budgetForShow(archetypeId, showIndex) * jitter));

  // A Personal Collector's chase card is the subject they already want, so the
  // two demands always line up.
  const wantedSubject = wants.find((w) => w.kind === 'subject')?.subject;
  const chaseCard =
    def.alwaysHasChaseCard && wantedSubject !== undefined
      ? wantedSubject
      : rng.next() < CHASE_CARD_CHANCE
        ? rng.pick(rng.pick(FRANCHISES).subjects)
        : undefined;

  return {
    id,
    archetype: archetypeId,
    label: def.label,
    budget,
    wants,
    ...(def.turnoff ? { turnoff: def.turnoff } : {}),
    ...(chaseCard !== undefined ? { chaseCard } : {}),
  };
}

export function generateBuyers(
  rng: Rng,
  showIndex: number,
  count: number,
  idPrefix: string,
): Buyer[] {
  return Array.from({ length: count }, (_, i) =>
    generateBuyer(rng, showIndex, `${idPrefix}-${i}`),
  );
}
