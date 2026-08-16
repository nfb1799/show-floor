/**
 * The scripted show the walkthrough plays on.
 *
 * Everything here is hand-picked rather than rolled, because the walkthrough
 * teaches by pointing at specific cards: "add that one and watch the number
 * move". A seeded draw could produce a case with no Pair in it and the script
 * would be talking about cards that are not there.
 *
 * It is still the real engine — these are ordinary Cards and Buyers fed
 * through createShow, so anything the player does here behaves exactly as it
 * will in a real run.
 */

import { GRADER_MIN_CONDITION, REFUSAL_INTEREST_MULT } from '../constants';
import { createShow, type ShowDeps, type ShowState } from '../show/showEngine';
import type { Buyer, Card } from '../types';

export const WALKTHROUGH_SEED = 'walkthrough';
export const WALKTHROUGH_BANKROLL = 100;

/**
 * The scripted pitches pay about $560 across the three buyers. The quota sits
 * under that: the walkthrough should end on a cleared show, because the last
 * thing it does is hand the player the shop.
 */
export const WALKTHROUGH_QUOTA = 400;

/** Ids the step script points at. Named so a typo is a type error. */
export const W = {
  lich: 'w-gr-12',
  golem: 'w-gr-13',
  bloom: 'w-gr-14',
  dell: 'w-hw-43',
  vance: 'w-hw-44',
  ruiz: 'w-hw-57',
  slab: 'w-dl-88',
  pup: 'w-pb-30',
  /** In stock, never in the case: the card the third buyer has to be dug for. */
  origin: 'w-pb-origin-4',
} as const;

/**
 * Eight cards carrying every lesson the script needs: three Grimoire cards for
 * the collector (two of them a Pair, all three a Set Run), two clean Hardwood
 * raws for the grader, a beaten Hardwood raw that earns nothing from them, a
 * slab the grader actively refuses, and a junk common to hand back when the
 * third buyer sends you digging.
 */
export const WALKTHROUGH_CASE: readonly Card[] = [
  {
    id: W.lich,
    subject: 'Ashen Lich',
    franchise: 'grimoire',
    setId: 'gr-codex',
    setNumber: 12,
    rarity: 'rare',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: W.golem,
    subject: 'Rune Golem',
    franchise: 'grimoire',
    setId: 'gr-codex',
    setNumber: 13,
    rarity: 'rare',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: W.bloom,
    subject: 'Gravebloom',
    franchise: 'grimoire',
    setId: 'gr-codex',
    setNumber: 14,
    rarity: 'rareHolo',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: W.dell,
    subject: 'Marcus Dell',
    franchise: 'hardwood',
    setId: 'hw-89',
    setNumber: 43,
    rarity: 'rare',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: W.vance,
    subject: 'Tyrone Vance',
    franchise: 'hardwood',
    setId: 'hw-89',
    setNumber: 44,
    rarity: 'rare',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: W.ruiz,
    subject: 'Bobby Ruiz',
    franchise: 'hardwood',
    setId: 'hw-89',
    // Deliberately not 45: consecutive with the other two it would make a Set
    // Run, and the pitch-type bonus would soften the refusal into a shrug.
    setNumber: 57,
    rarity: 'rare',
    slabbed: false,
    condition: 'played',
  },
  {
    id: W.slab,
    subject: 'Ramon Cruz',
    franchise: 'diamondLeague',
    setId: 'dl-84',
    setNumber: 88,
    rarity: 'uncommon',
    slabbed: true,
    grade: 9,
  },
  {
    id: W.pup,
    subject: 'Bramblepup',
    franchise: 'pocketBeasts',
    setId: 'pb-storm',
    setNumber: 30,
    rarity: 'common',
    slabbed: false,
    condition: 'lightlyPlayed',
  },
];

/**
 * Refills after each sale come from here, so the case never runs short. The
 * Origin Set card is the point of the third buyer: it is the only thing in the
 * run that satisfies them, and it is never in the case, so the only way to sell
 * it is to dig.
 */
export const WALKTHROUGH_RESERVE: readonly Card[] = [
  {
    id: W.origin,
    subject: 'Emberclaw',
    franchise: 'pocketBeasts',
    setId: 'pb-origin',
    setNumber: 4,
    rarity: 'rareHolo',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: 'w-res-1',
    subject: 'Tidecaller',
    franchise: 'grimoire',
    setId: 'gr-ledger',
    setNumber: 21,
    rarity: 'uncommon',
    slabbed: false,
    condition: 'nearMint',
  },
  {
    id: 'w-res-2',
    subject: 'Nico Barsanti',
    franchise: 'chromeRacers',
    setId: 'cr-s1',
    setNumber: 22,
    rarity: 'common',
    slabbed: false,
    condition: 'played',
  },
  {
    id: 'w-res-3',
    subject: 'Hal Brennan',
    franchise: 'diamondLeague',
    setId: 'dl-76',
    setNumber: 7,
    rarity: 'rare',
    slabbed: false,
    condition: 'lightlyPlayed',
  },
  {
    id: 'w-res-4',
    subject: 'Sparkmite',
    franchise: 'pocketBeasts',
    setId: 'pb-origin',
    setNumber: 51,
    rarity: 'uncommon',
    slabbed: false,
    condition: 'mint',
  },
  {
    id: 'w-res-5',
    subject: 'Ellis Trammell',
    franchise: 'hardwood',
    setId: 'hw-92',
    setNumber: 75,
    rarity: 'rareHolo',
    slabbed: false,
    condition: 'lightlyPlayed',
  },
  {
    id: 'w-res-6',
    subject: 'Oathbreaker',
    franchise: 'grimoire',
    setId: 'gr-codex',
    setNumber: 60,
    rarity: 'rare',
    slabbed: false,
    condition: 'nearMint',
  },
];

/**
 * Three buyers, each teaching one thing: a collector who pays for a franchise
 * you are deep in, a grader who refuses slabs outright, and a set builder who
 * wants a card that is not in the case at all — the only way to sell to them is
 * to dig for it.
 */
export const WALKTHROUGH_BUYERS: readonly Buyer[] = [
  {
    id: 'w-buyer-1',
    archetype: 'personalCollector',
    label: 'Personal Collector',
    budget: 210,
    wants: [{ kind: 'franchise', franchiseId: 'grimoire', interestPerCard: 4 }],
  },
  {
    id: 'w-buyer-2',
    archetype: 'grader',
    label: 'Grader',
    // Deliberately deep-pocketed. The grader's beat is the refusal, and a
    // capped offer hides it: with a small wallet the pitch pays the same
    // whether or not the beaten card is in it, and the lesson evaporates.
    budget: 320,
    wants: [{ kind: 'rawMinCondition', minCondition: GRADER_MIN_CONDITION, interestPerCard: 5 }],
    turnoff: { kind: 'anySlab', interestMult: REFUSAL_INTEREST_MULT },
  },
  {
    id: 'w-buyer-3',
    archetype: 'setBuilder',
    label: 'Set Builder',
    budget: 260,
    // Nothing in the opening case is from this set, and the refill cannot fix
    // that either: the one card that matches is held back in stock.
    wants: [{ kind: 'fromSets', setIds: ['pb-origin'], interestPerCard: 6 }],
  },
];

/**
 * A real show with the scripted contents dropped in. createShow does the
 * config and the bookkeeping; the case, the stock and the queue are then
 * replaced wholesale so nothing about the walkthrough depends on a roll.
 */
export function walkthroughShow(deps: ShowDeps): ShowState {
  const base = createShow(1, [...WALKTHROUGH_CASE, ...WALKTHROUGH_RESERVE], deps);

  return {
    ...base,
    config: {
      ...base.config,
      quota: WALKTHROUGH_QUOTA,
      buyerCount: WALKTHROUGH_BUYERS.length,
      conditionIds: [],
    },
    displayCase: [...WALKTHROUGH_CASE],
    inventory: [...WALKTHROUGH_RESERVE],
    lockedCardIds: [],
    selection: [],
    queue: [...WALKTHROUGH_BUYERS],
    queueIndex: 0,
    buyer: WALKTHROUGH_BUYERS[0]!,
    log: [],
    logSeq: 0,
  };
}
