/**
 * Buyer archetypes as data. Each one resolves its demands to concrete Wants at
 * generation time, so scoring never needs the set registry or a lookup table
 * keyed by archetype.
 */

import {
  BULK_GUY_MIN_CARDS,
  FLIPPER_VALUE_FRACTION,
  GRADER_MIN_CONDITION,
  INVESTOR_MIN_GRADE,
  REFUSAL_INTEREST_MULT,
  WANT_INTEREST,
} from '../constants';
import type { Rng } from '../rng';
import type { BuyerArchetypeId, Turnoff, Want } from '../types';
import { FRANCHISES, SETS, vintageSetIds } from '../cards/catalog';
import { budgetForShow } from './budget';

export interface ArchetypeDef {
  readonly id: BuyerArchetypeId;
  readonly label: string;
  /** One line of player-facing explanation. */
  readonly blurb: string;
  readonly buildWants: (rng: Rng, showIndex: number) => Want[];
  readonly turnoff?: Turnoff;
  /** Personal Collectors always name the subject they are hunting. */
  readonly alwaysHasChaseCard?: boolean;
}

const REFUSES_SLABS: Turnoff = { kind: 'anySlab', interestMult: REFUSAL_INTEREST_MULT };
const REFUSES_RAW: Turnoff = { kind: 'anyRaw', interestMult: REFUSAL_INTEREST_MULT };

export const ARCHETYPES: readonly ArchetypeDef[] = [
  {
    id: 'setBuilder',
    label: 'Set Builder',
    blurb: 'Filling one set. Will not touch slabs.',
    buildWants: (rng) => [
      {
        kind: 'fromSets',
        setIds: [rng.pick(SETS).id],
        interestPerCard: WANT_INTEREST.setBuilder,
      },
    ],
    // Section 3's raw/slab table gives Set Builders a slab refusal that the
    // archetype table in section 5 drops. The refusal is the more interesting
    // read and keeps raw cards relevant.
    turnoff: REFUSES_SLABS,
  },
  {
    id: 'personalCollector',
    label: 'Personal Collector',
    blurb: 'Hunting one subject and nothing else.',
    buildWants: (rng) => [
      {
        kind: 'subject',
        subject: rng.pick(rng.pick(FRANCHISES).subjects),
        interestPerCard: WANT_INTEREST.personalCollector,
      },
    ],
    alwaysHasChaseCard: true,
  },
  {
    id: 'flipper',
    label: 'Flipper',
    blurb: 'Buying to resell. Only real money interests him.',
    // The bar is a fraction of his own budget, so it climbs with the run
    // without the archetype needing its own escalation curve.
    buildWants: (_rng, showIndex) => [
      {
        kind: 'minCardValue',
        minValue: Math.max(
          5,
          Math.round(budgetForShow('flipper', showIndex) * FLIPPER_VALUE_FRACTION),
        ),
        interestPerCard: WANT_INTEREST.flipper,
      },
    ],
  },
  {
    id: 'grader',
    label: 'Grader',
    blurb: 'Looking for raw cards clean enough to submit. Beaten ones insult them.',
    buildWants: () => [
      {
        kind: 'rawMinCondition',
        minCondition: GRADER_MIN_CONDITION,
        interestPerCard: WANT_INTEREST.grader,
      },
    ],
    // He is buying to submit for grading, so a played card is not merely
    // unwanted — it is a waste of his time.
    turnoff: {
      kind: 'rawBelowCondition',
      minCondition: GRADER_MIN_CONDITION,
      interestMult: REFUSAL_INTEREST_MULT,
    },
  },
  {
    id: 'investor',
    label: 'Investor',
    blurb: 'High grades only. Raw cards kill the deal.',
    buildWants: () => [
      {
        kind: 'minGrade',
        minGrade: INVESTOR_MIN_GRADE,
        interestPerCard: WANT_INTEREST.investor,
      },
    ],
    turnoff: REFUSES_RAW,
  },
  {
    id: 'kid',
    // Named "Kid with $20" in the doc, but the budget scales with the run like
    // every other archetype, so the label stays generic.
    label: 'Kid',
    blurb: 'Wants anything shiny. Slabs are boring.',
    buildWants: () => [{ kind: 'holo', interestPerCard: WANT_INTEREST.kid }],
    turnoff: REFUSES_SLABS,
  },
  {
    id: 'bulkGuy',
    label: 'Bulk Guy',
    blurb: 'Buys by the stack. Rewards big pitches.',
    buildWants: () => [
      {
        kind: 'volume',
        minCards: BULK_GUY_MIN_CARDS,
        interestPerCard: WANT_INTEREST.bulkGuy,
      },
    ],
  },
  {
    id: 'nostalgia',
    label: 'Nostalgia Buyer',
    blurb: 'Only cares about the old stuff.',
    buildWants: () => [
      {
        kind: 'fromSets',
        setIds: vintageSetIds(),
        interestPerCard: WANT_INTEREST.nostalgia,
      },
    ],
  },
];

const BY_ID = new Map(ARCHETYPES.map((a) => [a.id, a]));

export function getArchetype(id: BuyerArchetypeId): ArchetypeDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown archetype: ${id}`);
  return found;
}
