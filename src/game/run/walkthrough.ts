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
 * Both scripted buyers cap out, so the show pays about $350. The quota is set
 * under that: the walkthrough should end on a cleared show, because the last
 * thing it does is hand the player the shop.
 */
export const WALKTHROUGH_QUOTA = 300;

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
} as const;

/**
 * Eight cards carrying every lesson the script needs: three Grimoire cards for
 * the collector (two of them a Pair, all three a Set Run), two clean Hardwood
 * raws for the grader, one beaten Hardwood raw as the trap that shows a
 * turnoff biting, and a slab and a junk common as the cards that never fit.
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

/** Refills after each sale come from here, so the case never runs short. */
export const WALKTHROUGH_RESERVE: readonly Card[] = [
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
 * Two buyers, chosen for contrast: one who pays for a franchise you happen to
 * be deep in, and one whose refusal punishes a single bad card. Budgets are
 * large enough that the pitch, not the wallet, is what the player is reading —
 * though both still cap, which is a lesson of its own.
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
    turnoff: {
      kind: 'rawBelowCondition',
      minCondition: GRADER_MIN_CONDITION,
      interestMult: REFUSAL_INTEREST_MULT,
    },
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
