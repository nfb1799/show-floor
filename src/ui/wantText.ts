/** Player-facing phrasing for buyer demands. Presentation only. */

import { getFranchise, getSet } from '../game/cards/catalog';
import {
  CONDITION_NAME,
  FRANCHISE_MARK,
  FRANCHISE_MARK_LABEL,
  SET_MARK,
  SET_MARK_LABEL,
} from './card/artSpec';
import { VINTAGE_YEAR_CUTOFF } from '../game/constants';
import type { Turnoff, Want } from '../game/types';

/**
 * The mark to print in front of a want, matching the one on the card line it
 * refers to. "Cards from Storm Cycle" gave no clue whether Storm Cycle was a
 * set or a franchise, so digging meant reading both fields on every card.
 */
export function wantMark(want: Want): { mark: string; label: string } | null {
  switch (want.kind) {
    case 'fromSets':
      // The vintage want spans many sets, so there is no single set to point at.
      return want.setIds.length === 1 ? { mark: SET_MARK, label: SET_MARK_LABEL } : null;
    case 'franchise':
      return { mark: FRANCHISE_MARK, label: FRANCHISE_MARK_LABEL };
    default:
      return null;
  }
}

export function describeWant(want: Want): string {
  switch (want.kind) {
    case 'fromSets':
      // Naming the actual sets matters: "vintage" is meaningless unless the
      // player can tell which cards qualify. Card faces print the set year.
      return want.setIds.length === 1 && want.setIds[0] !== undefined
        ? `Cards from ${getSet(want.setIds[0]).name}`
        : `Anything printed ${VINTAGE_YEAR_CUTOFF} or earlier`;
    case 'franchise':
      return `${getFranchise(want.franchiseId).name} cards`;
    case 'rawMinCondition':
      return `Raw cards, ${CONDITION_NAME[want.minCondition]} or better`;
    case 'minGrade':
      return `Slabs graded ${want.minGrade}+`;
    case 'holo':
      return 'Anything holo';
    case 'volume':
      return `Pitches of ${want.minCards}+ cards`;
    case 'distinctFranchises':
      return 'One card from each different franchise';
  }
}

export function wantBonus(want: Want): string {
  if (want.kind === 'distinctFranchises') return `+${want.interestPerCard} per franchise`;
  return `+${want.interestPerCard} each`;
}

/** Long-form explanation, shown under the buyer where there is room. */
export function explainWant(want: Want): string | null {
  switch (want.kind) {
    case 'distinctFranchises':
      return 'They are building one of everything, so only the first card of each franchise counts. Five different franchises beats five of the same one.';
    case 'fromSets':
      return want.setIds.length > 1
        ? 'Every card face prints its set year — anything at or under the cutoff counts.'
        : null;
    default:
      return null;
  }
}

/**
 * Exhaustive on purpose. The old version was a ternary with an else branch, so
 * a third turnoff kind was silently described as "Any slab" — the chip and the
 * rules disagreed and the player had no way to tell which was lying.
 */
export function describeTurnoff(turnoff: Turnoff): string {
  switch (turnoff.kind) {
    case 'anyRaw':
      return `Any raw card: x${turnoff.interestMult} Interest`;
    case 'anySlab':
      return `Any graded slab: x${turnoff.interestMult} Interest`;
  }
}
